'use client';

import Link from 'next/link';
import { Menu, Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';

export function HomeMobileNavigation() {
  return (
    <div className="flex items-center gap-2">
      <Link href="/home/create">
        <Button className="rounded-xl bg-gradient-to-r from-violet-500 to-sky-400 text-black hover:opacity-95">
          <Sparkles className="mr-2 h-4 w-4" />
          Create
        </Button>
      </Link>

      <Button variant="outline" size="icon" className="rounded-xl border-white/10 bg-white/[0.03] hover:bg-white/6">
        <Menu className="h-4.5 w-4.5" />
      </Button>
    </div>
  );
}
