import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

const AuthContext = createContext(null);

const API_BASE_URL = "";

function getToken() {
  return localStorage.getItem("treba_token");
}

function saveToken(token) {
  if (token) {
    localStorage.setItem("treba_token", token);
  }
}

function clearToken() {
  localStorage.removeItem("treba_token");
}

async function getCurrentUser() {
  const token = getToken();

  if (!token) {
    return null;
  }

  const response = await fetch(
    `${API_BASE_URL}/api/auth/me`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (response.status === 401 || response.status === 403) {
    clearToken();
    return null;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        "Unable to load authenticated user."
    );
  }

  return data?.user || null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] =
    useState(false);
  const [isLoadingAuth, setIsLoadingAuth] =
    useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] =
    useState(false);

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);

    try {
      const currentUser =
        await getCurrentUser();

      if (currentUser?.id) {
        setUser(currentUser);
        setIsAuthenticated(true);

        return currentUser;
      }

      setUser(null);
      setIsAuthenticated(false);

      return null;
    } catch (error) {
      console.error(
        "TREBA AUTH CHECK ERROR:",
        error
      );

      setUser(null);
      setIsAuthenticated(false);

      setAuthError({
        type: "auth_check_error",
        message:
          error?.message ||
          "Unable to check authentication status.",
      });

      return null;
    } finally {
      setAuthChecked(true);
      setIsLoadingAuth(false);
    }
  };

  useEffect(() => {
    checkUserAuth();
  }, []);

  const login = async (token) => {
    if (!token) {
      throw new Error(
        "No authentication token was received."
      );
    }

    saveToken(token);

    const authenticatedUser =
      await getCurrentUser();

    if (!authenticatedUser?.id) {
      clearToken();

      throw new Error(
        "Login completed, but the user session could not be established."
      );
    }

    setUser(authenticatedUser);
    setIsAuthenticated(true);
    setAuthError(null);
    setAuthChecked(true);

    return authenticatedUser;
  };

  const logout = async (
    shouldRedirect = true
  ) => {
    const token = getToken();

    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);

    /*
     * Tell the API that the client is logging out.
     *
     * JWT itself is stateless, so the important
     * client-side operation is removing the token.
     */

    if (token) {
      try {
        await fetch(
          `${API_BASE_URL}/api/auth/logout`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type":
                "application/json",
            },
          }
        );
      } catch (error) {
        console.error(
          "TREBA LOGOUT API ERROR:",
          error
        );
      }
    }

    clearToken();

    if (shouldRedirect) {
      window.location.href = "/login";
    }
  };

  const navigateToLogin = () => {
    window.location.href = "/login";
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

    login,
    logout,
    navigateToLogin,
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