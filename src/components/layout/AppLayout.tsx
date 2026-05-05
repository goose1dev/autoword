import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { Sidebar } from './Sidebar.tsx';
import { useSettingsStore, type ThemeMode } from '@/store/useSettingsStore.ts';
import styles from './AppLayout.module.css';

const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Світла тема', icon: Sun },
  { value: 'dark', label: 'Темна тема', icon: Moon },
];

export function AppLayout() {
  const location = useLocation();
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const showThemeDock = location.pathname === '/';

  return (
    <div className={styles.layout}>
      <Sidebar />
      <AnimatePresence>
        {showThemeDock && (
          <motion.div
            className={styles.themeDock}
            role="radiogroup"
            aria-label="Тема інтерфейсу"
            initial={{ opacity: 0, y: -18, scale: 0.96, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -34, scale: 0.94, filter: 'blur(8px)' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                className={`${styles.themeButton} ${theme === value ? styles.themeButtonActive : ''}`}
                onClick={() => setTheme(value)}
                aria-label={label}
                aria-checked={theme === value}
                role="radio"
                title={label}
              >
                <Icon size={17} />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <main className={styles.main}>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
