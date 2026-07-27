import { Request, Response, NextFunction } from 'express';
import { authenticate, optionalAuthenticate } from '../../../src/middlewares/authenticate';
import jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockImplementation((token: string) => {
    if (token === 'abc123') {
      return { userId: 'user_abc123' };
    }
    throw new Error('invalid token');
  }),
}));

describe('authenticate middleware', () => {
  beforeEach(() => {
    (jwt.verify as jest.Mock).mockImplementation((token: string) => {
      if (token === 'abc123') {
        return { userId: 'user_abc123' };
      }
      throw new Error('invalid token');
    });
  });

  it('should reject missing authorization header', () => {
    const req = { headers: {} } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should attach userId when Bearer token is present', () => {
    const req = { headers: { authorization: 'Bearer abc123' } } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect((req as Record<string, unknown>).userId).toBe('user_abc123');
  });
});

describe('optionalAuthenticate middleware', () => {
  it('should not fail when no auth header is provided', () => {
    const req = { headers: {} } as unknown as Request;
    const res = {} as unknown as Response;
    const next = jest.fn();

    optionalAuthenticate(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
