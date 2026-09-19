import { api } from './client';
import { CourtroomCase, CourtroomCaseCreate } from '../types';

export const courtroomApi = {
  /**
   * POST /api/v1/courtroom/cases
   * Convenes an adversarial Courtroom session against a user thesis.
   */
  createCase: (payload: CourtroomCaseCreate) =>
    api.post<CourtroomCase>('/api/v1/courtroom/cases', payload),

  /**
   * GET /api/v1/courtroom/cases/{caseId}
   * Retrieves an existing Courtroom case by its ID.
   */
  getCase: (caseId: string) =>
    api.get<CourtroomCase>(`/api/v1/courtroom/cases/${encodeURIComponent(caseId)}`),

  /**
   * GET /api/v1/courtroom/cases
   * Lists recent Courtroom cases.
   */
  getCases: (limit: number = 10) =>
    api.get<CourtroomCase[]>(`/api/v1/courtroom/cases?limit=${limit}`),
};
