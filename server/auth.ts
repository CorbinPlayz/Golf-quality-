import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export const SESSION_COOKIE_NAME = 'fairway_session';
export const SESSION_TTL_DAYS = 30;

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash: derived, salt };
}

export function verifyPassword(password: string, expectedHash: string, salt: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

export function generateSessionToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// Lightweight sliding-window rate limiter for anti-spam protection
interface Bucket {
  timestamps: number[];
}
const buckets = new Map<string, Bucket>();

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  keyPrefix: string;
  message?: string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.socket.remoteAddress || 'unknown';
    const userId = (req as AuthenticatedRequest).user?.id;
    const key = `${options.keyPrefix}:${userId ? `u:${userId}` : `ip:${ip}`}`;
    const now = Date.now();
    if (buckets.size > 10000) {
      for (const [k, v] of buckets) if (v.timestamps.every(t => now - t >= options.windowMs)) buckets.delete(k);
    }
    const existing = buckets.get(key) ?? { timestamps: [] };
    existing.timestamps = existing.timestamps.filter((t) => now - t < options.windowMs);

    if (existing.timestamps.length >= options.max) {
      res.status(429).json({
        error:
          options.message ||
          'Too many requests in a short window. Please wait a moment before trying again.',
      });
      return;
    }

    existing.timestamps.push(now);
    buckets.set(key, existing);
    next();
  };
}

export interface AuthUserRow {
  id: number;
  email: string;
  name: string;
  username: string;
  handicap: number | null;
  home_city: string | null;
  home_state: string | null;
  created_at: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserRow | null;
}
