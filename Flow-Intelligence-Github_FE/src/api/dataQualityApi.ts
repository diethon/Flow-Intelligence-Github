import { apiClient } from "../services/axiosClient";

export interface DataQualityData {
  score: number;
  status: "GOOD" | "PARTIAL" | "POOR";
  missingData: string[];
  lastSync: string | null;
}

export const dataQualityApi = {
  getQuality: async (repositoryId: string): Promise<DataQualityData> => {
    const res = await apiClient.get<{ success: boolean; data: DataQualityData }>(`/repositories/${repositoryId}/data-quality`);
    return res.data.data;
  },
};
