import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { base44 } from "@/api/base44Client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);

    try {
      const currentUser = await base44.auth.me();

      if (currentUser?.id) {
        setUser(currentUser);
        setIsAuthenticated(true);
        return currentUser;
      }

      setUser(null);
      setIsAuthenticated(false);

      return null;
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);

      const status = error?.status;

      if (status !== 401 && status !== 403) {
        console.error(
          "TREBA AUTH CHECK ERROR:",
          error
        );

        setAuthError({
          type: "auth_check_error",
          message:
            error?.message ||
            "Unable to check authentication status.",
        });
      }

      return null;
    } finally {
      setAuthChecked(true);
      setIsLoadingAuth(false);
    }
  };

  useEffect(() => {
    checkUserAuth();
  }, []);

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);

    try {
      if (shouldRedirect) {
        await base44.auth.logout(window.location.origin);
      } else {
        await base44.auth.logout();
      }
    } catch (error) {
      console.error(
        "TREBA LOGOUT ERROR:",
        error
      );
    }
  };

  const navigateToLogin = () => {
    try {
      base44.auth.redirectToLogin(
        window.location.href
      );
    } catch (error) {
      console.error(
        "TREBA LOGIN REDIRECT ERROR:",
        error
      );

      setAuthError({
        type: "login_error",
        message:
          "Unable to open the login page.",
      });
    }
  };

  const refreshAuth = async () => {
    return checkUserAuth();
  };

  const value = {
    user,
    isAuthenticated,
    isLoadingAuth,
    authError,
    authChecked,

    checkUserAuth,
    refreshAuth,
    navigateToLogin,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider."
    );
  }

  return context;
}