import type { Column, Dataset, Row } from '../types';
import { detectDelimiter, parseRows } from './csv';
import { collectDistinctValues, inferColumnType } from './values';

export interface BuildOptions {
  fileName: string;
  fileSize: number;
  /** Override the auto-detected delimiter. */
  delimiter?: string;
}

export class CsvError extends Error {}

/**
 * Turns raw CSV text into the shape the UI renders: typed columns plus
 * positional row tuples.
 *
 * Rows narrower than the header are padded and rows wider than it are
 * truncated, so a single ragged line never shifts the rest of the table. The
 * count is surfaced in the UI instead of being swallowed.
 */
export function buildDataset(text: string, options: BuildOptions): Dataset {
  const delimiter = options.delimiter ?? detectDelimiter(text);
  const raw = parseRows(text, delimiter);

  if (raw.length === 0) throw new CsvError('That file is empty — there is nothing to display.');

  const [headerRow, ...bodyRows] = raw;
  const header = headerRow.map((name, index) => name.trim() || `Column ${index + 1}`);

  if (bodyRows.length === 0) {
    throw new CsvError('That file only contains a header row — there are no data rows to display.');
  }

  let malformedRowCount = 0;
  const rows: Row[] = bodyRows.map((row) => {
    if (row.length === header.length) return row;
    malformedRowCount++;
    const normalised = row.slice(0, header.length);
    while (normalised.length < header.length) normalised.push('');
    return normalised;
  });

  const columns: Column[] = header.map((name, index) => {
    const cells = rows.map((row) => row[index]);
    return {
      key: `col-${index}`,
      name,
      index,
      type: inferColumnType(cells),
      distinctValues: collectDistinctValues(cells),
    };
  });

  return {
    columns,
    rows,
    malformedRowCount,
    fileName: options.fileName,
    fileSize: options.fileSize,
    delimiter,
  };
}
