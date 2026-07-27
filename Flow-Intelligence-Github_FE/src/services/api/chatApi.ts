import { apiClient } from '../axiosClient';

export interface ChatMessageData {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponseData {
  reply: string;
  sourceIds: string[];
}

export const chatApi = {
  chatWithData: async (
    repositoryId: string,
    message: string,
    conversationHistory: ChatMessageData[]
  ): Promise<ChatResponseData> => {
    const response = await apiClient.post<{ success: boolean; data: ChatResponseData }>('/chat', {
      repositoryId,
      message,
      conversationHistory,
    });
    return response.data.data;
  },
};
