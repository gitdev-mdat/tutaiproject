'use client';

/**
 * QuestionImportWizard — 3-step import flow
 * Step 1: Tải file    — Drag-and-drop .xlsx / .csv / .json
 * Step 2: Kiểm tra    — Validation results with per-row error detail
 * Step 3: Xác nhận   — Import confirmation with optional partial import
 */

import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import type { ImportRowPreview } from '@/lib/question-bank/qb-types';

type WizardStep = 'upload' | 'validate' | 'confirm' | 'progress' | 'success';

interface ValidationIssue {
  sheet?: string;
  row: number;
  field?: string;
  severity: 'ERROR' | 'WARNING';
  code: string;
  message: string;
}

interface WizardState {
  step: WizardStep;
  file: File | null;
  format: 'XLSX' | 'CSV' | 'JSON';
  content: string;
  xlsxBuffer: ArrayBuffer | null;
  previews: ImportRowPreview[];
  issues: ValidationIssue[];
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  idempotencyKey: string;
  sessionId: string;
  importedCount: number;
  progressCurrent: number;
  error: string | null;
  loading: boolean;
}

const STEPS = [
  { key: 'upload' as WizardStep, label: 'Tai file' },
  { key: 'validate' as WizardStep, label: 'Kiem tra' },
  { key: 'confirm' as WizardStep, label: 'Xac nhan' },
];

function StepIndicator({ current }: { current: WizardStep }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  const effectiveIdx = idx === -1 ? STEPS.length : idx;
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => {
        const isDone = i < effectiveIdx;
        const isActive = i === effectiveIdx;
        return (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  isDone
                    ? 'bg-blue-600 text-white'
                    : isActive
                      ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {isDone ? (
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`hidden text-[10px] font-medium sm:block ${isActive ? 'text-blue-700' : isDone ? 'text-slate-500' : 'text-slate-400'}`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mb-4 h-0.5 w-10 transition-colors ${i < effectiveIdx ? 'bg-blue-400' : 'bg-slate-200'}`}
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function UploadStep({
  onFile,
}: {
  onFile: (
    file: File,
    format: 'XLSX' | 'CSV' | 'JSON',
    content: string,
    buffer: ArrayBuffer | null
  ) => void;
}) {
  const [dragover, setDragover] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const MAX_MB = 10;

  function processFile(file: File) {
    setError(null);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['xlsx', 'csv', 'json'].includes(ext)) {
      setError('Chi ho tro .xlsx, .csv hoac .json.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError('File qua lon. Gioi han ' + MAX_MB + 'MB.');
      return;
    }
    if (ext === 'xlsx') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer) {
          setError('Khong doc duoc file.');
          return;
        }
        onFile(file, 'XLSX', '', buffer);
      };
      reader.onerror = () => setError('Khong doc duoc file.');
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = (e.target?.result as string) ?? '';
        if (!content.trim()) {
          setError('File trong.');
          return;
        }
        onFile(file, ext === 'json' ? 'JSON' : 'CSV', content, null);
      };
      reader.onerror = () => setError('Khong doc duoc file.');
      reader.readAsText(file, 'utf-8');
    }
  }

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Khu vuc tha file - nhap hoac keo file vao day"
        className={`flex min-h-[240px] cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${dragover ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragover(true);
        }}
        onDragLeave={() => setDragover(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragover(false);
          const f = e.dataTransfer.files?.[0];
          if (f) processFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv,.json"
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) processFile(f);
          }}
        />
        <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-100">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-slate-500"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-800">Keo tha file hoac nhan de chon</p>
          <p className="mt-1 text-xs text-slate-500">
            Ho tro: <strong className="text-slate-700">.xlsx</strong> (khuyen nghi) · .csv · .json
          </p>
          <p className="text-xs text-slate-400">Toi da {MAX_MB}MB</p>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {error}
        </div>
      )}
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-xs text-blue-700">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <span>
          Chưa có file?{' '}
          <a
            href="/api/question-bank/template"
            download
            className="font-semibold underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Tải file mẫu Excel
          </a>{' '}
          gồm 4 trang: Hướng dẫn, Trắc nghiệm, Tự luận và Danh mục kiến thức.
        </span>
      </div>
    </div>
  );
}

