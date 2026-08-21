/**
 * A dependency-free CSV reader/writer following RFC 4180.
 *
 * Handles quoted fields, escaped quotes (""), delimiters and newlines inside
 * quotes, CRLF / LF / CR line endings and a leading UTF-8 BOM. Parsing is a
 * single pass over the string with an explicit cursor, so a multi-megabyte file
 * costs one traversal rather than the repeated `split()` allocations a naive
 * implementation makes.
 */

const BOM = '﻿';
const DELIMITER_CANDIDATES = [',', ';', '\t', '|'] as const;

/**
 * Guesses the delimiter by parsing the first few lines with each candidate and
 * keeping the one that yields the most columns with a consistent row width.
 */
export function detectDelimiter(text: string): string {
  const sample = text.slice(0, 64 * 1024);
  let best = ',';
  let bestScore = -1;

  for (const candidate of DELIMITER_CANDIDATES) {
    const rows = parseRows(sample, candidate, 10);
    if (rows.length === 0) continue;

    const width = rows[0].length;
    if (width < 2) continue;

    // Reward wide tables, penalise every row that disagrees with the header width.
    const consistent = rows.filter((row) => row.length === width).length;
    const score = width * (consistent / rows.length);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

/**
 * Parses `text` into an array of raw string rows.
 *
 * @param maxRows Stop after this many rows. Used by delimiter detection to
 *                avoid parsing the whole file four times.
 */
export function parseRows(text: string, delimiter: string, maxRows = Infinity): string[][] {
  if (text.startsWith(BOM)) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldWasQuoted = false;
  let i = 0;

  const endField = () => {
    // Only trim unquoted fields: whitespace inside quotes is intentional.
    row.push(fieldWasQuoted ? field : field.trim());
    field = '';
    fieldWasQuoted = false;
  };

  const endRow = () => {
    endField();
    // Skip the phantom row produced by a trailing newline.
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // Escaped quote.
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"' && field.trim() === '') {
      field = '';
      inQuotes = true;
      fieldWasQuoted = true;
      i++;
      continue;
    }

    if (char === delimiter) {
      endField();
      i++;
      continue;
    }

    if (char === '\r' || char === '\n') {
      endRow();
      if (rows.length >= maxRows) return rows;
      // Consume CRLF as a single terminator.
      i += char === '\r' && text[i + 1] === '\n' ? 2 : 1;
      continue;
    }

    field += char;
    i++;
  }

  // Flush whatever the final line left in the buffers.
  if (field !== '' || row.length > 0) endRow();

  return rows;
}

/** Escapes a single value for CSV output, quoting only when necessary. */
export function escapeCell(value: string, delimiter: string): string {
  const needsQuotes =
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r') ||
    value !== value.trim();

  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialises a header + rows back into CSV text. */
export function toCsv(header: string[], rows: string[][], delimiter = ','): string {
  const lines = [header, ...rows].map((row) =>
    row.map((cell) => escapeCell(cell ?? '', delimiter)).join(delimiter),
  );
  return lines.join('\r\n');
}
