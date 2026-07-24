import React from 'react';

export const UsersManagementPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Users Management</h1>
            <p className="text-sm text-slate-500 mt-1">Manage system members and assign global application roles.</p>
          </div>
          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100">
            Admin Area
          </span>
        </div>

        <div className="border border-slate-150 rounded-xl overflow-hidden">
          <div className="p-8 text-center bg-slate-50">
            <span className="text-4xl">👥</span>
            <h3 className="text-base font-semibold text-slate-800 mt-3">Admin Redirection Page</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
              You have successfully entered the Admin Area because your role is **admin**. Users with the **user** role are redirected to the Dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsersManagementPage;
