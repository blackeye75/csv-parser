import { describe, expect, it } from 'vitest';
import {
  collectDistinctValues,
  inferColumnType,
  parseBoolean,
  parseDate,
  parseNumber,
} from './values';

describe('parseNumber', () => {
  it('parses plain, signed and exponential numbers', () => {
    expect(parseNumber('42')).toBe(42);
    expect(parseNumber('-3.5')).toBe(-3.5);
    expect(parseNumber('1e3')).toBe(1000);
  });

  it('parses formatted numbers from real exports', () => {
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('$1,200')).toBe(1200);
    expect(parseNumber('12%')).toBe(12);
    expect(parseNumber('(250)')).toBe(-250);
  });

  it('rejects anything that is not a number', () => {
    expect(parseNumber('12 apples')).toBeNull();
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('N/A')).toBeNull();
  });
});

describe('parseDate', () => {
  it('parses ISO dates and date-times', () => {
    expect(parseDate('2024-01-31')).toBe(Date.UTC(2024, 0, 31));
    expect(parseDate('2024-01-31T08:30')).toBe(Date.UTC(2024, 0, 31, 8, 30));
  });

  it('parses slash formats, preferring M/D/Y', () => {
    expect(parseDate('3/4/2024')).toBe(Date.UTC(2024, 2, 4));
    expect(parseDate('25/12/2024')).toBe(Date.UTC(2024, 11, 25));
  });

  it('rejects impossible and non-date values', () => {
    expect(parseDate('2024-02-31')).toBeNull();
    expect(parseDate('not a date')).toBeNull();
    expect(parseDate('')).toBeNull();
  });
});

describe('parseBoolean', () => {
  it('accepts the common spellings', () => {
    expect(parseBoolean('TRUE')).toBe(true);
    expect(parseBoolean('yes')).toBe(true);
    expect(parseBoolean('0')).toBe(false);
    expect(parseBoolean('maybe')).toBeNull();
  });
});

describe('inferColumnType', () => {
  it('detects each type', () => {
    expect(inferColumnType(['1', '2', '3'])).toBe('number');
    expect(inferColumnType(['2024-01-01', '2024-06-30'])).toBe('date');
    expect(inferColumnType(['true', 'false', 'true'])).toBe('boolean');
    expect(inferColumnType(['Ada', 'Alan'])).toBe('string');
  });

  it('ignores blank cells', () => {
    expect(inferColumnType(['1', '', '3', ''])).toBe('number');
  });

  it('tolerates a few stray values but not many', () => {
    const mostlyNumbers = [...Array(19).fill('5'), 'N/A'];
    expect(inferColumnType(mostlyNumbers)).toBe('number');

    const halfNumbers = [...Array(5).fill('5'), ...Array(5).fill('N/A')];
    expect(inferColumnType(halfNumbers)).toBe('string');
  });

  it('treats a 0/1 column as boolean rather than numeric', () => {
    expect(inferColumnType(['0', '1', '1', '0'])).toBe('boolean');
  });

  it('falls back to string for an entirely empty column', () => {
    expect(inferColumnType(['', '  ', ''])).toBe('string');
  });
});

describe('collectDistinctValues', () => {
  it('returns sorted distinct values for a low-cardinality column', () => {
    expect(collectDistinctValues(['b', 'a', 'b', ''])).toEqual(['a', 'b']);
  });

  it('is not categorical when every value is unique', () => {
    expect(collectDistinctValues(['a', 'b', 'c'])).toEqual([]);
  });

  it('bails out when the column is free text', () => {
    const many = Array.from({ length: 100 }, (_, i) => `value-${i}`);
    expect(collectDistinctValues(many)).toEqual([]);
  });
});
