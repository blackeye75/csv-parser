# Decisions

Short records of the calls that had a real alternative, and why this side of the fork won.

---

### 1. No CSV library

**Alternative:** PapaParse — the default choice, streaming, battle-tested.

**Chose:** a ~140-line parser in `lib/csv.ts`.

The whole substance of "parse a CSV" is quoted fields, escaped quotes, embedded newlines and mixed
line endings. Delegating it to a dependency hands away the part of this task worth looking at, and
the parser it replaces fits in one screen and carries 18 tests. PapaParse earns its place when
files outgrow memory and need streaming — that is a real threshold, and this app's 25 MB cap is
below it.

**Cost:** no streaming, no worker-based parsing yet. Both are noted as limits in the README, and
`lib/csv.ts` has no React import, so moving it into a Worker is a wiring change, not a rewrite.

---

### 2. Rows as `string[]`, not `Record<string, string>`

Objects are the ergonomic choice and would have made `row.salary` read nicely. They also silently
drop a column when a file has duplicate headers — `id,id,name` is not hypothetical in exported
data — and cost noticeably more memory per row at scale. Positional tuples plus a `Column.index`
keep every column addressable and every duplicate distinct. Component code pays for it with
`row[column.index]` instead of `row.name`; that is one indirection in one place.

---

### 3. Filter controls follow the inferred type

A single text box per column is less code and would satisfy the brief's wording. It also cannot
answer "salary above 140k" — string comparison puts `95000` above `140000` — which is the question
people actually bring to a numeric column.

So each column is typed, and gets the control that matches: range inputs for numbers and dates,
checkboxes for values that repeat, match-mode text filtering for everything else. Inference can be
wrong, so it is never a dead end: the type is shown as a badge on every filter, and text columns
keep the full set of match modes.

---

### 4. Boolean is checked before number

`0` and `1` parse as both. A column of them is a flag, and two checkboxes beat a min/max range for
a flag. The rule is one line of ordering in `inferColumnType`, and it is called out here because it
looks arbitrary until you hit a `remote` column full of `0`s and `1`s.

---

### 5. Categorical means "few distinct values **and** they repeat"

The first version used only "≤ 25 distinct values". On the 25-row sample file that turned the
unique `name` column into 25 checkboxes — technically a filter, practically a directory listing.
Adding "and at least one value repeats" fixes it without a magic ratio, and the integration test
that caught it (`offers a filter control matched to each column type`) still guards it.

---

### 6. Filters and search are debounced; the inputs are not

Controlled inputs update on every keystroke, so typing always feels immediate. The *derived* work —
scanning every row — reads a 180 ms debounced copy of the filter state. Typing `140000` re-scans
once instead of six times, and no keystroke ever waits on a scan.

---

### 7. Blanks sort last in both directions

Sorting is `direction × compare`, so the obvious implementation flips blanks to the top on a
descending sort and buries the highest values below a wall of empty cells. `makeComparator` pulls
the blank check outside the direction multiplier. A regression test (`keeps blank cells last when
sorting descending, not first`) holds the line.

---

### 8. Paging rather than virtualisation

Virtualised rendering handles more rows and costs a dependency plus measurement complexity for
variable-height content. Paging is ~40 lines, is keyboard- and screen-reader-friendly by default,
and gives the user a count they can reason about ("1–50 of 12,480"). Filtering and parsing already
handle far more rows than the DOM would; the ceiling here is rendering, and paging removes it. If
this needed infinite scroll over 500k rows, virtualisation is the change — and it swaps into
`DataTable` alone.

---

### 9. Malformed rows are repaired and reported, never dropped

A row that does not match the header width is padded or truncated to fit, and a banner says how
many rows that happened to. Dropping them loses data silently; failing the whole file over one bad
line is worse. Repair-and-tell keeps the file usable and keeps the user informed.

---

### 10. Export writes what is on screen

The export button emits the visible columns and the filtered, sorted rows — not the original file.
The point of filtering is the subset, and the round-trip test proves the output parses back to
exactly what went in, quotes and all. A UTF-8 BOM is prepended so Excel opens it without mangling
accented characters.
