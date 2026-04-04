/**
 * TRUTH-NET Auth Routes
 * Simple JWT-based authentication for user accounts
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { EscrowLedger } from '../../engine/escrow/EscrowLedger.js';
import { EventBus } from '../../events/EventBus.js';

// ============================================================================
// TYPES
// ============================================================================

interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  avatar?: string;
  role: 'user' | 'admin';
  onboarded: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory store (production: PostgreSQL)
const users = new Map<string, User>();
const emailIndex = new Map<string, string>(); // email -> userId

const DEFAULT_JWT_SECRET = 'truthnet-dev-secret-change-in-production';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

if (JWT_SECRET === DEFAULT_JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error(
    'FATAL: JWT_SECRET is set to the default value in a production environment. ' +
    'Set a strong, unique JWT_SECRET via environment variables before starting.'
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return null;
}

// ============================================================================
// HELPERS
// ============================================================================

function generateUserId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function signToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token: string): { userId: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
  } catch {
    return null;
  }
}

// ============================================================================
// AUTH MIDDLEWARE
// ============================================================================

export function authMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
        timestamp: new Date().toISOString(),
      });
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (!payload) {
      return reply.status(401).send({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Token is invalid or expired' },
        timestamp: new Date().toISOString(),
      });
    }

    (request as any).userId = payload.userId;
    (request as any).userRole = payload.role;
  };
}

// ============================================================================
// ROUTE FACTORY
// ============================================================================

export function createAuthRoutes(escrow: EscrowLedger, eventBus: EventBus) {
  return async function authRoutes(fastify: FastifyInstance): Promise<void> {

    // -----------------------------------------------------------------------
    // POST /auth/register
    // -----------------------------------------------------------------------
    fastify.post('/auth/register', async (
      request: FastifyRequest<{
        Body: { email: string; password: string; displayName?: string }
      }>,
      reply: FastifyReply
    ) => {
      const { email, password, displayName } = request.body;

      if (!email || !password) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Email and password are required' },
          timestamp: new Date().toISOString(),
        });
      }

      if (!EMAIL_RE.test(email)) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_EMAIL', message: 'Invalid email format' },
          timestamp: new Date().toISOString(),
        });
      }

      const passwordError = validatePassword(password);
      if (passwordError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: passwordError + '. Password must be at least 8 characters and include uppercase, lowercase, and a number.',
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Check for existing user
      if (emailIndex.has(email.toLowerCase())) {
        return reply.status(409).send({
          success: false,
          error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' },
          timestamp: new Date().toISOString(),
        });
      }

      const userId = generateUserId();
      const passwordHash = await bcrypt.hash(password, 10);
      const now = new Date();

      const user: User = {
        id: userId,
        email: email.toLowerCase(),
        passwordHash,
        displayName: displayName || email.split('@')[0],
        role: 'user',
        onboarded: false,
        createdAt: now,
        updatedAt: now,
      };

      users.set(userId, user);
      emailIndex.set(email.toLowerCase(), userId);

      // Create wallet with 0 balance
      escrow.createWallet(userId, 0);

      const token = signToken(userId, user.role);

      eventBus.publish('user.registered', { userId, email, timestamp: now.toISOString() });

      console.log(`[Auth] User registered: ${email} (${userId})`);

      return reply.status(201).send({
        success: true,
        data: {
          user: {
            id: userId,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            onboarded: user.onboarded,
          },
          token,
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // POST /auth/login
    // -----------------------------------------------------------------------
    fastify.post('/auth/login', async (
      request: FastifyRequest<{
        Body: { email: string; password: string }
      }>,
      reply: FastifyReply
    ) => {
      const { email, password } = request.body;

      if (!email || !password) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Email and password are required' },
          timestamp: new Date().toISOString(),
        });
      }

      const userId = emailIndex.get(email.toLowerCase());
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
          timestamp: new Date().toISOString(),
        });
      }

      const user = users.get(userId)!;
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return reply.status(401).send({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
          timestamp: new Date().toISOString(),
        });
      }

      const token = signToken(userId, user.role);

      return reply.send({
        success: true,
        data: {
          user: {
            id: userId,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            onboarded: user.onboarded,
          },
          token,
          balance: escrow.getBalance(userId),
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // GET /auth/me - Current user profile
    // -----------------------------------------------------------------------
    fastify.get('/auth/me', async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
          timestamp: new Date().toISOString(),
        });
      }

      const payload = verifyToken(authHeader.slice(7));
      if (!payload) {
        return reply.status(401).send({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Token expired' },
          timestamp: new Date().toISOString(),
        });
      }

      const user = users.get(payload.userId);
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            onboarded: user.onboarded,
          },
          balance: escrow.getBalance(user.id),
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // PUT /auth/profile - Update user profile (requires auth)
    // -----------------------------------------------------------------------
    fastify.put('/auth/profile', async (
      request: FastifyRequest<{
        Body: { displayName?: string; avatar?: string }
      }>,
      reply: FastifyReply
    ) => {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
          timestamp: new Date().toISOString(),
        });
      }

      const payload = verifyToken(authHeader.slice(7));
      if (!payload) {
        return reply.status(401).send({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Token is invalid or expired' },
          timestamp: new Date().toISOString(),
        });
      }

      const user = users.get(payload.userId);
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          timestamp: new Date().toISOString(),
        });
      }

      const { displayName, avatar } = request.body;
      if (displayName !== undefined) user.displayName = displayName;
      if (avatar !== undefined) user.avatar = avatar;
      user.updatedAt = new Date();

      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            avatar: user.avatar,
            role: user.role,
            onboarded: user.onboarded,
          },
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // POST /auth/onboard - Mark user as onboarded (requires auth)
    // -----------------------------------------------------------------------
    fastify.post('/auth/onboard', async (
      request: FastifyRequest<{ Body: { objective?: string } }>,
      reply: FastifyReply
    ) => {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
          timestamp: new Date().toISOString(),
        });
      }

      const payload = verifyToken(authHeader.slice(7));
      if (!payload) {
        return reply.status(401).send({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Token is invalid or expired' },
          timestamp: new Date().toISOString(),
        });
      }

      const userId = payload.userId;
      const { objective } = request.body;
      const user = users.get(userId);
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          timestamp: new Date().toISOString(),
        });
      }

      user.onboarded = true;
      user.updatedAt = new Date();

      eventBus.publish('user.onboarded', { userId, objective, timestamp: new Date().toISOString() });

      return reply.send({
        success: true,
        data: { onboarded: true, objective },
        timestamp: new Date().toISOString(),
      });
    });
  };
}
