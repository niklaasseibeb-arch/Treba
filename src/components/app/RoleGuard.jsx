import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { getTrebaRole, getRoleHomePath } from "@/lib/treba-roles";

/**
 * Layout route that restricts access to a single Treba role.
 * Users with a different role are redirected to their own dashboard.
 */
export default function RoleGuard({ allow }) {
  const { user } = useAuth();
  const role = getTrebaRole(user);
  if (role !== allow) {
    return <Navigate to={getRoleHomePath(role)} replace />;
  }
  return <Outlet />;
}