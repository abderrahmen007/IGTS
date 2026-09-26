const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
const numberFmt = new Intl.NumberFormat("fr-FR");

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

export function formatNumber(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : numberFmt.format(n);
}

export function formatPercent(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined) return "—";
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits })} %`;
}

export function pct(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0;
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l’instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `il y a ${d} j`;
  return formatDate(value);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function plural(n: number, one: string, many: string) {
  return `${formatNumber(n)} ${n > 1 ? many : one}`;
}
