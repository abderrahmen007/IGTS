"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { useConfirm, useToast } from "@/components/overlay";
import { ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { TextForm, type TextFormValue } from "@/components/admin/text-form";
import { ConfidenceChip, sourceLine } from "@/components/veille/shared";
import { api, apiForm, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatDate, plural } from "@/lib/format";
import { refreshVeillePending } from "@/lib/veille-pending";
import type { DraftPublishResult, VeilleDraft } from "@/lib/admin-types";

function draftToForm(d: VeilleDraft): TextFormValue {
  return {
    titre: d.titre,
    num: d.num,
    journal: d.journal,
    date: d.date,
    typeId: d.type ? String(d.type.id) : "",
    secteurId: d.secteur ? String(d.secteur.id) : "",
    themeId: d.theme ? String(d.theme.id) : "",
    description: d.description,
  };
}

/** What the AI saw and why it kept the text. */
function AiPanel({ d }: { d: VeilleDraft }) {
  return (
    <aside className="flex flex-col gap-4">
      <section className="glass flex flex-col gap-3 rounded-[22px] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
            <Icon name="sparkle" size={17} className="text-brand-700" />
            Lecture de l’IA
          </h2>
          <ConfidenceChip value={d.ai.confidence} />
        </div>
        {d.ai.reason && <p className="text-[13.5px] leading-relaxed text-ink-700">{d.ai.reason}</p>}
        {d.ai.keyPoints.length > 0 && (
          <ul className="space-y-1.5">
            {d.ai.keyPoints.map((p) => (
              <li key={p} className="flex gap-2 text-[13.5px] leading-relaxed text-ink-800">
                <Icon name="check" size={15} strokeWidth={2.4} className="mt-0.5 shrink-0 text-ok-600" />
                {p}
              </li>
            ))}
          </ul>
        )}
        {(d.ai.needsReview.length > 0 || d.duplicateOf) && (
          <div className="rounded-xl bg-saffron-50 px-3.5 py-3 text-[13px] leading-relaxed text-saffron-700">
            <p className="mb-1 font-semibold">À vérifier</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {d.duplicateOf && (
                <li>
                  Un texte au même titre existe déjà :{" "}
                  <Link href={`/dashboard/texts/${d.duplicateOf.id}`} className="font-semibold underline underline-offset-2">
                    l’ouvrir
                  </Link>
                </li>
              )}
              {d.ai.needsReview.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-ink-500">Modèle : {d.ai.model}</p>
      </section>

      <section className="flex flex-col gap-2.5 rounded-[22px] border border-ink-200/80 bg-white p-5 text-[13.5px]">
        <h2 className="text-[15px] font-semibold text-ink-900">Source</h2>
        <p className="text-ink-700">{sourceLine(d)}</p>
        {d.ai.ministere && (
          <p className="text-ink-600">
            <span className="text-ink-500">Autorité : </span>
            {d.ai.ministere}
          </p>
        )}
        {d.ai.signedOn && (
          <p className="text-ink-600">
            <span className="text-ink-500">Signé le </span>
            {d.ai.signedOn}
          </p>
        )}
        <div className="mt-1 flex flex-wrap gap-2">
          {d.pdfUrl && (
            <Button size="sm" variant="outline" asChild>
              <a href={d.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Icon name="file" size={15} />
                PDF du texte
              </a>
            </Button>
          )}
          {d.issuePdfUrl && d.issuePdfUrl !== d.pdfUrl && (
            <Button size="sm" variant="ghost" asChild>
              <a href={d.issuePdfUrl} target="_blank" rel="noopener noreferrer">
                Numéro complet
                <Icon name="external" size={14} />
              </a>
            </Button>
          )}
        </div>
      </section>
    </aside>
  );
}

export default function DraftPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: d, error, loading, reload, setData } = useApi<VeilleDraft>(`/admin/veille/drafts/${id}`);

  const reject = async () => {
    if (!d) return;
    const ok = await confirm({
      title: "Écarter ce texte ?",
      message: "Il ne sera pas publié. Vous pourrez le restaurer depuis l’onglet « Écartés ».",
      confirmLabel: "Écarter",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/admin/veille/drafts/${d.id}/reject`, { method: "POST", body: {} });
      void refreshVeillePending();
      toast("Texte écarté.");
      router.push("/dashboard/veille");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Action impossible.", "error");
    }
  };

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader
        back={{ href: "/dashboard/veille", label: "Veille automatique" }}
        eyebrow={d ? sourceLine(d) : undefined}
        title={d?.status === "published" ? "Texte publié" : d?.status === "rejected" ? "Texte écarté" : "Texte du JORT à valider"}
        description={
          d?.status === "pending"
            ? "Fiche préparée par l’IA. Corrigez ce qui doit l’être, puis publiez : le texte part aux entreprises abonnées à son thème."
            : undefined
        }
        actions={
          d?.status === "pending" ? (
            <Button variant="ghost" className="text-ink-600" onClick={() => void reject()}>
              <Icon name="x" size={16} />
              Écarter
            </Button>
          ) : undefined
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !d && <Skeleton className="h-[520px] rounded-[22px]" />}

      {d && d.status !== "pending" && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white/80 px-5 py-4 text-[14px] text-ink-700">
          <Icon name={d.status === "published" ? "check" : "x"} size={18} className={d.status === "published" ? "text-ok-600" : "text-ink-500"} />
          <span className="flex-1">
            {d.status === "published"
              ? `Publié${d.publishedAt ? ` le ${formatDate(d.publishedAt)}` : ""}${d.publishedBy ? ` par ${d.publishedBy.nom}` : ""}.`
              : `Écarté${d.rejectedBy ? ` par ${d.rejectedBy.nom}` : ""}${d.rejectReason ? ` : « ${d.rejectReason} »` : ""}.`}
          </span>
          {d.publishedTextId && (
            <Button size="sm" asChild>
              <Link href={`/dashboard/texts/${d.publishedTextId}`}>Voir le texte publié</Link>
            </Button>
          )}
        </div>
      )}

      {d && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {d.status === "pending" ? (
            <TextForm
              key={d.updatedAt}
              initial={draftToForm(d)}
              currentPdf={d.pdfUrl}
              submitLabel="Publier le texte"
              footerStart={
                <p className="text-[13px] text-ink-500">
                  {d.companies
                    ? `Sera envoyé à ${plural(d.companies, "entreprise abonnée", "entreprises abonnées")} à ce thème.`
                    : "Aucune entreprise n’est encore abonnée à ce thème."}
                </p>
              }
              secondary={{
                label: "Enregistrer sans publier",
                onSubmit: async (fd) => {
                  setData(await apiForm<VeilleDraft>(`/admin/veille/drafts/${d.id}`, "PATCH", fd));
                  toast("Modifications enregistrées.");
                },
              }}
              onSubmit={async (fd) => {
                const r = await apiForm<DraftPublishResult>(`/admin/veille/drafts/${d.id}/publish`, "POST", fd);
                void refreshVeillePending();
                toast(r.distributedTo ? `Texte publié et envoyé à ${plural(r.distributedTo, "entreprise", "entreprises")}.` : "Texte publié.");
                router.push(`/dashboard/texts/${r.textId}`);
              }}
            />
          ) : (
            <section className="flex flex-col gap-3 rounded-[22px] border border-ink-200/80 bg-white p-6">
              <h2 className="text-[17px] font-semibold leading-snug text-ink-900">{d.titre}</h2>
              <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-ink-700">{d.description}</p>
            </section>
          )}
          <AiPanel d={d} />
        </div>
      )}
    </div>
  );
}
