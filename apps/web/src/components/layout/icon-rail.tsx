"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Newspaper, Radio, Search, Eye, LayoutGrid } from "lucide-react";
import { cn } from "@genai/ui";

const navItems = [
  { href: "/daily", label: "Dnevni", icon: Newspaper },
  { href: "/live", label: "Uzivo", icon: Radio },
  { href: "/explore", label: "Istrazi", icon: Search },
  { href: "/watchlists", label: "Pracenje", icon: Eye },
  { href: "/observatory", label: "Observatory", icon: LayoutGrid },
] as const;

export function IconRail() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-14 hover:w-[200px] transition-all duration-200 border-r border-border bg-background group/rail overflow-hidden shrink-0">
      <div className="p-3 border-b border-border">
        <Link href="/daily" className="font-semibold text-sm whitespace-nowrap">
          <span className="block group-hover/rail:hidden text-center">G</span>
          <span className="hidden group-hover/rail:block pl-1">GenAI</span>
        </Link>
      </div>
      <nav className="flex-1 py-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors whitespace-nowrap",
                isActive
                  ? "text-foreground border-l-2 border-primary bg-card"
                  : "text-muted-foreground hover:text-foreground border-l-2 border-transparent"
              )}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span className="opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
