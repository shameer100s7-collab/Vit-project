import { useState, useEffect } from 'react';
import { livePriceService } from '../api';

export function useLivePrice(symbol: string, initialPrice: number | null = null) {
  const [livePrice, setLivePrice] = useState<number | null>(initialPrice);

  useEffect(() => {
    // Reset live price when symbol changes, optionally seed it with a newly provided initialPrice later
    setLivePrice(initialPrice);
    
    if (!symbol) return;

    const handlePriceUpdate = (newPrice: number) => {
      setLivePrice(newPrice);
    };

    livePriceService.subscribe(symbol, handlePriceUpdate);

    return () => {
      livePriceService.unsubscribe(symbol, handlePriceUpdate);
    };
  }, [symbol, initialPrice]);

  return livePrice;
}
