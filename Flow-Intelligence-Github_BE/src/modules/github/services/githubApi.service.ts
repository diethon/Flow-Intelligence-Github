import { Octokit } from '@octokit/rest';
import {
  GitHubApiConfig,
  GitHubTokenValidationResponse,
  GitHubPullRequest,
  GitHubReview,
  GitHubReviewRequest,
} from '../../../types';
import { AppError } from '../../../utils/AppError';

export class GitHubApiService {
  private octokit: Octokit;

  constructor(config: GitHubApiConfig) {
    this.octokit = new Octokit({
      auth: config.token,
      baseUrl: config.baseUrl || 'https://api.github.com',
      userAgent: 'Flow-Intelligence-GitHub/1.0',
    });
  }

  static createWithToken(token: string): GitHubApiService {
    return new GitHubApiService({ token });
  }

  async validateToken(): Promise<GitHubTokenValidationResponse> {
    try {
      const response = await this.octokit.request('GET /user', {
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      return response.data as GitHubTokenValidationResponse;
    } catch (error) {
      this.handleApiError(error, 'validateToken');
      throw error;
    }
  }

  async getUserRepoPermission(owner: string, repo: string, username: string): Promise<string> {
    try {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}/collaborators/{username}/permission', {
        owner,
        repo,
        username,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      const permissionData = response.data as {
        permission?: string;
        role_name?: string;
      };
      // GitHub may expose "maintain" through role_name while the legacy
      // permission field reports "write".
      return permissionData.role_name === "maintain"
        ? "maintain"
        : permissionData.permission ?? "none";
    } catch (error: any) {
      // Trả về 'none' nếu gặp lỗi 404 hoặc 403 (không có quyền xem thông tin collaborator của repo)
      if (error.status === 404 || error.status === 403) {
        return 'none';
      }
      this.handleApiError(error, 'getUserRepoPermission');
      throw error;
    }
  }

  async getRepository(owner: string, repo: string) {
    try {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}', {
        owner,
        repo,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      return response.data;
    } catch (error) {
      this.handleApiError(error, 'getRepository');
      throw error;
    }
  }

