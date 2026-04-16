import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  RotateCcw,
  Sparkles,
  Target,
} from 'lucide-react';
import { renderAsync } from 'docx-preview';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { GlassCard, Button, FileDropZone } from '@/components/ui/index.ts';
import { Header } from '@/components/layout/Header.tsx';
import { useSettingsStore } from '@/store/useSettingsStore.ts';
import styles from './BatchEdit.module.css';

interface BatchFile {
  id: string;
  name: string;
  size: number;
  originalBuffer: ArrayBuffer;
  currentBuffer: ArrayBuffer;
  modified: boolean;
}

type ReplaceScope = 'all' | 'selected';

interface ReplaceOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  scope: ReplaceScope;
}

interface MatchSnippet {
  before: string;
  match: string;
  after: string;
}

interface FileImpact {
  fileId: string;
  fileName: string;
  matches: number;
  snippets: MatchSnippet[];
}

interface ReplaceHistoryEntry {
  id: string;
  at: number;
  findText: string;
  replaceText: string;
  totalReplacements: number;
  filesChanged: number;
  scope: ReplaceScope;
  previousBuffers: Record<string, ArrayBuffer>;
}

interface QuickIdea {
  id: string;
  label: string;
  find: string;
  replace: string;
}

const QUICK_IDEAS: QuickIdea[] = [
  { id: 'double-space', label: 'Подвійні пробіли', find: '  ', replace: ' ' },
  { id: 'long-dash', label: 'Довге тире -> дефіс', find: '—', replace: '-' },
  { id: 'smart-quote-left', label: 'Ліва лапка -> "', find: '“', replace: '"' },
  { id: 'smart-quote-right', label: 'Права лапка -> "', find: '”', replace: '"' },
  { id: 'apostrophe', label: 'Типографський апостроф', find: '’', replace: "'" },
  { id: 'nbsp', label: 'Нерозривний пробіл', find: '\u00A0', replace: ' ' },
];

