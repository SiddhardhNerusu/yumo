import type { Request, Response, NextFunction } from 'express';
import { verifySession } from './auth';
import type { Store } from './db/store';

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const session = verifySession(token);
  if (!session) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  (req as AuthedRequest).userId = session.userId;
  next();
}

/** Gate premium-only endpoints (§8.3). Returns 402 for free users. */
export function requirePremium(store: Store) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = (req as AuthedRequest).userId;
    if (!userId || store.getTier(userId) !== 'premium') {
      res.status(402).json({ error: 'premium_required', upgrade: true });
      return;
    }
    next();
  };
}
