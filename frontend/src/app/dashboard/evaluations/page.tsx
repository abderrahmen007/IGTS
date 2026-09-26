"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  StackedBar,
  cn,
  toneDot,
} from "@/components/ui";
import { Tabs } from "@/components/tabs";
import { Icon } from "@/components/icons";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useUrlState } from "@/lib/use-url-state";
import { formatNumber, formatPercent, pct } from "@/lib/format";
import type { Tone } from "@/lib/status";
import type { CompanyFilters, CompanyOverview, Paginated, TextDetail, TextListItem } from "@/lib/types";

type QueueStatus = "a-analyser" | "non-conforme" | "indicatif";

/** One row of the evaluation queue with inline applicability/compliance selects. */
function QueueRow({
  item,
  filters,
  onSaved,
}: {
  item: TextListItem;
  filters: CompanyFilters;
  onSaved: () => void;
}) {
  const [appl, setAppl] = useState(item.applicabilite.id);
  const [etat, setEtat] = useState<number | "">(item.etat?.id ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const save = async (applicabiliteId: number, gestionetatId: number | "") => {
    setState("saving");
    setError(null);
    try {
      await api<TextDetail>(`/company/texts/${item.id}/evaluation`, {
        method: "PATCH",
        body: { applicabiliteId, gestionetatId: applicabiliteId === 1 && gestionetatId !== "" ? gestionetatId : null },
      });
      setState("saved");
      onSaved();
    } catch (e) {
      setState("error");
      setError(e instanceof ApiError ? e.message : "Erreur");
    }
  };

  return (
    <li className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:gap-6">
      <div className="min-w-0 flex-1">
        <Link href={`/dashboard/my-texts/${item.id}`} className="text-sm font-medium text-ink-900 hover:text-brand-700">
          {item.titre}
        </Link>
        <p className="mt-0.5 truncate text-[13px] text-ink-500">
          {[item.type?.name, item.secteur?.name, item.date].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 md:flex md:w-auto md:items-center">
        <Select
          aria-label="Applicabilité"
          value={appl}
          onChange={(e) => {
            const v = Number(e.target.value);
            setAppl(v);
            if (v !== 1) void save(v, "");
            else if (etat !== "") void save(v, etat);
          }}
          className="md:w-40"
        >
          {filters.applicabilites.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Conformité"
          value={etat}
          disabled={appl !== 1}
          onChange={(e) => {
            const v = e.target.value === "" ? "" : Number(e.target.value);
            setEtat(v);
            if (v !== "") void save(appl, v);
          }}
          className="md:w-40"
        >
          <option value="">Conformité…</option>
          {filters.etats.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <span className="col-span-2 flex h-5 w-24 items-center text-xs md:col-span-1">
          {state === "saving" && <span className="text-ink-500">Enregistrement…</span>}
          {state === "saved" && (
            <span className="flex items-center gap-1 text-ok-700">
              <Icon name="check" size={14} /> Enregistré
            </span>
          )}
          {state === "error" && <span className="text-bad-700">{error}</span>}
        </span>
      </div>
    </li>
  );
}

function ConformiteView() {
  const [q, setQ] = useUrlState(["status", "page"] as const);
  const status = (q.status || "a-analyser") as QueueStatus;
  const overview = useApi<CompanyOverview>("/company/overview");
  const { data: filters } = useApi<CompanyFilters>("/company/filters");
  const list = useApi<Paginated<TextListItem>>("/company/texts", { status, page: q.page || 1, pageSize: 20 });
  const s = overview.data?.stats;

  const summary: { label: string; value?: number; tone: Tone; status: string }[] = s
    ? [
        { label: "Conformes", value: s.conforme, tone: "ok", status: "conforme" },
        { label: "Non conformes", value: s.nonConforme, tone: "bad", status: "non-conforme" },
        { label: "À titre indicatif", value: s.indicatif, tone: "info", status: "indicatif" },
        { label: "À analyser", value: s.toAnalyse, tone: "warn", status: "a-analyser" },
        { label: "Non applicables", value: s.nonApplicable, tone: "neutral", status: "non-applicable" },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Conformité"
        description="Évaluez rapidement l’applicabilité et la conformité de vos textes. Chaque modification est enregistrée et historisée."
      />

      <Card>
        <div className="grid grid-cols-1 gap-6 px-5 py-5 lg:grid-cols-[220px_1fr] lg:items-center">
          <div>
            <p className="text-[13px] text-ink-600">Taux de conformité</p>
            {overview.loading ? (
              <Skeleton className="mt-2 h-9 w-24" />
            ) : (
              <p className="tabular mt-1 text-[34px] font-semibold leading-none tracking-tight text-ink-950">
                {formatPercent(s?.complianceRate)}
              </p>
            )}
            <p className="mt-2 text-xs text-ink-500">Conformes ÷ (conformes + non conformes)</p>
          </div>
          <div>
            {s && <StackedBar height="h-3" segments={summary.map((x) => ({ ...x, value: x.value ?? 0 }))} />}
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
              {summary.map((x) => (
                <li key={x.label}>
                  <Link href={`/dashboard/my-texts?status=${x.status}`} className="group block">
                    <span className="flex items-center gap-2 text-[13px] text-ink-600 group-hover:text-brand-700">
                      <span className={cn("h-2 w-2 rounded-sm", toneDot(x.tone))} />
                      {x.label}
                    </span>
                    <span className="tabular mt-0.5 block text-base font-semibold text-ink-900">
                      {formatNumber(x.value)}
                      <span className="ml-1.5 text-xs font-normal text-ink-500">
                        {formatPercent(pct(x.value ?? 0, s?.total ?? 0))}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="File d’évaluation"
          description="Les changements sont enregistrés dès la sélection."
        />
        <div className="border-b border-ink-150 px-5 pt-2">
          <Tabs<QueueStatus>
            value={status}
            onChange={(v) => setQ({ status: v })}
            items={[
              { value: "a-analyser", label: "À analyser", count: s?.toAnalyse },
              { value: "non-conforme", label: "Non conformes", count: s?.nonConforme },
              { value: "indicatif", label: "À titre indicatif", count: s?.indicatif },
            ]}
          />
        </div>

        {list.error && (
          <div className="p-5">
            <ErrorState message={list.error} onRetry={list.reload} />
          </div>
        )}
        {list.loading && !list.data && (
          <div className="space-y-4 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}
        {list.data && filters && (
          <>
            {list.data.items.length ? (
              <ul className={cn("divide-y divide-ink-150", list.loading && "opacity-60")}>
                {list.data.items.map((item) => (
                  <QueueRow key={item.id} item={item} filters={filters} onSaved={overview.reload} />
                ))}
              </ul>
            ) : (
              <EmptyState icon="check" title="Rien à traiter ici" description="Tous les textes de cette catégorie ont été traités." />
            )}
            <Pagination
              page={list.data.page}
              pageCount={list.data.pageCount}
              total={list.data.total}
              pageSize={list.data.pageSize}
              onPage={(p) => setQ({ page: p }, { resetPage: false })}
            />
          </>
        )}
      </Card>
    </>
  );
}

export default function ConformitePage() {
  return (
    <Suspense>
      <ConformiteView />
    </Suspense>
  );
}
