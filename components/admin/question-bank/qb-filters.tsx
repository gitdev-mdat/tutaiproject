'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DIFFICULTY_VALUES,
  EDITORIAL_STATUS_VALUES,
  QUESTION_TYPE_VALUES,
  DIFFICULTY_LABELS,
  EDITORIAL_STATUS_LABELS,
  QUESTION_TYPE_LABELS,
  SUBJECT_LABELS,
  SUBJECT_ID_VALUES,
  QUESTION_IMPORT_ORIGIN_LABELS,
  QUESTION_IMPORT_ORIGIN_VALUES,
} from '@/lib/question-bank/qb-types';
import type { QuestionFilter } from '@/lib/question-bank/qb-types';

interface QuestionBankFiltersProps {
  filter: QuestionFilter;
  onFilterChange: (patch: Partial<QuestionFilter>) => void;
  onClear: () => void;
  activeCount: number;
}

// ─── Quick chip ───────────────────────────────────────────────────────────────

function ActiveFilterChip({
  label,
  onClick,
  id,
}: {
  label: string;
  onClick: () => void;
  id: string;
}) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1 rounded-full border border-slate-200 bg-white pl-2.5 pr-2 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Xóa bộ lọc ${label}`}
    >
      {label}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-50"
        aria-hidden="true"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}

// ─── Advanced filter select ───────────────────────────────────────────────────

function AdvancedSelect<T extends string>({
  label,
  value,
  placeholder,
  options,
  onChange,
  id,
}: {
  label: string;
  value: T | undefined;
  placeholder: string;
  options: { value: T; label: string }[];
  onChange: (v: T | undefined) => void;
  id: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-500">
        {label}
      </label>
      <Select
        value={value ?? 'ALL'}
        onValueChange={(v) => onChange(v === 'ALL' ? undefined : (v as T))}
      >
        <SelectTrigger id={id} className="h-8 min-w-[130px] text-xs">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{placeholder}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuestionBankFilters({
  filter,
  onFilterChange,
  onClear,
  activeCount,
}: QuestionBankFiltersProps) {
  const [searchValue, setSearchValue] = React.useState(filter.search ?? '');
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  // Debounce search
  React.useEffect(() => {
    const id = setTimeout(() => {
      const normalizedSearch = searchValue || undefined;
      if (normalizedSearch !== filter.search) {
        onFilterChange({ search: normalizedSearch, page: 1 });
      }
    }, 350);
    return () => clearTimeout(id);
  }, [searchValue, filter.search, onFilterChange]);

  // Count only non-search, non-sort active filters for the Bộ lọc badge
  function countAdvancedFilters(f: QuestionFilter): number {
    let n = 0;
    if (f.subjectId) n++;
    if (f.grade) n++;
    if (f.questionType) n++;
    if (f.difficulty) n++;
    if (f.editorialStatus) n++;
    if (f.importOrigin) n++;
    if (f.roadmapEligible !== undefined) n++;
    if (f.isSpecial !== undefined) n++;
    return n;
  }

  const advancedCount = countAdvancedFilters(filter);

  return (
    <div className="space-y-2.5">
      {/* Row 1: Search + Bộ lọc + Sort */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative min-w-0 flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <Input
            id="qb-search"
            type="search"
            aria-label="Tìm kiếm câu hỏi"
            placeholder="Tìm theo mã hoặc nội dung câu hỏi..."
            value={searchValue}
            onChange={(e) => setSearchValue((e.target as HTMLInputElement).value)}
            className="h-9 pl-9 text-sm"
          />
        </div>

        {/* Bộ lọc button */}
        <button
          id="qb-filter-btn"
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
          aria-controls="qb-advanced-filters"
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            advancedOpen || advancedCount > 0
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="11" y1="18" x2="13" y2="18" />
          </svg>
          Bộ lọc
          {advancedCount > 0 && (
            <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
              {advancedCount}
            </span>
          )}
        </button>

        {/* Sort */}
        <Select
          value="newest"
          onValueChange={() => {
            /* Sort not yet wired to API */
          }}
        >
          <SelectTrigger className="h-9 w-auto gap-1 border-slate-200 text-sm text-slate-600">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Mới nhất</SelectItem>
            <SelectItem value="oldest">Cũ nhất</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear all */}
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-9 shrink-0 text-xs text-slate-500"
          >
            Xóa bộ lọc
          </Button>
        )}
      </div>

      {/* Row 2: Active filter chips */}
      {advancedCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {filter.subjectId && (
            <ActiveFilterChip
              id="qb-chip-active-subject"
              label={SUBJECT_LABELS[filter.subjectId]}
              onClick={() => onFilterChange({ subjectId: undefined, page: 1 })}
            />
          )}
          {filter.questionType && (
            <ActiveFilterChip
              id="qb-chip-active-type"
              label={QUESTION_TYPE_LABELS[filter.questionType]}
              onClick={() => onFilterChange({ questionType: undefined, page: 1 })}
            />
          )}
          {filter.grade && (
            <ActiveFilterChip
              id="qb-chip-active-grade"
              label={`Lớp ${filter.grade}`}
              onClick={() => onFilterChange({ grade: undefined, page: 1 })}
            />
          )}
          {filter.difficulty && (
            <ActiveFilterChip
              id="qb-chip-active-difficulty"
              label={DIFFICULTY_LABELS[filter.difficulty]}
              onClick={() => onFilterChange({ difficulty: undefined, page: 1 })}
            />
          )}
          {filter.editorialStatus && (
            <ActiveFilterChip
              id="qb-chip-active-status"
              label={EDITORIAL_STATUS_LABELS[filter.editorialStatus]}
              onClick={() => onFilterChange({ editorialStatus: undefined, page: 1 })}
            />
          )}
          {filter.importOrigin && (
            <ActiveFilterChip
              id="qb-chip-active-origin"
              label={QUESTION_IMPORT_ORIGIN_LABELS[filter.importOrigin]}
              onClick={() => onFilterChange({ importOrigin: undefined, page: 1 })}
            />
          )}
          {filter.roadmapEligible !== undefined && (
            <ActiveFilterChip
              id="qb-chip-active-roadmap"
              label={filter.roadmapEligible ? 'Có thể dùng' : 'Không dùng'}
              onClick={() => onFilterChange({ roadmapEligible: undefined, page: 1 })}
            />
          )}
        </div>
      )}

      {/* Row 3: Advanced filter panel */}
      {advancedOpen && (
        <div
          id="qb-advanced-filters"
          role="region"
          aria-label="Bộ lọc nâng cao"
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {/* Nội dung group */}
            <AdvancedSelect
              id="qb-filter-subject"
              label="Môn học"
              value={filter.subjectId}
              placeholder="Tất cả môn"
              options={SUBJECT_ID_VALUES.map((s) => ({
                value: s,
                label: SUBJECT_LABELS[s],
              }))}
              onChange={(v) => onFilterChange({ subjectId: v, page: 1 })}
            />

            <AdvancedSelect
              id="qb-filter-grade"
              label="Lớp"
              value={filter.grade ? String(filter.grade) : undefined}
              placeholder="Tất cả lớp"
              options={[
                { value: '10', label: 'Lớp 10' },
                { value: '11', label: 'Lớp 11' },
                { value: '12', label: 'Lớp 12' },
              ]}
              onChange={(v) =>
                onFilterChange({ grade: v ? (Number(v) as 10 | 11 | 12) : undefined, page: 1 })
              }
            />

            <AdvancedSelect
              id="qb-filter-type"
              label="Loại câu hỏi"
              value={filter.questionType}
              placeholder="Tất cả loại"
              options={QUESTION_TYPE_VALUES.map((t) => ({
                value: t,
                label: QUESTION_TYPE_LABELS[t],
              }))}
              onChange={(v) => onFilterChange({ questionType: v, page: 1 })}
            />

            <AdvancedSelect
              id="qb-filter-difficulty"
              label="Độ khó"
              value={filter.difficulty}
              placeholder="Mọi độ khó"
              options={DIFFICULTY_VALUES.map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] }))}
              onChange={(v) => onFilterChange({ difficulty: v, page: 1 })}
            />

            {/* Quản trị group */}
            <AdvancedSelect
              id="qb-filter-status"
              label="Trạng thái"
              value={filter.editorialStatus}
              placeholder="Tất cả trạng thái"
              options={EDITORIAL_STATUS_VALUES.map((s) => ({
                value: s,
                label: EDITORIAL_STATUS_LABELS[s],
              }))}
              onChange={(v) => onFilterChange({ editorialStatus: v, page: 1 })}
            />

            <AdvancedSelect
              id="qb-filter-origin"
              label="Nguồn nhập"
              value={filter.importOrigin}
              placeholder="Mọi nguồn"
              options={QUESTION_IMPORT_ORIGIN_VALUES.map((origin) => ({
                value: origin,
                label: QUESTION_IMPORT_ORIGIN_LABELS[origin],
              }))}
              onChange={(value) => onFilterChange({ importOrigin: value, page: 1 })}
            />

            <AdvancedSelect
              id="qb-filter-roadmap"
              label="Lộ trình"
              value={
                filter.roadmapEligible === true
                  ? 'true'
                  : filter.roadmapEligible === false
                    ? 'false'
                    : undefined
              }
              placeholder="Tất cả"
              options={[
                { value: 'true', label: 'Có thể dùng' },
                { value: 'false', label: 'Không dùng' },
              ]}
              onChange={(v) =>
                onFilterChange({
                  roadmapEligible: v === 'true' ? true : v === 'false' ? false : undefined,
                  page: 1,
                })
              }
            />
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            {advancedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-slate-500"
                onClick={() => {
                  onFilterChange({
                    subjectId: undefined,
                    grade: undefined,
                    questionType: undefined,
                    difficulty: undefined,
                    editorialStatus: undefined,
                    importOrigin: undefined,
                    roadmapEligible: undefined,
                    isSpecial: undefined,
                    page: 1,
                  });
                }}
              >
                Đặt lại
              </Button>
            )}
            <Button size="sm" className="h-7 text-xs" onClick={() => setAdvancedOpen(false)}>
              Áp dụng bộ lọc
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
