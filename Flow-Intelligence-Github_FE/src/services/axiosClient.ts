import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiResponse } from '../types';

const createApiClient = (baseURL: string) => {
  const client = axios.create({
    baseURL,
    timeout: 60000, // Increased to 60s to allow Gemini API enough time to generate the brief
    headers: {
      'Content-Type': 'application/json',
    },
  });

  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error: AxiosError) => Promise.reject(error)
  );

  client.interceptors.response.use(
    (response: AxiosResponse<ApiResponse>) => response,
    (error: AxiosError<ApiResponse>) => {
      if (error.response?.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
};

export const apiClient = createApiClient('/api');

export const handleApiError = (error: unknown): never => {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as AxiosError<ApiResponse>;
    const response = axiosError.response?.data;
    const message = response?.message || axiosError.message || 'Something went wrong';
    const errors = response?.errors;
    throw new Error(JSON.stringify({ message, errors, status: axiosError.response?.status }));
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error('Unknown error');
};

export default apiClient;
