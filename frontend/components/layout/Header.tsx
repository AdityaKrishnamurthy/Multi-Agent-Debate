"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/layout/ThemeProvider";

export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" className={className}>
      <rect x="0" y="0" width="13" height="28" rx="4" fill="var(--pro)" />
      <rect x="15" y="0" width="13" height="28" rx="4" fill="var(--con)" />
    </svg>
  );
}

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const onHome = pathname === "/";

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-[60px] max-w-[1440px] items-center gap-6 px-4 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-3 whitespace-nowrap rounded-md text-base font-bold tracking-tight text-foreground sm:text-[17px]"
        >
          <LogoMark />
          Multi-Agent Debate
        </Link>

        <nav aria-label="Main" className="ml-auto flex items-center gap-1">
          <Button
            variant={onHome ? "secondary" : "ghost"}
            size="sm"
            nativeButton={false}
            render={<Link href="/" />}
          >
            New debate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/#samples" />}
            className="hidden sm:inline-flex"
          >
            Sample debates
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleTheme}
            aria-label={
              theme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </nav>
      </div>
    </header>
  );
}
