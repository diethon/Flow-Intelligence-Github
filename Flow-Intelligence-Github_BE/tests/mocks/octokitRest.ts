export const Octokit = jest.fn().mockImplementation(() => ({
  request: jest.fn().mockResolvedValue({ data: {} }),
  rest: {
    pulls: {
      list: jest.fn().mockResolvedValue({ data: [] }),
      get: jest.fn().mockResolvedValue({ data: {} }),
      listReviews: jest.fn().mockResolvedValue({ data: [] }),
      listReviewRequests: jest.fn().mockResolvedValue({ data: [] }),
    },
    repos: {
      get: jest.fn().mockResolvedValue({ data: {} }),
    },
    users: {
      getAuthenticated: jest.fn().mockResolvedValue({ data: {} }),
    },
  },
}));
