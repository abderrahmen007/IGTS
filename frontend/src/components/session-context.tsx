"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/session";

export const SessionContext = createContext<SessionUser | null>(null);

export function useUser(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useUser must be used inside the dashboard layout");
  return user;
}
