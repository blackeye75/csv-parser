/** Human-readable file size, e.g. `1.4 MB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

/** Thousands-separated count, e.g. `12,480`. */
export function formatCount(value: number): string {
  return value.toLocaleString();
}

/** Readable name for a delimiter character. */
export function delimiterLabel(delimiter: string): string {
  const names: Record<string, string> = {
    ',': 'comma',
    ';': 'semicolon',
    '\t': 'tab',
    '|': 'pipe',
  };
  return names[delimiter] ?? delimiter;
}

/** Triggers a client-side download of `text` as a file. */
export function downloadTextFile(text: string, fileName: string): void {
  const blob = new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
