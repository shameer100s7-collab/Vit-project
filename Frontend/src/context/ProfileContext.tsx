import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { profileService, TradingProfile } from '../api/profileService';
import { useAuth } from './AuthContext';

interface ProfileContextType {
  profile: TradingProfile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (profile: TradingProfile) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<TradingProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async () => {
    if (!isAuthenticated) {
      setProfile(null);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const data = await profileService.getProfile();
      setProfile(data);
    } catch (error) {
      console.error('Failed to load profile', error);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [isAuthenticated]);

  const updateProfile = async (newProfile: TradingProfile) => {
    const updated = await profileService.updateProfile(newProfile);
    setProfile(updated);
  };

  return (
    <ProfileContext.Provider value={{ profile, isLoading, refreshProfile: fetchProfile, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
