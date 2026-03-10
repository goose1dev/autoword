import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExportOptions } from '@/services/exportService.ts';

interface SettingsStore {
  defaultFont: string;
  defaultFontSize: number;
  autoSave: boolean;
  showFieldHints: boolean;
  darkPreview: boolean;

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
      defaultFont: 'Times New Roman',
      defaultFontSize: 14,
      autoSave: true,
      showFieldHints: true,
      darkPreview: false,

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
