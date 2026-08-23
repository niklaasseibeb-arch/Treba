import React from "react";
import DriverSubscriptionPanel from "@/components/driver/DriverSubscriptionPanel";
import SubscriptionPaymentHistory from "@/components/driver/SubscriptionPaymentHistory";

export default function DriverSubscription() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscription</h1>
        <p className="mt-1 text-muted-foreground">
          Treba drivers pay a simple monthly subscription. No commission is ever charged on passenger fares — the fare
          belongs entirely to the passenger and driver.
        </p>
      </div>
      <DriverSubscriptionPanel />
      <SubscriptionPaymentHistory />
    </div>
  );
}