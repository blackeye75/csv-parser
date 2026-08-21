import { useEffect, useState } from 'react';

/**
 * Delays propagating a fast-changing value (a search box, a range input) so the
 * table re-filters once the user pauses instead of on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
