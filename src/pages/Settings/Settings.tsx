import { GlassCard, Input } from '@/components/ui/index.ts';
import { Header } from '@/components/layout/Header.tsx';
import { useSettingsStore } from '@/store/useSettingsStore.ts';
import styles from './Settings.module.css';

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

  return (
    <>
      <Header title="Налаштування" />
      <div className={styles.page}>
        <GlassCard padding="md">
          <p className={styles.sectionTitle}>Стандартне форматування</p>
          <div className={styles.settingsGroup}>
            <Input
              label="Шрифт за замовчуванням"
              value={defaultFont}
              onChange={(e) => setDefaultFont(e.target.value)}
            />
            <Input
              label="Розмір шрифту (пт)"
              type="number"
              value={defaultFontSize}
              onChange={(e) => setDefaultFontSize(Number(e.target.value))}
            />
          </div>
        </GlassCard>

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

        <p className={styles.footer}>
          AutoWord v1.0.0 — Автоматизація документів
          <br />
          Побудовано з React, TypeScript та любов&#39;ю
        </p>
      </div>
    </>
  );
}
