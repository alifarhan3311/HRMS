import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button';

export default function Pagination({ page, pageSize, total, totalPages, isLoading = false, onPageChange, onPageSizeChange }) {
  const lastPage = Math.max(1, totalPages);
  const pages = [...new Set([1, page - 1, page, page + 1, lastPage])]
    .filter(value => value >= 1 && value <= lastPage).sort((a, b) => a - b);
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span role="status">{isLoading ? 'Loading payslips…' : `Showing ${first}–${last} of ${total} payslips`}</span>
        <label className="flex items-center gap-2">
          Rows per page
          <select aria-label="Payslips per page" value={pageSize} disabled={isLoading}
            onChange={event => onPageSizeChange(Number(event.target.value))}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-foreground outline-none focus:border-primary disabled:opacity-50">
            {[5, 10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>
      <nav aria-label="Saved payslips pagination" className="flex flex-wrap items-center gap-1.5">
        <span className="mr-2 text-xs text-muted-foreground">{isLoading ? `Page ${page}` : `Page ${page} of ${lastPage}`}</span>
        <Button variant="secondary" size="sm" aria-label="Previous payslips page" disabled={isLoading || page <= 1}
          onClick={() => onPageChange(page - 1)}><ChevronLeft className="h-4 w-4" /> Previous</Button>
        {!isLoading && pages.map((number, index) => (
          <span key={number} className="inline-flex items-center gap-1.5">
            {index > 0 && number - pages[index - 1] > 1 && <span className="px-1 text-muted-foreground" aria-hidden="true">…</span>}
            <Button variant={number === page ? 'primary' : 'secondary'} size="sm"
              aria-label={`Payslips page ${number}`} aria-current={number === page ? 'page' : undefined}
              disabled={number === page} onClick={() => onPageChange(number)}>{number}</Button>
          </span>
        ))}
        <Button variant="secondary" size="sm" aria-label="Next payslips page" disabled={isLoading || page >= lastPage}
          onClick={() => onPageChange(page + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
      </nav>
    </div>
  );
}
