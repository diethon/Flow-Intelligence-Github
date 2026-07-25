import React, { useState, useEffect, useCallback } from 'react';
import {
  adminGetUsers,
  adminUpdateUserRole,
  adminDeleteUser,
  adminGetUserRepositories
} from '../services/adminService';
import type { AdminUser, UserConnectedRepo } from '../services/adminService';
import { useAuth } from '../components/AuthContext';

export const UsersManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Delete modal state
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // User connections modal state
  const [selectedUserForRepos, setSelectedUserForRepos] = useState<AdminUser | null>(null);
  const [connectedRepos, setConnectedRepos] = useState<UserConnectedRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);

  const handleViewConnections = async (user: AdminUser) => {
    setSelectedUserForRepos(user);
    setLoadingRepos(true);
    setConnectedRepos([]);
    try {
      const response = await adminGetUserRepositories(user._id);
      if (response.success && response.data) {
        setConnectedRepos(response.data);
      }
    } catch (err: any) {
      console.error("Failed to load user connections:", err);
      setError(err?.response?.data?.message || 'Could not load connections for this user');
    } finally {
      setLoadingRepos(false);
    }
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminGetUsers({
        page,
        limit,
        search,
        role: roleFilter || undefined,
      });
      if (response.success && response.data) {
        setUsers(response.data.users);
        setTotal(response.data.total);
      } else {
        setError(response.message || 'Failed to load users');
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err?.response?.data?.message || 'Error occurred while loading users list');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Flash messages helper
  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleRoleToggle = async (user: AdminUser) => {
    if (user._id === currentUser?._id) {
      setError('You cannot change your own global application role.');
      return;
    }

    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      const response = await adminUpdateUserRole(user._id, nextRole);
      if (response.success) {
        setUsers(users.map(u => u._id === user._id ? { ...u, role: nextRole } : u));
        triggerSuccess(`Successfully changed role of ${user.username} to ${nextRole.toUpperCase()}`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update user role');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    setDeleteLoading(true);
    setError(null);
    try {
      const response = await adminDeleteUser(userToDelete._id);
      if (response.success) {
        setUsers(users.filter(u => u._id !== userToDelete._id));
        setTotal(prev => prev - 1);
        setUserToDelete(null);
        triggerSuccess(`User ${userToDelete.username} deleted successfully`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete user');
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center justify-between text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800 font-bold">×</button>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-xl flex items-center justify-between text-sm shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span className="font-medium">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800 font-bold">×</button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Users Management</h1>
            <p className="text-sm text-slate-500 mt-1">Manage system members, inspect active connections, and adjust global application roles.</p>
          </div>
          <div className="flex-shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm">
              🛡️ System Administration
            </span>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
          <div className="relative w-full md:flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by username or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-50/50 border border-slate-200 text-slate-800 placeholder-slate-400 text-sm font-medium rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-slate-350 focus:bg-white transition-all shadow-sm"
            />
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full md:w-[160px] bg-slate-50/50 border border-slate-200 text-slate-800 text-sm font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-slate-350 focus:bg-white transition-all shadow-sm cursor-pointer"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Joined Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading && users.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-slate-100" />
                          <div className="space-y-2">
                            <div className="h-4 w-28 bg-slate-100 rounded" />
                            <div className="h-3 w-40 bg-slate-100 rounded" />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4"><div className="h-6 w-16 bg-slate-100 rounded-full" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-100 rounded" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-8 w-12 bg-slate-100 rounded ml-auto" /></td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 bg-slate-50/50">
                      <span className="text-3xl">👥</span>
                      <h3 className="text-sm font-semibold text-slate-800 mt-2">No users found</h3>
                      <p className="text-xs text-slate-400 mt-1">Try modifying your search or filter settings.</p>
                    </td>
                  </tr>
                ) : (
                  users.map((item) => {
                    const isSelf = item._id === currentUser?._id;
                    return (
                      <tr key={item._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {item.avatarUrl ? (
                              <img
                                src={item.avatarUrl}
                                alt={item.username}
                                className="h-10 w-10 rounded-full border border-slate-200 object-cover shadow-sm flex-shrink-0"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm shadow-inner uppercase flex-shrink-0">
                                {item.username.charAt(0)}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                                {item.username}
                                {isSelf && (
                                  <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-normal">
                                    You
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5">{item.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-lg border
                            ${item.role === 'admin'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200/50 shadow-indigo-100/5'
                              : 'bg-slate-50 text-slate-600 border-slate-200/60'
                            }`}
                          >
                            {item.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {new Date(item.createdAt).toLocaleDateString('en-GB')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleViewConnections(item)}
                              title="View connected repositories"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-350 shadow-sm active:bg-slate-100 transition-all rounded-lg"
                            >
                              <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              Connections
                            </button>

                            {/* Toggle role button */}
                            <button
                              onClick={() => handleRoleToggle(item)}
                              disabled={isSelf}
                              title={isSelf ? 'Cannot change your own role' : `Promote to ${item.role === 'admin' ? 'User' : 'Admin'}`}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg shadow-sm transition-all border
                                ${isSelf
                                  ? 'bg-slate-50 border-slate-150 text-slate-300 cursor-not-allowed shadow-none'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-350 shadow-sm active:bg-slate-100'
                                }`}
                            >
                              {item.role === 'admin' ? (
                                <>
                                  <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13l-3 3m0 0l-3-3m3 3V8m0-5a9 9 0 110 18 9 9 0 010-18z" />
                                  </svg>
                                  Demote
                                </>
                              ) : (
                                <>
                                  <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z" />
                                  </svg>
                                  Promote
                                </>
                              )}
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => setUserToDelete(item)}
                              disabled={isSelf}
                              title={isSelf ? 'Cannot delete your own account' : 'Delete user account'}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg shadow-sm transition-all border
                                ${isSelf
                                  ? 'bg-slate-50 border-slate-150 text-slate-300 cursor-not-allowed shadow-none'
                                  : 'bg-rose-50/30 border-rose-200/60 text-rose-600 hover:bg-rose-50 hover:border-rose-300 active:bg-rose-100'
                                }`}
                            >
                              <svg className="h-3.5 w-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Showing page <strong className="font-semibold text-slate-700">{page}</strong> of <strong className="font-semibold text-slate-700">{totalPages}</strong>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-350 text-slate-700 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1.5"
                >
                  <svg className="h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-350 text-slate-700 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1.5"
                >
                  Next
                  <svg className="h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white max-w-md w-full rounded-2xl border border-slate-200 shadow-2xl p-6 relative animate-scaleUp">
            <h3 className="text-lg font-bold text-slate-900">Confirm Account Deletion</h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Are you sure you want to permanently delete user <strong className="text-slate-800">{userToDelete.username}</strong>?
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl mt-3 flex gap-2">
              <span className="text-sm">⚠️</span>
              <div>
                <p className="font-bold">This action cannot be undone!</p>
                <p className="mt-0.5">Deleting the user will also disconnect all of their GitHub repositories and revoke all permissions.</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setUserToDelete(null)}
                disabled={deleteLoading}
                className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="px-4 py-2 bg-rose-600 text-white text-sm font-semibold rounded-xl hover:bg-rose-500 active:bg-rose-700 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-md shadow-rose-600/10"
              >
                {deleteLoading ? (
                  <>
                    <span className="animate-spin inline-block rounded-full h-3.5 w-3.5 border-2 border-transparent border-t-white" />
                    Deleting...
                  </>
                ) : (
                  'Confirm Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Connections Modal */}
      {selectedUserForRepos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white max-w-2xl w-full rounded-2xl border border-slate-200 shadow-2xl p-6 relative animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Connected Repositories</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing connected repositories for <strong className="text-slate-700">{selectedUserForRepos.username}</strong> ({selectedUserForRepos.email})
                </p>
              </div>
              <button 
                onClick={() => setSelectedUserForRepos(null)}
                className="text-slate-400 hover:text-slate-650 font-bold text-xl p-1 leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="max-h-[350px] overflow-y-auto pr-1">
              {loadingRepos ? (
                <div className="space-y-3 py-6">
                  <div className="h-10 bg-slate-50 animate-pulse rounded-xl" />
                  <div className="h-10 bg-slate-50 animate-pulse rounded-xl" />
                  <div className="h-10 bg-slate-50 animate-pulse rounded-xl" />
                </div>
              ) : connectedRepos.length === 0 ? (
                <div className="text-center py-10 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <span className="text-3xl">🔌</span>
                  <h4 className="text-sm font-semibold text-slate-800 mt-2">No connected repositories</h4>
                  <p className="text-xs text-slate-400 mt-1">This user hasn't connected or doesn't participate in any repositories.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                        <th className="px-4 py-3">Repository</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">User's Role</th>
                        <th className="px-4 py-3">Last Synced</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {connectedRepos.map((repo, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                          <td className="px-4 py-3 text-xs font-semibold text-slate-900">
                            {repo.fullName}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border
                              ${repo.isPrivate 
                                ? 'bg-slate-100 border-slate-200 text-slate-600' 
                                : 'bg-green-50 border-green-200 text-green-700'
                              }`}
                            >
                              {repo.isPrivate ? 'Private' : 'Public'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-50/50 border border-slate-200 px-2 py-0.5 rounded-lg flex items-center gap-1 w-max">
                              {repo.role === 'leader' ? '✦ Leader' : repo.role === 'dev' ? '⌘ Developer' : '👁 Viewer'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-slate-400">
                            {repo.lastSyncedAt ? new Date(repo.lastSyncedAt).toLocaleString('en-GB') : 'Never'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end mt-6 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedUserForRepos(null)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 active:bg-black transition-all shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManagementPage;
