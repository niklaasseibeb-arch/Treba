import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UserPlus, Mail, Lock, Loader2, Luggage, Car, Phone, ShieldCheck,
  Contact as ContactIcon, Upload, CheckCircle2,
} from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "@/components/ui/use-toast";
import { safeReturnTo } from "@/lib/authReturnTo";
import DriverRegistrationSteps from "@/components/driver/DriverRegistrationSteps";

const CONTACT_METHODS = [
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone_call", label: "Phone call" },
  { value: "email", label: "Email" },
];

export default function Register() {
  const [step, setStep] = useState("account"); // account | emailOtp | passengerDetails | mobileOtp
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [role, setRole] = useState("passenger");

  // Passenger details
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredContact, setPreferredContact] = useState("sms");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [mobileOtp, setMobileOtp] = useState("");
  const [sentMobileCode, setSentMobileCode] = useState("");

  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.register({ email, password });
      setStep("emailOtp");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const finishDriver = async () => {
    try {
      await base44.auth.updateMe({ app_role: "driver" });
    } catch (e) {
      // non-fatal
    }
    const dest = safeReturnTo() === "/" ? "/app/driver" : safeReturnTo();
    window.location.href = dest;
  };

  const handleEmailVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) base44.auth.setToken(result.access_token);
      if (role === "driver") {
        setStep("driverDetails");
        return;
      }
      setStep("passengerDetails");
    } catch (err) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast({ title: "Code sent", description: "Check your email for the new code." });
    } catch (err) {
      setError(err.message || "Failed to resend code");
    }
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrl(file_url);
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePassengerDetailsSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!fullName.trim() || !phone.trim()) {
      setError("Full name and mobile number are required.");
      return;
    }
    // Generate a mobile verification code (sent via SMS where supported).
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setSentMobileCode(code);
    setStep("mobileOtp");
    toast({
      title: "Verification code sent",
      description: `A code was sent to ${phone}. (Demo: ${code})`,
    });
  };

  const handleMobileVerify = async () => {
    setError("");
    setLoading(true);
    try {
      if (mobileOtp !== sentMobileCode) {
        setError("Incorrect verification code.");
        setLoading(false);
        return;
      }
      // Persist role + create passenger profile
      try {
        await base44.auth.updateMe({ app_role: "passenger", full_name: fullName, phone });
      } catch (e) {
        // non-fatal
      }
      await base44.entities.PassengerProfile.create({
        user_id: (await base44.auth.me()).id,
        full_name: fullName,
        phone,
        preferred_contact_method: preferredContact,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
        profile_photo_url: photoUrl,
        phone_verified: true,
        account_status: "active",
      });
      const dest = safeReturnTo() === "/" ? "/app/passenger" : safeReturnTo();
      window.location.href = dest;
    } catch (err) {
      setError(err.message || "Could not complete registration.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", safeReturnTo());
  };

  // ---------- Email OTP step ----------
  if (step === "emailOtp") {
    return (
      <AuthLayout icon={Mail} title="Verify your email" subtitle={`We sent a code to ${email}`}>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}
        <div className="flex justify-center mb-6">
          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>
              <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
              <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button className="w-full h-12 font-medium" onClick={handleEmailVerify} disabled={loading || otpCode.length < 6}>
          {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</>) : "Verify"}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Didn't receive the code?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">Resend</button>
        </p>
      </AuthLayout>
    );
  }

  // ---------- Passenger details step ----------
  if (step === "passengerDetails") {
    return (
      <AuthLayout icon={Luggage} title="Complete your passenger profile" subtitle="Tell us a bit about you so we can match your trips.">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}
        <form onSubmit={handlePassengerDetailsSubmit} className="space-y-5">
          {/* Photo */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-primary">
              {photoUrl ? (
                <img src={photoUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <Luggage className="h-7 w-7" />
              )}
            </div>
            <div>
              <input id="photo" type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
              <Label htmlFor="photo" className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {photoUrl ? "Change photo" : "Add photo (optional)"}
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" className="h-12" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Mobile number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="081 123 4567" className="pl-10 h-12" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Preferred contact method</Label>
            <Select value={preferredContact} onValueChange={setPreferredContact}>
              <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTACT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ContactIcon className="h-4 w-4 text-primary" /> Emergency contact
            </div>
            <div className="space-y-2">
              <Label htmlFor="emName">Contact name</Label>
              <Input id="emName" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} placeholder="Optional" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emPhone">Contact phone</Label>
              <Input id="emPhone" type="tel" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="081 000 0000" className="h-11" />
            </div>
          </div>

          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            Continue
          </Button>
        </form>
      </AuthLayout>
    );
  }

  // ---------- Mobile OTP step ----------
  if (step === "mobileOtp") {
    return (
      <AuthLayout icon={ShieldCheck} title="Verify your mobile number" subtitle={`We sent a code to ${phone}`}>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}
        <div className="flex justify-center mb-6">
          <InputOTP maxLength={6} value={mobileOtp} onChange={setMobileOtp} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>
              <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
              <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button className="w-full h-12 font-medium" onClick={handleMobileVerify} disabled={loading || mobileOtp.length < 6}>
          {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</>) : (<><CheckCircle2 className="w-4 h-4 mr-2" />Verify & finish</>)}
        </Button>
      </AuthLayout>
    );
  }

  // ---------- Driver details step ----------
  if (step === "driverDetails") {
    return <DriverRegistrationSteps email={email} />;
  }

  // ---------- Account step ----------
  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Sign up to get started"
      footer={
        <>
          Already have an account?{" "}
          <Link
            to={"/login" + (safeReturnTo() !== "/" ? "?returnTo=" + encodeURIComponent(safeReturnTo()) : "")}
            className="text-primary font-medium hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <Button variant="outline" className="w-full h-12 text-sm font-medium mb-6" onClick={handleGoogle}>
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      <form onSubmit={handleAccountSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label>I'm registering as a</Label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setRole("passenger")}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${role === "passenger" ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}>
              <Luggage className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-semibold">Passenger</div>
                <div className="text-xs text-muted-foreground">Request trips & travel</div>
              </div>
            </button>
            <button type="button" onClick={() => setRole("driver")}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${role === "driver" ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}>
              <Car className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-semibold">Driver</div>
                <div className="text-xs text-muted-foreground">Receive allocations & earn</div>
              </div>
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="password" type="password" autoComplete="new-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="confirm" type="password" autoComplete="new-password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</>) : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}