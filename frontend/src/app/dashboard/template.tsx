/** Re-mounted on every navigation: gives each page a short, subtle entrance. */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-[rise_220ms_ease-out]">{children}</div>;
}
