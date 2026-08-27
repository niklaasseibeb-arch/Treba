import React, { useState } from "react";
import { Link } from "react-router-dom";

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
import { useAuth } from "@/lib/AuthContext";

export default function Login() {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");

    const cleanEmail =
      email.trim().toLowerCase();

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
      console.log(
        "================================="
      );
      console.log("TREBA LOGIN START");
      console.log("Email:", cleanEmail);
      console.log(
        "================================="
      );

      /*
       * =====================================================
       * TREBA API LOGIN
       * =====================================================
       *
       * Authentication is now handled by the
       * Treba Express + PostgreSQL backend.
       *
       * Base44 authentication is NOT used here.
       */

      const response = await fetch(
        "/api/auth/login",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            email: cleanEmail,
            password,
          }),
        }
      );

      let data = null;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          "The Treba server returned an invalid response."
        );
      }

      console.log(
        "TREBA LOGIN RESPONSE:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Login failed. Please check your email and password."
        );
      }

      /*
       * The Treba API must return a JWT.
       */

      if (!data?.token) {
        throw new Error(
          "Login succeeded but no authentication token was returned."
        );
      }

      /*
       * =====================================================
       * ESTABLISH TREBA AUTH SESSION
       * =====================================================
       *
       * AuthContext stores the JWT and verifies
       * the authenticated user through /api/auth/me.
       */

      const authenticatedUser =
        await login(data.token);

      console.log(
        "TREBA AUTHENTICATED USER:",
        authenticatedUser
      );

      if (!authenticatedUser?.id) {
        throw new Error(
          "Login completed, but no authenticated user was found."
        );
      }

      /*
       * =====================================================
       * DESTINATION
       * =====================================================
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
       * Driver dashboard
       */

      if (
        authenticatedUser.app_role ===
        "driver"
      ) {
        window.location.href =
          "/app/driver";

        return;
      }

      /*
       * Passenger dashboard
       */

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
        "================================="
      );

      /*
       * Remove any invalid token that
       * may have been stored.
       */

      localStorage.removeItem(
        "treba_token"
      );

      setError(
        err?.message ||
          "Login failed. Please check your email and password."
      );

    } finally {
      setLoading(false);
    }
  };

  /*
   * =========================================================
   * GOOGLE LOGIN
   * =========================================================
   *
   * Google authentication is left untouched for now.
   *
   * We are first getting Treba email/password
   * authentication completely working.
   */

  const handleGoogleLogin = () => {
    setError(
      "Google login will be connected after Treba email/password authentication is complete."
    );
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