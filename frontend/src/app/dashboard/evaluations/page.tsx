"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EvaluationPanel } from "@/components/evaluation-panel";
import { TextReader } from "@/components/text-reader";
import { Icon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { SecteurPills, ThemeSelect, themeForSecteur } from "@/components/secteur-filter";
import { AnimatedTabsList } from "@/components/aceternity/animated-tabs";
import { AnimatedContent } from "@/components/reactbits/animated-content";
import { scrollToTop } from "@/components/smooth-scroll";
import { ErrorState, LinkButton, Pagination, SearchInput, Skeleton, EmptyState } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useLive } from "@/components/live-context";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useDebounced } from "@/lib/use-url-state";
import { formatNumber, plural } from "@/lib/format";
import { getDomainTheme } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { CompanyFilters, Paginated, TextDetail, TextListItem } from "@/lib/types";

type Mode = "one" | "list";
const QUEUE_SIZE = 100;

/** Keeps ?id= and ?vue= in the address bar so a text can be shared or reloaded. */
function writeUrl(id: number | null, mode: Mode) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("id", String(id));
  else url.searchParams.delete("id");
  if (mode === "list") url.searchParams.set("vue", "liste");
  else url.searchParams.delete("vue");
  window.history.replaceState(null, "", url);
}

const subline = (t: TextListItem) => [t.type?.name, t.date, t.secteur?.name].filter(Boolean).join(" · ");

// ─── Direct choice of a text (supervisor's request, 09/10) ──────────

