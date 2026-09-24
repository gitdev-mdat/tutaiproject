'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface ImportMethodItem {
  label: string;
  description: string;
  icon: LucideIcon;
  href?: string;
  onSelect?: () => void;
}

export function ImportMethodMenu({
  label,
  items,
  variant = 'outline',
}: {
  label: string;
  items: ImportMethodItem[];
  variant?: 'default' | 'outline';
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant={variant} />}>
        {label}
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[300px] p-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">{item.label}</span>
                <span className="mt-0.5 block text-xs leading-4 text-slate-500">
                  {item.description}
                </span>
              </span>
            </>
          );
          return (
            <DropdownMenuItem
              key={item.label}
              className="items-start gap-2.5 px-2 py-2"
              onClick={item.onSelect}
              render={item.href ? <Link href={item.href} /> : undefined}
            >
              {content}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
