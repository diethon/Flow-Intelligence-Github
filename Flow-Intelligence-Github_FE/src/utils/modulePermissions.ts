export type GlobalRole = "admin" | "user" | "leader";
export type RepositoryRole = "leader" | "dev" | "viewer";

export interface ModulePermissionInput {
  globalRole?: GlobalRole;
  repositoryRole?: RepositoryRole;
  isPrivate?: boolean;
}

export const canManageWeeklyBrief = ({
  globalRole,
  repositoryRole,
}: ModulePermissionInput): boolean =>
  globalRole === "admin" || repositoryRole === "leader";

export const canViewPublishedWeeklyBrief = ({
  globalRole,
  repositoryRole,
  isPrivate = true,
}: ModulePermissionInput): boolean =>
  globalRole === "admin" ||
  repositoryRole === "leader" ||
  repositoryRole === "dev" ||
  !isPrivate;

export const canManagePrivacySettings = canManageWeeklyBrief;

export const getPermissionErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as {
      response?: { status?: number; data?: { message?: string } };
    }).response;
    if (response?.status === 403) {
      return "You do not have permission to access this feature.";
    }
    return response?.data?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

