import React from "react";
import { CheckCircle2, MapPin, Flag, CalendarClock, Clock, Users, FileText, Hash, Route as RouteIcon, BadgeDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import LuggageSummary from "@/components/LuggageSummary";

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-medium break-words">{value || "—"}</div>
      </div>
    </div>
  );
}

export default function TripRequestReceipt({ request, onAnother }) {
  return (
    <div className="max-w-2xl space-y-6">
      {request.request_status === "matched" && request.matched_driver_name ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          <div>
            <h2 className="text-lg font-semibold text-emerald-900">Request sent to a scheduled driver</h2>
            <p className="text-sm text-emerald-800">Treba matched your request to {request.matched_driver_name}. Your driver will accept, decline, or negotiate your fare. No booking is confirmed yet.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <CheckCircle2 className="h-6 w-6 text-amber-600" />
          <div>
            <h2 className="text-lg font-semibold text-amber-900">Trip request submitted</h2>
            <p className="text-sm text-amber-800">No scheduled driver with confirmed availability matched your trip yet. Treba is looking — your fare will be negotiated with the driver once matched.</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 treba-shadow">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Request ID</span>
          </div>
          <span className="font-mono text-sm font-semibold">{request.id}</span>
        </div>

        <div className="divide-y divide-border">
          <Row icon={RouteIcon} label="Route" value={`${request.origin} → ${request.destination}`} />
          <Row icon={CalendarClock} label="Date" value={request.requested_date} />
          <Row icon={Clock} label="Preferred departure" value={request.requested_time} />
          <Row icon={MapPin} label="Pickup" value={request.pickup_location} />
          <Row icon={Flag} label="Drop-off" value={request.dropoff_location} />
          <Row icon={Users} label="Passengers" value={String(request.number_of_seats || 1)} />
          <div className="py-2.5"><LuggageSummary luggage={request} /></div>
          {request.notes ? <Row icon={FileText} label="Notes" value={request.notes} /> : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Request status</div>
            <span className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">Requested</span>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Fare</div>
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1 text-sm font-semibold">
              <BadgeDollarSign className="h-4 w-4 text-muted-foreground" />
              To be negotiated
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onAnother} className="h-11 px-6">Submit another request</Button>
      </div>
    </div>
  );
}