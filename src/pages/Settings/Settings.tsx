import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { GlassCard, Input } from '@/components/ui/index.ts';
import { Header } from '@/components/layout/Header.tsx';
import { useSettingsStore } from '@/store/useSettingsStore.ts';
import { useAuthStore } from '@/store/useAuthStore.ts';
import styles from './Settings.module.css';

const FONT_OPTIONS = [
  'Times New Roman',
  'Arial',
  'Calibri',
  'Cambria',
  'Georgia',
  'Verdana',
  'Tahoma',
  'Courier New',
  'Comic Sans MS',
];

interface ToggleRowProps {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ label, desc, value, onChange }: ToggleRowProps) {
  return (
    <div className={styles.row}>
      <div>
        <div className={styles.rowLabel}>{label}</div>
        <div className={styles.rowDesc}>{desc}</div>
      </div>
      <div
        className={`${styles.toggle} ${value ? styles.active : ''}`}
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onChange(!value);
        }}
      >
        <div className={styles.toggleDot} />
      </div>
    </div>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const logout = useAuthStore((s) => s.logout);

  const defaultFont = useSettingsStore((s) => s.defaultFont);
  const defaultFontSize = useSettingsStore((s) => s.defaultFontSize);
  const autoSave = useSettingsStore((s) => s.autoSave);
  const showFieldHints = useSettingsStore((s) => s.showFieldHints);
  const darkPreview = useSettingsStore((s) => s.darkPreview);

  const setDefaultFont = useSettingsStore((s) => s.setDefaultFont);
  const setDefaultFontSize = useSettingsStore((s) => s.setDefaultFontSize);
  const setAutoSave = useSettingsStore((s) => s.setAutoSave);
  const setShowFieldHints = useSettingsStore((s) => s.setShowFieldHints);
  const setDarkPreview = useSettingsStore((s) => s.setDarkPreview);

  const handleLogout = async () => {
    await logout();
    navigate('/auth', { replace: true });
  };

  return (
    <>
      <Header title="Налаштування" />
      <div className={styles.page}>
        {isAdmin() && (
          <GlassCard padding="md">
            <p className={styles.sectionTitle}>Стандартне форматування</p>
            <div className={styles.settingsGroup}>
              <div className={styles.selectWrapper}>
                <label className={styles.selectLabel}>Шрифт за замовчуванням</label>
                <select
                  className={styles.select}
                  value={defaultFont}
                  onChange={(e) => setDefaultFont(e.target.value)}
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font} value={font}>{font}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Розмір шрифту (пт)"
                type="number"
                value={defaultFontSize}
                onChange={(e) => setDefaultFontSize(Number(e.target.value))}
              />
            </div>
          </GlassCard>
        )}

        <GlassCard padding="md">
          <p className={styles.sectionTitle}>Загальні</p>
          <div className={styles.settingsGroup}>
            <ToggleRow
              label="Автозбереження"
              desc="Автоматично зберігати зміни при редагуванні"
              value={autoSave}
              onChange={setAutoSave}
            />
            <ToggleRow
              label="Підказки полів"
              desc="Показувати підказки біля полів в редакторі"
              value={showFieldHints}
              onChange={setShowFieldHints}
            />
            <ToggleRow
              label="Темний перегляд"
              desc="Темний фон у попередньому перегляді"
              value={darkPreview}
              onChange={setDarkPreview}
            />
          </div>
        </GlassCard>

        <GlassCard padding="md">
          <button className={styles.logoutRow} onClick={handleLogout}>
            <LogOut size={18} />
            <span>Вийти з акаунту</span>
          </button>
        </GlassCard>

        <p className={styles.footer}>
          AutoWord v1.0.0 — Автоматизація документів
          <br />
          Побудовано з React, TypeScript та любов&#39;ю
        </p>
      </div>
    </>
  );
}
