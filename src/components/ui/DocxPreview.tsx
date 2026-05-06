import { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { fillDocxTemplate } from '@/services/documentService.ts';
import styles from './DocxPreview.module.css';

const EMPTY_VALUES: Record<string, string> = {};

interface DocxPreviewProps {
  file?: File;
  fileUrl?: string;
  fileName?: string;
  values?: Record<string, string>;
  htmlFallback?: string;
  dark?: boolean;
}

async function loadFileFromUrl(url: string, fileName: string): Promise<File> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load docx: ${response.status}`);
  }

  const blob = await response.blob();
  return new File([blob], fileName || 'document.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

export function DocxPreview({
  file,
  fileUrl,
  fileName = 'document.docx',
  values = EMPTY_VALUES,
  htmlFallback = '',
  dark = false,
}: DocxPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;

    let cancelled = false;
    setMessage('');
    container.innerHTML = '';

    const renderFallback = (text: string) => {
      if (!htmlFallback) return;
      container.innerHTML = `<div class="${styles.fallbackPaper}">${htmlFallback}</div>`;
      setMessage(text);
    };

    (async () => {
      try {
        const sourceFile = file && file.size > 0
          ? file
          : fileUrl
            ? await loadFileFromUrl(fileUrl, fileName)
            : null;

        if (!sourceFile) {
          renderFallback('Для цього старого запису немає оригінального .docx файлу. Щоб отримати точний Word-перегляд, перезавантажте файл або надішліть запит заново.');
          return;
        }

        const buffer = await fillDocxTemplate(sourceFile, values);
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
          renderFallback('Не вдалося показати Word-перегляд. Показано спрощену версію.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file, fileName, fileUrl, htmlFallback, values]);

  return (
    <>
      <div ref={previewRef} className={`${styles.preview} ${dark ? styles.dark : ''}`} />
      {message && <div className={styles.message}>{message}</div>}
    </>
  );
}
