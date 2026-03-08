import { useMemo } from 'react';

/**
 * Generic hook that deduplicates the filter/search/sort/count pattern
 * used across candidate, lead, and team list screens.
 *
 * Items with `updated_at` are sorted most-recent-first automatically.
 */
export function useFilteredList<T extends Record<string, any>>(
    items: T[],
    search: string,
    activeFilter: string,
    filterField: keyof T,
    searchFields: (keyof T)[],
): { filtered: T[]; counts: Record<string, number> } {
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const result = items.filter((item) => {
            if (q) {
                const matches = searchFields.some((field) => {
                    const val = item[field];
                    if (typeof val === 'string') return val.toLowerCase().includes(q);
                    return false;
                });
                if (!matches) return false;
            }
            if (activeFilter !== 'all' && item[filterField] !== activeFilter) return false;
            return true;
        });
        if (result.length > 0 && 'updated_at' in result[0]) {
            result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        }
        return result;
    }, [items, search, activeFilter, filterField, searchFields]);

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: items.length };
        items.forEach((item) => {
            const key = item[filterField] as string;
            c[key] = (c[key] || 0) + 1;
        });
        return c;
    }, [items, filterField]);

    return { filtered, counts };
}
