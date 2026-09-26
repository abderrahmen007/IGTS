"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { useToast } from "@/components/overlay";
import { TextForm, textToForm } from "@/components/admin/text-form";
import { apiForm } from "@/lib/api";
import type { AdminTextDetail } from "@/lib/admin-types";

export default function NewTextPage() {
  const router = useRouter();
  const toast = useToast();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={{ href: "/dashboard/texts", label: "Textes réglementaires" }}
        title="Nouveau texte"
        description="Le texte sera ajouté automatiquement à la veille des entreprises abonnées à son thème, qui en seront notifiées."
      />
      <TextForm
        initial={textToForm()}
        submitLabel="Publier le texte"
        note="Vérifiez le secteur et le thème : ils déterminent les entreprises concernées."
        onSubmit={async (fd) => {
          const t = await apiForm<AdminTextDetail>("/admin/texts", "POST", fd);
          toast(
            t.distributedTo
              ? `Texte publié et envoyé à ${t.distributedTo} entreprise(s).`
              : "Texte publié. Aucune entreprise n’est encore abonnée à ce thème.",
          );
          router.replace(`/dashboard/texts/${t.id}`);
        }}
      />
    </div>
  );
}
