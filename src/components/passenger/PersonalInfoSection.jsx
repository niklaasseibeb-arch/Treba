import React, { useState } from "react";
import { Loader2, Save, Phone, ShieldCheck, Upload, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/components/ui/use-toast";

const CONTACT_METHODS = [
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone_call", label: "Phone call" },
  { value: "email", label: "Email" },
];

export default function PersonalInfoSection({ profile, profileId, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    full_name: profile?.full_name || "",
    phone: profile?.phone || "",
    preferred_contact_method: profile?.preferred_contact_method || "sms",
    emergency_contact_name: profile?.emergency_contact_name || "",
    emergency_contact_phone: profile?.emergency_contact_phone || "",
    profile_photo_url: profile?.profile_photo_url || "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [mobileCode, setMobileCode] = useState("");
  const [sentCode, setSentCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const phoneVerified = profile?.phone_verified;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((f) => ({ ...f, profile_photo_url: file_url }));
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let saved;
      if (profileId) {
        saved = await base44.entities.PassengerProfile.update(profileId, form);
      } else {
        saved = await base44.entities.PassengerProfile.create({ ...form, account_status: "active" });
      }
      onSaved?.(saved);
      toast({ title: "Profile saved", description: "Your details have been updated." });
    } catch (err) {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const startVerify = () => {
    if (!form.phone.trim()) {
      toast({ title: "Add a mobile number first", variant: "destructive" });
      return;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setSentCode(code);
    setMobileCode("");
    setVerifyOpen(true);
    toast({ title: "Code sent", description: `Demo code: ${code}` });
  };

  const confirmVerify = async () => {
    if (mobileCode !== sentCode) {
      toast({ title: "Incorrect code", variant: "destructive" });
      return;
    }
    setVerifying(true);
    try {
      const saved = await base44.entities.PassengerProfile.update(profileId, { phone_verified: true });
      onSaved?.(saved);
      setVerifyOpen(false);
      toast({ title: "Mobile verified", description: "Your mobile number is now verified." });
    } catch (err) {
      toast({ title: "Could not verify", description: err.message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-5 rounded-2xl border border-border bg-card p-6 treba-shadow">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-primary">
          {form.profile_photo_url ? (
            <img src={form.profile_photo_url} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg font-bold">
              {(form.full_name || "P").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <input id="pPhoto" type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          <Label htmlFor="pPhoto" className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {form.profile_photo_url ? "Change photo" : "Add photo"}
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pName">Full name</Label>
          <Input id="pName" value={form.full_name} onChange={set("full_name")} required className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pPhone">Mobile number</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="pPhone" type="tel" value={form.phone} onChange={set("phone")} placeholder="081 123 4567" className="pl-10 h-11" />
            </div>
            {phoneVerified ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-3 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Verified
              </span>
            ) : (
              <Button type="button" variant="outline" className="h-11 px-3" onClick={startVerify}>
                <ShieldCheck className="mr-1 h-4 w-4" /> Verify
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Preferred contact method</Label>
        <Select value={form.preferred_contact_method} onValueChange={(v) => setForm((f) => ({ ...f, preferred_contact_method: v }))}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CONTACT_METHODS.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <p className="mb-3 text-sm font-semibold">Emergency contact</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="emName">Contact name</Label>
            <Input id="emName" value={form.emergency_contact_name} onChange={set("emergency_contact_name")} placeholder="Optional" className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emPhone">Contact phone</Label>
            <Input id="emPhone" type="tel" value={form.emergency_contact_phone} onChange={set("emergency_contact_phone")} placeholder="081 000 0000" className="h-11" />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving} className="h-11 px-6">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save changes
        </Button>
      </div>

      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify your mobile number</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">We sent a code to {form.phone}.</p>
          <div className="flex justify-center py-2">
            <InputOTP maxLength={6} value={mobileCode} onChange={setMobileCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyOpen(false)}>Cancel</Button>
            <Button onClick={confirmVerify} disabled={verifying || mobileCode.length < 6}>
              {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}