"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui";
import { Classement, ConfidenceChip, sourceLine } from "@/components/veille/shared";
import { api, ApiError } from "@/lib/api";
import { formatDate, plural } from "@/lib/format";
import type { DraftPublishResult, VeilleDraft } from "@/lib/admin-types";

interface ValidationInfo {
  admin: { nom: string };
  draft: VeilleDraft;
  reviewUrl: string;
}

/**
 * Page opened from the "Valider et publier" button of the morning e-mail.
 * Opening it changes nothing (mail scanners open links too): the text is
 * published only by the click on "Publier ce texte". The signed link is the
 * credential, so no login is needed.
 */
export default function ValidationPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<ValidationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState<DraftPublishResult | null>(null);

  useEffect(() => {
    let alive = true;
    api<ValidationInfo>(`/veille/validation/${encodeURIComponent(token)}`, { auth: false })
      .then((r) => alive && setInfo(r))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : "Ce lien ne peut pas être ouvert."));
    return () => {
      alive = false;
    };
  }, [token]);

  const publish = async () => {
    setPublishing(true);
    setError(null);
    try {
      setDone(await api<DraftPublishResult>(`/veille/validation/${encodeURIComponent(token)}`, { method: "POST", auth: false }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Publication impossible.");
    } finally {
      setPublishing(false);
    }
  };

  const d = done?.draft ?? info?.draft ?? null;

  return (
    <div className="relative isolate flex min-h-screen flex-col items-center bg-paper px-4 py-10 sm:py-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-40 -top-48 h-[560px] w-[560px] rounded-full border-[110px] border-brand-600 opacity-25 blur-[46px]" />
        <div className="absolute -bottom-40 left-10 h-[420px] w-[420px] rounded-full bg-saffron-500 opacity-20 blur-[90px]" />
      </div>

      <Image src="/brand/igts-veille.png" alt="IGTS Veille" width={112} height={78} loading="eager" className="mb-8" />

      <main className="glass w-full max-w-[640px] rounded-[26px] px-6 py-7 sm:px-9 sm:py-9">
        {!info && !error && (
          <div className="flex items-center justify-center gap-3 py-16 text-ink-600">
            <Spinner size={18} /> Ouverture du texte…
          </div>
        )}

        {!info && error && (
          <div className="flex flex-col items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-coral-50 text-coral-700">
              <Icon name="alert" size={22} />
            </span>
            <h1 className="font-serif text-[26px] font-semibold text-ink-900">Lien de validation expiré</h1>
            <p className="text-[15px] leading-relaxed text-ink-600">{error}</p>
            <Button asChild>
              <Link href="/dashboard/veille">Ouvrir la veille automatique</Link>
            </Button>
          </div>
        )}

        {info && d && (
          <div className="flex flex-col gap-5">
            {done ? (
              <div className="flex flex-col items-start gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ok-50 text-ok-700">
                  <Icon name="check" size={24} strokeWidth={2.4} />
                </span>
                <h1 className="font-serif text-[28px] font-semibold leading-tight text-ink-900">Texte publié</h1>
                <p className="text-[15px] leading-relaxed text-ink-600">
                  {done.distributedTo
                    ? `Il a été ajouté à la veille de ${plural(done.distributedTo, "entreprise", "entreprises")}, qui en ont été prévenues.`
                    : "Il a rejoint la base. Aucune entreprise n’est encore abonnée à son thème."}
                </p>
              </div>
            ) : d.status === "published" ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ok-700">Déjà publié</p>
                <h1 className="font-serif text-[26px] font-semibold leading-tight text-ink-900">Ce texte est déjà en ligne</h1>
                <p className="text-[14.5px] text-ink-600">
                  {d.publishedBy ? `Publié par ${d.publishedBy.nom}` : "Publié"}
                  {d.publishedAt ? ` le ${formatDate(d.publishedAt)}` : ""}.
                </p>
              </div>
            ) : d.status === "rejected" ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">Écarté</p>
                <h1 className="font-serif text-[26px] font-semibold leading-tight text-ink-900">Ce texte a été écarté</h1>
                <p className="text-[14.5px] text-ink-600">
                  {d.rejectedBy ? `Par ${d.rejectedBy.nom}. ` : ""}Il peut être restauré depuis la plateforme.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-saffron-700">Bonjour {info.admin.nom}</p>
                <h1 className="font-serif text-[28px] font-semibold leading-tight text-ink-900">Publier ce texte ?</h1>
              </div>
            )}

            <article className="flex flex-col gap-3 rounded-2xl border border-ink-200/80 bg-white p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                <span className="min-w-0 truncate">{sourceLine(d)}</span>
                <span className="flex-1" />
                {d.status === "pending" && !done && <ConfidenceChip value={d.ai.confidence} />}
              </div>
              <h2 className="text-[16px] font-semibold leading-snug text-ink-900">{d.titre}</h2>
              <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-ink-700">{d.description}</p>
              <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-ink-600">
                <Icon name="library" size={15} className="text-ink-400" />
                {d.type && <span className="font-medium">{d.type.name} ·</span>}
                <Classement draft={d} />
              </p>
              {d.pdfUrl && (
                <a href={d.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 self-start text-[13.5px] font-semibold text-brand-700 hover:underline">
                  <Icon name="file" size={15} />
                  Lire le texte officiel (PDF)
                </a>
              )}
            </article>

            {d.status === "pending" && !done && (d.ai.needsReview.length > 0 || d.duplicateOf) && (
              <div className="rounded-xl bg-saffron-50 px-4 py-3 text-[13.5px] leading-relaxed text-saffron-700">
                <p className="font-semibold">L’IA conseille une vérification</p>
                <ul className="mt-1 list-disc pl-4">
                  {d.duplicateOf && <li>Un texte au même titre existe déjà dans la base.</li>}
                  {d.ai.needsReview.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {error && <p className="rounded-xl bg-coral-50 px-4 py-3 text-[13.5px] text-coral-700">{error}</p>}

            {d.status === "pending" && !done && (
              <>
                <p className="text-[13.5px] text-ink-600">
                  {d.companies
                    ? `Il sera ajouté à la veille de ${plural(d.companies, "entreprise abonnée", "entreprises abonnées")} à ce thème, qui en seront prévenues.`
                    : "Aucune entreprise n’est encore abonnée à ce thème : le texte rejoindra la base sans être envoyé."}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {d.ready ? (
                    <Button size="lg" onClick={() => void publish()} disabled={publishing}>
                      {publishing ? <Spinner size={16} /> : <Icon name="send" size={17} />}
                      Publier ce texte
                    </Button>
                  ) : (
                    <p className="text-[13.5px] font-medium text-coral-700">Le classement est incomplet : complétez-le sur la plateforme avant de publier.</p>
                  )}
                  <Button size="lg" variant="outline" asChild>
                    <a href={info.reviewUrl}>Vérifier d’abord sur la plateforme</a>
                  </Button>
                </div>
              </>
            )}

            {(done || d.status === "published") && (done?.textId ?? d.publishedTextId) && (
              <Button variant="outline" asChild className="self-start">
                <Link href={`/dashboard/texts/${done?.textId ?? d.publishedTextId}`}>Voir le texte sur la plateforme</Link>
              </Button>
            )}
          </div>
        )}
      </main>
      <p className="mt-6 max-w-[520px] text-center text-xs leading-relaxed text-ink-500">
        Lien personnel envoyé aux administrateurs IGTS, valable 14 jours. Ouvrir cette page ne publie rien.
      </p>
    </div>
  );
}
