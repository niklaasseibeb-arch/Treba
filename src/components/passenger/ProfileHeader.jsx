import React from "react";
import { User, ShieldCheck, BadgeCheck, Star } from "lucide-react";
import { Image } from "@/components/ui/image";
import StatusBadge from "@/components/StatusBadge";

export default function ProfileHeader({ profile, user }) {
  const initials = (profile?.full_name || user?.full_name || "P")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 treba-shadow sm:flex-row sm:items-center">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/15 text-primary">
        {profile?.profile_photo_url ? (
          <Image src={profile.profile_photo_url} alt={profile.full_name} className="h-full w-full" fittingType="fill" />
        ) : (
          <span className="text-2xl font-bold">{initials}</span>
        )}
      </div>

      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{profile?.full_name || user?.full_name || "Passenger"}</h1>
          {profile?.phone_verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              <BadgeCheck className="h-3.5 w-3.5" /> Mobile verified
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{user?.email}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={profile?.account_status || "active"} />
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
            <Star className="h-3.5 w-3.5" /> Reliability {profile?.reliability_score ?? 100}%
          </span>
        </div>
      </div>
    </div>
  );
}