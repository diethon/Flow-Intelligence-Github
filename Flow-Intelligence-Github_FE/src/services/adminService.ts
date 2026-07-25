import apiClient from './axiosClient.js';
import type { ApiResponse } from '../types';

export interface AdminUser {
  _id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRepository {
  _id: string;
  owner: string;
  name: string;
  fullName: string;
  isPrivate: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface SystemStats {
  totalUsers: number;
  totalRepos: number;
  totalCommits: number;
  totalPRs: number;
  syncStats: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
}

export async function adminGetUsers(params: {
  page: number;
  limit: number;
  search?: string;
  role?: string;
}): Promise<ApiResponse<{ users: AdminUser[]; total: number; page: number; limit: number; totalPages: number }>> {
  const res = await apiClient.get('/admin/users', { params });
  return res.data;
}

export async function adminUpdateUserRole(
  userId: string,
  role: 'admin' | 'user'
): Promise<ApiResponse<AdminUser>> {
  const res = await apiClient.put(`/admin/users/${userId}/role`, { role });
  return res.data;
}

export async function adminDeleteUser(userId: string): Promise<ApiResponse<{ message: string }>> {
  const res = await apiClient.delete(`/admin/users/${userId}`);
  return res.data;
}

export async function adminGetStats(): Promise<ApiResponse<SystemStats>> {
  const res = await apiClient.get('/admin/stats');
  return res.data;
}

export async function adminGetRepositories(params: {
  page: number;
  limit: number;
}): Promise<ApiResponse<{ repositories: AdminRepository[]; total: number; page: number; limit: number; totalPages: number }>> {
  const res = await apiClient.get('/admin/repositories', { params });
  return res.data;
}

export async function adminForceSyncRepository(repoId: string): Promise<ApiResponse<unknown>> {
  const res = await apiClient.post(`/admin/repositories/${repoId}/sync`, {});
  return res.data;
}

export async function adminDisconnectRepository(repoId: string): Promise<ApiResponse<{ disconnected: boolean }>> {
  const res = await apiClient.delete(`/admin/repositories/${repoId}`);
  return res.data;
}

export interface UserConnectedRepo {
  repositoryId: string | null;
  fullName: string;
  isPrivate: boolean;
  lastSyncedAt: string | null;
  role: 'leader' | 'dev' | 'viewer';
  githubUsername: string;
}

export async function adminGetUserRepositories(userId: string): Promise<ApiResponse<UserConnectedRepo[]>> {
  const res = await apiClient.get(`/admin/users/${userId}/repositories`);
  return res.data;
}
