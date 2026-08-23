import React from "react";
import { cn } from "@/lib/utils";

export const TREBA_LOGO_URL =
  "https://media.base44.com/images/public/user_6a5b503cc9e14b0190f76f9e/b3e5184c5_TrebaAppLogo1.png";

/**
 * Treba brand logo — the official supplied icon plus the Treba wordmark.
 * The wordmark is rendered in Treba's golden yellow, immediately next to the
 * original logo. Do not alter, recolour, stretch or replace the icon asset.
 */
export default function Logo({ size = "md", showWordmark = true, showTagline = false, className }) {
  const dimensions = {
    sm: { box: "h-8 w-8", text: "text-lg", tag: "text-[10px]" },
    md: { box: "h-10 w-10", text: "text-xl", tag: "text-[11px]" },
    lg: { box: "h-14 w-14", text: "text-3xl", tag: "text-xs" },
    xl: { box: "h-20 w-20", text: "text-4xl", tag: "text-sm" },
  }[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src={TREBA_LOGO_URL}
        alt="Treba logo"
        className={cn("rounded-xl object-cover", dimensions.box)}
        style={{ display: "block" }}
      />
      {showWordmark && (
        <div className="leading-none">
          <div className={cn("font-extrabold tracking-tight text-primary", dimensions.text)}>
            Treba
          </div>
          {showTagline && (
            <div className={cn("font-medium text-muted-foreground mt-0.5", dimensions.tag)}>
              Plan. Book. Travel.
            </div>
          )}
        </div>
      )}
    </div>
  );
}