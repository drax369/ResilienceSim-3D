/**
 * Authentication and Session Types for ResilienceSim 3D.
 */

export interface User {
  email: string;
  name: string;
  role: string;
  organization: string;
  isDemo: boolean;
  avatarInitials: string;
}

export interface Session {
  user: User;
  token: string;
  loginTimestamp: number;
  rememberMe: boolean;
}

export interface LoginCredentials {
  identifier: string;
  password?: string;
  rememberMe: boolean;
}

export type AppView = 'landing' | 'login' | 'loading' | 'workspace';
