"use client";

import { useUser } from "@/components/session-context";
import { CompanyDashboard } from "./_company-dashboard";
import { AdminDashboard } from "./_admin-dashboard";

export default function DashboardPage() {
  const user = useUser();
  return user.type === "admin" ? <AdminDashboard /> : <CompanyDashboard />;
}
