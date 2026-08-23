import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "How Treba Works", to: "/how-it-works" },
  { label: "Admin", to: "/app/admin" },
];

export default function PublicHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center" aria-label="Treba home">
          <Logo size="md" showTagline />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button asChild variant="outline" className="h-10 px-5">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild className="h-10 px-5 font-semibold">
            <Link to="/register">Sign up</Link>
          </Button>
        </div>

        <button
          className="inline-flex items-center justify-center rounded-lg p-2 text-foreground md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2">
            <Button asChild variant="outline" className="h-11">
              <Link to="/login" onClick={() => setOpen(false)}>
                Log in
              </Link>
            </Button>
            <Button asChild className="h-11 font-semibold">
              <Link to="/register" onClick={() => setOpen(false)}>
                Sign up
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}