import React, { useState } from "react";
import { Link } from "react-router-dom";

import { base44 } from "@/api/base44Client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Car,
  Loader2,
  Lock,
  Mail,
  UserPlus,
  Luggage,
  ShieldCheck,
} from "lucide-react";

import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";

import DriverRegistrationSteps from "@/components/driver/DriverRegistrationSteps";

const CONTACT_METHODS = [
  {
    value: "whatsapp",
    label: "WhatsApp",
  },
  {
    value: "phone_call",
    label: "Phone call",
  },
  {
    value: "email",
    label: "Email",
  },
];

export default function Register() {
  /*
   * =========================================================
   * ACCOUNT STATE
   * =========================================================
   */

  const [role, setRole] = useState("passenger");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  /*
   * =========================================================
   * PASSENGER STATE
   * =========================================================
   */

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [preferredContact, setPreferredContact] =
    useState("whatsapp");

  const [emergencyName, setEmergencyName] =
    useState("");

  const [emergencyPhone, setEmergencyPhone] =
    useState("");

  const [photoUrl, setPhotoUrl] = useState("");

  const [uploadingPhoto, setUploadingPhoto] =
    useState(false);

  /*
   * =========================================================
   * VERIFICATION STATE
   * =========================================================
   */

  const [verificationCode, setVerificationCode] =
    useState("");

  const [mobileOtp, setMobileOtp] =
    useState("");

  /*
   * =========================================================
   * SCREEN STATE
   * =========================================================
   *
   * account
   * emailVerification
   * passengerDetails
   * mobileOtp
   * driverDetails
   */

  const [step, setStep] =
    useState("account");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  /*
   * =========================================================
   * HELPERS
   * =========================================================
   */

  const cleanEmail =
    email.trim().toLowerCase();

  /*
   * =========================================================
   * CONTINUE AFTER BASE44 AUTHENTICATION
   * =========================================================
   */

  const continueAfterAuthentication =
    async (authenticatedUser) => {
      if (!authenticatedUser?.id) {
        throw new Error(
          "Authenticated user could not be found."
        );
      }

      console.log(
        "TREBA AUTHENTICATED USER:",
        authenticatedUser
      );

      /*
       * Store Treba marketplace role.
       */

      await base44.auth.updateMe({
        app_role: role,
        email:
          authenticatedUser.email ||
          cleanEmail,
        profile_completion: false,
      });

      console.log(
        "TREBA ROLE ASSIGNED:",
        role
      );

      /*
       * Continue to the appropriate
       * Treba registration process.
       */

      if (role === "driver") {
        setStep("driverDetails");
      } else {
        setStep("passengerDetails");
      }
    };

  /*
   * =========================================================
   * ACCOUNT CREATION
   * =========================================================
   */

  const handleAccountSubmit =
    async (event) => {
      event.preventDefault();

      setError("");

      if (!cleanEmail) {
        setError(
          "Email address is required."
        );
        return;
      }

      if (password.length < 8) {
        setError(
          "Password must be at least 8 characters."
        );
        return;
      }

      if (password !== confirmPassword) {
        setError(
          "Passwords do not match."
        );
        return;
      }

      if (!role) {
        setError(
          "Please select Passenger or Driver."
        );
        return;
      }

      setLoading(true);

      try {
        console.log(
          "================================="
        );

        console.log(
          "TREBA REGISTRATION START"
        );

        console.log(
          "Email:",
          cleanEmail
        );

        console.log(
          "Role:",
          role
        );

        console.log(
          "================================="
        );

        /*
         * IMPORTANT:
         *
         * This is the actual SDK method
         * available in @base44/sdk 0.8.43.
         */

        const result =
          await base44.auth.register({
            email: cleanEmail,
            password,
          });

        console.log(
          "TREBA BASE44 REGISTER RESULT:",
          result
        );

        /*
         * Base44 requires email verification.
         *
         * Do NOT attempt login yet.
         */

        sessionStorage.setItem(
          "treba_registration_role",
          role
        );

        sessionStorage.setItem(
          "treba_registration_email",
          cleanEmail
        );

        /*
         * Move to Base44 email verification.
         */

        setVerificationCode("");

        setStep(
          "emailVerification"
        );

      } catch (err) {
        console.error(
          "TREBA REGISTRATION FAILED:",
          err
        );

        console.error(
          "Message:",
          err?.message
        );

        console.error(
          "Status:",
          err?.status
        );

        console.error(
          "Response:",
          err?.response
        );

        console.error(
          "Data:",
          err?.data
        );

        setError(
          err?.message ||
            err?.response?.data?.message ||
            err?.data?.message ||
            "Unable to create your account."
        );

      } finally {
        setLoading(false);
      }
    };

  /*
   * =========================================================
   * BASE44 EMAIL VERIFICATION
   * =========================================================
   */

  const handleEmailVerification =
    async () => {
      setError("");

      const code =
        verificationCode.trim();

      if (!code) {
        setError(
          "Enter the verification code sent to your email."
        );
        return;
      }

      setLoading(true);

      try {
        console.log(
          "TREBA EMAIL VERIFICATION START"
        );

        /*
         * IMPORTANT:
         *
         * SDK 0.8.43 requires:
         *
         * verifyOtp({
         *   email,
         *   otpCode
         * })
         */

        const verificationResult =
          await base44.auth.verifyOtp({
            email: cleanEmail,
            otpCode: code,
          });

        console.log(
          "TREBA EMAIL VERIFICATION RESULT:",
          verificationResult
        );

        /*
         * Email verification does not necessarily
         * establish the login session.
         *
         * Therefore explicitly authenticate.
         */

        const loginResult =
          await base44.auth.loginViaEmailPassword(
            cleanEmail,
            password
          );

        console.log(
          "TREBA LOGIN AFTER EMAIL VERIFICATION:",
          loginResult
        );

        /*
         * Retrieve authenticated Base44 user.
         */

        const authenticatedUser =
          await base44.auth.me();

        console.log(
          "TREBA AUTHENTICATED USER:",
          authenticatedUser
        );

        if (!authenticatedUser?.id) {
          throw new Error(
            "Email verified, but Treba could not establish your login session."
          );
        }

        /*
         * Continue with selected Treba role.
         */

        await continueAfterAuthentication(
          authenticatedUser
        );

      } catch (err) {
        console.error(
          "TREBA EMAIL VERIFICATION FAILED:",
          err
        );

        console.error(
          "Message:",
          err?.message
        );

        console.error(
          "Status:",
          err?.status
        );

        console.error(
          "Response:",
          err?.response
        );

        console.error(
          "Data:",
          err?.data
        );

        setError(
          err?.message ||
            err?.response?.data?.message ||
            err?.data?.message ||
            "Email verification failed. Please check the code and try again."
        );

      } finally {
        setLoading(false);
      }
    };

  /*
   * =========================================================
   * PASSENGER DETAILS
   * =========================================================
   */

  const handlePassengerDetailsSubmit =
    async (event) => {
      event.preventDefault();

      setError("");

      if (!fullName.trim()) {
        setError(
          "Full name is required."
        );
        return;
      }

      if (!phone.trim()) {
        setError(
          "Mobile number is required."
        );
        return;
      }

      /*
       * Temporary Treba mobile OTP.
       *
       * This is separate from Base44
       * email verification.
       */

      const code =
        String(
          Math.floor(
            100000 +
              Math.random() *
                900000
          )
        );

      sessionStorage.setItem(
        "treba_passenger_mobile_otp",
        code
      );

      setMobileOtp("");

      /*
       * For development/testing only.
       */

      alert(
        `Treba mobile verification code: ${code}`
      );

      setStep("mobileOtp");
    };

  /*
   * =========================================================
   * PASSENGER MOBILE VERIFICATION
   * =========================================================
   */

  const handleMobileVerify =
    async () => {
      setError("");

      const savedCode =
        sessionStorage.getItem(
          "treba_passenger_mobile_otp"
        );

      if (
        mobileOtp !== savedCode
      ) {
        setError(
          "Incorrect verification code."
        );
        return;
      }

      setLoading(true);

      try {
        const authenticatedUser =
          await base44.auth.me();

        if (!authenticatedUser?.id) {
          throw new Error(
            "Your account session could not be found."
          );
        }

        /*
         * Update Base44 User.
         */

        await base44.auth.updateMe({
          app_role: "passenger",
          full_name:
            fullName.trim(),
          phone:
            phone.trim(),
          email:
            cleanEmail,
          profile_completion:
            true,
        });

        /*
         * Check for an existing
         * PassengerProfile.
         */

        const existingProfiles =
          await base44.entities.PassengerProfile.filter(
            {
              user_id:
                authenticatedUser.id,
            }
          );

        /*
         * Create profile only once.
         */

        if (
          !existingProfiles ||
          existingProfiles.length === 0
        ) {
          await base44.entities.PassengerProfile.create(
            {
              user_id:
                authenticatedUser.id,

              full_name:
                fullName.trim(),

              phone:
                phone.trim(),

              email:
                cleanEmail,

              preferred_contact_method:
                preferredContact,

              emergency_contact_name:
                emergencyName.trim(),

              emergency_contact_phone:
                emergencyPhone.trim(),

              profile_photo_url:
                photoUrl,

              phone_verified:
                true,

              active:
                true,
            }
          );
        }

        /*
         * Clean temporary registration data.
         */

        sessionStorage.removeItem(
          "treba_passenger_mobile_otp"
        );

        sessionStorage.removeItem(
          "treba_registration_role"
        );

        sessionStorage.removeItem(
          "treba_registration_email"
        );

        /*
         * Passenger dashboard.
         */

        window.location.href =
          "/app/passenger";

      } catch (err) {
        console.error(
          "TREBA PASSENGER REGISTRATION FAILED:",
          err
        );

        setError(
          err?.message ||
            "Could not complete passenger registration."
        );

      } finally {
        setLoading(false);
      }
    };

  /*
   * =========================================================
   * PHOTO UPLOAD
   * =========================================================
   */

  const handlePhoto = async (
    event
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadingPhoto(true);

    try {
      const result =
        await base44.integrations.Core.UploadFile(
          {
            file,
          }
        );

      if (result?.file_url) {
        setPhotoUrl(
          result.file_url
        );
      }

    } catch (err) {
      console.error(
        "TREBA PHOTO UPLOAD FAILED:",
        err
      );

      setError(
        err?.message ||
          "Could not upload photo."
      );

    } finally {
      setUploadingPhoto(false);
    }
  };

  /*
   * =========================================================
   * GOOGLE
   * =========================================================
   */

  const handleGoogle = () => {
    try {
      sessionStorage.setItem(
        "treba_registration_role",
        role
      );

      base44.auth.loginWithProvider(
        "google",
        safeReturnTo()
      );

    } catch (err) {
      console.error(
        "TREBA GOOGLE REGISTRATION FAILED:",
        err
      );

      setError(
        err?.message ||
          "Unable to start Google registration."
      );
    }
  };

  /*
   * =========================================================
   * DRIVER REGISTRATION
   * =========================================================
   */

  if (
    step === "driverDetails"
  ) {
    return (
      <DriverRegistrationSteps
        phone={phone}
      />
    );
  }

  /*
   * =========================================================
   * EMAIL VERIFICATION SCREEN
   * =========================================================
   */

  if (
    step ===
    "emailVerification"
  ) {
    return (
      <AuthLayout
        icon={ShieldCheck}
        title="Verify your email"
        subtitle={`Enter the verification code sent to ${cleanEmail}`}
      >

        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-5">

          <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            Check your email for the verification code
            sent by Base44.
          </div>

          <div className="space-y-2">

            <Label htmlFor="verificationCode">
              Verification code
            </Label>

            <Input
              id="verificationCode"
              value={
                verificationCode
              }
              onChange={(event) =>
                setVerificationCode(
                  event.target.value
                )
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Enter verification code"
              className="h-12 text-center text-lg tracking-widest"
              autoFocus
            />

          </div>

          <Button
            type="button"
            className="h-12 w-full"
            onClick={
              handleEmailVerification
            }
            disabled={
              loading ||
              !verificationCode.trim()
            }
          >

            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify email"
            )}

          </Button>

        </div>

      </AuthLayout>
    );
  }

  /*
   * =========================================================
   * PASSENGER DETAILS SCREEN
   * =========================================================
   */

  if (
    step ===
    "passengerDetails"
  ) {
    return (
      <AuthLayout
        icon={Luggage}
        title="Complete your passenger profile"
        subtitle="Tell us a bit about you so we can manage your trips."
      >

        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form
          onSubmit={
            handlePassengerDetailsSubmit
          }
          className="space-y-5"
        >

          {/* PHOTO */}

          <div className="flex items-center gap-4">

            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-primary">

              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Luggage className="h-7 w-7" />
              )}

            </div>

            <div>

              <input
                id="passenger-photo"
                type="file"
                accept="image/*"
                onChange={handlePhoto}
                className="hidden"
              />

              <Label
                htmlFor="passenger-photo"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >

                {uploadingPhoto ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Upload"
                )}

                {photoUrl
                  ? "Change photo"
                  : "Add photo (optional)"}

              </Label>

            </div>

          </div>

          {/* FULL NAME */}

          <div className="space-y-2">

            <Label>
              Full name
            </Label>

            <Input
              value={fullName}
              onChange={(event) =>
                setFullName(
                  event.target.value
                )
              }
              placeholder="Jane Doe"
              className="h-12"
              required
            />

          </div>

          {/* MOBILE */}

          <div className="space-y-2">

            <Label>
              Mobile number
            </Label>

            <Input
              type="tel"
              value={phone}
              onChange={(event) =>
                setPhone(
                  event.target.value
                )
              }
              placeholder="081 123 4567"
              className="h-12"
              required
            />

          </div>

          {/* CONTACT */}

          <div className="space-y-2">

            <Label>
              Preferred contact method
            </Label>

            <select
              value={
                preferredContact
              }
              onChange={(event) =>
                setPreferredContact(
                  event.target.value
                )
              }
              className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm"
            >

              {CONTACT_METHODS.map(
                (method) => (
                  <option
                    key={
                      method.value
                    }
                    value={
                      method.value
                    }
                  >
                    {method.label}
                  </option>
                )
              )}

            </select>

          </div>

          {/* EMERGENCY */}

          <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">

            <div className="text-sm font-semibold">
              Emergency contact
            </div>

            <Input
              value={
                emergencyName
              }
              onChange={(event) =>
                setEmergencyName(
                  event.target.value
                )
              }
              placeholder="Contact name (optional)"
              className="h-11"
            />

            <Input
              type="tel"
              value={
                emergencyPhone
              }
              onChange={(event) =>
                setEmergencyPhone(
                  event.target.value
                )
              }
              placeholder="Contact phone (optional)"
              className="h-11"
            />

          </div>

          <Button
            type="submit"
            className="h-12 w-full"
          >
            Continue
          </Button>

        </form>

      </AuthLayout>
    );
  }

  /*
   * =========================================================
   * PASSENGER MOBILE OTP
   * =========================================================
   */

  if (
    step === "mobileOtp"
  ) {
    return (
      <AuthLayout
        icon={ShieldCheck}
        title="Verify your mobile number"
        subtitle={`Enter the code sent to ${phone}`}
      >

        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-5">

          <Input
            value={mobileOtp}
            onChange={(event) =>
              setMobileOtp(
                event.target.value
              )
            }
            maxLength={6}
            inputMode="numeric"
            placeholder="6-digit code"
            className="h-12 text-center text-lg tracking-widest"
          />

          <Button
            type="button"
            className="h-12 w-full"
            onClick={
              handleMobileVerify
            }
            disabled={
              loading ||
              mobileOtp.length !== 6
            }
          >

            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify & finish"
            )}

          </Button>

        </div>

      </AuthLayout>
    );
  }

  /*
   * =========================================================
   * ACCOUNT CREATION SCREEN
   * =========================================================
   */

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Sign up to get started"
      footer={
        <>
          Already have an account?{" "}

          <Link
            to="/login"
            className="font-medium text-primary hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* GOOGLE */}

      <Button
        type="button"
        variant="outline"
        className="mb-6 h-12 w-full"
        onClick={handleGoogle}
        disabled={loading}
      >

        <GoogleIcon className="mr-2 h-5 w-5" />

        Continue with Google

      </Button>

      {/* DIVIDER */}

      <div className="relative mb-6">

        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>

        <div className="relative flex justify-center text-xs uppercase">

          <span className="bg-card px-3 text-muted-foreground">
            or
          </span>

        </div>

      </div>

      {/* FORM */}

      <form
        onSubmit={
          handleAccountSubmit
        }
        className="space-y-5"
      >

        {/* ROLE */}

        <div className="space-y-2">

          <Label>
            I'm registering as
          </Label>

          <div className="grid grid-cols-2 gap-3">

            <button
              type="button"
              onClick={() =>
                setRole("passenger")
              }
              className={`flex items-center gap-3 rounded-xl border p-3 text-left ${
                role === "passenger"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted"
              }`}
            >

              <Luggage className="h-5 w-5 text-primary" />

              <div>

                <div className="text-sm font-semibold">
                  Passenger
                </div>

                <div className="text-xs text-muted-foreground">
                  Request trips & travel
                </div>

              </div>

            </button>

            <button
              type="button"
              onClick={() =>
                setRole("driver")
              }
              className={`flex items-center gap-3 rounded-xl border p-3 text-left ${
                role === "driver"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted"
              }`}
            >

              <Car className="h-5 w-5 text-primary" />

              <div>

                <div className="text-sm font-semibold">
                  Driver
                </div>

                <div className="text-xs text-muted-foreground">
                  Receive allocations & earn
                </div>

              </div>

            </button>

          </div>

        </div>

        {/* EMAIL */}

        <div className="space-y-2">

          <Label htmlFor="email">
            Email
          </Label>

          <div className="relative">

            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              className="h-12 pl-10"
              required
            />

          </div>

        </div>

        {/* PASSWORD */}

        <div className="space-y-2">

          <Label htmlFor="password">
            Password
          </Label>

          <div className="relative">

            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              className="h-12 pl-10"
              required
            />

          </div>

        </div>

        {/* CONFIRM PASSWORD */}

        <div className="space-y-2">

          <Label htmlFor="confirmPassword">
            Confirm password
          </Label>

          <div className="relative">

            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat password"
              value={
                confirmPassword
              }
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value
                )
              }
              className="h-12 pl-10"
              required
            />

          </div>

        </div>

        {/* SUBMIT */}

        <Button
          type="submit"
          className="h-12 w-full"
          disabled={loading}
        >

          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />

              Creating account...
            </>
          ) : (
            "Create account"
          )}

        </Button>

      </form>

    </AuthLayout>
  );
}