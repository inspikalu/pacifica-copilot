import type { ReactNode } from "react";

interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  title: ReactNode;
  rows: T[];
  columns: Column<T>[];
  getRowKey?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export function DataTable<T>({ title, rows, columns, getRowKey, onRowClick, emptyMessage }: DataTableProps<T>) {
  return (
    <div className="hl-card overflow-hidden">
      {/* Table header bar */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--foreground-muted)] font-medium">
          {title}
        </span>
        <span className="text-[10px] text-[var(--foreground-muted)] opacity-40">
          {rows.length} {rows.length === 1 ? "row" : "rows"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border-separate border-spacing-0">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.12em] text-[var(--foreground-muted)] font-medium border-b border-[var(--border)] whitespace-nowrap"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-xs text-[var(--foreground-muted)] text-center opacity-50"
                  colSpan={columns.length}
                >
                  {emptyMessage ?? "No data available."}
                </td>
              </tr>
            ) : null}
            {rows.map((row, index) => (
              <tr
                key={getRowKey ? getRowKey(row, index) : index}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`hl-row transition-colors border-b border-[var(--border)] last:border-0 ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="px-4 py-3 whitespace-nowrap text-[var(--foreground)] hl-num"
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
