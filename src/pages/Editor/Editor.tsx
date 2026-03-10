import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, Printer, Eye } from 'lucide-react';
import { GlassCard, Button, Input } from '@/components/ui/index.ts';
import { Header } from '@/components/layout/Header.tsx';
import { useDocumentStore } from '@/store/useDocumentStore.ts';
import { useSettingsStore } from '@/store/useSettingsStore.ts';
import { fillTemplate } from '@/services/documentService.ts';
import { exportToDocx, type ExportOptions } from '@/services/exportService.ts';
import styles from './Editor.module.css';

export function Editor() {
  const navigate = useNavigate();
  const templates = useDocumentStore((s) => s.templates);
  const activeTemplateId = useDocumentStore((s) => s.activeTemplateId);
  const setActiveTemplate = useDocumentStore((s) => s.setActiveTemplate);

  const activeTemplate = templates.find((t) => t.id === activeTemplateId);

  const settingsFont = useSettingsStore((s) => s.defaultFont);
  const settingsFontSize = useSettingsStore((s) => s.defaultFontSize);
  const darkPreview = useSettingsStore((s) => s.darkPreview);

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [formatOptions, setFormatOptions] = useState<Partial<ExportOptions>>({
    marginTop: 20,
    marginBottom: 20,
    marginLeft: 30,
    marginRight: 15,
    fontSize: settingsFontSize,
    fontFamily: settingsFont,
    lineSpacing: 1.5,
  });

  const previewHtml = useMemo(() => {
    if (!activeTemplate) return '';
    return fillTemplate(activeTemplate.htmlPreview, fieldValues);
  }, [activeTemplate, fieldValues]);

  const highlightedHtml = useMemo(() => {
    if (!previewHtml) return '';
    return previewHtml.replace(
      /\{\{([^}]+)\}\}/g,
      `<span class="${styles.highlight}">{{$1}}</span>`
    );
  }, [previewHtml]);

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleFormatChange = (key: keyof ExportOptions, value: number) => {
    setFormatOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleExport = async () => {
    if (!activeTemplate) return;
    const filledContent = fillTemplate(activeTemplate.htmlPreview, fieldValues);
    await exportToDocx(filledContent, activeTemplate.name, formatOptions);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${activeTemplate?.name ?? 'Документ'}</title>
          <style>
            body { font-family: '${formatOptions.fontFamily ?? settingsFont}', serif; font-size: ${formatOptions.fontSize ?? settingsFontSize}pt; line-height: 1.6; padding: 40px; }
            @page { margin: ${formatOptions.marginTop ?? 20}mm ${formatOptions.marginRight ?? 15}mm ${formatOptions.marginBottom ?? 20}mm ${formatOptions.marginLeft ?? 30}mm; }
            .placeholder { background: #fef3c7; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
          </style>
        </head>
        <body>${previewHtml}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (templates.length === 0) {
    return (
      <>
        <Header title="Редактор" />
        <GlassCard padding="lg">
          <div className={styles.noTemplate}>
            <FileText size={48} style={{ opacity: 0.2 }} />
            <p className={styles.noTemplateTitle}>Спочатку завантажте шаблон</p>
            <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 16 }}>
              Перейдіть у розділ «Шаблони» та завантажте .docx файл
            </p>
            <Button variant="primary" onClick={() => navigate('/templates')}>
              Перейти до шаблонів
            </Button>
          </div>
        </GlassCard>
      </>
    );
  }

  return (
    <>
      <Header title="Редактор" breadcrumb={activeTemplate?.name} />
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div className={styles.topActions}>
            <Button
              variant="secondary"
              size="md"
              icon={<Printer size={16} />}
              onClick={handlePrint}
              disabled={!activeTemplate}
            >
              Друк
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={<Download size={16} />}
              onClick={handleExport}
              disabled={!activeTemplate}
            >
              Експорт .docx
            </Button>
          </div>
        </div>

        <div className={styles.editorLayout}>
          {/* ── Left: Fields ── */}
          <div className={styles.fieldsPanel}>
            <GlassCard padding="md">
              <div className={styles.fieldGroup}>
                <label className={styles.fieldsPanelTitle}>Шаблон</label>
                <select
                  className={styles.templateSelector}
                  value={activeTemplateId ?? ''}
                  onChange={(e) => setActiveTemplate(e.target.value)}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </GlassCard>

            {activeTemplate && activeTemplate.fields.length > 0 && (
              <GlassCard padding="md">
                <p className={styles.fieldsPanelTitle}>Поля документа</p>
                <div className={styles.fieldGroup}>
                  {activeTemplate.fields.map((field) => (
                    <Input
                      key={field.id}
                      label={field.label}
                      placeholder={`Введіть ${field.label.toLowerCase()}`}
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={fieldValues[field.key] ?? ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    />
                  ))}
                </div>
              </GlassCard>
            )}

            <GlassCard padding="md">
              <div className={styles.formatSection}>
                <p className={styles.formatTitle}>Форматування</p>
                <div className={styles.formatGrid}>
                  <Input
                    label="Верхній відступ (мм)"
                    type="number"
                    value={formatOptions.marginTop ?? 20}
                    onChange={(e) => handleFormatChange('marginTop', Number(e.target.value))}
                  />
                  <Input
                    label="Нижній відступ (мм)"
                    type="number"
                    value={formatOptions.marginBottom ?? 20}
                    onChange={(e) => handleFormatChange('marginBottom', Number(e.target.value))}
                  />
                  <Input
                    label="Лівий відступ (мм)"
                    type="number"
                    value={formatOptions.marginLeft ?? 30}
                    onChange={(e) => handleFormatChange('marginLeft', Number(e.target.value))}
                  />
                  <Input
                    label="Правий відступ (мм)"
                    type="number"
                    value={formatOptions.marginRight ?? 15}
                    onChange={(e) => handleFormatChange('marginRight', Number(e.target.value))}
                  />
                </div>
                <div className={styles.formatGrid}>
                  <Input
                    label="Розмір шрифту (пт)"
                    type="number"
                    value={formatOptions.fontSize ?? 14}
                    onChange={(e) => handleFormatChange('fontSize', Number(e.target.value))}
                  />
                  <Input
                    label="Міжрядковий інтервал"
                    type="number"
                    step="0.1"
                    value={formatOptions.lineSpacing ?? 1.5}
                    onChange={(e) => handleFormatChange('lineSpacing', Number(e.target.value))}
                  />
                </div>
              </div>
            </GlassCard>
          </div>

          {/* ── Right: Preview ── */}
          <div className={styles.previewPanel}>
            <GlassCard padding="md">
              <div className={styles.previewHeader}>
                <span className={styles.previewLabel}>
                  <Eye size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Попередній перегляд
                </span>
              </div>
              <div
                className={`${styles.previewContainer} ${darkPreview ? styles.dark : ''}`}
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            </GlassCard>
          </div>
        </div>
      </div>
    </>
  );
}
