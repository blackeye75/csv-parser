import { describe, expect, it } from 'vitest';
import { buildDataset } from './dataset';
import { emptyFilterFor, isFilterActive, queryRows } from './filtering';
import type { FilterMap } from '../types';

const csv = [
  'name,department,salary,started,remote',
  'Ada,Engineering,120000,2021-03-01,true',
  'Alan,Engineering,95000,2019-07-15,false',
  'Grace,Design,87000,2022-11-20,true',
  'Katherine,Research,,2020-01-05,false',
].join('\n');

const dataset = buildDataset(csv, { fileName: 'people.csv', fileSize: 1 });
const byName = (key: string) => dataset.columns.find((c) => c.name === key)!;

function run(filters: FilterMap, search = '', sort = null) {
  return queryRows({ columns: dataset.columns, rows: dataset.rows, filters, search, sort }).map(
    (row) => row[0],
  );
}

describe('queryRows', () => {
  it('returns every row when nothing is filtered', () => {
    expect(run({})).toEqual(['Ada', 'Alan', 'Grace', 'Katherine']);
  });

  it('filters text with each mode', () => {
    const key = byName('name').key;
    expect(run({ [key]: { kind: 'text', mode: 'contains', value: 'a' } })).toEqual([
      'Ada',
      'Alan',
      'Grace',
      'Katherine',
    ]);
    expect(run({ [key]: { kind: 'text', mode: 'startsWith', value: 'A' } })).toEqual(['Ada', 'Alan']);
    expect(run({ [key]: { kind: 'text', mode: 'equals', value: 'ada' } })).toEqual(['Ada']);
    expect(run({ [key]: { kind: 'text', mode: 'notContains', value: 'a' } })).toEqual([]);
  });

  it('finds blank cells with the empty modes', () => {
    const key = byName('salary').key;
    expect(run({ [key]: { kind: 'text', mode: 'empty', value: '' } })).toEqual(['Katherine']);
    expect(run({ [key]: { kind: 'text', mode: 'notEmpty', value: '' } })).toEqual([
      'Ada',
      'Alan',
      'Grace',
    ]);
  });

  it('filters numbers by an inclusive range', () => {
    const key = byName('salary').key;
    expect(run({ [key]: { kind: 'number', min: '90000', max: '' } })).toEqual(['Ada', 'Alan']);
    expect(run({ [key]: { kind: 'number', min: '', max: '95000' } })).toEqual(['Alan', 'Grace']);
    expect(run({ [key]: { kind: 'number', min: '87000', max: '95000' } })).toEqual(['Alan', 'Grace']);
  });

  it('filters dates by an inclusive range, including the final day', () => {
    const key = byName('started').key;
    expect(run({ [key]: { kind: 'date', from: '2021-01-01', to: '' } })).toEqual(['Ada', 'Grace']);
    expect(run({ [key]: { kind: 'date', from: '2021-03-01', to: '2021-03-01' } })).toEqual(['Ada']);
  });

  it('filters categorical columns by a set of values', () => {
    const key = byName('department').key;
    expect(run({ [key]: { kind: 'set', selected: ['Design', 'Research'] } })).toEqual([
      'Grace',
      'Katherine',
    ]);
  });

  it('combines filters across columns with AND', () => {
    expect(
      run({
        [byName('department').key]: { kind: 'set', selected: ['Engineering'] },
        [byName('salary').key]: { kind: 'number', min: '100000', max: '' },
      }),
    ).toEqual(['Ada']);
  });

  it('searches across every column', () => {
    expect(run({}, 'design')).toEqual(['Grace']);
    expect(run({}, 'engineering')).toEqual(['Ada', 'Alan']);
  });

  it('applies search on top of filters', () => {
    expect(run({ [byName('remote').key]: { kind: 'set', selected: ['true'] } }, 'ada')).toEqual([
      'Ada',
    ]);
  });

  it('sorts numerically, not lexicographically, and puts blanks last', () => {
    const sorted = queryRows({
      columns: dataset.columns,
      rows: dataset.rows,
      filters: {},
      search: '',
      sort: { columnKey: byName('salary').key, direction: 'asc' },
    });
    expect(sorted.map((row) => row[0])).toEqual(['Grace', 'Alan', 'Ada', 'Katherine']);
  });

  it('sorts dates chronologically', () => {
    const sorted = queryRows({
      columns: dataset.columns,
      rows: dataset.rows,
      filters: {},
      search: '',
      sort: { columnKey: byName('started').key, direction: 'desc' },
    });
    expect(sorted.map((row) => row[0])).toEqual(['Grace', 'Ada', 'Katherine', 'Alan']);
  });

  it('keeps blank cells last when sorting descending, not first', () => {
    const sorted = queryRows({
      columns: dataset.columns,
      rows: dataset.rows,
      filters: {},
      search: '',
      sort: { columnKey: byName('salary').key, direction: 'desc' },
    });
    expect(sorted.map((row) => row[0])).toEqual(['Ada', 'Alan', 'Grace', 'Katherine']);
  });

  it('does not mutate the source rows when sorting', () => {
    const before = dataset.rows.map((row) => row[0]);
    queryRows({
      columns: dataset.columns,
      rows: dataset.rows,
      filters: {},
      search: '',
      sort: { columnKey: byName('name').key, direction: 'desc' },
    });
    expect(dataset.rows.map((row) => row[0])).toEqual(before);
  });
});

describe('isFilterActive', () => {
  it('ignores blank filters', () => {
    expect(isFilterActive(undefined)).toBe(false);
    expect(isFilterActive({ kind: 'text', mode: 'contains', value: '  ' })).toBe(false);
    expect(isFilterActive({ kind: 'number', min: '', max: '' })).toBe(false);
    expect(isFilterActive({ kind: 'set', selected: [] })).toBe(false);
  });

  it('treats the empty/notEmpty modes as active without a value', () => {
    expect(isFilterActive({ kind: 'text', mode: 'empty', value: '' })).toBe(true);
  });
});

describe('emptyFilterFor', () => {
  it('picks a control that matches the column type', () => {
    expect(emptyFilterFor(byName('salary')).kind).toBe('number');
    expect(emptyFilterFor(byName('started')).kind).toBe('date');
    expect(emptyFilterFor(byName('department')).kind).toBe('set');
    expect(emptyFilterFor(byName('remote')).kind).toBe('set');
  });
});
