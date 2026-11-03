export const AUTH_KEY = 'toserba-auth';

export interface AuthUser {
  username: string;
  name: string;
  role: string;
}

export const DEFAULT_USER = {
  username: 'admin',
  password: 'admin123',
  name: 'Admin Toko',
  role: 'Pemilik',
};

export function getAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;

  try {
    const data = localStorage.getItem(AUTH_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.href = '/login';
}