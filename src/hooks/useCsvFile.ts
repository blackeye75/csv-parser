import { useCallback, useState } from 'react';
import type { Dataset } from '../types';
import { buildDataset, CsvError } from '../lib/dataset';

/** Files above this size are rejected rather than freezing the tab. */
export const MAX_FILE_SIZE = 25 * 1024 * 1024;

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface CsvFileState {
  dataset: Dataset | null;
  status: LoadStatus;
  error: string | null;
  loadFile: (file: File) => Promise<void>;
  loadText: (text: string, fileName: string) => void;
  reset: () => void;
}

function isCsvLike(file: File): boolean {
  return (
    /\.(csv|tsv|txt)$/i.test(file.name) ||
    ['text/csv', 'text/tab-separated-values', 'text/plain', 'application/vnd.ms-excel'].includes(
      file.type,
    )
  );
}

/** Owns file reading and parsing, and the loading/error states that go with it. */
export function useCsvFile(): CsvFileState {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const fail = useCallback((message: string) => {
    setError(message);
    setStatus('error');
    setDataset(null);
  }, []);

  const loadText = useCallback(
    (text: string, fileName: string) => {
      try {
        setDataset(buildDataset(text, { fileName, fileSize: new Blob([text]).size }));
        setError(null);
        setStatus('ready');
      } catch (cause) {
        fail(
          cause instanceof CsvError
            ? cause.message
            : 'That file could not be parsed as CSV. Check that it is a delimited text file.',
        );
      }
    },
    [fail],
  );

  const loadFile = useCallback(
    async (file: File) => {
      if (!isCsvLike(file)) {
        fail(`“${file.name}” is not a CSV file. Upload a .csv, .tsv or .txt file.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        fail(
          `“${file.name}” is larger than the ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB limit.`,
        );
        return;
      }

      setStatus('loading');
      setError(null);
      try {
        const text = await file.text();
        // Yield a frame so the loading state paints before parsing blocks.
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        loadText(text, file.name);
      } catch {
        fail(`“${file.name}” could not be read. It may have been moved or deleted.`);
      }
    },
    [fail, loadText],
  );

  const reset = useCallback(() => {
    setDataset(null);
    setError(null);
    setStatus('idle');
  }, []);

  return { dataset, status, error, loadFile, loadText, reset };
}
