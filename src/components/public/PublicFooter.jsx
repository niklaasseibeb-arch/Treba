import React from "react";
import { Link } from "react-router-dom";
import { Globe, Phone, Facebook, Instagram, MessageCircle } from "lucide-react";
import Logo from "@/components/Logo";

function NamibiaFlag() {
  const rays = Array.from({ length: 12 });
  return (
    <svg viewBox="0 0 90 60" className="inline-block h-5 w-8 rounded-sm shadow-sm" role="img" aria-label="Namibia flag" preserveAspectRatio="none">
      <defs>
        <clipPath id="namibiaFlagClip"><rect x="0" y="0" width="90" height="60" /></clipPath>
      </defs>
      <g clipPath="url(#namibiaFlagClip)">
        <polygon points="0,0 90,0 0,60" fill="#003580" />
        <polygon points="90,0 90,60 0,60" fill="#009639" />
        <rect x="-20" y="18" width="130" height="24" fill="#ffffff" transform="rotate(-33.69 45 30)" />
        <rect x="-20" y="21" width="130" height="18" fill="#D21034" transform="rotate(-33.69 45 30)" />
        <g transform="translate(16 40)" fill="#FDB813">
          {rays.map((_, i) => (
            <polygon key={i} points="0,-13 2.2,-7 -2.2,-7" transform={`rotate(${i * 30})`} />
          ))}
          <circle cx="0" cy="0" r="4.5" />
        </g>
      </g>
    </svg>
  );
}

export default function PublicFooter() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col items-center gap-4 md:items-start">
            <Logo size="md" showTagline />
            <div className="flex items-center gap-2 text-sm font-medium">
              <NamibiaFlag />
              <span>Proudly connecting towns across Namibia.</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm font-medium">
            <Globe className="h-4 w-4" />
            <a href="https://www.treba.com.na" className="hover:underline">
              www.treba.com.na
            </a>
          </div>

          <div className="flex flex-col items-center gap-3 md:items-end">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Phone className="h-4 w-4" />
              <a href="tel:+264811624588" className="hover:underline">
                081 162 4588
              </a>
            </div>
            <div className="flex items-center gap-3">
              <a href="#" aria-label="Facebook" className="rounded-full bg-primary-foreground/15 p-2 transition-colors hover:bg-primary-foreground/25">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="#" aria-label="Instagram" className="rounded-full bg-primary-foreground/15 p-2 transition-colors hover:bg-primary-foreground/25">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="https://wa.me/264811624588" aria-label="WhatsApp" className="rounded-full bg-primary-foreground/15 p-2 transition-colors hover:bg-primary-foreground/25">
                <MessageCircle className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-primary-foreground/20 pt-6 text-sm md:flex-row">
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link to="/" className="hover:underline">Home</Link>
            <Link to="/how-it-works" className="hover:underline">How Treba Works</Link>
            <Link to="/login" className="hover:underline">Log in</Link>
            <Link to="/register" className="hover:underline">Sign up</Link>
            <a href="#" className="hover:underline">Privacy</a>
            <a href="#" className="hover:underline">Terms</a>
          </nav>
          <p className="text-primary-foreground/80">
            © {new Date().getFullYear()} Treba. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}