import { useState, useRef, type DragEvent, useCallback } from 'react';
import { Upload } from 'lucide-react';
import styles from './FileDropZone.module.css';

interface FileDropZoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
}

export function FileDropZone({ onFiles, accept = '.docx', multiple = true }: FileDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.name.endsWith('.docx')
    );
    if (files.length) onFiles(files);
  }, [onFiles]);

  const handleClick = () => inputRef.current?.click();

  const handleChange = () => {
    const rawFiles = inputRef.current?.files;
    if (rawFiles?.length) {
      const validFiles = Array.from(rawFiles).filter(f => f.name.toLowerCase().endsWith('.docx'));
      if (validFiles.length) onFiles(validFiles);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      className={`${styles.container} ${dragging ? styles.dragging : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <Upload size={40} className={styles.icon} />
      <p className={styles.title}>
        Перетягніть .docx файли сюди
      </p>
      <p className={styles.subtitle}>
        або натисніть, щоб вибрати файли
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className={styles.hiddenInput}
      />
    </div>
  );
}
