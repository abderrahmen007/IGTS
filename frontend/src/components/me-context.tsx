"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { Preferences, Profile } from "@/lib/types";
import { useUser } from "./session-context";

interface MeState {
  profile: Profile | null;
  /** False for read-only sub-accounts. */
  canEdit: boolean;
  reload: () => Promise<void>;
  setProfile: (p: Profile) => void;
  savePreferences: (patch: Partial<Omit<Preferences, "tourSeenAt">> & { tourSeen?: boolean }) => Promise<void>;
}

const MeContext = createContext<MeState | null>(null);

/** Company space: the connected user's profile, rights and preferences. */
export function MeProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);

  const reload = useCallback(async () => {
    try {
      setProfile(await api<Profile>("/company/me"));
    } catch {
      /* the pages show their own errors */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    api<Profile>("/company/me")
      .then((p) => alive && setProfile(p))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const savePreferences = useCallback<MeState["savePreferences"]>(async (patch) => {
    const preferences = await api<Preferences>("/company/me/preferences", { method: "PATCH", body: patch });
    setProfile((p) => (p ? { ...p, preferences } : p));
  }, []);

  const canEdit = profile ? profile.canEdit : user.canEdit !== false;

  return (
    <MeContext.Provider value={{ profile, canEdit, reload, setProfile, savePreferences }}>{children}</MeContext.Provider>
  );
}

export function useMe(): MeState {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe must be used inside <MeProvider>");
  return ctx;
}

/** Same as useMe but safe outside the company space (admin pages). */
export function useMeOptional(): MeState | null {
  return useContext(MeContext);
}