/** shadcn/ui Popover + Command: type a few letters, pick the text to evaluate. */
function TextPicker({
  queue,
  currentId,
  total,
  onPick,
  onShowList,
}: {
  queue: TextListItem[];
  currentId: number | null;
  total: number;
  onPick: (id: number) => void;
  onShowList: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Choisir un texte à analyser">
          <Icon name="listChecks" size={16} />
          Choisir un texte
          <Icon name="chevronDown" size={14} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(560px,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput placeholder="Titre, numéro, secteur…" />
          <CommandList>
            <CommandEmpty>Aucun texte ne correspond.</CommandEmpty>
            <CommandGroup heading={`${plural(queue.length, "texte non analysé", "textes non analysés")}`}>
              {queue.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`${t.id} ${t.titre} ${t.num ?? ""} ${t.secteur?.name ?? ""}`}
                  onSelect={() => {
                    setOpen(false);
                    onPick(t.id);
                  }}
                  className={cn(t.id === currentId && "shadow-[inset_0_0_0_1px_var(--color-brand-200)]")}
                >
                  <Icon name="file" size={18} className="mt-0.5 shrink-0 self-start text-ink-500" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-2 font-medium leading-snug">{t.titre}</span>
                    <span className="flex items-center gap-1.5 truncate text-xs text-ink-500">
                      <span>{[t.type?.name, t.date].filter(Boolean).join(" · ")}</span>
                      {t.secteur?.name && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 font-medium text-ink-700">
                            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", getDomainTheme(t.secteur.name).dot)} />
                            {t.secteur.name}
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                  {t.id === currentId && <span className="shrink-0 text-xs font-semibold text-brand-700">En cours</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {total > queue.length && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onShowList();
              }}
              className="flex w-full items-center justify-center gap-2 border-t border-ink-150 px-4 py-3 text-[13px] font-semibold text-brand-700 hover:bg-brand-50"
            >
              Voir les {formatNumber(total)} textes dans la liste complète
              <Icon name="arrowRight" size={14} />
            </button>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── List of all texts waiting for an evaluation ────────────────────

function PendingList({ onPick }: { onPick: (id: number) => void }) {
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [secteurId, setSecteurId] = useState("");
  const [themeId, setThemeId] = useState("");
  const [page, setPage] = useState(1);
  const { data: filters } = useApi<CompanyFilters>("/company/filters");
  const { data, error, loading, reload } = useApi<Paginated<TextListItem>>("/company/texts", {
    status: "a-analyser",
    search: q,
    secteurId,
    themeId,
    sort: "secteur",
    page,
    pageSize: 20,
  });

  // A new search, secteur or thème starts again from page 1
  const key = `${q}|${secteurId}|${themeId}`;
  const [filterKey, setFilterKey] = useState(key);
  if (filterKey !== key) {
    setFilterKey(key);
    setPage(1);
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-ink-200/80 bg-white">
      <div className="flex flex-col gap-3 border-b border-ink-150 px-5 py-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un titre, un numéro, un mot-clé…" className="md:max-w-md" />
        {filters && filters.secteurs.length > 1 && (
          <SecteurPills
            filters={filters}
            secteurId={secteurId}
            onChange={(id) => {
              setSecteurId(id);
              setThemeId(themeForSecteur(filters, id, themeId));
            }}
          />
        )}
        {filters?.themes && filters.themes.length > 0 && (
          <ThemeSelect filters={filters} secteurId={secteurId} themeId={themeId} onChange={setThemeId} className="sm:w-72" />
        )}
      </div>

      {error && (
        <div className="p-5">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}

      <ul className={cn("divide-y divide-ink-150", loading && data && "opacity-60")}>
        {loading && !data && [0, 1, 2, 3, 4].map((i) => <li key={i} className="px-5 py-4"><Skeleton className="h-10" /></li>)}
        {data?.items.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onPick(t.id)}
              className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-paper"
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  t.secteur?.name ? getDomainTheme(t.secteur.name).badge : "bg-saffron-100 text-saffron-700",
                )}
              >
                <Icon name="inbox" size={19} strokeWidth={1.8} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink-900 group-hover:text-brand-700">{t.titre}</span>
                <span className="flex items-center gap-1.5 truncate text-[13px] text-ink-500">
                  <span>{[t.type?.name, t.date].filter(Boolean).join(" · ")}</span>
                  {t.secteur?.name && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 font-medium text-ink-700">
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", getDomainTheme(t.secteur.name).dot)} />
                        {t.secteur.name}
                      </span>
                    </>
                  )}
                  {t.theme?.name && <span className="truncate">· {t.theme.name}</span>}
                </span>
              </span>
              <span className="hidden shrink-0 sm:block">
                <StatusBadge applicabilite={t.applicabilite} etat={t.etat} />
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[13.5px] font-semibold text-brand-700">
                Analyser
                <Icon name="arrowRight" size={15} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {data && data.items.length === 0 && (
        <EmptyState icon="search" title="Aucun texte ne correspond" description="Modifiez la recherche, le secteur ou le thème." />
      )}
      {data && data.pageCount > 1 && (
        <Pagination
          page={data.page}
          pageCount={data.pageCount}
          total={data.total}
          pageSize={data.pageSize}
          onPage={(p) => {
            setPage(p);
            scrollToTop();
          }}
        />
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────

/**
 * Texts waiting for an evaluation. Either one after the other (three questions,
 * then the next), or any text chosen directly from the picker or the list.
 */
export default function EvaluatePage() {
  const live = useLive();
  const [mode, setMode] = useState<Mode>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("vue") === "liste" ? "list" : "one",
  );
  const [queue, setQueue] = useState<TextListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState<TextDetail | null>(null);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await api<Paginated<TextListItem>>("/company/texts", {
        query: { status: "a-analyser", pageSize: QUEUE_SIZE },
      });
      setQueue(res.items);
      setTotal(res.total);
      setError(null);
      return res.items;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Chargement impossible.");
      return null;
    }
  }, []);

  // First load: ?id= opens that text, ?vue=liste opens the list
  useEffect(() => {
    let alive = true;
    const id = Number(new URLSearchParams(window.location.search).get("id")) || null;
    api<Paginated<TextListItem>>("/company/texts", { query: { status: "a-analyser", pageSize: QUEUE_SIZE } })
      .then((res) => {
        if (!alive) return;
        setQueue(res.items);
        setTotal(res.total);
        setCurrentId(id ?? res.items[0]?.id ?? null);
      })
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : "Chargement impossible."));
    return () => {
      alive = false;
    };
  }, []);

  // Text shown in "one by one" mode
  useEffect(() => {
    if (!currentId) return;
    let cancelled = false;
    api<TextDetail>(`/company/texts/${currentId}`)
      .then((d) => !cancelled && setLoaded(d))
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e.message : "Chargement impossible."));
    return () => {
      cancelled = true;
    };
  }, [currentId]);

  const current = currentId && loaded?.id === currentId ? loaded : null;
  const position = useMemo(() => (queue && currentId ? queue.findIndex((t) => t.id === currentId) : -1), [queue, currentId]);

  const show = (id: number | null, m: Mode = "one") => {
    setCurrentId(id);
    setMode(m);
    writeUrl(id, m);
    scrollToTop();
  };

  /** The next text after the current one (wrapping), leaving out skipped ones. */
  const nextAfter = (list: TextListItem[], fromIndex: number, skip: Set<number>) => {
    for (let i = 1; i <= list.length; i++) {
      const t = list[(fromIndex + i) % list.length];
      if (t && !skip.has(t.id) && t.id !== currentId) return t.id;
    }
    return null;
  };

  const goNext = async (evaluated: boolean, skip = skipped) => {
    const list = queue ?? [];
    const idx = Math.max(0, position);
    const remaining = evaluated ? list.filter((t) => t.id !== currentId) : list;
    if (evaluated) setQueue(remaining);
    let next = nextAfter(list, idx, skip);
    if (!next && remaining.length === 0) {
      const fresh = await fetchQueue();
      next = fresh?.find((t) => !skip.has(t.id))?.id ?? null;
    }
    if (evaluated) setTotal((n) => Math.max(0, n - 1));
    show(next);
  };

  const skip = () => {
    if (!currentId) return;
    const s = new Set(skipped).add(currentId);
    setSkipped(s);
    void goNext(false, s);
  };

  const finished = queue !== null && !currentId;

  return (
    <Tabs value={mode} onValueChange={(v) => show(v === "one" ? currentId ?? queue?.[0]?.id ?? null : currentId, v as Mode)} className="gap-6">
      <div className="glass flex flex-col gap-3 rounded-[18px] px-4 py-3 sm:px-5 lg:flex-row lg:items-center">
        <nav aria-label="Fil d’Ariane" className="flex items-center gap-2 text-sm text-ink-500">
          <Link href="/dashboard" className="hover:text-brand-700">
            Accueil
          </Link>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-ink-900">Analyse des textes</span>
          {total > 0 && <span className="rounded-full bg-saffron-100 px-2 py-0.5 text-xs font-semibold text-saffron-700">{formatNumber(total)}</span>}
        </nav>
        <AnimatedTabsList
          label="Façon d’analyser"
          layoutId="evaluate-mode"
          value={mode}
          className="lg:ml-4"
          tabs={[
            { value: "one", label: "Un par un", icon: "inbox" },
            { value: "list", label: "Choisir dans la liste", icon: "list" },
          ]}
        />
        <div className="flex-1" />
        {mode === "one" && queue && queue.length > 0 && currentId && (
          <div className="flex flex-wrap items-center gap-3">
            {position >= 0 && (
              <span className="text-[13.5px] text-ink-600">
                Texte <b className="text-ink-900">{formatNumber(position + 1)}</b> sur {formatNumber(total)}
                {done > 0 && <span className="text-ok-700"> · {plural(done, "analysé", "analysés")}</span>}
              </span>
            )}
            <TextPicker queue={queue} currentId={currentId} total={total} onPick={(id) => show(id)} onShowList={() => show(currentId, "list")} />
            <button onClick={skip} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-brand-700 hover:underline">
              Passer <Icon name="arrowRight" size={14} />
            </button>
          </div>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={() => void fetchQueue().then((items) => setCurrentId((c) => c ?? items?.[0]?.id ?? null))} />}

      <TabsContent value="list">
        <AnimatedContent>
          <PendingList onPick={(id) => show(id)} />
        </AnimatedContent>
      </TabsContent>

      <TabsContent value="one">
        {queue === null && !error && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
            <Skeleton className="h-[480px] rounded-[22px]" />
            <Skeleton className="h-[480px] rounded-[22px]" />
          </div>
        )}

        {finished && (
          <div className="glass mx-auto flex w-full max-w-2xl flex-col items-center rounded-[28px] px-8 py-14 text-center">
            <span className="gem flex h-16 w-16 items-center justify-center rounded-full bg-ok-600 text-white">
              <Icon name="check" size={30} strokeWidth={2.4} />
            </span>
            <h1 className="mt-5 font-serif text-[30px] font-semibold text-ink-900">
              {skipped.size ? "Vous avez parcouru tous les textes" : "Tous les textes sont analysés"}
            </h1>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-ink-600">
              {done > 0 && `${plural(done, "texte analysé", "textes analysés")} pendant cette session. `}
              {skipped.size
                ? `${plural(skipped.size, "texte passé reviendra", "textes passés reviendront")} la prochaine fois.`
                : "Aucun texte n’attend votre avis. Vous serez prévenu dès qu’un nouveau texte arrive."}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-2.5">
              <LinkButton href="/dashboard" variant="primary" size="lg">
                Retour à l’accueil
              </LinkButton>
              <LinkButton href="/dashboard/actions" size="lg">
                Mon plan d’action
              </LinkButton>
            </div>
          </div>
        )}

        {currentId && (
          <div key={currentId} className="animate-[rise_280ms_var(--ease-out-soft)] grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
            {current ? (
              <>
                <TextReader detail={current} clamp />
                <EvaluationPanel
                  detail={current}
                  mode="queue"
                  onSaved={() => {
                    setDone((d) => d + 1);
                    live?.reload();
                  }}
                  onNext={() => void goNext(true)}
                  onSkip={skip}
                  className="xl:sticky xl:top-24"
                />
              </>
            ) : (
              <>
                <Skeleton className="h-[480px] rounded-[22px]" />
                <Skeleton className="h-[480px] rounded-[22px]" />
              </>
            )}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
