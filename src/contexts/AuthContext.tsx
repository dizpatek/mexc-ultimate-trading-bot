"use client";

import React, { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { api } from "../services/api";
import { AuthContext } from "./authTypes";
import type { User, AuthContextType } from "./authTypes";

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Default to true to check token first

  useEffect(() => {
    // Check if user is logged in on app start
    const token = localStorage.getItem("token");
    if (token) {
      // Verify token with backend
      api
        .get("/auth/me")
        .then((response) => {
          setUser(response.data.user);
        })
        .catch(() => {
          localStorage.removeItem("token");
          setUser(null);
        })
        .finally(() => {
          // Use setTimeout to avoid synchronous setState in effect
          setTimeout(() => setLoading(false), 0);
        });
    } else {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => setLoading(false), 0);
    }

    // Global 401 Handler Listener
    const handleAuthLogout = () => {
      console.log("[AuthContext] Global logout triggered via api-auth-logout event");
      setUser(null);
    };

    window.addEventListener("api-auth-logout", handleAuthLogout);
    return () => window.removeEventListener("api-auth-logout", handleAuthLogout);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await api.post("/auth/login", { email, password });
      const { token, user: userData } = response.data;
      localStorage.setItem("token", token);
      setUser(userData);
      window.dispatchEvent(new Event("api-auth-login"));
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login failed";
      throw new Error(message);
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
  ): Promise<boolean> => {
    try {
      const response = await api.post("/auth/register", {
        username,
        email,
        password,
      });
      const { token, user: userData } = response.data;
      localStorage.setItem("token", token);
      setUser(userData);
      window.dispatchEvent(new Event("api-auth-login"));
      return true;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Registration failed";
      throw new Error(message);
    }
  };

  const googleLogin = async (googleData: {
    googleId: string;
    email: string;
    name: string;
    picture?: string;
  }): Promise<boolean> => {
    try {
      const response = await api.post("/auth/google", googleData);
      const { token, user: userData } = response.data;
      localStorage.setItem("token", token);
      setUser(userData);
      window.dispatchEvent(new Event("api-auth-login"));
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Google Auth failed";
      throw new Error(message);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    window.dispatchEvent(new Event("api-auth-logout"));

    // Matrix Bridge Integration: Clear TV Session
    localStorage.removeItem("tv_login_status");
    window.dispatchEvent(new Event("tv-session-clear"));

    // Notify Extension if present
    window.postMessage(
      {
        source: "matrix-bridge-page",
        action: "logout",
      },
      "*",
    );
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    googleLogin,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
