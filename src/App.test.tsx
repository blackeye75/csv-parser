import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';

/** Renders the app and loads the bundled sample file. */
async function renderWithSample() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: /load the sample dataset/i }));
  await screen.findByRole('region', { name: /csv data/i });
  return user;
}

const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

const nameCells = () =>
  bodyRows().map((row) => within(row).getAllByRole('cell')[2].textContent ?? '');

describe('CSV Explorer', () => {
  it('shows the upload prompt before a file is loaded', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /upload a csv file/i })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders the parsed file, keeping commas inside quoted fields intact', async () => {
    await renderWithSample();

    expect(screen.getByRole('heading', { name: 'sample-employees.csv' })).toBeInTheDocument();
    expect(screen.getByText(/25 rows · 8 columns/)).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /department/i })).toBeInTheDocument();
    expect(screen.getAllByText('Lovelace, Ada').length).toBeGreaterThan(0);
  });

  it('offers a filter control matched to each column type', async () => {
    await renderWithSample();

    // Numeric column → a min/max range.
    expect(screen.getByLabelText('Minimum salary')).toBeInTheDocument();
    expect(screen.getByLabelText('Maximum salary')).toBeInTheDocument();
    // Date column → a from/to range.
    expect(screen.getByLabelText('start_date from')).toBeInTheDocument();
    // Low-cardinality column → checkboxes.
    expect(screen.getByRole('group', { name: /department values/i })).toBeInTheDocument();
    // Free-text column → a match-mode selector.
    expect(screen.getByLabelText('How to match name')).toBeInTheDocument();
  });

  it('filters a categorical column down to the selected values', async () => {
    const user = await renderWithSample();

    const departments = screen.getByRole('group', { name: /department values/i });
    await user.click(within(departments).getByRole('checkbox', { name: 'Design' }));

    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    expect(nameCells().sort()).toEqual(['Adele Goldberg', 'Carol Shaw']);
    expect(screen.getByText(/2 matching/)).toBeInTheDocument();
  });

  it('filters a numeric column by range rather than by string comparison', async () => {
    const user = await renderWithSample();

    await user.type(screen.getByLabelText('Minimum salary'), '155000');

    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    expect(nameCells().sort()).toEqual([
      'Barbara Liskov',
      'Grace Hopper',
      'Lovelace, Ada',
      'Shafi Goldwasser',
    ]);
  });

  it('filters a date column by an inclusive range', async () => {
    const user = await renderWithSample();

    await user.type(screen.getByLabelText('start_date from'), '2023-01-01');

    await waitFor(() => expect(bodyRows()).toHaveLength(5));
  });

  it('combines filters from different columns', async () => {
    const user = await renderWithSample();

    const departments = screen.getByRole('group', { name: /department values/i });
    await user.click(within(departments).getByRole('checkbox', { name: 'Engineering' }));
    await user.type(screen.getByLabelText('Minimum salary'), '160000');

    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    expect(nameCells().sort()).toEqual(['Grace Hopper', 'Lovelace, Ada']);
  });

  it('searches across every column at once', async () => {
    const user = await renderWithSample();

    await user.type(screen.getByRole('searchbox', { name: /search all columns/i }), 'hampton');

    await waitFor(() => expect(bodyRows()).toHaveLength(3));
  });

  it('sorts a numeric column by value, cycling asc → desc → original order', async () => {
    const user = await renderWithSample();
    const originalFirst = nameCells()[0];
    const header = screen.getByRole('button', { name: 'salary' });

    await user.click(header);
    await waitFor(() => expect(nameCells()[0]).toBe('Joan Clarke')); // lowest salary

    await user.click(header);
    await waitFor(() => expect(nameCells()[0]).toBe('Lovelace, Ada')); // highest salary

    await user.click(header);
    await waitFor(() => expect(nameCells()[0]).toBe(originalFirst));
  });

  it('clears every filter at once', async () => {
    const user = await renderWithSample();

    const departments = screen.getByRole('group', { name: /department values/i });
    await user.click(within(departments).getByRole('checkbox', { name: 'Design' }));
    await waitFor(() => expect(bodyRows()).toHaveLength(2));

    await user.click(screen.getByRole('button', { name: /clear all/i }));
    await waitFor(() => expect(bodyRows()).toHaveLength(25));
  });

  it('explains an empty result instead of showing a blank table', async () => {
    const user = await renderWithSample();

    await user.type(screen.getByLabelText('Minimum salary'), '999999');

    expect(await screen.findByText(/no rows match the current filters/i)).toBeInTheDocument();
  });

  it('hides a column when it is unchecked in the columns menu', async () => {
    const user = await renderWithSample();

    await user.click(screen.getByRole('button', { name: /^columns/i }));
    const menu = screen.getByRole('group', { name: /toggle column visibility/i });
    await user.click(within(menu).getByRole('checkbox', { name: 'location' }));

    await waitFor(() =>
      expect(screen.queryByRole('columnheader', { name: /location/i })).not.toBeInTheDocument(),
    );
  });

  it('returns to the upload screen when a new file is requested', async () => {
    const user = await renderWithSample();

    await user.click(screen.getByRole('button', { name: /new file/i }));

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload a csv file/i })).toBeInTheDocument();
  });
});
