import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Eye, FileText } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import { saveAs } from 'file-saver';
import { GlassCard, Button, Input } from '@/components/ui/index.ts';
import { Header } from '@/components/layout/Header.tsx';
import { useDocumentStore } from '@/store/useDocumentStore.ts';
import { useSettingsStore } from '@/store/useSettingsStore.ts';
import { fillDocxTemplate, fillTemplate } from '@/services/documentService.ts';
import { exportToDocx } from '@/services/exportService.ts';
import styles from './Editor.module.css';

export function Editor() {
  const navigate = useNavigate();
  const templates = useDocumentStore((s) => s.templates);
  const activeTemplateId = useDocumentStore((s) => s.activeTemplateId);
  const setActiveTemplate = useDocumentStore((s) => s.setActiveTemplate);
  const darkPreview = useSettingsStore((s) => s.darkPreview);

  const activeTemplate = templates.find((t) => t.id === activeTemplateId);

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [previewError, setPreviewError] = useState('');
  const [exporting, setExporting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const previewHtml = useMemo(() => {
    if (!activeTemplate) return '';
    return fillTemplate(activeTemplate.htmlPreview, fieldValues);
  }, [activeTemplate, fieldValues]);

  const highlightedHtml = useMemo(() => {
    if (!previewHtml) return '';
    return previewHtml.replace(
      /\{\{([^}]+)\}\}/g,
      `<span class="${styles.highlight}">{{$1}}</span>`,
    );
  }, [previewHtml]);

  useEffect(() => {
    if (!activeTemplate && templates.length > 0) {
      setActiveTemplate(templates[0].id);
    }
  }, [activeTemplate, setActiveTemplate, templates]);

  useEffect(() => {
    setFieldValues({});
  }, [activeTemplateId]);

  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;

    let cancelled = false;
    setPreviewError('');
    container.innerHTML = '';

    if (!activeTemplate) return;

    if (activeTemplate.rawFile.size === 0) {
      container.innerHTML = `<div class="${styles.htmlFallback}">${highlightedHtml}</div>`;
      setPreviewError('Оригінальний .docx файл недоступний, тому показано спрощений HTML-перегляд.');
      return;
    }

    (async () => {
      try {
        const buffer = await fillDocxTemplate(activeTemplate.rawFile, fieldValues);
        if (cancelled) return;

        container.innerHTML = '';
        await renderAsync(buffer, container, undefined, {
          className: 'docx',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        });
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          container.innerHTML = `<div class="${styles.htmlFallback}">${highlightedHtml}</div>`;
          setPreviewError('Не вдалося показати Word-перегляд. Показано спрощену версію.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTemplate, fieldValues, highlightedHtml]);

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleExport = async () => {
    if (!activeTemplate) return;

    setExporting(true);
    try {
      if (activeTemplate.rawFile.size > 0) {
        const buffer = await fillDocxTemplate(activeTemplate.rawFile, fieldValues);
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        saveAs(blob, activeTemplate.fileName || `${activeTemplate.name}.docx`);
      } else {
        await exportToDocx(previewHtml, activeTemplate.name);
      }
    } finally {
      setExporting(false);
    }
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
          <div />
          <div className={styles.topActions}>
            <Button
              variant="primary"
              size="md"
              icon={<Download size={16} />}
              onClick={handleExport}
              disabled={!activeTemplate || exporting}
            >
              {exporting ? 'Експорт...' : 'Експорт .docx'}
            </Button>
          </div>
        </div>

        <div className={styles.editorLayout}>
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
          </div>

          <div className={styles.previewPanel}>
            <GlassCard padding="md">
              <div className={styles.previewHeader}>
                <span className={styles.previewLabel}>
                  <Eye size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Попередній перегляд
                </span>
              </div>
              <div
                ref={previewRef}
                className={`${styles.previewContainer} ${darkPreview ? styles.dark : ''}`}
              />
              {previewError && (
                <div className={styles.previewError}>{previewError}</div>
              )}
            </GlassCard>
          </div>
        </div>
      </div>
    </>
  );
}
