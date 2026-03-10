import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppUser, UserRole } from '@/types/index.ts';

interface StoredUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  passwordHash: string;
  createdAt: string;
}

interface AuthStore {
  currentUser: AppUser | null;
  users: StoredUser[];
  initialized: boolean;

  login: (username: string, password: string) => { ok: boolean; error?: string };
  register: (username: string, displayName: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  isAdmin: () => boolean;
}

function hashPassword(password: string): string {
  // Simple hash for local-only app (no server, no network)
  let hash = 0;
  const str = password + '__autoword_salt_2026__';
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36);
}

const ADMIN_USER: StoredUser = {
  id: 'admin-001',
  username: 'admin',
  displayName: 'Адміністратор',
  role: 'admin',
  passwordHash: hashPassword('admin'),
  createdAt: new Date().toISOString(),
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      currentUser: null,
      users: [ADMIN_USER],
      initialized: true,

      login: (username: string, password: string) => {
        const { users } = get();
        const user = users.find(
          (u) => u.username.toLowerCase() === username.toLowerCase().trim()
        );
        if (!user) {
          return { ok: false, error: 'Користувача не знайдено' };
        }
        if (user.passwordHash !== hashPassword(password)) {
          return { ok: false, error: 'Невірний пароль' };
        }
        const appUser: AppUser = {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          createdAt: user.createdAt,
        };
        set({ currentUser: appUser });
        return { ok: true };
      },

      register: (username: string, displayName: string, password: string) => {
        const { users } = get();
        const trimmedUsername = username.toLowerCase().trim();

        if (trimmedUsername.length < 3) {
          return { ok: false, error: "Ім'я користувача має бути мін. 3 символи" };
        }
        if (password.length < 4) {
          return { ok: false, error: 'Пароль має бути мін. 4 символи' };
        }
        if (users.some((u) => u.username.toLowerCase() === trimmedUsername)) {
          return { ok: false, error: 'Це ім\'я вже зайнято' };
        }

        const newUser: StoredUser = {
          id: crypto.randomUUID(),
          username: trimmedUsername,
          displayName: displayName.trim() || trimmedUsername,
          role: 'user',
          passwordHash: hashPassword(password),
          createdAt: new Date().toISOString(),
        };

        const appUser: AppUser = {
          id: newUser.id,
          username: newUser.username,
          displayName: newUser.displayName,
          role: newUser.role,
          createdAt: newUser.createdAt,
        };

        set({
          users: [...users, newUser],
          currentUser: appUser,
        });
        return { ok: true };
      },

      logout: () => {
        set({ currentUser: null });
      },

      isAdmin: () => {
        return get().currentUser?.role === 'admin';
      },
    }),
    {
      name: 'autoword-auth',
      partialize: (state) => ({
        users: state.users,
        currentUser: state.currentUser,
      }),
    }
  )
);
