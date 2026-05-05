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
            initial={{ opacity: 0, y: -76, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -86, scale: 0.985 }}
            transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
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
