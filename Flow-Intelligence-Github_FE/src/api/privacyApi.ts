import { apiClient } from "../services/axiosClient";

export interface PrivacySettingsData {
  _id?: string;
  repositoryId: string;
  pseudonymizeContributors: boolean;
  minimumGroupSize: number;
  excludeRawComments: boolean;
  excludeRawCode: boolean;
}

export const privacyApi = {
  getSettings: async (repositoryId: string): Promise<PrivacySettingsData> => {
    const res = await apiClient.get<{ success: boolean; data: PrivacySettingsData }>(`/repositories/${repositoryId}/privacy`);
    return res.data.data;
  },
  updateSettings: async (repositoryId: string, data: Partial<PrivacySettingsData>): Promise<PrivacySettingsData> => {
    const res = await apiClient.put<{ success: boolean; data: PrivacySettingsData }>(`/repositories/${repositoryId}/privacy`, data);
    return res.data.data;
  },
};
