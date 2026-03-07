import { FilterFn } from '@tanstack/react-table';

/**
 * Shared filter function for faceted filters that check if the cell value
 * is included in the selected filter array.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const arrayIncludesFilter: FilterFn<any> = (row, columnId, filterValue: string[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  const value = row.getValue(columnId);
  return filterValue.includes(String(value));
};
