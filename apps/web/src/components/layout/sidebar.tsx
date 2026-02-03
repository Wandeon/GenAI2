"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@genai/ui";

const navItems = [
  { href: "/observatory", label: "Observatory", icon: "🔭" },
  { href: "/daily", label: "Dnevni pregled", icon: "📰" },
  { href: "/explore", label: "Istrazi", icon: "🔍" },
  { href: "/watchlists", label: "Pracenje", icon: "👁" },
  { href: "/library", label: "Knjiznica", icon: "📚" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-card hidden lg:block">
      <div className="p-4 border-b">
        <Link href="/" className="text-xl font-bold">
          GenAI.hr
        </Link>
      </div>
      <nav className="p-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent"
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