  async getUserRepositories(options: {
    perPage?: number;
    page?: number;
    type?: 'all' | 'owner' | 'public' | 'private' | 'member';
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    direction?: 'asc' | 'desc';
  } = {}): Promise<{
    name: string;
    full_name: string;
    description: string | null;
    private: boolean;
    html_url: string;
    stargazers_count?: number;
    forks_count?: number;
    watchers_count?: number;
    language?: string | null;
    open_issues_count?: number;
    default_branch?: string;
  }[]> {
    const { perPage = 100, page = 1, type = 'all', sort = 'updated', direction = 'desc' } = options;

    try {
      const response = await this.octokit.request('GET /user/repos', {
        per_page: perPage,
        page,
        type,
        sort,
        direction,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      return (response.data as Record<string, unknown>[]).map((repo) => ({
        name: repo.name as string,
        full_name: repo.full_name as string,
        description: repo.description as string | null,
        private: repo.private as boolean,
        html_url: repo.html_url as string,
        stargazers_count: repo.stargazers_count as number,
        forks_count: repo.forks_count as number,
        watchers_count: repo.watchers_count as number,
        language: repo.language as string | null,
        open_issues_count: repo.open_issues_count as number,
        default_branch: repo.default_branch as string,
      }));
    } catch (error) {
      this.handleApiError(error, 'getUserRepositories');
      throw error;
    }
  }

  async getRepositoryLanguages(owner: string, repo: string): Promise<Record<string, number>> {
    try {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}/languages', {
        owner,
        repo,
        headers: { 'X-GitHub-Api-Version': '2022-11-28' },
      });
      return response.data;
    } catch (error) {
      this.handleApiError(error, 'getRepositoryLanguages');
      throw error;
    }
  }

  async getRepositoryContributors(owner: string, repo: string, perPage = 10): Promise<{ login: string; avatar_url: string; contributions: number }[]> {
    try {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}/contributors', {
        owner,
        repo,
        per_page: perPage,
        headers: { 'X-GitHub-Api-Version': '2022-11-28' },
      });
      return response.data as { login: string; avatar_url: string; contributions: number }[];
    } catch (error) {
      this.handleApiError(error, 'getRepositoryContributors');
      throw error;
    }
  }

  async getRepositoryBranches(owner: string, repo: string): Promise<{ name: string; commit: { sha: string } }[]> {
    try {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}/branches', {
        owner,
        repo,
        per_page: 100,
        headers: { 'X-GitHub-Api-Version': '2022-11-28' },
      });
      return response.data;
    } catch (error) {
      this.handleApiError(error, 'getRepositoryBranches');
      throw error;
    }
  }

  async getRepositoryIssues(
    owner: string,
    repo: string,
    options: { state?: 'open' | 'closed' | 'all'; perPage?: number; page?: number } = {}
  ): Promise<{ total_count: number }> {
    try {
      const { state = 'open', perPage = 1 } = options;
      const response = await this.octokit.request('GET /repos/{owner}/{repo}/issues', {
        owner,
        repo,
        state,
        per_page: perPage,
        headers: { 'X-GitHub-Api-Version': '2022-11-28' },
      });
      return { total_count: response.data.length };
    } catch (error) {
      this.handleApiError(error, 'getRepositoryIssues');
      throw error;
    }
  }

  /**
   * Detailed issues for normalization. Note: GitHub's issues endpoint also
   * returns pull requests; callers must skip rows that carry a `pull_request`
   * field. Only metadata is returned — no raw body is exposed here.
   */
  async getDetailedIssues(
    owner: string,
    repo: string,
    options: { state?: 'open' | 'closed' | 'all'; perPage?: number; page?: number; since?: string } = {}
  ): Promise<Record<string, any>[]> {
    const { state = 'all', perPage = 100, page = 1, since } = options;
    try {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}/issues', {
        owner,
        repo,
        state,
        per_page: perPage,
        page,
        ...(since ? { since } : {}),
        headers: { 'X-GitHub-Api-Version': '2022-11-28' },
      });
      return response.data as Record<string, any>[];
    } catch (error) {
      this.handleApiError(error, 'getDetailedIssues');
      throw error;
    }
  }

  /** Commit history (metadata only). Supports incremental `since` (ISO date). */
  async getCommits(
    owner: string,
    repo: string,
    options: { perPage?: number; page?: number; since?: string; sha?: string } = {}
  ): Promise<Record<string, any>[]> {
    const { perPage = 100, page = 1, since, sha } = options;
    try {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}/commits', {
        owner,
        repo,
        per_page: perPage,
        page,
        ...(since ? { since } : {}),
        ...(sha ? { sha } : {}),
        headers: { 'X-GitHub-Api-Version': '2022-11-28' },
      });
      return response.data as Record<string, any>[];
    } catch (error) {
      this.handleApiError(error, 'getCommits');
      throw error;
    }
  }

  /** CI/CD check runs for a given git ref (commit SHA or branch). */
  async getCheckRunsForRef(owner: string, repo: string, ref: string): Promise<Record<string, any>[]> {
    try {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', {
        owner,
        repo,
        ref,
        per_page: 100,
        headers: { 'X-GitHub-Api-Version': '2022-11-28' },
      });
      return (response.data.check_runs || []) as Record<string, any>[];
    } catch (error) {
      this.handleApiError(error, 'getCheckRunsForRef');
      throw error;
    }
  }

  async getPullRequests(
    owner: string,
    repo: string,
    options: {
      state?: 'all' | 'open' | 'closed';
      perPage?: number;
      page?: number;
    } = {}
  ): Promise<GitHubPullRequest[]> {
    const { state = 'all', perPage = 100, page = 1 } = options;

    try {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}/pulls', {
        owner,
        repo,
        state,
        per_page: perPage,
        page,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      return (response.data as GitHubPullRequest[]).map((pr) => ({
        ...pr,
        head: {
          ...pr.head,
          repo: pr.head.repo ? {
            name: pr.head.repo.name,
            full_name: pr.head.repo.full_name,
          } : undefined,
        },
      }));
    } catch (error) {
      this.handleApiError(error, 'getPullRequests');
      throw error;
    }
  }

  async getReviews(owner: string, repo: string, pullNumber: number): Promise<GitHubReview[]> {
    try {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      return response.data as unknown as GitHubReview[];
    } catch (error) {
      this.handleApiError(error, 'getReviews');
      throw error;
    }
  }

  async getReviewRequests(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<GitHubReviewRequest[]> {
    try {
      const response = await this.octokit.request(
        'GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers',
        {
          owner,
          repo,
          pull_number: pullNumber,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      return (response.data.users || []).map((user: Record<string, unknown>) => ({
        id: user.id as number,
        user: {
          id: user.id as number,
          login: user.login as string,
          avatar_url: user.avatar_url as string,
        },
        created_at: new Date().toISOString(),
      }));
    } catch (error) {
      this.handleApiError(error, 'getReviewRequests');
      throw error;
    }
  }

  private handleApiError(error: unknown, context: string): void {
    if (error && typeof error === 'object' && 'status' in error) {
      const octokitError = error as {
        status: number;
        headers?: Record<string, string>;
        request: { url: string };
      };

      const rateLimitRemaining = Number(octokitError.headers?.['x-ratelimit-remaining'] || 0);
      const rateLimitReset = Number(octokitError.headers?.['x-ratelimit-reset'] || 0);

      if (octokitError.status === 403 && rateLimitRemaining === 0) {
        const resetDate = new Date(rateLimitReset * 1000);
        throw new AppError(
          `GitHub API rate limit exceeded. Resets at ${resetDate.toISOString()}`,
          429,
          'RATE_LIMIT_EXCEEDED',
          {
            context,
            rateLimitReset: resetDate.toISOString(),
            retryAfter: Math.max(0, resetDate.getTime() - Date.now()),
          }
        );
      }

      if (octokitError.status === 401) {
        throw new AppError('Invalid GitHub token', 401, 'INVALID_GITHUB_TOKEN', {
          context,
          retryable: false,
        });
      }

      if (octokitError.status === 404) {
        throw new AppError('GitHub repository not found', 404, 'REPOSITORY_NOT_FOUND', {
          context,
          retryable: false,
        });
      }

      if (octokitError.status === 422) {
        throw new AppError('Invalid request to GitHub API', 422, 'GITHUB_VALIDATION_ERROR', {
          context,
          retryable: false,
        });
      }

      if (octokitError.status >= 500) {
        throw new AppError(
          `GitHub API server error (${octokitError.status})`,
          octokitError.status,
          'GITHUB_SERVER_ERROR',
          {
            context,
            retryable: true,
            retryAfter: 5000,
          }
        );
      }

      if (octokitError.status === 0) {
        throw new AppError(
          'Network error when calling GitHub API',
          0,
          'NETWORK_ERROR',
          {
            context,
            retryable: true,
            retryAfter: 2000,
          }
        );
      }

      throw new AppError(
        `GitHub API error: ${octokitError.status}`,
        octokitError.status,
        'GITHUB_API_ERROR',
        {
          context,
          retryable: octokitError.status >= 500,
          retryAfter: octokitError.status >= 500 ? 5000 : 0,
        }
      );
    }

    throw new AppError('Unknown error from GitHub API', 500, 'UNKNOWN_GITHUB_ERROR', {
      context,
      retryable: true,
      retryAfter: 1000,
    });
  }

  async createWebhook(
    owner: string,
    repo: string,
    options: {
      url: string;
      secret: string;
      events: string[];
      active: boolean;
    }
  ): Promise<{ id: number; url: string }> {
    try {
      const response = await this.octokit.repos.createWebhook({
        owner,
        repo,
        name: 'web',
        config: {
          url: options.url,
          secret: options.secret,
          content_type: 'json',
          insecure_ssl: '0',
        },
        events: options.events,
        active: options.active,
      });

      return {
        id: response.data.id,
        url: response.data.url,
      };
    } catch (error: any) {
      this.handleApiError(error, 'createWebhook');
      throw error;
    }
  }
}
