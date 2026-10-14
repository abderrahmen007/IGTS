"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { useConfirm, useToast } from "@/components/overlay";
import { Badge, EmptyState, ErrorState, Field, Input, PageHeader, Skeleton } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DataTable, Kpi, LikertBar, LikertLegend } from "@/components/charts/kit";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatDate, plural, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  RATING_LABELS,
  type FeedbackCampaign,
  type FeedbackOverview,
  type FeedbackQuestion,
  type FeedbackResults,
} from "@/lib/feedback-types";

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const note = (n: number | null) => (n === null ? "—" : n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

// ─── Launch ─────────────────────────────────────────────────────────

function LaunchDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(`Enquête de satisfaction ${new Date().getFullYear()}`);
  const [closesOn, setClosesOn] = useState(inDays(29));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api("/admin/feedback/campaigns", { method: "POST", body: { title, closesOn } });
      toast("Enquête lancée : les entreprises reçoivent l’invitation par e-mail.");
      onOpenChange(false);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lancement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Lancer une enquête</DialogTitle>
          <DialogDescription>
            Chaque compte actif reçoit une invitation par e-mail et une carte sur son accueil. L’enquête reprend les questions actuelles.
          </DialogDescription>
        </DialogHeader>
        <form id="launch-form" onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Titre" htmlFor="c-title">
            <Input id="c-title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Dernier jour pour répondre" htmlFor="c-close">
            <Input id="c-close" type="date" required min={today()} value={closesOn} onChange={(e) => setClosesOn(e.target.value)} />
          </Field>
          {error && <p className="text-[13px] text-bad-700">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="launch-form" disabled={saving}>
            {saving ? "Lancement…" : "Lancer et inviter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Questions ──────────────────────────────────────────────────────

function QuestionsDialog({
  open,
  onOpenChange,
  questions,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  questions: FeedbackQuestion[];
  onSaved: (q: FeedbackQuestion[]) => void;
}) {
  const toast = useToast();
  const [list, setList] = useState<FeedbackQuestion[]>(questions);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setList(questions.map((q) => ({ ...q })));
      setError(null);
    }
  }

  const update = (i: number, patch: Partial<FeedbackQuestion>) => setList(list.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setList(next);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await api<FeedbackQuestion[]>("/admin/feedback/questions", {
        method: "PUT",
        body: { questions: list.map(({ id, label, kind, required }) => ({ id, label, kind, required })) },
      });
      onSaved(saved);
      toast("Questions enregistrées : elles serviront aux prochaines enquêtes.");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Questions de l’enquête</DialogTitle>
          <DialogDescription>Les changements s’appliquent aux prochaines enquêtes ; une enquête ouverte garde ses questions.</DialogDescription>
        </DialogHeader>
        <ol className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto pr-1" data-lenis-prevent>
          {list.map((q, i) => (
            <li key={q.id || i} className="flex flex-col gap-3 rounded-2xl border border-ink-200/80 bg-white p-4">
              <div className="flex items-start gap-2">
                <span className="tabular mt-2.5 w-6 shrink-0 text-[13px] font-semibold text-ink-500">{i + 1}.</span>
                <Input
                  aria-label={`Question ${i + 1}`}
                  value={q.label}
                  maxLength={300}
                  onChange={(e) => update(i, { label: e.target.value })}
                  className="flex-1"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 pl-8">
                <Select value={q.kind} onValueChange={(v) => update(i, { kind: v as FeedbackQuestion["kind"], required: v === "rating" })}>
                  <SelectTrigger className="h-9 w-[180px]" aria-label="Type de réponse">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rating">Note de 1 à 5</SelectItem>
                    <SelectItem value="text">Réponse libre</SelectItem>
                  </SelectContent>
                </Select>
                {q.kind === "rating" && (
                  <label className="flex items-center gap-2 text-[13px] text-ink-700">
                    <Switch checked={q.required} onCheckedChange={(v) => update(i, { required: v })} />
                    Obligatoire
                  </label>
                )}
                <span className="flex-1" />
                <Button variant="ghost" size="icon-sm" aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)}>
                  <Icon name="chevronDown" size={16} className="rotate-180" />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Descendre" disabled={i === list.length - 1} onClick={() => move(i, 1)}>
                  <Icon name="chevronDown" size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Supprimer la question"
                  className="text-bad-700"
                  onClick={() => setList(list.filter((_, k) => k !== i))}
                >
                  <Icon name="trash" size={16} />
                </Button>
              </div>
            </li>
          ))}
        </ol>
        <Button
          variant="outline"
          className="self-start"
          disabled={list.length >= 20}
          onClick={() => setList([...list, { id: "", label: "", kind: "rating", required: true }])}
        >
          <Icon name="plus" size={16} />
          Ajouter une question
        </Button>
        {error && <p className="text-[13px] text-bad-700">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => void save()} disabled={saving || list.some((q) => q.label.trim().length < 3)}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Results ────────────────────────────────────────────────────────

function Results({ id, onClosed }: { id: number; onClosed: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: r, error, loading, reload } = useApi<FeedbackResults>(`/admin/feedback/campaigns/${id}`);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !r) return <Skeleton className="h-[420px] rounded-[22px]" />;
  if (!r) return null;

  const close = async () => {
    const ok = await confirm({
      title: "Clôturer l’enquête ?",
      message: "Les entreprises ne pourront plus répondre. Les résultats restent consultables.",
      confirmLabel: "Clôturer",
    });
    if (!ok) return;
    try {
      await api(`/admin/feedback/campaigns/${id}/close`, { method: "POST" });
      toast("Enquête clôturée.");
      void reload();
      onClosed();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Opération impossible.", "error");
    }
  };

  const ratings = r.questions.filter((q) => q.kind === "rating");
  const texts = r.questions.filter((q) => q.kind === "text");
  const share = r.companiesTotal ? Math.round((r.companiesAnswered / r.companiesTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/70 px-4 py-3 text-[14px] text-ink-700">
        <Badge tone={r.campaign.open ? "ok" : "neutral"}>{r.campaign.open ? "Ouverte" : "Clôturée"}</Badge>
        <span className="flex-1">
          {r.campaign.trigger === "auto" ? "Ouverte automatiquement" : `Lancée par ${r.campaign.openedBy}`} le {formatDate(r.campaign.openedAt)}
          {r.campaign.open ? `, réponses jusqu’au ${formatDate(r.campaign.closesOn)}` : r.campaign.closedAt ? `, clôturée le ${formatDate(r.campaign.closedAt)}` : ""}
        </span>
        {r.campaign.open && (
          <Button size="sm" variant="outline" onClick={() => void close()}>
            Clôturer maintenant
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon="award" label="Note moyenne" value={r.average} format={note} suffix=" / 5" sub="toutes questions notées" />
        <Kpi icon="users" label="Répondants" value={r.respondents} sub="une réponse par personne" />
        <Kpi
          icon="building"
          label="Entreprises ayant répondu"
          value={r.companiesAnswered}
          sub={`sur ${r.companiesTotal} entreprises actives (${share} %)`}
          meter={share}
        />
        <Kpi icon="message" label="Commentaires" value={texts.reduce((n, q) => n + q.count, 0)} sub="réponses libres" />
      </div>

      {r.respondents === 0 ? (
        <div className="rounded-[22px] border border-ink-200/80 bg-white">
          <EmptyState icon="message" title="Pas encore de réponse" description="Les résultats s’afficheront ici au fil des réponses." />
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-4 rounded-[22px] border border-ink-200/80 bg-white p-5 sm:p-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-[16px] font-semibold text-ink-900">Réponses par question</h2>
                <p className="text-[13px] text-ink-500">Répartition des notes, de « pas du tout » à « tout à fait ».</p>
              </div>
              <LikertLegend labels={RATING_LABELS} />
            </header>
            <ul className="flex flex-col divide-y divide-ink-100">
              {ratings.map((q) =>
                q.kind === "rating" ? (
                  <li key={q.id} className="grid gap-2 py-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_64px] sm:items-center sm:gap-5">
                    <span className="text-[14px] leading-snug text-ink-800">{q.label}</span>
                    <LikertBar distribution={q.distribution} labels={RATING_LABELS} />
                    <span className="tabular text-[15px] font-semibold text-ink-900 sm:text-right">
                      {note(q.average)}
                      <span className="text-[12px] font-normal text-ink-500"> /5</span>
                    </span>
                  </li>
                ) : null,
              )}
            </ul>
            <DataTable
              head={["Question", "1", "2", "3", "4", "5", "Moyenne"]}
              rows={ratings.map((q) =>
                q.kind === "rating" ? [q.label, ...q.distribution, note(q.average)] : [q.label],
              )}
            />
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            {texts.map((q) =>
              q.kind === "text" ? (
                <section key={q.id} className="flex flex-col gap-3 rounded-[22px] border border-ink-200/80 bg-white p-5 sm:p-6">
                  <h2 className="text-[16px] font-semibold text-ink-900">{q.label}</h2>
                  {q.comments.length === 0 ? (
                    <p className="text-[13.5px] text-ink-500">Aucun commentaire.</p>
                  ) : (
                    <ul className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1" data-lenis-prevent>
                      {q.comments.map((c) => (
                        <li key={`${c.nom}-${c.at}`} className="rounded-2xl bg-paper px-4 py-3">
                          <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink-800">{c.text}</p>
                          <p className="mt-1.5 text-xs text-ink-500">
                            {c.nom} · {c.company} · {relativeTime(c.at)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null,
            )}
            <section className="flex flex-col gap-3 rounded-[22px] border border-ink-200/80 bg-white p-5 sm:p-6">
              <h2 className="text-[16px] font-semibold text-ink-900">Par entreprise</h2>
              <p className="-mt-2 text-[13px] text-ink-500">Les moins satisfaites d’abord : ce sont elles à rappeler.</p>
              <ul className="flex flex-col divide-y divide-ink-100">
                {r.byCompany.map((c) => (
                  <li key={c.companyId} className="flex items-center gap-3 py-2.5 text-[14px]">
                    <Link href={`/dashboard/companies/${c.companyId}`} className="min-w-0 flex-1 truncate font-medium text-ink-900 hover:text-brand-700">
                      {c.company}
                    </Link>
                    <span className="text-[12.5px] text-ink-500">{plural(c.respondents, "réponse", "réponses")}</span>
                    <span className="tabular w-14 text-right font-semibold text-ink-900">{note(c.average)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────

/**
 * Satisfaction surveys of the client companies: launched by IGTS or
 * automatically every 1 September, with editable questions.
 */
export default function SurveysPage() {
  const { data, error, loading, reload, setData } = useApi<FeedbackOverview>("/admin/feedback");
  const [selected, setSelected] = useState<number | null>(null);
  const [launching, setLaunching] = useState(false);
  const [editing, setEditing] = useState(false);

  const campaigns = data?.campaigns ?? [];
  const shown: FeedbackCampaign | undefined = campaigns.find((c) => c.id === selected) ?? campaigns[0];

  return (
    <>
      <PageHeader
        eyebrow="Clients"
        title="Enquêtes de satisfaction"
        description="Chaque 1er septembre, une enquête s’ouvre automatiquement pour 30 jours. Vous pouvez aussi en lancer une à tout moment."
        actions={
          data ? (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Icon name="pencil" size={16} />
                Modifier les questions
              </Button>
              <Button onClick={() => setLaunching(true)} disabled={data.current !== null} title={data.current !== null ? "Une enquête est déjà ouverte" : undefined}>
                <Icon name="send" size={16} />
                Lancer une enquête
              </Button>
            </>
          ) : undefined
        }
      />
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <Skeleton className="h-[420px] rounded-[22px]" />}

      {data && campaigns.length === 0 && (
        <div className="glass rounded-[22px]">
          <EmptyState
            icon="message"
            title="Aucune enquête pour l’instant"
            description={`La prochaine s’ouvrira automatiquement le 1er septembre. Questions prêtes : ${data.questions.length}.`}
            action={
              <Button onClick={() => setLaunching(true)}>
                <Icon name="send" size={16} />
                Lancer une enquête maintenant
              </Button>
            }
          />
        </div>
      )}

      {shown && (
        <>
          {campaigns.length > 1 && (
            <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Enquêtes">
              {campaigns.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={c.id === shown.id}
                  onClick={() => setSelected(c.id)}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                    c.id === shown.id ? "border-brand-800 bg-brand-800 text-white" : "border-ink-200 bg-white text-ink-700 hover:border-brand-200",
                  )}
                >
                  {c.title}
                  {c.open && <span className="h-2 w-2 rounded-full bg-ok-600" aria-label="ouverte" />}
                </button>
              ))}
            </div>
          )}
          <Results key={shown.id} id={shown.id} onClosed={() => void reload()} />
        </>
      )}

      <LaunchDialog open={launching} onOpenChange={setLaunching} onDone={() => void reload()} />
      {data && (
        <QuestionsDialog
          open={editing}
          onOpenChange={setEditing}
          questions={data.questions}
          onSaved={(questions) => setData({ ...data, questions })}
        />
      )}
    </>
  );
}
