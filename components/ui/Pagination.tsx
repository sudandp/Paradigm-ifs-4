import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
  pageSizeOptions?: number[];
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  className = '',
  pageSizeOptions = [10, 20, 50, 100],
}) => {
  const totalPages = Math.ceil(totalItems / pageSize);

  if (totalItems === 0) return null;

  return (
    <div className={`flex flex-col md:flex-row justify-between items-center bg-card p-4 rounded-xl border border-border gap-4 ${className}`}>
      {onPageSizeChange && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">Show</span>
          <select
            id="pageSize"
            name="pageSize"
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-page border border-border text-primary-text text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-1.5 transition-all outline-none"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted">per page</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-2 h-9 w-9 rounded-lg"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1 mx-2">
          <span className="text-sm font-semibold text-primary-text">Page {currentPage}</span>
          <span className="text-sm text-muted">of {totalPages}</span>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="p-2 h-9 w-9 rounded-lg"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="text-sm text-muted">
        Total {totalItems} entries
      </div>
    </div>
  );
};

export default Pagination;
