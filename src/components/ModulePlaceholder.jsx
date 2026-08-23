import React from "react";
import { Link } from "react-router-dom";
import { Construction, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTrebaRole, getRoleHomePath } from "@/lib/treba-roles";
import { useAuth } from "@/lib/AuthContext";

/**
 * Foundation placeholder for modules whose detailed functionality is reserved
 * for a later build prompt. It renders an honest, branded "ready for next phase"
 * state instead of fake functionality.
 */
export default function ModulePlaceholder({ title, description, icon: Icon = Construction }) {
  const { user } = useAuth();
  const role = getTrebaRole(user);
  const home = getRoleHomePath(role);

  return (
    <div className="flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-20">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <Icon className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {description ||
          "This module is part of the Treba foundation and is ready to be built out in the next development phase."}
      </p>
      <div className="mt-6">
        <Button asChild variant="outline">
          <Link to={home}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}