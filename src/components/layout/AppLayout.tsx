import { Outlet } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { Sidebar } from './Sidebar.tsx';
import { useSettingsStore, type ThemeMode } from '@/store/useSettingsStore.ts';
import styles from './AppLayout.module.css';

const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Світла тема', icon: Sun },
  { value: 'dark', label: 'Темна тема', icon: Moon },
];

export function AppLayout() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.themeDock} role="radiogroup" aria-label="Тема інтерфейсу">
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
      </div>
      <main className={styles.main}>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
