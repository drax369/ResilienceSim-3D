/**
 * Authentication & Session Service for ResilienceSim 3D.
 *
 * NOTE FOR PRODUCTION:
 * This implementation provides an explicit, clearly labeled DEMO MODE for prototype evaluation.
 * Production deployment requires:
 * 1. Server-side credential verification over HTTPS (bcrypt/argon2 password hashing).
 * 2. Secure HTTP-only cookies or signed JWT access/refresh tokens.
 * 3. Session invalidation and role-based access control (RBAC).
 */

import type { Session, User, LoginCredentials } from '../types/auth';

const SESSION_STORAGE_KEY = 'resiliencesim_3d_session';

export const DEMO_USER: User = {
  email: 'demo.analyst@resiliencesim.internal',
  name: 'Demo Operations Lead',
  role: 'Supply Chain Resilience Director',
  organization: 'Global Logistics Operations (Demo)',
  isDemo: true,
  avatarInitials: 'DO',
};

export const DEMO_PREFILL_CREDENTIALS = {
  email: 'demo.analyst@resiliencesim.internal',
  password: 'Resilience2026!',
};

class AuthService {
  /**
   * Retrieves active session from either localStorage or sessionStorage.
   */
  public getSession(): Session | null {
    try {
      const stored =
        localStorage.getItem(SESSION_STORAGE_KEY) ||
        sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored) as Session;
    } catch {
      return null;
    }
  }

  /**
   * Checks if user has an active session.
   */
  public isAuthenticated(): boolean {
    return this.getSession() !== null;
  }

  /**
   * Retrieves current user profile if logged in.
   */
  public getCurrentUser(): User | null {
    const session = this.getSession();
    return session ? session.user : null;
  }

  /**
   * Executes demo login using predefined analyst credentials.
   */
  public loginWithDemoAccount(rememberMe: boolean = true): Session {
    const session: Session = {
      user: DEMO_USER,
      token: `demo_session_${Date.now()}`,
      loginTimestamp: Date.now(),
      rememberMe,
    };
    this.saveSession(session);
    return session;
  }

  /**
   * Executes login with user-provided credentials.
   * In Demo Mode, creates an explicitly marked demo session for the supplied identifier.
   */
  public loginWithCredentials(credentials: LoginCredentials): Session {
    const trimmedId = credentials.identifier.trim();
    const initials = trimmedId
      .split(/[@._\s]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'SC';

    const user: User = {
      email: trimmedId.includes('@') ? trimmedId : `${trimmedId}@resiliencesim.internal`,
      name: trimmedId.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      role: 'Enterprise Resilience Analyst (Demo Access)',
      organization: 'Enterprise Supply Chain Group',
      isDemo: true,
      avatarInitials: initials,
    };

    const session: Session = {
      user,
      token: `demo_session_${Date.now()}`,
      loginTimestamp: Date.now(),
      rememberMe: credentials.rememberMe,
    };

    this.saveSession(session);
    return session;
  }

  /**
   * Persists session to appropriate browser storage.
   */
  private saveSession(session: Session): void {
    const payload = JSON.stringify(session);
    if (session.rememberMe) {
      localStorage.setItem(SESSION_STORAGE_KEY, payload);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      sessionStorage.setItem(SESSION_STORAGE_KEY, payload);
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  /**
   * Logs out and cleans up all session tokens.
   */
  public logout(): void {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

export const authService = new AuthService();
