import { Request, Response } from 'express';
import { z } from 'zod';
import { ChatService } from '../services/ChatService.js';
import { AppError } from '../utils/AppError.js';
import { User } from '../models/User.js';

const chatRequestSchema = z.object({
  repositoryId: z.string().min(1, 'Repository ID is required'),
  message: z.string().min(1).max(500, 'Message cannot exceed 500 characters'),
  conversationHistory: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })
  ).max(20, 'History cannot exceed 20 messages').default([]),
});

export const chatWithData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { repositoryId, message, conversationHistory } = chatRequestSchema.parse(req.body);

    // Call the ChatService
    const result = await ChatService.generateChatResponse(
      repositoryId,
      message,
      conversationHistory
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError('Validation Error', 400, 'BAD_REQUEST', { details: error.issues });
    }
    console.error('Chat error:', error);
    throw new AppError('Failed to generate chat response', 500, 'INTERNAL_SERVER_ERROR');
  }
};
