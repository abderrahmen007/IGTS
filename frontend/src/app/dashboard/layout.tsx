"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { SessionContext } from "@/components/session-context";
import { OverlayProvider } from "@/components/overlay";
import { LiveProvider } from "@/components/live-context";
import { MeProvider } from "@/components/me-context";
import { TourProvider } from "@/components/tour";
import { AssistantWidget } from "@/components/assistant-widget";
import { Spinner } from "@/components/ui";
import { getSession, type SessionUser } from "@/lib/session";

const ADMIN_ONLY = ["/dashboard/companies", "/dashboard/texts", "/dashboard/referentiel", "/dashboard/admins"];
const COMPANY_ONLY = [
  "/dashboard/my-texts",
  "/dashboard/evaluations",
  "/dashboard/actions",
  "/dashboard/profile",
  "/dashboard/team",
];

/** Soft IGTS-coloured halos behind the glass (the ring of the logo, saffron, sky). */
function Halos() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -right-36 -top-52 h-[640px] w-[640px] rounded-full border-[120px] border-brand-600 opacity-30 blur-[46px]" />
      <div className="absolute left-[12%] top-[38%] h-[440px] w-[440px] rounded-full bg-saffron-500 opacity-[0.2] blur-[90px]" />
      <div className="absolute -bottom-40 right-[18%] h-[520px] w-[520px] rounded-full bg-[#8fa8e0] opacity-30 blur-[100px]" />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    const u = session.user;
    const forbidden =
      (u.type === "company" && ADMIN_ONLY.some((p) => pathname.startsWith(p))) ||
      (u.type === "admin" && COMPANY_ONLY.some((p) => pathname.startsWith(p)));
    if (forbidden) {
      router.replace("/dashboard");
      return;
    }
    setUser(u);
  }, [router, pathname]);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-brand-800">
        <Spinner size={22} />
      </div>
    );
  }

  const shell = (
    <div className="relative isolate min-h-screen lg:pl-[256px]">
      <Halos />
      {/* Desktop sidebar: floating glass panel */}
      <aside className="fixed inset-y-3 left-3 z-40 hidden w-[244px] lg:block">
        <Sidebar user={user} />
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div
            className="animate-[fade_150ms_ease-out] absolute inset-0 bg-ink-950/40"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="animate-[rise_200ms_ease-out] absolute inset-y-3 left-3 w-[280px]">
            <Sidebar user={user} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-col">
        <Topbar user={user} onMenu={() => setMenuOpen(true)} />
        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
      </div>
    </div>
  );

  return (
    <SessionContext.Provider value={user}>
      <OverlayProvider>
        {user.type === "company" ? (
          <LiveProvider>
            <MeProvider>
              <TourProvider>
                {shell}
                <AssistantWidget />
              </TourProvider>
            </MeProvider>
          </LiveProvider>
        ) : (
          shell
        )}
      </OverlayProvider>
    </SessionContext.Provider>
  );
}
