'use client';

import Link from 'next/link';

import { Button } from '@kit/ui/button';

export function HomeMenuNavigation() {
  return (
    <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
      <Link href="/home" className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-sky-400 ring-1 ring-white/10">
          <span className="text-xs font-semibold text-black">QC</span>
        </div>
        <span className="text-sm font-semibold text-white">QuickCreator</span>
      </Link>

      <div className="flex items-center gap-2">
        <Link href="/home/create">
          <Button className="rounded-xl bg-gradient-to-r from-violet-500 to-sky-400 text-black hover:opacity-95">
            New content
          </Button>
        </Link>

        <Link href="/home/library">
          <Button variant="outline" className="rounded-xl border-white/10 bg-white/[0.03] hover:bg-white/6">
            Library
          </Button>
        </Link>
      </div>
    </div>
  );
}
