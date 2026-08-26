import React, { useState } from "react";
import { Link } from "react-router-dom";

import { base44 } from "@/api/base44Client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Loader2,
  Lock,
  Mail,
  LogIn,
} from "lucide-react";

import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Email address is required.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    setLoading(true);

    try {
      console.log("=================================");
      console.log("TREBA LOGIN START");
      console.log("Email:", cleanEmail);
      console.log("=================================");

      /*
       * IMPORTANT:
       *
       * @base44/sdk 0.8.43 does NOT have:
       *
       * base44.auth.login()
       *
       * The correct method is:
       *
       * base44.auth.loginViaEmailPassword()
       */

      const loginResult =
        await base44.auth.loginViaEmailPassword(
          cleanEmail,
          password
        );

      console.log(
        "TREBA LOGIN RESULT:",
        loginResult
      );

      /*
       * Retrieve the authenticated Base44 user.
       */

      const authenticatedUser =
        await base44.auth.me();

      console.log(
        "TREBA AUTHENTICATED USER:",
        authenticatedUser
      );

      if (!authenticatedUser?.id) {
        throw new Error(
          "Login completed, but no authenticated user session was found."
        );
      }

      /*
       * Determine destination.
       */

      const returnTo = safeReturnTo();

      if (
        returnTo &&
        returnTo !== "/"
      ) {
        window.location.href =
          returnTo;

        return;
      }

      /*
       * Send the user to the correct
       * Treba dashboard.
       */

      if (
        authenticatedUser.app_role ===
        "driver"
      ) {
        window.location.href =
          "/app/driver";

        return;
      }

      window.location.href =
        "/app/passenger";

    } catch (err) {
      console.error(
        "================================="
      );

      console.error(
        "TREBA LOGIN FAILED"
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

      console.error(
        "================================="
      );

      setError(
        err?.message ||
          err?.response?.data?.message ||
          err?.data?.message ||
          "Login failed. Please check your email and password."
      );

    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    try {
      base44.auth.loginWithProvider(
        "google",
        safeReturnTo()
      );
    } catch (err) {
      console.error(
        "TREBA GOOGLE LOGIN FAILED:",
        err
      );

      setError(
        err?.message ||
          "Unable to start Google login."
      );
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Log in to your Treba account"
      footer={
        <>
          Don't have an account?{" "}

          <Link
            to="/register"
            className="font-medium text-primary hover:underline"
          >
            Create account
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
        onClick={
          handleGoogleLogin
        }
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

      {/* LOGIN FORM */}

      <form
        onSubmit={handleLogin}
        className="space-y-5"
      >

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
              autoComplete="current-password"
              placeholder="Enter your password"
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

        {/* SUBMIT */}

        <Button
          type="submit"
          className="h-12 w-full"
          disabled={loading}
        >

          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />

              Logging in...
            </>
          ) : (
            "Log in"
          )}

        </Button>

      </form>

    </AuthLayout>
  );
}