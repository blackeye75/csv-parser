import { useCallback, useRef, useState } from 'react';

interface FileDropzoneProps {
  onFile: (file: File) => void;
  onUseSample: () => void;
  disabled?: boolean;
}

/**
 * Upload surface. Accepts a click, a keyboard activation and a drag-and-drop,
 * and offers the bundled sample file as an escape hatch for a quick look.
 */
export function FileDropzone({ onFile, onUseSample, disabled = false }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <div className="dropzone-wrap">
      <div
        className={`dropzone${isDragging ? ' dropzone--active' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Upload a CSV file. Press Enter to browse, or drop a file here."
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <svg className="dropzone__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 16V4m0 0L8 8m4-4 4 4" />
          <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </svg>
        <p className="dropzone__title">Drop a CSV file here, or click to browse</p>
        <p className="dropzone__hint">
          .csv, .tsv or .txt · comma, semicolon, tab or pipe separated · up to 25 MB
        </p>
        <input
          ref={inputRef}
          type="file"
          className="visually-hidden"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            // Reset so re-selecting the same file fires `change` again.
            event.target.value = '';
          }}
        />
      </div>

      <p className="dropzone__sample">
        No file handy?{' '}
        <button type="button" className="link-button" onClick={onUseSample}>
          Load the sample dataset
        </button>
      </p>
    </div>
  );
}
