import { create } from 'zustand';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  getCountFromServer,
  collection,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase.ts';
import type { AppUser, UserRole } from '@/types/index.ts';

interface AuthStore {
  currentUser: AppUser | null;
  loading: boolean;

  initAuth: () => () => void;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (username: string, displayName: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAdmin: () => boolean;
}

function toEmail(username: string): string {
  return `${username.toLowerCase().trim()}@autoword.app`;
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  currentUser: null,
  loading: true,

  initAuth: () => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          set({
            currentUser: {
              id: firebaseUser.uid,
              username: data.username,
              displayName: data.displayName,
              role: data.role as UserRole,
              createdAt: data.createdAt,
            },
            loading: false,
          });
        } else {
          set({ currentUser: null, loading: false });
        }
      } else {
        set({ currentUser: null, loading: false });
      }
    });
    return unsubscribe;
  },

  login: async (username: string, password: string) => {
    try {
      const email = toEmail(username);
      const cred = await signInWithEmailAndPassword(auth, email, password);

      const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        set({
          currentUser: {
            id: cred.user.uid,
            username: data.username,
            displayName: data.displayName,
            role: data.role as UserRole,
            createdAt: data.createdAt,
          },
        });
      }
      return { ok: true };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        return { ok: false, error: 'Користувача не знайдено або невірний пароль' };
      }
      if (code === 'auth/wrong-password') {
        return { ok: false, error: 'Невірний пароль' };
      }
      return { ok: false, error: 'Помилка входу' };
    }
  },

  register: async (username: string, displayName: string, password: string) => {
    try {
      const trimmedUsername = username.toLowerCase().trim();

      if (trimmedUsername.length < 3) {
        return { ok: false, error: "Ім'я користувача має бути мін. 3 символи" };
      }
      if (password.length < 6) {
        return { ok: false, error: 'Пароль має бути мін. 6 символів' };
      }

      const email = toEmail(trimmedUsername);
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // First registered user becomes admin
      const snapshot = await getCountFromServer(collection(db, 'users'));
      const isFirst = snapshot.data().count === 0;

      const role: UserRole = isFirst ? 'admin' : 'user';
      const userDisplayName = displayName.trim() || trimmedUsername;
      const createdAt = new Date().toISOString();

      await setDoc(doc(db, 'users', cred.user.uid), {
        username: trimmedUsername,
        displayName: userDisplayName,
        role,
        createdAt,
      });

      set({
        currentUser: {
          id: cred.user.uid,
          username: trimmedUsername,
          displayName: userDisplayName,
          role,
          createdAt,
        },
      });

      return { ok: true };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/email-already-in-use') {
        return { ok: false, error: "Це ім'я вже зайнято" };
      }
      if (code === 'auth/weak-password') {
        return { ok: false, error: 'Пароль занадто слабкий (мін. 6 символів)' };
      }
      return { ok: false, error: 'Помилка реєстрації' };
    }
  },

  logout: async () => {
    await signOut(auth);
    set({ currentUser: null });
  },

  isAdmin: () => {
    return get().currentUser?.role === 'admin';
  },
}));
