import { apiClient } from "../services/axiosClient";

export interface BriefItem {
  type: string;
  title: string;
  detail: string;
  severity: "high" | "medium" | "low" | "info";
  evidenceCardIds: string[];
}

export interface AiBriefData {
  _id: string;
  repositoryId: string;
  windowStart: string;
  windowEnd: string;
  status: "generating" | "completed" | "failed" | "fallback";
  summary: string;
  confidence: "high" | "medium" | "low";
  limitations: string[];
  items: BriefItem[];
  isFallback: boolean;
  createdAt: string;
}

export interface NotificationSettingsPayload {
  slackWebhookUrl?: string;
  scheduleEnabled?: boolean;
  scheduleDay?: string;
  scheduleTime?: string;
}

export const briefApi = {
  generateBrief: async (repositoryId: string, windowStart?: string, windowEnd?: string): Promise<AiBriefData> => {
    const res = await apiClient.post<{ success: boolean; data: AiBriefData }>(`/repositories/${repositoryId}/briefs/generate`, {
      windowStart,
      windowEnd,
    });
    return res.data.data;
  },
  getBriefs: async (repositoryId: string): Promise<AiBriefData[]> => {
    const res = await apiClient.get<{ success: boolean; data: AiBriefData[] }>(`/repositories/${repositoryId}/briefs`);
    return res.data.data;
  },
  updateNotificationSettings: async (
    repositoryId: string,
    payload: string | NotificationSettingsPayload
  ): Promise<any> => {
    const body = typeof payload === "string" ? { slackWebhookUrl: payload } : payload;
    const res = await apiClient.patch<{ success: boolean; data: any }>(`/repositories/${repositoryId}/notification-settings`, body);
    return res.data.data;
  },
  sendBriefNotification: async (repositoryId: string, payload?: { recipients?: string[]; slackWebhookUrl?: string }): Promise<any> => {
    const res = await apiClient.post<{ success: boolean; message: string; data: any }>(`/repositories/${repositoryId}/briefs/send-notification`, payload || {});
    return res.data;
  },
};
