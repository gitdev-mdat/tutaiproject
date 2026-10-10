'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { normalizeCustomHighSchoolName } from '@/data/vietnam-high-schools';
import { normalizeVietnameseSearch } from '@/data/vietnam-provinces-legacy';
import {
  localHighSchoolDirectory,
  type HighSchoolDirectory,
} from '@/lib/onboarding/high-school-directory';

export type SchoolSelection =
  | { schoolId: string; schoolName: string; schoolSource: 'dataset' }
  | { schoolId: null; schoolName: string; schoolSource: 'custom' }
  | { schoolId: null; schoolName: ''; schoolSource: null };

export function SchoolCombobox({
  provinceCode,
  schoolId,
  schoolName,
  schoolSource,
  onChange,
  directory = localHighSchoolDirectory,
}: {
  provinceCode: string;
  schoolId: string;
  schoolName: string;
  schoolSource: 'dataset' | 'custom' | '';
  onChange: (selection: SchoolSelection) => void;
  directory?: HighSchoolDirectory;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [schools, setSchools] = React.useState<
    Awaited<ReturnType<HighSchoolDirectory['listByProvince']>>
  >([]);
  const [loading, setLoading] = React.useState(false);
  const [customMode, setCustomMode] = React.useState(false);
  const [customName, setCustomName] = React.useState('');

  const normalizedQuery = normalizeVietnameseSearch(query);
  const filtered = normalizedQuery
    ? schools.filter((school) =>
        normalizeVietnameseSearch(`${school.name} ${school.districtName ?? ''}`).includes(
          normalizedQuery
        )
      )
    : schools;
  const selectedLabel = schoolSource && schoolName ? schoolName : null;

  function close() {
    setOpen(false);
    setQuery('');
    setCustomMode(false);
    setCustomName('');
  }

  async function openSelector() {
    if (!provinceCode) return;
    setOpen(true);
    setLoading(true);
    try {
      setSchools(await directory.listByProvince(provinceCode));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        role="combobox"
        aria-label="Trường THPT"
        aria-expanded={open}
        aria-controls="high-school-list"
        disabled={!provinceCode}
        onClick={() => void openSelector()}
        className="mt-1 flex h-11 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 text-left text-sm outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
      >
        <span className={selectedLabel ? 'truncate text-slate-900' : 'truncate text-slate-400'}>
          {selectedLabel ??
            (provinceCode ? 'Tìm trường THPT của em' : 'Chọn tỉnh / thành phố trước')}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
      </button>

      <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? void openSelector() : close())}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-xl overflow-hidden p-0">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>Chọn trường THPT</DialogTitle>
          </DialogHeader>
          {customMode ? (
            <div className="space-y-4 p-4">
              <label className="block text-sm font-semibold text-slate-700">
                Nhập tên trường
                <input
                  autoFocus
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  placeholder="Ví dụ: THPT Nguyễn Văn A"
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCustomMode(false)}
                  className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-600"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  disabled={!customName.trim()}
                  onClick={() => {
                    onChange({
                      schoolId: null,
                      schoolName: normalizeCustomHighSchoolName(customName),
                      schoolSource: 'custom',
                    });
                    close();
                  }}
                  className="min-h-11 rounded-xl bg-[#0052FF] px-4 text-sm font-bold text-white disabled:opacity-50"
                >
                  Dùng tên trường này
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center border-b bg-slate-50 px-4 py-3">
                <Search className="mr-2 size-4 shrink-0 text-slate-400" aria-hidden="true" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm trường THPT của em…"
                  aria-label="Tìm trường THPT của em"
                  className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
              <div id="high-school-list" className="max-h-[min(46vh,330px)] overflow-y-auto p-2">
                {loading ? (
                  <p className="px-3 py-8 text-center text-sm text-slate-500">
                    Đang tải danh sách trường…
                  </p>
                ) : filtered.length ? (
                  filtered.map((school) => {
                    const selected = school.id === schoolId && schoolSource === 'dataset';
                    return (
                      <button
                        type="button"
                        key={school.id}
                        onClick={() => {
                          onChange({
                            schoolId: school.id,
                            schoolName: school.name,
                            schoolSource: 'dataset',
                          });
                          close();
                        }}
                        className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-slate-100 ${selected ? 'bg-blue-50 font-semibold text-[#0052FF]' : 'text-slate-700'}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block">{school.name}</span>
                          {school.districtName ? (
                            <span className="block text-xs font-normal text-slate-400">
                              {school.districtName}
                            </span>
                          ) : null}
                        </span>
                        {selected ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-6 text-center text-sm text-slate-500">
                    Không tìm thấy trường phù hợp.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-slate-50 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setCustomMode(true)}
                  className="min-h-11 text-left text-sm font-semibold text-[#0052FF]"
                >
                  Không thấy trường của em? <span className="underline">Nhập tên trường</span>
                </button>
                {selectedLabel ? (
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ schoolId: null, schoolName: '', schoolSource: null });
                      close();
                    }}
                    className="min-h-11 text-sm font-semibold text-slate-500"
                  >
                    Bỏ chọn
                  </button>
                ) : null}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
