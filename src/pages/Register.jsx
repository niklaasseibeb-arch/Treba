import React, { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Loader2,
  Lock,
  Mail,
  UserPlus,
  ShieldCheck,
  Luggage,
  Car,
  Phone,
} from "lucide-react";

import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

const CONTACT_METHODS = [
  {
    value: "sms",
    label: "SMS",
  },
  {
    value: "whatsapp",
    label: "WhatsApp",
  },
  {
    value: "email",
    label: "Email",
  },
];

/*
 * =========================================================
 * REGISTER
 * =========================================================
 *
 * Treba authentication is now handled by:
 *
 * React
 *   ↓
 * Express API
 *   ↓
 * PostgreSQL
 *
 * Authentication:
 *
 * bcrypt + JWT
 *
 * Base44 authentication is NOT used here.
 */

export default function Register() {
  /*
   * =========================================================
   * ACCOUNT
   * =========================================================
   */

  const [role, setRole] = useState("passenger");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  /*
   * =========================================================
   * PASSENGER DETAILS
   * =========================================================
   */

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [preferredContact, setPreferredContact] =
    useState("sms");

  const [emergencyName, setEmergencyName] =
    useState("");

  const [emergencyPhone, setEmergencyPhone] =
    useState("");

  /*
   * =========================================================
   * MOBILE OTP
   * =========================================================
   */

  const [mobileOtp, setMobileOtp] = useState("");

  /*
   * =========================================================
   * UI
   * =========================================================
   */

  const [step, setStep] = useState("account");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  /*
   * =========================================================
   * HELPERS
   * =========================================================
   */

  const cleanEmail =
    email.trim().toLowerCase();

  /*
   * =========================================================
   * STORE AUTH SESSION
   * =========================================================
   */

  const storeAuthentication = (
    token,
    user
  ) => {
    if (!token) {
      throw new Error(
        "No authentication token was returned."
      );
    }

    if (!user?.id) {
      throw new Error(
        "No authenticated user was returned."
      );
    }

    localStorage.setItem(
      "treba_token",
      token
    );

    localStorage.setItem(
      "treba_user",
      JSON.stringify(user)
    );
  };

  /*
   * =========================================================
   * REGISTER ACCOUNT
   * =========================================================
   */

  const handleAccountSubmit = async (
    event
  ) => {
    event.preventDefault();

    setError("");

    /*
     * Basic validation.
     */

    if (!cleanEmail) {
      setError(
        "Email address is required."
      );
      return;
    }

    if (!password) {
      setError(
        "Password is required."
      );
      return;
    }

    if (password.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        "Passwords do not match."
      );
      return;
    }

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
       * Create account through
       * our own Treba API.
       */

      const response =
        await fetch(
          "/api/auth/register",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              app_role: role,

              full_name:
                fullName.trim(),

              phone:
                phone.trim(),

              email:
                cleanEmail,

              password,
            }),
          }
        );

      const data =
        await response.json();

      console.log(
        "TREBA REGISTER RESULT:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Failed to create account."
        );
      }

      if (
        !data?.token ||
        !data?.user
      ) {
        throw new Error(
          "Account was created, but no authentication session was returned."
        );
      }

      /*
       * Store JWT.
       */

      storeAuthentication(
        data.token,
        data.user
      );

      /*
       * Keep the user information
       * in localStorage.
       */

      console.log(
        "TREBA AUTHENTICATION STORED"
      );

      /*
       * Passenger:
       *
       * Continue to mobile
       * verification.
       */

      if (
        role === "passenger"
      ) {
        setStep("passengerOtp");

        /*
         * Development-only OTP.
         *
         * This will later be replaced
         * with the real SMS service.
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

        /*
         * DEVELOPMENT ONLY
         */

        alert(
          `Treba mobile verification code: ${code}`
        );

        return;
      }

      /*
       * Driver registration.
       *
       * Driver onboarding will be
       * handled separately.
       */

      window.location.href =
        "/app/driver";
    } catch (err) {
      console.error(
        "================================="
      );

      console.error(
        "TREBA REGISTRATION FAILED"
      );

      console.error(
        "Error:",
        err
      );

      console.error(
        "Message:",
        err?.message
      );

      console.error(
        "================================="
      );

      setError(
        err?.message ||
          "Could not create your account."
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * =========================================================
   * VERIFY PASSENGER MOBILE
   * =========================================================
   */

  const handleMobileVerify =
    async () => {
      setError("");

      const savedCode =
        sessionStorage.getItem(
          "treba_passenger_mobile_otp"
        );

      if (!savedCode) {
        setError(
          "Your verification code has expired. Please register again."
        );
        return;
      }

      if (
        mobileOtp.trim() !==
        savedCode
      ) {
        setError(
          "Incorrect verification code."
        );
        return;
      }

      setLoading(true);

      try {
        /*
         * Retrieve our Treba JWT.
         */

        const token =
          localStorage.getItem(
            "treba_token"
          );

        if (!token) {
          throw new Error(
            "Your authentication session could not be found."
          );
        }

        /*
         * Retrieve authenticated
         * user from our API.
         */

        const meResponse =
          await fetch(
            "/api/auth/me",
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const meData =
          await meResponse.json();

        console.log(
          "TREBA AUTH ME:",
          meData
        );

        if (!meResponse.ok) {
          throw new Error(
            meData?.message ||
              "Your authentication session is invalid."
          );
        }

        const authenticatedUser =
          meData?.user;

        if (
          !authenticatedUser?.id
        ) {
          throw new Error(
            "Authenticated user could not be found."
          );
        }

        /*
         * Update local user data.
         */

        localStorage.setItem(
          "treba_user",
          JSON.stringify(
            authenticatedUser
          )
        );

        /*
         * Create passenger profile
         * through our PostgreSQL API.
         */

        const profileResponse =
          await fetch(
            "/api/passengers",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body: JSON.stringify({
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
                  emergencyName.trim() ||
                  null,

                emergency_contact_phone:
                  emergencyPhone.trim() ||
                  null,

                payment_methods: [],
              }),
            }
          );

        const profileData =
          await profileResponse.json();

        console.log(
          "TREBA PASSENGER PROFILE RESULT:",
          profileData
        );

        /*
         * The profile endpoint may
         * return an error if the profile
         * already exists.
         */

        if (
          !profileResponse.ok
        ) {
          /*
           * If the profile already
           * exists, we can still
           * continue.
           */

          const profileMessage =
            profileData?.error ||
            profileData?.message ||
            "";

          if (
            !profileMessage
              .toLowerCase()
              .includes("already")
          ) {
            throw new Error(
              profileMessage ||
                "Could not create passenger profile."
            );
          }
        }

        /*
         * Clean temporary data.
         */

        sessionStorage.removeItem(
          "treba_passenger_mobile_otp"
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
   * GOOGLE
   * =========================================================
   *
   * Google authentication is intentionally
   * disabled for this custom JWT migration.
   *
   * We will implement Google OAuth separately
   * after email/password authentication is
   * completely stable.
   */

  const handleGoogle =
    () => {
      setError(
        "Google registration will be enabled after the Treba authentication migration is complete."
      );
    };

  /*
   * =========================================================
   * MOBILE OTP SCREEN
   * =========================================================
   */

  if (
    step === "passengerOtp"
  ) {
    return (
      <AuthLayout
        icon={ShieldCheck}
        title="Verify your mobile number"
        subtitle={`Enter the 6-digit code sent to ${phone}`}
        footer={
          <>
            Need to start again?{" "}

            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem(
                  "treba_passenger_mobile_otp"
                );

                localStorage.removeItem(
                  "treba_token"
                );

                localStorage.removeItem(
                  "treba_user"
                );

                setStep("account");
              }}
              className="font-medium text-primary hover:underline"
            >
              Go back
            </button>
          </>
        }
      >
        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-5">

          <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            Enter the 6-digit verification
            code generated for your mobile
            number.
          </div>

          <div className="space-y-2">

            <Label htmlFor="mobileOtp">
              Verification code
            </Label>

            <Input
              id="mobileOtp"
              value={mobileOtp}
              onChange={(event) =>
                setMobileOtp(
                  event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 6)
                )
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              className="h-12 text-center text-lg tracking-widest"
              autoFocus
            />

          </div>

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

      {/* =====================================================
          GOOGLE
          ===================================================== */}

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

      {/* =====================================================
          DIVIDER
          ===================================================== */}

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

      {/* =====================================================
          FORM
          ===================================================== */}

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

            {/* PASSENGER */}

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

            {/* DRIVER */}

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
                  Receive trips & earn
                </div>
              </div>

            </button>

          </div>

        </div>

        {/* FULL NAME */}

        <div className="space-y-2">

          <Label htmlFor="fullName">
            Full name
          </Label>

          <div className="relative">

            <UserPlus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(event) =>
                setFullName(
                  event.target.value
                )
              }
              className="h-12 pl-10"
              required
            />

          </div>

        </div>

        {/* MOBILE */}

        <div className="space-y-2">

          <Label htmlFor="phone">
            Mobile number
          </Label>

          <div className="relative">

            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="081 123 4567"
              value={phone}
              onChange={(event) =>
                setPhone(
                  event.target.value
                )
              }
              className="h-12 pl-10"
              required
            />

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
              value={confirmPassword}
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