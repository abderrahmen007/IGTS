import { Badge } from "./ui";
import { textStatus } from "@/lib/status";
import type { Ref } from "@/lib/types";

export function StatusBadge({ applicabilite, etat }: { applicabilite: Ref | null; etat: Ref | null }) {
  const s = textStatus(applicabilite, etat);
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
