import { describe, expect, it } from 'vitest';
import { buildDataset, CsvError } from './dataset';

const options = { fileName: 'test.csv', fileSize: 100 };

describe('buildDataset', () => {
  it('builds typed columns and positional rows', () => {
    const dataset = buildDataset('name,age,active\nAda,36,true\nAlan,41,false', options);

    expect(dataset.columns.map((c) => [c.name, c.type])).toEqual([
      ['name', 'string'],
      ['age', 'number'],
      ['active', 'boolean'],
    ]);
    expect(dataset.rows).toEqual([
      ['Ada', '36', 'true'],
      ['Alan', '41', 'false'],
    ]);
  });

  it('gives duplicate headers distinct keys', () => {
    const dataset = buildDataset('id,id\n1,2', options);
    expect(dataset.columns.map((c) => c.key)).toEqual(['col-0', 'col-1']);
  });

  it('names unnamed columns after their position', () => {
    const dataset = buildDataset('id,,name\n1,x,Ada', options);
    expect(dataset.columns[1].name).toBe('Column 2');
  });

  it('pads and truncates ragged rows, and counts them', () => {
    const dataset = buildDataset('a,b,c\n1,2\n1,2,3,4\n1,2,3', options);

    expect(dataset.rows).toEqual([
      ['1', '2', ''],
      ['1', '2', '3'],
      ['1', '2', '3'],
    ]);
    expect(dataset.malformedRowCount).toBe(2);
  });

  it('detects the delimiter when none is given', () => {
    expect(buildDataset('a;b\n1;2', options).delimiter).toBe(';');
  });

  it('rejects an empty file and a header-only file', () => {
    expect(() => buildDataset('', options)).toThrow(CsvError);
    expect(() => buildDataset('a,b,c', options)).toThrow(CsvError);
  });
});
