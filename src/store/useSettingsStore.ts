import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExportOptions } from '@/services/exportService.ts';

export type ThemeMode = 'dark' | 'light';

interface SettingsStore {
  theme: ThemeMode;
  defaultFont: string;
  defaultFontSize: number;
  autoSave: boolean;
  showFieldHints: boolean;
  darkPreview: boolean;

  setTheme: (theme: ThemeMode) => void;
  setDefaultFont: (font: string) => void;
  setDefaultFontSize: (size: number) => void;
  setAutoSave: (v: boolean) => void;
  setShowFieldHints: (v: boolean) => void;
  setDarkPreview: (v: boolean) => void;

  getExportOptions: () => Partial<ExportOptions>;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      defaultFont: 'Times New Roman',
      defaultFontSize: 14,
      autoSave: true,
      showFieldHints: true,
      darkPreview: false,

      setTheme: (theme) => set({ theme }),
      setDefaultFont: (font) => set({ defaultFont: font }),
      setDefaultFontSize: (size) => set({ defaultFontSize: size }),
      setAutoSave: (v) => set({ autoSave: v }),
      setShowFieldHints: (v) => set({ showFieldHints: v }),
      setDarkPreview: (v) => set({ darkPreview: v }),

      getExportOptions: () => ({
        fontFamily: get().defaultFont,
        fontSize: get().defaultFontSize,
      }),
    }),
    {
      name: 'autoword-settings',
    }
  )
);
