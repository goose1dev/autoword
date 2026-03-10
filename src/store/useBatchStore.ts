import { create } from 'zustand';
import { persist, type StateStorage } from 'zustand/middleware';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// ── IndexedDB storage adapter for Zustand persist ──
// ArrayBuffers can't be JSON-serialized, so we convert to/from base64.

const DB_NAME = 'autoword-batch';
const STORE_NAME = 'state';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(name);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  },
  setItem: async (name: string, value: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, name);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  removeItem: async (name: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(name);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

// ── ArrayBuffer ↔ base64 helpers ──
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

interface SerializedBatchFile {
  id: string;
  name: string;
  size: number;
  originalBuffer: string;  // base64
  currentBuffer: string;   // base64
  modified: boolean;
}

export interface BatchFile {
  id: string;
  name: string;
  size: number;
  originalBuffer: ArrayBuffer;
  currentBuffer: ArrayBuffer;
  modified: boolean;
}

interface BatchStore {
  files: BatchFile[];
  selectedId: string | null;
  exportedCount: number;

  addFiles: (newFiles: File[]) => Promise<void>;
  removeFile: (id: string) => void;
  clearAll: () => void;
  selectFile: (id: string | null) => void;
  replaceAll: (findText: string, replaceText: string) => Promise<{ totalReplacements: number; filesChanged: number }>;
  exportSingle: (file: BatchFile) => void;
  exportAll: (filesToExport: BatchFile[]) => Promise<void>;
  updateFileBuffer: (id: string, buffer: ArrayBuffer) => void;
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

/**
 * Rebuild plain text from a sequence of <w:r> runs, replace occurrences,
 * then distribute the resulting text back across the original runs.
 *
 * This handles the common case where Word splits a single user-visible
 * string across several <w:r> elements (e.g. due to spell-check markers,
 * formatting changes, or revision tracking).
 */
function replaceInParagraph(paragraphXml: string, find: string, replace: string): { xml: string; count: number } {
  // Collect all <w:r>...</w:r> runs that contain a <w:t> text node.
  const runRegex = /(<w:r\b[^>]*>)([\s\S]*?)(<\/w:r>)/g;
  const textRegex = /(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/;

  interface RunInfo {
    fullMatch: string;
    pre: string;       // everything before <w:t>
    textOpen: string;   // <w:t ...>
    text: string;       // inner text
    textClose: string;  // </w:t>
    post: string;       // everything after </w:t>
    start: number;      // character offset in concatenated plaintext
  }

  const runs: RunInfo[] = [];
  let concatenated = '';
  let m: RegExpExecArray | null;

  // Temporarily work on the paragraph
  const tempXml = paragraphXml;

  // eslint-disable-next-line no-cond-assign
  while ((m = runRegex.exec(tempXml)) !== null) {
    const runBody = m[2];
    const tm = textRegex.exec(runBody);
    if (tm) {
      const beforeText = runBody.substring(0, tm.index);
      const afterText = runBody.substring(tm.index + tm[0].length);
      runs.push({
        fullMatch: m[0],
        pre: m[1] + beforeText + tm[1],
        textOpen: tm[1],
        text: tm[2],
        textClose: tm[3],
        post: afterText + m[3],
        start: concatenated.length,
      });
      concatenated += tm[2];
    }
  }

  if (runs.length === 0) return { xml: paragraphXml, count: 0 };

  const escapedFind = escapeRegex(find);
  const regex = new RegExp(escapedFind, 'g');
  const matches = concatenated.match(regex);
  if (!matches || matches.length === 0) return { xml: paragraphXml, count: 0 };

  const newConcatenated = concatenated.replace(regex, replace);

  // Distribute the new text back across runs.
  // Strategy: put all text into the first run, empty the rest.
  // This is simple and preserves the first run's formatting.
  if (runs.length === 1) {
    const run = runs[0];
    const preserveSpace = run.textOpen.includes('xml:space') ? run.textOpen : run.textOpen.replace('>', ' xml:space="preserve">');
    const newRun = run.pre.replace(run.textOpen, preserveSpace) + newConcatenated + run.post;
    return { xml: paragraphXml.replace(run.fullMatch, newRun), count: matches.length };
  }

  let result = paragraphXml;
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    if (i === 0) {
      const preserveSpace = run.textOpen.includes('xml:space') ? run.textOpen : run.textOpen.replace('>', ' xml:space="preserve">');
      const newRun = run.pre.replace(run.textOpen, preserveSpace) + newConcatenated + run.post;
      result = result.replace(run.fullMatch, newRun);
    } else {
      // Empty out subsequent runs' text
      const preserveSpace = run.textOpen.includes('xml:space') ? run.textOpen : run.textOpen.replace('>', ' xml:space="preserve">');
      const newRun = run.pre.replace(run.textOpen, preserveSpace) + run.post;
      result = result.replace(run.fullMatch, newRun);
    }
  }

  return { xml: result, count: matches.length };
}

function replaceTextInXml(xml: string, find: string, replace: string): { xml: string; count: number } {
  // First try simple direct replacement (works when text isn't split across runs)
  const escapedFind = escapeRegex(escapeXml(find));
  const simpleRegex = new RegExp(escapedFind, 'g');
  const simpleMatches = xml.match(simpleRegex);

  if (simpleMatches && simpleMatches.length > 0) {
    return {
      xml: xml.replace(simpleRegex, escapeXml(replace)),
      count: simpleMatches.length,
    };
  }

  // Fallback: paragraph-level search for split runs
  const escapedFindXml = escapeXml(find);
  const paragraphRegex = /(<w:p\b[^>]*>[\s\S]*?<\/w:p>)/g;
  let totalCount = 0;
  const newXml = xml.replace(paragraphRegex, (para) => {
    const result = replaceInParagraph(para, escapedFindXml, escapeXml(replace));
    totalCount += result.count;
    return result.xml;
  });

  return { xml: newXml, count: totalCount };
}

export async function countMatchesInFiles(files: BatchFile[], findText: string): Promise<{ totalMatches: number; filesWithMatches: number }> {
  if (!findText || files.length === 0) return { totalMatches: 0, filesWithMatches: 0 };

  const findXml = escapeXml(findText);
  const regex = new RegExp(escapeRegex(findXml), 'gi');
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

  return { totalMatches: total, filesWithMatches: withMatches };
}

export const useBatchStore = create<BatchStore>()(
  persist(
    (set, get) => ({
      files: [],
      selectedId: null,
      exportedCount: 0,

      addFiles: async (newFiles: File[]) => {
        const batchFiles: BatchFile[] = [];
        for (const f of newFiles) {
          if (!f.name.toLowerCase().endsWith('.docx')) continue;
          const buffer = await f.arrayBuffer();
          batchFiles.push({
            id: crypto.randomUUID(),
            name: f.name,
            size: f.size,
            originalBuffer: buffer.slice(0),
            currentBuffer: buffer.slice(0),
            modified: false,
          });
        }
        set((state) => {
          const newSelected = !state.selectedId && batchFiles.length > 0
            ? batchFiles[0].id
            : state.selectedId;
          return {
            files: [...state.files, ...batchFiles],
            selectedId: newSelected,
          };
        });
      },

      removeFile: (id: string) => {
        const { files, selectedId } = get();
        const remaining = files.filter((f) => f.id !== id);
        set({
          files: remaining,
          selectedId: selectedId === id
            ? (remaining[0]?.id ?? null)
            : selectedId,
        });
      },

      clearAll: () => {
        set({ files: [], selectedId: null });
      },

      selectFile: (id: string | null) => {
        set({ selectedId: id });
      },

      replaceAll: async (findText: string, replaceText: string) => {
        if (!findText) return { totalReplacements: 0, filesChanged: 0 };

        const { files } = get();
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
                  const result = replaceTextInXml(xml, findText, replaceText);
                  if (result.count > 0) {
                    fileChanges += result.count;
                    zip.file(path, result.xml);
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

        set({ files: updatedFiles });
        return { totalReplacements, filesChanged };
      },

      exportSingle: (file: BatchFile) => {
        const blob = new Blob([file.currentBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        saveAs(blob, file.modified ? file.name.replace(/\.docx$/i, '_edited.docx') : file.name);
        set((state) => ({ exportedCount: state.exportedCount + 1 }));
      },

      exportAll: async (filesToExport: BatchFile[]) => {
        if (filesToExport.length === 0) return;

        if (filesToExport.length === 1) {
          get().exportSingle(filesToExport[0]);
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
        set((state) => ({ exportedCount: state.exportedCount + filesToExport.length }));
      },

      updateFileBuffer: (id: string, buffer: ArrayBuffer) => {
        set((state) => ({
          files: state.files.map((f) =>
            f.id === id ? { ...f, currentBuffer: buffer, modified: true } : f
          ),
        }));
      },
    }),
    {
      name: 'autoword-batch-files',
      storage: {
        getItem: async (name) => {
          const raw = await idbStorage.getItem(name);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          // Rehydrate base64 → ArrayBuffer
          if (parsed?.state?.files) {
            parsed.state.files = (parsed.state.files as SerializedBatchFile[]).map((f) => ({
              ...f,
              originalBuffer: base64ToBuffer(f.originalBuffer),
              currentBuffer: base64ToBuffer(f.currentBuffer),
            }));
          }
          return parsed;
        },
        setItem: async (name, value) => {
          // Serialize ArrayBuffer → base64 before storing
          const toStore = {
            ...value,
            state: {
              ...value.state,
              files: value.state.files.map((f: BatchFile) => ({
                ...f,
                originalBuffer: bufferToBase64(f.originalBuffer),
                currentBuffer: bufferToBase64(f.currentBuffer),
              })),
            },
          };
          await idbStorage.setItem(name, JSON.stringify(toStore));
        },
        removeItem: async (name) => {
          await idbStorage.removeItem(name);
        },
      },
      partialize: (state) => ({
        files: state.files,
        selectedId: state.selectedId,
        exportedCount: state.exportedCount,
      } as unknown as BatchStore),
    }
  )
);