function IssueBadge({ severity }: { severity: 'ERROR' | 'WARNING' | 'VALID' }) {
  if (severity === 'ERROR')
    return (
      <span className="inline-flex items-center rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-700">
        Loi
      </span>
    );
  if (severity === 'WARNING')
    return (
      <span className="inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
        Canh bao
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
      Hop le
    </span>
  );
}

type FilterTab = 'all' | 'error' | 'warning' | 'ok';

function ValidateStep({
  previews,
  issues,
  totalRows,
  validRows,
  warningRows,
  errorRows,
  fileName,
}: {
  previews: ImportRowPreview[];
  issues: ValidationIssue[];
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  fileName: string;
}) {
  const [tab, setTab] = React.useState<FilterTab>('all');
  const [expanded, setExpanded] = React.useState<number | null>(null);

  const tabs = [
    { key: 'all' as FilterTab, label: 'Tat ca', count: totalRows },
    { key: 'error' as FilterTab, label: 'Co loi', count: errorRows },
    { key: 'warning' as FilterTab, label: 'Canh bao', count: warningRows },
    { key: 'ok' as FilterTab, label: 'Hop le', count: validRows },
  ];

  const filtered = previews.filter((p) => {
    if (tab === 'error') return p.status === 'ERROR';
    if (tab === 'warning') return p.status === 'WARNING';
    if (tab === 'ok') return p.status === 'VALID';
    return true;
  });

  const issuesByRow: Record<number, ValidationIssue[]> = {};
  for (const issue of issues) {
    if (!issuesByRow[issue.row]) issuesByRow[issue.row] = [];
    issuesByRow[issue.row].push(issue);
  }

  function downloadErrorFile() {
    const lines = ['Dong,Sheet,Cot,Muc_do,Ma_loi,Mo_ta'];
    for (const iss of issues) {
      lines.push(
        [
          iss.row,
          iss.sheet ?? '',
          iss.field ?? '',
          iss.severity,
          iss.code,
          '"' + iss.message.replace(/"/g, '""') + '"',
        ].join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'errors_' + fileName.replace(/\.[^.]+$/, '') + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
          {totalRows} cau
        </span>
        {validRows > 0 && (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            {validRows} hop le
          </span>
        )}
        {warningRows > 0 && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            {warningRows} canh bao
          </span>
        )}
        {errorRows > 0 && (
          <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
            {errorRows} loi
          </span>
        )}
        {errorRows > 0 && (
          <button
            onClick={downloadErrorFile}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            Tai file loi
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-slate-200" role="tablist">
        {tabs
          .filter((t) => t.key === 'all' || t.count > 0)
          .map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={
                'inline-flex items-center gap-1 border-b-2 px-3 pb-2 pt-1 text-xs font-medium transition-colors ' +
                (tab === t.key
                  ? 'border-blue-500 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700')
              }
            >
              {t.label}
              {t.count > 0 && (
                <span
                  className={
                    'rounded-full px-1.5 py-0.5 text-[9px] font-bold ' +
                    (tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500')
                  }
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-xs" aria-label="Ket qua kiem tra tung dong">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-14 px-3 py-2 text-left font-semibold text-slate-500">Dong</th>
                <th className="w-24 px-3 py-2 text-left font-semibold text-slate-500">Ma</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">Cau hoi</th>
                <th className="w-20 px-3 py-2 text-left font-semibold text-slate-500">Phân loại</th>
                <th className="w-24 px-3 py-2 text-left font-semibold text-slate-500">
                  Trang thai
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Khong co dong nao.
                  </td>
                </tr>
              )}
              {filtered.map((p) => {
                const rowIssues = issuesByRow[p.rowIndex] ?? [];
                const isExp = expanded === p.rowIndex;
                return (
                  <React.Fragment key={p.rowIndex}>
                    <tr
                      className={
                        'border-t border-slate-100 transition-colors ' +
                        (p.status === 'ERROR'
                          ? 'bg-red-50/40 hover:bg-red-50'
                          : p.status === 'WARNING'
                            ? 'bg-amber-50/30 hover:bg-amber-50'
                            : 'hover:bg-slate-50')
                      }
                    >
                      <td className="px-3 py-2.5 font-mono text-slate-500">{p.rowIndex}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-700">
                        {p.externalId ?? <span className="text-slate-300">-</span>}
                      </td>
                      <td className="max-w-[240px] px-3 py-2.5">
                        <div className="line-clamp-1 text-slate-800">
                          {p.stemPreview ?? <span className="italic text-slate-400">Trong</span>}
                        </div>
                        {rowIssues.length > 0 && (
                          <button
                            onClick={() => setExpanded(isExp ? null : p.rowIndex)}
                            className="mt-0.5 flex items-center gap-0.5 text-[10px] text-red-600 hover:underline"
                            aria-expanded={isExp}
                          >
                            {rowIssues[0].sheet && (
                              <span className="font-mono">{rowIssues[0].sheet}</span>
                            )}
                            {rowIssues[0].field && (
                              <span className="text-slate-400"> · {rowIssues[0].field}</span>
                            )}{' '}
                            · {rowIssues.length} van de
                            <svg
                              width="9"
                              height="9"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className={'transition-transform ' + (isExp ? 'rotate-180' : '')}
                              aria-hidden="true"
                            >
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {p.curriculumLabel ?? <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <IssueBadge severity={p.status as 'ERROR' | 'WARNING' | 'VALID'} />
                      </td>
                    </tr>
                    {isExp && rowIssues.length > 0 && (
                      <tr className="border-t border-red-100 bg-red-50">
                        <td colSpan={5} className="px-3 py-2">
                          <ul className="space-y-1">
                            {rowIssues.map((iss, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <IssueBadge severity={iss.severity} />
                                <span className="text-xs text-slate-700">
                                  {iss.sheet && (
                                    <span className="font-mono text-slate-500">{iss.sheet}</span>
                                  )}
                                  {iss.field && (
                                    <span className="text-slate-400"> - {iss.field}</span>
                                  )}
                                  {' - '}
                                  {iss.message}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ConfirmStep({
  fileName,
  totalRows,
  validRows,
  warningRows,
  errorRows,
  onImportAll,
  onImportValid,
  loading,
}: {
  fileName: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  onImportAll: () => void;
  onImportValid: () => void;
  loading: boolean;
}) {
  const canImportAll = errorRows === 0;
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-700"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{fileName}</p>
            <p className="text-xs text-slate-500">{totalRows} dong</p>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-100 rounded-lg bg-slate-50 text-center">
          <div className="px-3 py-2.5">
            <p className="text-lg font-bold text-emerald-700">{validRows}</p>
            <p className="text-[10px] text-slate-500">Hop le</p>
          </div>
          <div className="px-3 py-2.5">
            <p
              className={`text-lg font-bold ${warningRows > 0 ? 'text-amber-600' : 'text-slate-400'}`}
            >
              {warningRows}
            </p>
            <p className="text-[10px] text-slate-500">Canh bao</p>
          </div>
          <div className="px-3 py-2.5">
            <p className={`text-lg font-bold ${errorRows > 0 ? 'text-red-600' : 'text-slate-400'}`}>
              {errorRows}
            </p>
            <p className="text-[10px] text-slate-500">Loi</p>
          </div>
        </div>
      </div>
      {errorRows > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <strong>{errorRows} cau co loi</strong> se khong duoc import. Import chi {validRows} cau
          hop le, hoac quay lai sua file.
        </div>
      )}
      <div className="flex flex-col gap-2">
        {canImportAll ? (
          <Button
            id="qb-import-confirm-btn"
            className="w-full"
            onClick={onImportAll}
            disabled={loading}
          >
            {loading ? 'Dang import...' : `Import ${validRows + warningRows} cau hoi`}
          </Button>
        ) : (
          <>
            <Button
              id="qb-import-valid-btn"
              className="w-full"
              onClick={onImportValid}
              disabled={loading || validRows === 0}
            >
              {loading ? 'Dang import...' : `Chi import ${validRows} cau hop le`}
            </Button>
            {validRows === 0 && (
              <p className="text-center text-xs text-slate-400">
                Khong co cau hoi hop le de import.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProgressScreen({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const r = 34,
    circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-6 py-10">
      <div className="relative flex size-20 items-center justify-center">
        <svg
          className="absolute inset-0 -rotate-90"
          width="80"
          height="80"
          viewBox="0 0 80 80"
          aria-hidden="true"
        >
          <circle cx="40" cy="40" r={r} fill="none" stroke="#E2E8F0" strokeWidth="8" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke="#0052FF"
            strokeWidth="8"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct / 100)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
        </svg>
        <span className="text-sm font-bold text-slate-800">{pct}%</span>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-800">Dang import cau hoi...</p>
        <p className="text-xs text-slate-500">
          {current} / {total} cau da xu ly
        </p>
      </div>
    </div>
  );
}

function SuccessScreen({
  count,
  warningCount,
  onViewQuestions,
  onImportAnother,
}: {
  count: number;
  warningCount: number;
  onViewQuestions: () => void;
  onImportAnother: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-emerald-600"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900">Import hoan tat!</p>
        <p className="mt-1 text-sm text-slate-600">{count} cau hoi da duoc them vao ngan hang.</p>
        {warningCount > 0 && (
          <p className="mt-1 text-xs text-slate-400">
            {warningCount} cau co canh bao - hay kiem tra lai.
          </p>
        )}
      </div>
      <div className="flex flex-col items-center gap-2">
        <Button id="qb-import-view-btn" onClick={onViewQuestions}>
          Xem cau hoi vua import
        </Button>
        <button
          onClick={onImportAnother}
          className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
        >
          Import file khac
        </button>
      </div>
    </div>
  );
}

interface QuestionImportWizardProps {
  onClose: () => void;
  onComplete: () => void;
}

function makeInitialState(): WizardState {
  return {
    step: 'upload',
    file: null,
    format: 'CSV',
    content: '',
    xlsxBuffer: null,
    previews: [],
    issues: [],
    totalRows: 0,
    validRows: 0,
    warningRows: 0,
    errorRows: 0,
    idempotencyKey: uuidv4(),
    sessionId: '',
    importedCount: 0,
    progressCurrent: 0,
    error: null,
    loading: false,
  };
}

export function QuestionImportWizard({ onClose, onComplete }: QuestionImportWizardProps) {
  const [state, setState] = React.useState<WizardState>(makeInitialState);

  function patch(p: Partial<WizardState>) {
    setState((s) => ({ ...s, ...p }));
  }
  function reset() {
    setState(makeInitialState());
  }

  async function handleFile(
    file: File,
    format: 'XLSX' | 'CSV' | 'JSON',
    content: string,
    buffer: ArrayBuffer | null
  ) {
    patch({
      file,
      format,
      content,
      xlsxBuffer: buffer,
      error: null,
      loading: true,
      step: 'validate',
    });
    try {
      let body: BodyInit;
      let headers: Record<string, string>;
      if (format === 'XLSX' && buffer) {
        const fd = new FormData();
        fd.append(
          'file',
          new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
          file.name
        );
        body = fd;
        headers = {};
      } else {
        body = JSON.stringify({
          content,
          format,
          fileName: file.name,
          mappings: [],
          defaults: { accessTier: 'OPEN', editorialStatus: 'DRAFT', sourceType: 'PUBLIC_DOCUMENT' },
        });
        headers = { 'Content-Type': 'application/json' };
      }
      const res = await fetch('/api/question-bank/import/preview', {
        method: 'POST',
        headers,
        body,
      });
      const data = (await res.json()) as {
        previews?: ImportRowPreview[];
        issues?: ValidationIssue[];
        totalRows?: number;
        validRows?: number;
        warningRows?: number;
        errorRows?: number;
        error?: string;
        sessionId?: string;
      };
      if (!res.ok) {
        patch({ error: data.error ?? 'Loi khong xac dinh.', loading: false, step: 'upload' });
        return;
      }
      const previews = data.previews ?? [];
      const issues = data.issues ?? [];
      const totalRows = data.totalRows ?? previews.length;
      const errorRows = data.errorRows ?? previews.filter((p) => p.status === 'ERROR').length;
      const warningRows = data.warningRows ?? previews.filter((p) => p.status === 'WARNING').length;
      const validRows = data.validRows ?? totalRows - errorRows;
      patch({
        previews,
        issues,
        totalRows,
        validRows,
        warningRows,
        errorRows,
        sessionId: data.sessionId ?? '',
        loading: false,
      });
    } catch {
      patch({ error: 'Khong ket noi duoc may chu.', loading: false, step: 'upload' });
    }
  }

  async function handleImport(onlyValid: boolean) {
    patch({ step: 'progress', loading: true, error: null, progressCurrent: 0 });
    try {
      const res = await fetch('/api/question-bank/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: state.idempotencyKey,
          sessionId: state.sessionId,
          allowPartial: onlyValid,
          conflictActions: {},
        }),
      });
      const data = (await res.json()) as {
        successCount?: number;
        warningCount?: number;
        failedCount?: number;
        error?: string;
      };
      if (!res.ok) {
        patch({ error: data.error ?? 'Loi khong xac dinh.', loading: false, step: 'confirm' });
        return;
      }
      patch({
        step: 'success',
        importedCount: data.successCount ?? 0,
        warningRows: data.warningCount ?? 0,
        loading: false,
      });
      onComplete();
    } catch {
      patch({ error: 'Khong ket noi duoc may chu.', loading: false, step: 'confirm' });
    }
  }

  const isVisible3Step =
    state.step === 'upload' || state.step === 'validate' || state.step === 'confirm';

  return (
    <div className="flex h-full flex-col" role="dialog" aria-modal="true" aria-label="Nhap cau hoi">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Nhap cau hoi</h2>
          <p className="text-xs text-slate-500">Import tu file Excel, CSV hoac JSON</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Dong"
          className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      {isVisible3Step && (
        <div className="border-b border-slate-100 px-5 py-3">
          <StepIndicator current={state.step} />
        </div>
      )}
      {state.step === 'validate' && state.loading && (
        <div className="flex items-center gap-2 border-b border-slate-100 bg-blue-50 px-5 py-2.5 text-xs text-blue-700">
          <svg
            className="animate-spin"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          Dang kiem tra du lieu...
        </div>
      )}
      {state.error && (
        <div
          role="alert"
          className="border-b border-red-200 bg-red-50 px-5 py-2.5 text-xs text-red-700"
        >
          {state.error}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {state.step === 'upload' && <UploadStep onFile={handleFile} />}
        {state.step === 'validate' && !state.loading && (
          <ValidateStep
            previews={state.previews}
            issues={state.issues}
            totalRows={state.totalRows}
            validRows={state.validRows}
            warningRows={state.warningRows}
            errorRows={state.errorRows}
            fileName={state.file?.name ?? ''}
          />
        )}
        {state.step === 'confirm' && (
          <ConfirmStep
            fileName={state.file?.name ?? ''}
            totalRows={state.totalRows}
            validRows={state.validRows}
            warningRows={state.warningRows}
            errorRows={state.errorRows}
            onImportAll={() => handleImport(false)}
            onImportValid={() => handleImport(true)}
            loading={state.loading}
          />
        )}
        {state.step === 'progress' && (
          <ProgressScreen current={state.progressCurrent} total={state.totalRows} />
        )}
        {state.step === 'success' && (
          <SuccessScreen
            count={state.importedCount}
            warningCount={state.warningRows}
            onViewQuestions={onClose}
            onImportAnother={reset}
          />
        )}
      </div>
      {state.step === 'validate' && !state.loading && (
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => patch({ step: 'upload', error: null })}
          >
            Chon file khac
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (state.sessionId) {
                window.location.assign(
                  `/admin/question-bank/import?session=${encodeURIComponent(state.sessionId)}`
                );
              }
            }}
            disabled={state.validRows === 0 && state.warningRows === 0}
          >
            Tiep theo
          </Button>
        </div>
      )}
      {state.step === 'confirm' && (
        <div className="border-t border-slate-200 px-5 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => patch({ step: 'validate', error: null })}
            disabled={state.loading}
          >
            Quay lai
          </Button>
        </div>
      )}
    </div>
  );
}
