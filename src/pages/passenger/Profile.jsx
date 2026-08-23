import React, { useEffect, useState } from "react";
import { Loader2, User, History, CreditCard } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ProfileHeader from "@/components/passenger/ProfileHeader";
import PersonalInfoSection from "@/components/passenger/PersonalInfoSection";
import ReliabilitySection from "@/components/passenger/ReliabilitySection";
import BookingHistorySection from "@/components/passenger/BookingHistorySection";
import PaymentMethodsSection from "@/components/passenger/PaymentMethodsSection";

export default function PassengerProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profileId, setProfileId] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const existing = await base44.entities.PassengerProfile.filter({ user_id: user.id });
        if (!active) return;
        if (existing && existing.length) {
          const p = existing[0];
          setProfile(p);
          setProfileId(p.id);
        } else {
          setProfile({ full_name: user.full_name || "" });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSaved = (saved) => {
    setProfile(saved);
    setProfileId(saved.id);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="mt-1 text-muted-foreground">Manage your details, reliability and payment methods.</p>
      </div>

      <ProfileHeader profile={profile} user={user} />

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile"><User className="mr-1.5 h-4 w-4" /> Profile</TabsTrigger>
          <TabsTrigger value="bookings"><History className="mr-1.5 h-4 w-4" /> Bookings</TabsTrigger>
          <TabsTrigger value="payment"><CreditCard className="mr-1.5 h-4 w-4" /> Payment</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4 space-y-6">
          <PersonalInfoSection profile={profile} profileId={profileId} onSaved={handleSaved} />
          <ReliabilitySection profile={profile} />
        </TabsContent>

        <TabsContent value="bookings" className="mt-4">
          <BookingHistorySection />
        </TabsContent>

        <TabsContent value="payment" className="mt-4">
          <PaymentMethodsSection profile={profile} profileId={profileId} onSaved={handleSaved} />
        </TabsContent>
      </Tabs>
    </div>
  );
}