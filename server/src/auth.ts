import jwt from 'jsonwebtoken';
import { JWT_SECRET, IS_PROD } from './config';

export interface Session {
  userId: string;
}

export function signSession(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifySession(token: string): Session | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const sub = typeof payload === 'object' && payload ? (payload as { sub?: unknown }).sub : undefined;
    return typeof sub === 'string' ? { userId: sub } : null;
  } catch {
    return null;
  }
}

export interface ExternalIdentity {
  providerId: string;
  email: string | null;
}

/**
 * Verify an Apple/Google identity token → external identity.
 *
 * ⚠️ STUB. Production MUST verify the token signature against the provider's
 * JWKS (Apple: appleid.apple.com/auth/keys; Google: token issuer + aud). Until
 * that is implemented, verification is refused in production and, in dev, the
 * token is trusted as an opaque provider id so the flow is testable.
 */
export function verifyExternalIdentity(idToken: string, email: string | null): ExternalIdentity | null {
  if (IS_PROD) return null; // never trust an unverified token in production
  if (!idToken || idToken.length < 3) return null;
  return { providerId: idToken, email };
}
