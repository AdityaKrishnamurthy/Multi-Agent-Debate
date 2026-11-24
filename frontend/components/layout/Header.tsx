"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Scale, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/layout/ThemeProvider";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight text-foreground hover:opacity-85"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Scale className="size-4" />
            </span>
            <span className="text-base">Multi-Agent Debate</span>
          </Link>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            Phase 1 Demo
          </Badge>
        </div>

        <nav className="flex items-center gap-2">
          <Button
            variant={pathname === "/" ? "secondary" : "ghost"}
            size="sm"
            nativeButton={false}
            render={<Link href="/" />}
          >
            New Debate
          </Button>
          <Button
            variant={pathname?.startsWith("/debate") ? "secondary" : "ghost"}
            size="sm"
            nativeButton={false}
            render={<Link href="/debate/4day-week?demo=1" />}
          >
            Sample Debate
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
        </nav>
      </div>
    </header>
  );
}
