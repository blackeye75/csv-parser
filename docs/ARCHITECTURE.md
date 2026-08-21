# Architecture

## The shape of the thing

```
File ──► useCsvFile ──► buildDataset ──► Dataset ──► queryRows ──► page slice ──► DataTable
           (read,        (parse, infer     (columns    (filter,      (paging)
            validate)     types)           + rows)      search,
                                                        sort)
```

One direction, one owner per stage. Nothing downstream mutates what came before it: `queryRows`
copies before sorting, so the source rows always hold the file's original order and "no sort" stays
reachable.

## Data model

A row is a **`string[]`, not an object.**

```ts
type Row = string[];              // ['E-1001', 'Lovelace, Ada', 'Engineering', …]
interface Column { key, name, index, type, distinctValues }
```

Three reasons:

1. **Duplicate headers.** Real exports ship `id,id,name`. An object row silently drops a column;
   positional tuples cannot.
2. **Memory.** One array per row instead of one object with N re-declared string keys matters at
   100k rows.
3. **Stable identity.** `Column.key` is derived from the position (`col-3`), so filters, sort state
   and visibility survive columns that share a display name.

Cells stay strings. Coercion happens at comparison time, in `values.ts`, so the table always
displays exactly what the file said — `007` stays `007`, `1,200` keeps its comma — while filters
and sorts still work numerically.

## Parsing (`lib/csv.ts`)

A single-pass character scanner with an explicit cursor and an `inQuotes` flag, following RFC 4180:
quoted fields, `""` escapes, delimiters and newlines inside quotes, CRLF/LF/CR line endings, and a
leading BOM. The naive `text.split('\n').map(l => l.split(','))` fails on the first quoted comma —
which is exactly the case that shows up in real data (`"Lovelace, Ada"`).

One deliberate asymmetry: **unquoted fields are trimmed, quoted fields are not.** ` Ada ` is
almost always accidental padding; `"  Ada  "` is someone saying they meant those spaces.

**Delimiter detection** parses the first 10 lines with each of `, ; \t |` and scores each by
`columnCount × (rows agreeing with the header width ÷ rows)`. That product is what makes
`name;note` with `first, of her name` in the text resolve to `;` rather than `,`: the comma yields
more columns but wildly inconsistent widths.

## Type inference (`lib/values.ts`)

Sample up to 200 non-empty cells per column; a type wins if ≥ 90% of them parse as it. The
threshold is what lets one `N/A` in a numeric column keep its range filter.

Order matters: **boolean is tested before number**, because `0`/`1` parse as both and a column of
zeroes and ones is better served by two checkboxes than by a numeric range.

`collectDistinctValues` decides whether a column is *categorical*: at most 25 distinct values **and
those values repeat**. The second half of that rule was added after a 25-row sample file rendered
its unique `name` column as 25 checkboxes — each matching exactly one row, which is a list, not a
filter.

Number parsing accepts what spreadsheets actually emit: `1,234.5`, `$1,200`, `12%`, `(250)` as
−250. Date parsing is strict on purpose — `Date.parse` is engine-dependent and will accept things
like `"12 apples"` — so only ISO (`2024-01-31`, optional time) and `M/D/Y` slash forms are
accepted, and impossible calendar dates like `2024-02-31` are rejected by round-tripping the parsed
value back through `Date`.

## Filtering (`lib/filtering.ts`)

`queryRows` is the single entry point, and applies, in order:

1. **Column filters**, AND-ed. Active filters are resolved to `[columnIndex, filter]` pairs *once*,
   before the scan — so per-row cost is proportional to the number of active filters, not to the
   number of columns. A 40-column file with one filter does one comparison per row.
2. **Global search** — a substring match over every cell.
3. **Sort**, using the column's inferred type, with blanks pinned last in *both* directions
   (`makeComparator`). Descending shouldn't bury the top rows under empty cells.

Filters are a discriminated union on `kind`, so `switch` over them is exhaustive and TypeScript
fails the build when a new kind is added but not handled — the type checker, not a test, is what
keeps the UI and the engine in step.

## React state

All shared state lives in `App.tsx` — filters, search, sort, page, page size, hidden columns — and
flows down as props. There is no state library and no context: this is one page with one data
source, and adding either would be ceremony without payoff.

The pipeline is three chained `useMemo`s: `visibleColumns` → `filteredRows` → `pageRows`. Typing in
a filter only re-runs the stages below it, and `filteredRows` reads *debounced* filter and search
values (180 ms), so a keystroke re-renders inputs immediately but re-scans rows only once the user
pauses. Table cells are memoised, so a sort or a page change re-renders only the cells whose text
actually changed.

Two effects handle the state that would otherwise go stale: loading a new file resets everything
column-scoped, and narrowing the results clamps the page number so you are never stranded on an
empty page 9.

## Accessibility

Semantic `<table>` with `scope` and `aria-sort` on the headers; every control labelled (visibly, or
via `aria-label` where the design has no room); the dropzone is a focusable `role="button"` that
responds to <kbd>Enter</kbd> and <kbd>Space</kbd>; the columns menu closes on outside click and
<kbd>Esc</kbd>; row counts announce through `aria-live`; errors use `role="alert"`; focus is always
visible. The UI tests query by role and label rather than by class, so this stays true — if a
control loses its accessible name, a test fails.
