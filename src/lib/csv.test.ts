import { describe, expect, it } from 'vitest';
import { detectDelimiter, escapeCell, parseRows, toCsv } from './csv';

describe('parseRows', () => {
  it('parses a simple table', () => {
    expect(parseRows('a,b\n1,2\n3,4', ',')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('keeps delimiters that appear inside quoted fields', () => {
    expect(parseRows('name,city\n"Doe, Jane",Berlin', ',')).toEqual([
      ['name', 'city'],
      ['Doe, Jane', 'Berlin'],
    ]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseRows('quote\n"She said ""hi"""', ',')).toEqual([['quote'], ['She said "hi"']]);
  });

  it('keeps newlines that appear inside quoted fields', () => {
    expect(parseRows('note\n"line one\nline two"', ',')).toEqual([
      ['note'],
      ['line one\nline two'],
    ]);
  });

  it('handles CRLF, bare CR and a trailing newline', () => {
    expect(parseRows('a,b\r\n1,2\r3,4\r\n', ',')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('strips a UTF-8 BOM from the first header', () => {
    expect(parseRows('﻿id,name\n1,Ada', ',')[0]).toEqual(['id', 'name']);
  });

  it('preserves empty fields, including trailing ones', () => {
    expect(parseRows('a,b,c\n1,,3\n,,', ',')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
      ['', '', ''],
    ]);
  });

  it('preserves whitespace inside quotes but trims it outside', () => {
    expect(parseRows('a,b\n  padded  ,"  kept  "', ',')).toEqual([
      ['a', 'b'],
      ['padded', '  kept  '],
    ]);
  });

  it('stops early when maxRows is reached', () => {
    expect(parseRows('a\n1\n2\n3\n4', ',', 2)).toHaveLength(2);
  });

  it('returns no rows for empty input', () => {
    expect(parseRows('', ',')).toEqual([]);
  });
});

describe('detectDelimiter', () => {
  it.each([
    [',', 'a,b,c\n1,2,3'],
    [';', 'a;b;c\n1;2;3'],
    ['\t', 'a\tb\tc\n1\t2\t3'],
    ['|', 'a|b|c\n1|2|3'],
  ])('detects %j', (delimiter, text) => {
    expect(detectDelimiter(text)).toBe(delimiter);
  });

  it('is not fooled by commas inside semicolon-separated text', () => {
    expect(detectDelimiter('name;note\nAda;first, of her name\nAlan;a, b, c')).toBe(';');
  });

  it('falls back to a comma for a single-column file', () => {
    expect(detectDelimiter('only\n1\n2')).toBe(',');
  });
});

describe('escapeCell / toCsv', () => {
  it('quotes only the cells that need it', () => {
    expect(escapeCell('plain', ',')).toBe('plain');
    expect(escapeCell('a,b', ',')).toBe('"a,b"');
    expect(escapeCell('say "hi"', ',')).toBe('"say ""hi"""');
    expect(escapeCell('line\nbreak', ',')).toBe('"line\nbreak"');
  });

  it('round-trips through the parser', () => {
    const header = ['name', 'note'];
    const rows = [['Doe, Jane', 'She said "hi"'], ['Ada', 'line\nbreak']];
    expect(parseRows(toCsv(header, rows), ',')).toEqual([header, ...rows]);
  });
});
