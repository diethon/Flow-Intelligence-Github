import { Request, Response } from 'express';
import axios from 'axios';
import { User } from '../models';
import jwt from 'jsonwebtoken';
import env from '../../../config/env';

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string;
  name: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

const getGithubAuthUrl = (promptConsent: boolean = true) => {
  const state = Math.random().toString(36).substring(7);
  let url = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=http://localhost:3001/api/auth/github/callback&scope=repo,user,notifications&state=${state}`;
  if (promptConsent) {
    url += '&prompt=consent';
  }
  return url;
};

const exchangeCodeForToken = async (code: string): Promise<string> => {
  const response = await axios.post<GitHubTokenResponse>(
    'https://github.com/login/oauth/access_token',
    {
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    },
    {
      headers: { Accept: 'application/json' },
    }
  );

  if (!response.data.access_token) {
    throw new Error('Failed to get access token from GitHub');
  }

  return response.data.access_token;
};

const getGithubUser = async (accessToken: string): Promise<GitHubUser> => {
  const response = await axios.get<GitHubUser>('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  return response.data;
};

const getGithubEmail = async (accessToken: string): Promise<string> => {
  const response = await axios.get<GitHubEmail[]>('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  const primaryEmail = response.data.find((email) => email.primary && email.verified);
  if (!primaryEmail) {
    throw new Error('No primary verified email found');
  }

  return primaryEmail.email;
};

const generateJwt = (userId: string): string => {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '30d' });
};

export const githubLogin = (req: Request, res: Response) => {
  const promptConsent = req.query.prompt !== 'false';
  const authUrl = getGithubAuthUrl(promptConsent);
  res.json({ url: authUrl });
};

export const githubCallback = async (req: Request, res: Response): Promise<void> => {
  const { code, error } = req.query;

  if (error) {
    res.redirect(`${env.CORS_ORIGIN}/login?error=${error}`);
    return;
  }

  if (!code || typeof code !== 'string') {
    res.redirect(`${env.CORS_ORIGIN}/login?error=no_code`);
    return;
  }

  try {
    const accessToken = await exchangeCodeForToken(code);
    const githubUser = await getGithubUser(accessToken);
    const email = githubUser.email || (await getGithubEmail(accessToken));

    let user = await User.findOne({ githubId: String(githubUser.id) });

    if (!user) {
      user = new User({
        githubId: String(githubUser.id),
        username: githubUser.login,
        email,
        avatarUrl: githubUser.avatar_url,
        accessToken,
        role: 'user',
      });
      await user.save();
    } else {
      user.accessToken = accessToken;
      user.username = githubUser.login;
      user.avatarUrl = githubUser.avatar_url;
      await user.save();
    }

    const jwtToken = generateJwt(user._id.toString());
    res.redirect(`${env.CORS_ORIGIN}/auth/callback?token=${jwtToken}`);
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.redirect(`${env.CORS_ORIGIN}/login?error=auth_failed`);
  }
};

export const getMe = async (req: Request, res: Response) => {
  const userId = (req as Request & { userId?: string }).userId;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  const user = await User.findById(userId).select('-accessToken -refreshToken');
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  res.json({ success: true, data: user });
};

export const logout = async (req: Request, res: Response) => {
  const userId = (req as Request & { userId?: string }).userId;
  if (userId) {
    await User.findByIdAndUpdate(userId, { accessToken: '' });
  }
  res.json({ success: true, message: 'Logged out successfully' });
};
