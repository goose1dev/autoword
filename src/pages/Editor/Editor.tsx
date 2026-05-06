import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Eye, FileText } from 'lucide-react';
import { saveAs } from 'file-saver';
import { GlassCard, Button, DocxPreview, Input } from '@/components/ui/index.ts';
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
  const [exporting, setExporting] = useState(false);

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
      } else if (activeTemplate.fileUrl) {
        const response = await fetch(activeTemplate.fileUrl);
        const blob = await response.blob();
        const file = new File([blob], activeTemplate.fileName, {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        const buffer = await fillDocxTemplate(file, fieldValues);
        saveAs(new Blob([buffer], { type: blob.type }), activeTemplate.fileName || `${activeTemplate.name}.docx`);
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
              <DocxPreview
                file={activeTemplate?.rawFile}
                fileUrl={activeTemplate?.fileUrl}
                fileName={activeTemplate?.fileName}
                values={fieldValues}
                htmlFallback={highlightedHtml}
                dark={darkPreview}
              />
            </GlassCard>
          </div>
        </div>
      </div>
    </>
  );
}
