'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, ChevronDown, Crown } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Badge } from '@kit/ui/badge';
import { Separator } from '@kit/ui/separator';

type NavItem = {
  label: string;
  href: string;
  icon: any;
  badge?: string;
};

const primaryNav: NavItem[] = [
  { label: 'Dashboard', href: '/home', icon: require('lucide-react').LayoutGrid },
  { label: 'Projects', href: '/home/projects', icon: require('lucide-react').FolderKanban },
  { label: 'Sites', href: '/home/sites', icon: require('lucide-react').Globe },
  { label: 'Create Content', href: '/home/create', icon: require('lucide-react').Sparkles, badge: 'New' },
  { label: 'Content Library', href: '/home/library', icon: require('lucide-react').LibraryBig },
];

const secondaryNav: NavItem[] = [
  { label: 'Templates', href: '/home/templates', icon: require('lucide-react').Blocks },
  { label: 'Integrations', href: '/home/integrations', icon: require('lucide-react').PlugZap },
  { label: 'Publishing', href: '/home/publishing', icon: require('lucide-react').Send },
  { label: 'Billing', href: '/home/billing', icon: require('lucide-react').CreditCard },
];

function Brand() {
  return (
    <Link href="/home" className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-sky-400 shadow-[0_10px_40px_rgba(139,92,246,0.22)] ring-1 ring-white/10">
        <span className="text-sm font-semibold text-black">QC</span>
      </div>

      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight text-white">
          QuickCreator
        </div>
        <div className="text-xs text-zinc-400">Workspace</div>
      </div>
    </Link>
  );
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const Icon = item.icon.default ?? item.icon;
  const active =
    pathname === item.href ||
    (item.href !== '/home' && pathname.startsWith(item.href + '/'));

  return (
    <Link
      href={item.href}
      className={[
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
        active
          ? 'bg-white/8 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)]'
          : 'text-zinc-300 hover:bg-white/6 hover:text-white',
      ].join(' ')}
    >
      <span
        className={[
          'grid h-9 w-9 place-items-center rounded-lg border transition',
          active
            ? 'border-white/10 bg-white/8'
            : 'border-white/5 bg-white/[0.03] group-hover:border-white/10 group-hover:bg-white/6',
        ].join(' ')}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>

      <span className="min-w-0 flex-1 truncate">{item.label}</span>

      {item.badge ? (
        <Badge className="border border-violet-400/20 bg-violet-500/15 text-violet-200">
          {item.badge}
        </Badge>
      ) : null}
    </Link>
  );
}

export function HomeSidebar({ user }: { user: any }) {
  return (
    <div className="flex h-dvh w-[288px] flex-col border-r border-white/5 bg-black/20 backdrop-blur">
      <div className="px-5 pb-4 pt-5">
        <Brand />

        {/* Project switcher */}
        <button className="mt-5 flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 text-left text-sm text-zinc-200 transition hover:border-white/10 hover:bg-white/6">
          <div className="min-w-0">
            <div className="truncate font-medium">
              {user?.data?.user_metadata?.workspaceName ?? 'Default Project'}
            </div>
            <div className="truncate text-xs text-zinc-400">
              Production workspace
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        </button>

        {/* Search */}
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 text-sm text-zinc-400">
          <Search className="h-4 w-4" />
          <span className="truncate">Search…</span>
          <span className="ml-auto rounded-md border border-white/5 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-400">
            ⌘K
          </span>
        </div>
      </div>

      <Separator className="bg-white/5" />

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Content
        </div>
        <div className="space-y-1">
          {primaryNav.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>

        <div className="mt-6 px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Manage
        </div>
        <div className="space-y-1">
          {secondaryNav.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
      </div>

      {/* Upgrade */}
      <div className="px-5 pb-5">
        <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/20">
              <Crown className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">
                Upgrade to Pro
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                Higher limits, team features, and advanced workflows.
              </div>
            </div>
          </div>

          <Button className="mt-4 w-full rounded-xl bg-gradient-to-r from-violet-500 to-sky-400 text-black hover:opacity-95">
            Upgrade
          </Button>

          <div className="mt-2 text-center text-[11px] text-zinc-500">
            Manage billing in <span className="text-zinc-300">Billing</span>
          </div>
        </div>
      </div>
    </div>
  );
}
