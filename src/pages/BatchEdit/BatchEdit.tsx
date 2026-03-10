import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Layers,
  Download,
  Search,
  Replace,
  Check,
  Trash2,
  X,
} from 'lucide-react';
import { renderAsync } from 'docx-preview';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { GlassCard, Button, FileDropZone } from '@/components/ui/index.ts';
import { Header } from '@/components/layout/Header.tsx';
import styles from './BatchEdit.module.css';

interface BatchFile {
  id: string;
  name: string;
  size: number;
  originalBuffer: ArrayBuffer;
  currentBuffer: ArrayBuffer;
  modified: boolean;
}

export function BatchEdit() {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showFindBar, setShowFindBar] = useState(false);
  const [toast, setToast] = useState<{ text: string; detail: string } | null>(null);
  const [matchStats, setMatchStats] = useState({ totalMatches: 0, filesWithMatches: 0 });
  const previewRef = useRef<HTMLDivElement>(null);

  const selectedFile = files.find((f) => f.id === selectedId);

  // ── Render preview via docx-preview ──
  useEffect(() => {
    if (!previewRef.current) return;
    const container = previewRef.current;

    if (!selectedFile) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = '';
    renderAsync(selectedFile.currentBuffer, container, undefined, {
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
    }).catch(console.error);
  }, [selectedFile]);

  // ── Count matches in .docx XML ──
  useEffect(() => {
    if (!findText || files.length === 0) {
      setMatchStats({ totalMatches: 0, filesWithMatches: 0 });
      return;
    }

    let cancelled = false;
    const findXml = escapeXml(findText);
    const regex = new RegExp(escapeRegex(findXml), 'gi');

    (async () => {
      let total = 0;
      let withMatches = 0;

      for (const file of files) {
        try {
          const zip = await JSZip.loadAsync(file.currentBuffer);
          let fileMatches = 0;

          for (const path of Object.keys(zip.files)) {
            if (path.startsWith('word/') && path.endsWith('.xml') && !zip.files[path].dir) {
              const xml = await zip.files[path].async('string');
              const m = xml.match(regex);
              if (m) fileMatches += m.length;
            }
          }

          if (fileMatches > 0) {
            total += fileMatches;
            withMatches++;
          }
        } catch { /* skip corrupt files */ }
      }

      if (!cancelled) setMatchStats({ totalMatches: total, filesWithMatches: withMatches });
    })();

    return () => { cancelled = true; };
  }, [findText, files]);

  // ── Upload files ──
  const handleUploadFiles = useCallback(async (newFiles: File[]) => {
    const batchFiles: BatchFile[] = [];
    for (const file of newFiles) {
      const buffer = await file.arrayBuffer();
      batchFiles.push({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        originalBuffer: buffer,
        currentBuffer: buffer,
        modified: false,
      });
    }
    setFiles((prev) => {
      if (!selectedId && batchFiles.length > 0) {
        setSelectedId(batchFiles[0].id);
      }
      return [...prev, ...batchFiles];
    });
  }, [selectedId]);

  // ── Find & Replace in .docx XML ──
  const handleReplaceAll = async () => {
    if (!findText) return;

    const findXml = escapeXml(findText);
    const replaceXml = escapeXml(replaceText);
    const regex = new RegExp(escapeRegex(findXml), 'g');

    let totalReplacements = 0;
    let filesChanged = 0;

    const updatedFiles = await Promise.all(
      files.map(async (file) => {
        try {
          const zip = await JSZip.loadAsync(file.currentBuffer);
          let fileChanges = 0;

          for (const path of Object.keys(zip.files)) {
            if (path.startsWith('word/') && path.endsWith('.xml') && !zip.files[path].dir) {
              const xml = await zip.files[path].async('string');
              const m = xml.match(regex);
              if (m) {
                fileChanges += m.length;
                zip.file(path, xml.replace(regex, replaceXml));
              }
            }
          }

          if (fileChanges === 0) return file;

          totalReplacements += fileChanges;
          filesChanged++;
          const newBuffer = await zip.generateAsync({ type: 'arraybuffer' });
          return { ...file, currentBuffer: newBuffer, modified: true };
        } catch {
          return file;
        }
      })
    );

    setFiles(updatedFiles);
    setToast({
      text: `Замінено ${totalReplacements} збігів`,
      detail: `у ${filesChanged} файлах`,
    });
    setTimeout(() => setToast(null), 3000);
    setFindText('');
  };

  // ── Export ──
  const handleExportSingle = (file: BatchFile) => {
    const blob = new Blob([file.currentBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    saveAs(blob, file.modified ? file.name.replace(/\.docx$/i, '_edited.docx') : file.name);
  };

  const handleExportFiles = async (filesToExport: BatchFile[]) => {
    if (filesToExport.length === 0) return;

    if (filesToExport.length === 1) {
      handleExportSingle(filesToExport[0]);
      return;
    }

    const zip = new JSZip();
    for (const file of filesToExport) {
      const name = file.modified
        ? file.name.replace(/\.docx$/i, '_edited.docx')
        : file.name;
      zip.file(name, file.currentBuffer);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'autoword_edited.zip');
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id) {
      setSelectedId(files.find((f) => f.id !== id)?.id ?? null);
    }
  };

  const handleClearAll = () => {
    setFiles([]);
    setSelectedId(null);
  };

  const modifiedCount = files.filter((f) => f.modified).length;

  // ── Empty State ──
  if (files.length === 0) {
    return (
      <>
        <Header title="Масове редагування" breadcrumb="Знайти та замінити у багатьох файлах" />
        <div className={styles.page}>
          <GlassCard padding="lg">
            <div className={styles.emptyState}>
              <Layers size={56} className={styles.emptyIcon} />
              <p className={styles.emptyTitle}>Закиньте .docx файли для масового редагування</p>
              <p className={styles.emptyDesc}>
                Перетягніть кілька Word-файлів — вони одразу з'являться в списку.
                Далі використовуйте «Знайти та замінити», щоб змінити текст у всіх файлах одночасно.
              </p>
              <FileDropZone onFiles={handleUploadFiles} />
            </div>
          </GlassCard>
        </div>
      </>
    );
  }

  // ── Main Layout ──
  return (
    <>
      <Header title="Масове редагування" breadcrumb={`${files.length} файлів завантажено`} />
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div className={styles.statsBar}>
              <div className={styles.stat}>
                <span className={styles.statValue}>{files.length}</span>
                <span className={styles.statLabel}>файлів</span>
              </div>
              {modifiedCount > 0 && (
                <div className={styles.stat}>
                  <span className={styles.statValue} style={{ color: 'var(--color-accent)' }}>{modifiedCount}</span>
                  <span className={styles.statLabel}>змінено</span>
                </div>
              )}
            </div>
          </div>
          <div className={styles.topActions}>
            <Button
              variant="secondary"
              size="md"
              icon={<Search size={16} />}
              onClick={() => setShowFindBar((v) => !v)}
            >
              Знайти та замінити
            </Button>
            {modifiedCount > 0 && (
              <Button
                variant="secondary"
                size="md"
                icon={<Download size={16} />}
                onClick={() => handleExportFiles(files.filter((f) => f.modified))}
              >
                Змінені ({modifiedCount})
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              icon={<Download size={16} />}
              onClick={() => handleExportFiles(files)}
            >
              Експорт всіх
            </Button>
          </div>
        </div>

        <div className={styles.layout}>
          {/* ── Left: File List ── */}
          <div className={styles.fileListPanel}>
            <div className={styles.fileListHeader}>
              <span className={styles.fileListTitle}>Файли</span>
              <span className={styles.fileCount}>{files.length}</span>
            </div>
            <div className={styles.fileList}>
              <AnimatePresence>
                {files.map((file) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    className={[
                      styles.fileItem,
                      selectedId === file.id && styles.active,
                      file.modified && styles.modified,
                    ].filter(Boolean).join(' ')}
                    onClick={() => setSelectedId(file.id)}
                  >
                    <div className={styles.fileIcon}>
                      <FileText size={14} />
                    </div>
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <div className={styles.fileName}>{file.name}</div>
                      <div className={styles.fileMeta}>
                        {(file.size / 1024).toFixed(1)} KB
                        {file.modified && ' · змінено'}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(file.id);
                      }}
                      className={styles.deleteBtn}
                      aria-label="Видалити файл"
                    >
                      <Trash2 size={12} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <FileDropZone onFiles={handleUploadFiles} />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              style={{ marginTop: 6, width: '100%' }}
            >
              Очистити все
            </Button>
          </div>

          {/* ── Document Area ── */}
          <div className={styles.docArea}>
            {/* Floating Find & Replace */}
            <AnimatePresence>
              {showFindBar && (
                <motion.div
                  className={styles.findBar}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className={styles.findBarHeader}>
                    <span className={styles.findBarTitle}>
                      <Replace size={14} />
                      Знайти та замінити
                    </span>
                    <button className={styles.findBarClose} onClick={() => setShowFindBar(false)}>
                      <X size={14} />
                    </button>
                  </div>
                  <div className={styles.findBarFields}>
                    <div className={styles.findBarRow}>
                      <input
                        className={styles.findBarInput}
                        placeholder="Знайти..."
                        value={findText}
                        onChange={(e) => setFindText(e.target.value)}
                      />
                    </div>
                    <div className={styles.findBarRow}>
                      <input
                        className={styles.findBarInput}
                        placeholder="Замінити на..."
                        value={replaceText}
                        onChange={(e) => setReplaceText(e.target.value)}
                      />
                      <button
                        className={`${styles.findBarBtn} ${styles.findBarBtnPrimary}`}
                        onClick={handleReplaceAll}
                        disabled={!findText || matchStats.totalMatches === 0}
                      >
                        Замінити все
                      </button>
                    </div>
                  </div>
                  {findText && (
                    <div className={styles.findBarInfo}>
                      Знайдено <span className={styles.findBarInfoHighlight}>{matchStats.totalMatches}</span> збігів
                      у <span className={styles.findBarInfoHighlight}>{matchStats.filesWithMatches}</span> файлах
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {selectedFile ? (
              <>
                <div className={styles.docToolbar}>
                  <div className={styles.docToolbarLeft}>
                    <FileText size={16} style={{ color: 'var(--color-primary)' }} />
                    <span className={styles.docFileName}>
                      {selectedFile.name}
                      {selectedFile.modified && (
                        <span style={{ color: 'var(--color-accent)', marginLeft: 8, fontSize: 12 }}>
                          (змінено)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className={styles.docToolbarRight}>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Download size={14} />}
                      onClick={() => handleExportSingle(selectedFile)}
                    >
                      Експорт
                    </Button>
                  </div>
                </div>
                <div ref={previewRef} className={styles.previewContainer} />
              </>
            ) : (
              <div className={styles.previewEmpty}>
                <FileText size={40} style={{ opacity: 0.15 }} />
                <p>Оберіть файл зі списку зліва</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={styles.changeToast}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className={styles.changeToastIcon}>
              <Check size={16} />
            </div>
            <div>
              <div className={styles.changeToastText}>{toast.text}</div>
              <div className={styles.changeToastDetail}>{toast.detail}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
