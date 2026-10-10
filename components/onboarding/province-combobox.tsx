'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';

import {
  VIETNAM_PROVINCES_LEGACY,
  findLegacyProvinceByCode,
  normalizeVietnameseSearch,
} from '@/data/vietnam-provinces-legacy';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ProvinceCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const selected = findLegacyProvinceByCode(value);
  const normalizedQuery = normalizeVietnameseSearch(query);
  const filtered = normalizedQuery
    ? VIETNAM_PROVINCES_LEGACY.filter((province) =>
        normalizeVietnameseSearch(province.name).includes(normalizedQuery)
      )
    : VIETNAM_PROVINCES_LEGACY;

  return (
    <>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls="legacy-province-list"
        onClick={() => setOpen(true)}
        className="mt-1 flex h-11 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 text-left text-sm outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-blue-100"
      >
        <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
          {selected?.name ?? 'Chọn tỉnh / thành phố'}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
      </button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery('');
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg overflow-hidden p-0">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>Chọn tỉnh / thành phố</DialogTitle>
          </DialogHeader>
          <div className="flex items-center border-b bg-slate-50 px-4 py-3">
            <Search className="mr-2 size-4 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm tỉnh / thành phố…"
              aria-label="Tìm tỉnh / thành phố"
              className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <div id="legacy-province-list" className="max-h-[min(52vh,360px)] overflow-y-auto p-2">
            {filtered.length ? (
              filtered.map((province) => {
                const isSelected = province.code === value;
                return (
                  <button
                    type="button"
                    key={province.code}
                    onClick={() => {
                      onChange(province.code);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-slate-100 ${isSelected ? 'bg-blue-50 font-semibold text-[#0052FF]' : 'text-slate-700'}`}
                  >
                    <span className="flex-1">{province.name}</span>
                    {isSelected ? <Check className="size-4" aria-hidden="true" /> : null}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-8 text-center text-sm text-slate-500">
                Không tìm thấy tỉnh / thành phố phù hợp.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
