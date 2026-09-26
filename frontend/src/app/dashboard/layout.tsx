"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { SessionContext } from "@/components/session-context";
import { Spinner } from "@/components/ui";
import { getSession, type SessionUser } from "@/lib/session";

const ADMIN_ONLY = ["/dashboard/companies", "/dashboard/texts"];
const COMPANY_ONLY = ["/dashboard/my-texts", "/dashboard/evaluations", "/dashboard/actions", "/dashboard/chat"];

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

  return (
    <SessionContext.Provider value={user}>
      <div className="min-h-screen lg:pl-60">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 lg:block">
          <Sidebar type={user.type} />
        </aside>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-ink-950/40" onClick={() => setMenuOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-64 shadow-xl">
              <Sidebar type={user.type} onNavigate={() => setMenuOpen(false)} />
            </aside>
          </div>
        )}

        <div className="flex min-h-screen flex-col">
          <Topbar user={user} onMenu={() => setMenuOpen(true)} />
          <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </SessionContext.Provider>
  );
}