export function BatchEdit() {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showFindBar, setShowFindBar] = useState(true);
  const [toast, setToast] = useState<{ text: string; detail: string } | null>(null);
  const [matchStats, setMatchStats] = useState({ totalMatches: 0, filesWithMatches: 0 });
  const [analysisImpacts, setAnalysisImpacts] = useState<FileImpact[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [replaceOptions, setReplaceOptions] = useState<ReplaceOptions>({
    caseSensitive: false,
    wholeWord: false,
    scope: 'all',
  });
  const [history, setHistory] = useState<ReplaceHistoryEntry[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);
  const darkPreview = useSettingsStore((s) => s.darkPreview);

  const selectedFile = files.find((f) => f.id === selectedId);
  const targetFiles = useMemo(() => {
    if (replaceOptions.scope === 'selected') {
      return selectedFile ? [selectedFile] : [];
    }
    return files;
  }, [files, replaceOptions.scope, selectedFile]);

  const canReplace =
    Boolean(findText.trim())
    && matchStats.totalMatches > 0
    && targetFiles.length > 0
    && !processing;

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

  // ── Analyze match impact (count + snippets) ──
  useEffect(() => {
    if (!findText.trim() || targetFiles.length === 0) {
      setMatchStats({ totalMatches: 0, filesWithMatches: 0 });
      setAnalysisImpacts([]);
      setAnalysisLoading(false);
      return;
    }

    let cancelled = false;
    setAnalysisLoading(true);

    (async () => {
      let total = 0;
      let withMatches = 0;
      const impacts: FileImpact[] = [];

      for (const file of targetFiles) {
        try {
          const zip = await JSZip.loadAsync(file.currentBuffer);
          let fileMatches = 0;
          const snippets: MatchSnippet[] = [];

          for (const path of Object.keys(zip.files)) {
            if (path.startsWith('word/') && path.endsWith('.xml') && !zip.files[path].dir) {
              const xml = await zip.files[path].async('string');
              const text = extractVisibleTextFromWordXml(xml);
              if (!text) continue;
              const indices = findAllMatchIndices(text, findText, replaceOptions);
              if (indices.length > 0) {
                fileMatches += indices.length;
                if (snippets.length < 3) {
                  for (const index of indices) {
                    if (snippets.length >= 3) break;
                    snippets.push(buildSnippet(text, index, findText.length));
                  }
                }
              }
            }
          }

          if (fileMatches > 0) {
            total += fileMatches;
            withMatches++;
            impacts.push({
              fileId: file.id,
              fileName: file.name,
              matches: fileMatches,
              snippets,
            });
          }
        } catch { /* skip corrupt files */ }
      }

      impacts.sort((a, b) => b.matches - a.matches);

      if (!cancelled) {
        setMatchStats({ totalMatches: total, filesWithMatches: withMatches });
        setAnalysisImpacts(impacts);
        setAnalysisLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [findText, targetFiles, replaceOptions]);

  // ── Upload files ──
  const handleUploadFiles = useCallback(async (newFiles: File[]) => {
    const batchFiles: BatchFile[] = [];
    for (const file of newFiles) {
      const buffer = await file.arrayBuffer();
      batchFiles.push({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        originalBuffer: buffer.slice(0),
        currentBuffer: buffer.slice(0),
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

  const handleApplyQuickIdea = (idea: QuickIdea) => {
    setFindText(idea.find);
    setReplaceText(idea.replace);
    setShowFindBar(true);
  };

  const handleUndoLast = () => {
    if (history.length === 0) return;
    const [last, ...rest] = history;

    setFiles((prev) => prev.map((file) => {
      const previousBuffer = last.previousBuffers[file.id];
      if (!previousBuffer) return file;
      const restored = previousBuffer.slice(0);
      return {
        ...file,
        currentBuffer: restored,
        modified: !buffersEqual(restored, file.originalBuffer),
      };
    }));

    setHistory(rest);
    setToast({
      text: 'Останню операцію скасовано',
      detail: `Відновлено ${last.filesChanged} файлів`,
    });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Find & Replace in .docx XML ──
  const handleReplaceAll = async () => {
    if (!canReplace) return;

    setProcessing(true);

    const findXml = escapeXml(findText);
    const replaceXml = escapeXml(replaceText);
    const targetIds = new Set(targetFiles.map((f) => f.id));

    let totalReplacements = 0;
    let filesChanged = 0;
    const previousBuffers: Record<string, ArrayBuffer> = {};

    const updatedFiles = await Promise.all(
      files.map(async (file) => {
        if (!targetIds.has(file.id)) return file;

        try {
          const zip = await JSZip.loadAsync(file.currentBuffer);
          let fileChanges = 0;

          for (const path of Object.keys(zip.files)) {
            if (path.startsWith('word/') && path.endsWith('.xml') && !zip.files[path].dir) {
              const xml = await zip.files[path].async('string');
              const result = replaceTextInXml(xml, findXml, replaceXml, replaceOptions);
              if (result.count > 0) {
                fileChanges += result.count;
                zip.file(path, result.xml);
              }
            }
          }

          if (fileChanges === 0) return file;

          previousBuffers[file.id] = file.currentBuffer.slice(0);
          totalReplacements += fileChanges;
          filesChanged++;
          const newBuffer = await zip.generateAsync({ type: 'arraybuffer' });
          return {
            ...file,
            currentBuffer: newBuffer,
            modified: !buffersEqual(newBuffer, file.originalBuffer),
          };
        } catch {
          return file;
        }
      })
    );

    setFiles(updatedFiles);

    if (filesChanged > 0) {
      setHistory((prev) => [
        {
          id: crypto.randomUUID(),
          at: Date.now(),
          findText,
          replaceText,
          totalReplacements,
          filesChanged,
          scope: replaceOptions.scope,
          previousBuffers,
        },
        ...prev,
      ].slice(0, 20));
    }

    setToast({
      text: `Замінено ${totalReplacements} збігів`,
      detail: `${replaceOptions.scope === 'selected' ? 'Лише у вибраному файлі' : `у ${filesChanged} файлах`}`,
    });
    setTimeout(() => setToast(null), 3000);
    setProcessing(false);
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
    setFiles((prev) => {
      const next = prev.filter((f) => f.id !== id);
      setSelectedId((current) => (current === id ? (next[0]?.id ?? null) : current));
      return next;
    });
  };

  const handleClearAll = () => {
    setFiles([]);
    setSelectedId(null);
    setHistory([]);
    setFindText('');
    setReplaceText('');
    setAnalysisImpacts([]);
    setMatchStats({ totalMatches: 0, filesWithMatches: 0 });
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
              variant={showFindBar ? 'primary' : 'secondary'}
              size="md"
              icon={<Search size={16} />}
              onClick={() => setShowFindBar((v) => !v)}
            >
              Панель заміни
            </Button>
            <Button
              variant="ghost"
              size="md"
              icon={<RotateCcw size={16} />}
              disabled={history.length === 0}
              onClick={handleUndoLast}
            >
              Скасувати
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

        {history.length > 0 && (
          <div className={styles.historyStrip}>
            {history.slice(0, 3).map((entry) => (
              <div key={entry.id} className={styles.historyItem}>
                <span className={styles.historyTime}>
                  {new Date(entry.at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={styles.historyText}>
                  {entry.findText || 'порожньо'} &rarr; {entry.replaceText || '(видалення)'}
                </span>
                <span className={styles.historyMeta}>
                  {entry.totalReplacements} змін / {entry.filesChanged} файлів
                </span>
              </div>
            ))}
          </div>
        )}

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
                        disabled={!canReplace}
                      >
                        {processing ? 'Обробка...' : 'Замінити'}
                      </button>
                    </div>
                  </div>

                  <div className={styles.findBarOptions}>
                    <label className={styles.optionCheck}>
                      <input
                        type="checkbox"
                        checked={replaceOptions.caseSensitive}
                        onChange={(e) => setReplaceOptions((prev) => ({ ...prev, caseSensitive: e.target.checked }))}
                      />
                      Враховувати регістр
                    </label>
                    <label className={styles.optionCheck}>
                      <input
                        type="checkbox"
                        checked={replaceOptions.wholeWord}
                        onChange={(e) => setReplaceOptions((prev) => ({ ...prev, wholeWord: e.target.checked }))}
                      />
                      Тільки ціле слово
                    </label>
                  </div>

                  <div className={styles.scopeRow}>
                    <button
                      className={`${styles.scopeBtn} ${replaceOptions.scope === 'all' ? styles.scopeBtnActive : ''}`}
                      onClick={() => setReplaceOptions((prev) => ({ ...prev, scope: 'all' }))}
                    >
                      Усі файли
                    </button>
                    <button
                      className={`${styles.scopeBtn} ${replaceOptions.scope === 'selected' ? styles.scopeBtnActive : ''}`}
                      onClick={() => setReplaceOptions((prev) => ({ ...prev, scope: 'selected' }))}
                      disabled={!selectedFile}
                    >
                      Лише вибраний
                    </button>
                  </div>

                  <div className={styles.quickIdeas}>
                    <div className={styles.quickIdeasTitle}>
                      <Sparkles size={13} />
                      Швидкі ідеї
                    </div>
                    <div className={styles.quickIdeasList}>
                      {QUICK_IDEAS.map((idea) => (
                        <button
                          key={idea.id}
                          className={styles.quickIdeaBtn}
                          onClick={() => handleApplyQuickIdea(idea)}
                        >
                          {idea.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {findText && (
                    <div className={styles.findBarInfo}>
                      Знайдено <span className={styles.findBarInfoHighlight}>{matchStats.totalMatches}</span> збігів
                      у <span className={styles.findBarInfoHighlight}>{matchStats.filesWithMatches}</span> файлах
                    </div>
                  )}

                  <div className={styles.impactPanel}>
                    <div className={styles.impactPanelHeader}>
                      <span className={styles.impactTitle}>
                        <Target size={13} />
                        Попередній вплив
                      </span>
                      {analysisLoading && <span className={styles.analysisBadge}>Аналіз...</span>}
                    </div>

                    {!findText.trim() && (
                      <p className={styles.analysisPlaceholder}>
                        Введіть фразу, щоб побачити, де саме будуть зміни.
                      </p>
                    )}

                    {findText.trim() && !analysisLoading && analysisImpacts.length === 0 && (
                      <p className={styles.analysisPlaceholder}>Збігів не знайдено у вибраному scope.</p>
                    )}

                    {analysisImpacts.length > 0 && (
                      <div className={styles.impactList}>
                        {analysisImpacts.slice(0, 8).map((impact) => (
                          <div key={impact.fileId} className={styles.impactItem}>
                            <div className={styles.impactItemTop}>
                              <span className={styles.impactFileName}>{impact.fileName}</span>
                              <span className={styles.impactCount}>{impact.matches}</span>
                            </div>
                            {impact.snippets.map((snippet, index) => (
                              <div key={`${impact.fileId}-${index}`} className={styles.snippet}>
                                <span>{snippet.before}</span>
                                <mark>{snippet.match}</mark>
                                <span>{snippet.after}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
                <div ref={previewRef} className={`${styles.previewContainer} ${darkPreview ? styles.dark : ''}`} />
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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#160;/g, ' ')
    .replace(/&nbsp;/g, ' ');
}

function extractVisibleTextFromWordXml(xml: string): string {
  const chunks: string[] = [];
  const regex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    chunks.push(decodeXmlEntities(match[1]));
  }

  return chunks.join(' ').replace(/\s+/g, ' ').trim();
}

const WORD_CHAR_REGEX = /[A-Za-z0-9А-Яа-яІіЇїЄєҐґ_]/;

function isWordChar(char: string): boolean {
  if (!char) return false;
  return WORD_CHAR_REGEX.test(char);
}

function isWholeWordBoundary(text: string, index: number, length: number): boolean {
  const before = index > 0 ? text[index - 1] : '';
  const after = index + length < text.length ? text[index + length] : '';
  return !isWordChar(before) && !isWordChar(after);
}

function findAllMatchIndices(text: string, query: string, options: Pick<ReplaceOptions, 'caseSensitive' | 'wholeWord'>): number[] {
  if (!query) return [];
  const normalizedText = options.caseSensitive ? text : text.toLocaleLowerCase('uk-UA');
  const normalizedQuery = options.caseSensitive ? query : query.toLocaleLowerCase('uk-UA');
  const indices: number[] = [];

  let from = 0;
  while (from <= normalizedText.length - normalizedQuery.length) {
    const index = normalizedText.indexOf(normalizedQuery, from);
    if (index === -1) break;

    if (!options.wholeWord || isWholeWordBoundary(text, index, query.length)) {
      indices.push(index);
    }

    from = index + Math.max(1, normalizedQuery.length);
  }

  return indices;
}

function buildSnippet(text: string, index: number, length: number): MatchSnippet {
  const context = 32;
  const start = Math.max(0, index - context);
  const end = Math.min(text.length, index + length + context);
  const before = `${start > 0 ? '…' : ''}${text.slice(start, index)}`;
  const match = text.slice(index, index + length);
  const after = `${text.slice(index + length, end)}${end < text.length ? '…' : ''}`;

  return { before, match, after };
}

function replaceInText(
  text: string,
  findText: string,
  replaceText: string,
  options: Pick<ReplaceOptions, 'caseSensitive' | 'wholeWord'>,
): { text: string; count: number } {
  if (!findText) return { text, count: 0 };

  const normalizedText = options.caseSensitive ? text : text.toLocaleLowerCase('uk-UA');
  const normalizedFind = options.caseSensitive ? findText : findText.toLocaleLowerCase('uk-UA');

  let from = 0;
  let count = 0;
  let output = '';

  while (from <= normalizedText.length - normalizedFind.length) {
    const index = normalizedText.indexOf(normalizedFind, from);
    if (index === -1) break;

    if (options.wholeWord && !isWholeWordBoundary(text, index, findText.length)) {
      output += text.slice(from, index + 1);
      from = index + 1;
      continue;
    }

    output += text.slice(from, index);
    output += replaceText;
    from = index + findText.length;
    count++;
  }

  if (count === 0) {
    return { text, count: 0 };
  }

  output += text.slice(from);
  return { text: output, count };
}

function replaceInParagraph(
  paragraphXml: string,
  findText: string,
  replaceText: string,
  options: Pick<ReplaceOptions, 'caseSensitive' | 'wholeWord'>,
): { xml: string; count: number } {
  const runRegex = /(<w:r\b[^>]*>)([\s\S]*?)(<\/w:r>)/g;
  const textRegex = /(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/;

  interface RunInfo {
    fullMatch: string;
    pre: string;
    textOpen: string;
    text: string;
    post: string;
  }

  const runs: RunInfo[] = [];
  let concatenated = '';
  let runMatch: RegExpExecArray | null;

  while ((runMatch = runRegex.exec(paragraphXml)) !== null) {
    const runBody = runMatch[2];
    const textMatch = textRegex.exec(runBody);

    if (!textMatch) continue;

    const beforeText = runBody.substring(0, textMatch.index);
    const afterText = runBody.substring(textMatch.index + textMatch[0].length);
    runs.push({
      fullMatch: runMatch[0],
      pre: `${runMatch[1]}${beforeText}${textMatch[1]}`,
      textOpen: textMatch[1],
      text: textMatch[2],
      post: `${afterText}${runMatch[3]}`,
    });
    concatenated += textMatch[2];
  }

  if (runs.length === 0) return { xml: paragraphXml, count: 0 };

  const replacement = replaceInText(concatenated, findText, replaceText, options);
  if (replacement.count === 0) return { xml: paragraphXml, count: 0 };

  let resultXml = paragraphXml;
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const replacementText = i === 0 ? replacement.text : '';
    const preserveSpace = run.textOpen.includes('xml:space')
      ? run.textOpen
      : run.textOpen.replace('>', ' xml:space="preserve">');
    const newRun = run.pre.replace(run.textOpen, preserveSpace) + replacementText + run.post;
    resultXml = resultXml.replace(run.fullMatch, newRun);
  }

  return { xml: resultXml, count: replacement.count };
}

function replaceTextInXml(
  xml: string,
  findText: string,
  replaceText: string,
  options: Pick<ReplaceOptions, 'caseSensitive' | 'wholeWord'>,
): { xml: string; count: number } {
  const direct = replaceInText(xml, findText, replaceText, options);
  if (direct.count > 0) {
    return { xml: direct.text, count: direct.count };
  }

  let total = 0;
  const paragraphRegex = /(<w:p\b[^>]*>[\s\S]*?<\/w:p>)/g;
  const paragraphReplaced = xml.replace(paragraphRegex, (paragraph) => {
    const result = replaceInParagraph(paragraph, findText, replaceText, options);
    total += result.count;
    return result.xml;
  });

  return { xml: paragraphReplaced, count: total };
}

function buffersEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const viewA = new Uint8Array(a);
  const viewB = new Uint8Array(b);
  for (let i = 0; i < viewA.length; i++) {
    if (viewA[i] !== viewB[i]) return false;
  }
  return true;
}
