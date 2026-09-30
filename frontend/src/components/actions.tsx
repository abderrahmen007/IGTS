"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { Icon } from "./icons";
import { Modal, useConfirm, useToast } from "./overlay";
import { Button, Field, Input, Progress, Textarea, cn, toneBadge } from "./ui";
import { api, apiForm, ApiError } from "@/lib/api";
import { formatDate, initials } from "@/lib/format";
import { ACTION_COLUMNS, ACTION_EFFICACE, dueChip } from "@/lib/status";
import type { ActionPlan, TextDetail } from "@/lib/types";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx";

/** Upload proofs for an action (max 5 files, 10 MB each). */
export async function uploadProofs(actionId: number, files: FileList | File[]) {
  const form = new FormData();
  Array.from(files)
    .slice(0, 5)
    .forEach((f) => form.append("files", f));
  return apiForm<TextDetail>(`/company/actions/${actionId}/files`, "POST", form);
}

function fileLabel(name: string) {
  // Stored names end with "-<random>.<ext>": show a readable name
  return name.replace(/-[0-9a-f]{8,}(?=\.[a-z0-9]+$)/i, "").replace(/-/g, " ");
}

/** Status control as three segments (En cours / À reprendre / Efficace). */
export function StatusSegments({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (id: number) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Statut de l’action" className="grid grid-cols-3 gap-1 rounded-xl bg-ink-100 p-1">
      {ACTION_COLUMNS.map((c) => {
        const on = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(c.id)}
            className={cn(
              "flex h-9 items-center justify-center gap-2 rounded-[9px] text-[13px] font-semibold transition-colors",
              on ? "bg-white text-ink-900 shadow-[0_1px_2px_rgb(22_20_43/0.12)]" : "text-ink-600 hover:text-ink-900",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", c.dot)} />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

/** Full edition of an action: text, owner, dates, status, progress and proofs. */
export function ActionEditor({
  action,
  open,
  onClose,
  onSaved,
}: {
  action: ActionPlan | null;
  open: boolean;
  onClose: () => void;
  onSaved: (d: TextDetail) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    description: "",
    responsable: "",
    telephone: "",
    dateOuverture: "",
    dateCloture: "",
    status: 1,
    effectivite: 0,
  });
  const [files, setFiles] = useState<ActionPlan["files"]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const [shown, setShown] = useState<ActionPlan | null>(null);
  if (action && action !== shown) {
    setShown(action);
    setForm({
      description: action.description ?? "",
      responsable: action.responsable ?? "",
      telephone: action.telephone ?? "",
      dateOuverture: action.dateOuverture?.slice(0, 10) ?? "",
      dateCloture: action.dateCloture?.slice(0, 10) ?? "",
      status: action.status?.id ?? 1,
      effectivite: action.effectivite ?? 0,
    });
    setFiles(action.files);
  }

  if (!action) return null;

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("save");
    try {
      const d = await api<TextDetail>(`/company/actions/${action.id}`, {
        method: "PATCH",
        body: {
          description: form.description,
          responsable: form.responsable,
          telephone: form.telephone,
          dateOuverture: form.dateOuverture || undefined,
          dateCloture: form.dateCloture || null,
          gestionactionId: form.status,
          effectivite: Number(form.effectivite),
        },
      });
      onSaved(d);
      toast(form.status === ACTION_EFFICACE ? "Action terminée. Bravo !" : "Action enregistrée.");
      onClose();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Enregistrement impossible.", "error");
    } finally {
      setBusy(null);
    }
  };

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy("upload");
    try {
      const d = await uploadProofs(action.id, list);
      setFiles(d.actions.find((a) => a.id === action.id)?.files ?? files);
      onSaved(d);
      toast(list.length > 1 ? "Preuves ajoutées." : "Preuve ajoutée.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Envoi impossible.", "error");
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const removeFile = async (name: string) => {
    const ok = await confirm({ title: "Retirer ce fichier ?", message: fileLabel(name), confirmLabel: "Retirer", danger: true });
    if (!ok) return;
    try {
      const d = await api<TextDetail>(`/company/actions/${action.id}/files/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      setFiles(d.actions.find((a) => a.id === action.id)?.files ?? []);
      onSaved(d);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Suppression impossible.", "error");
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: "Supprimer cette action ?",
      message: "L’action et son historique seront supprimés. Les preuves déjà envoyées restent archivées.",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    setBusy("delete");
    try {
      const d = await api<TextDetail>(`/company/actions/${action.id}`, { method: "DELETE" });
      onSaved(d);
      toast("Action supprimée.");
      onClose();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Suppression impossible.", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Action ${action.number ? `n° ${action.number}` : ""}`}
      description={action.texte?.titre}
      footer={
        <>
          <Button variant="ghost" icon="trash" onClick={remove} loading={busy === "delete"} className="text-bad-700 sm:mr-auto">
            Supprimer
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="action-editor" loading={busy === "save"}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="action-editor" onSubmit={save} className="flex flex-col gap-5">
        <Field label="Que faut-il faire ?" htmlFor="ae-desc">
          <Textarea id="ae-desc" rows={3} required minLength={3} value={form.description} onChange={set("description")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Qui s’en charge ?" htmlFor="ae-resp">
            <Input id="ae-resp" value={form.responsable} onChange={set("responsable")} />
          </Field>
          <Field label="Téléphone" htmlFor="ae-tel">
            <Input id="ae-tel" value={form.telephone} onChange={set("telephone")} inputMode="tel" />
          </Field>
          <Field label="Ouverte le" htmlFor="ae-open">
            <Input id="ae-open" type="date" value={form.dateOuverture} onChange={set("dateOuverture")} />
          </Field>
          <Field label="Échéance" htmlFor="ae-close" hint="Rappel par e-mail 7 jours et 1 jour avant.">
            <Input id="ae-close" type="date" value={form.dateCloture} onChange={set("dateCloture")} />
          </Field>
        </div>
        <Field label="Statut">
          <StatusSegments value={form.status} onChange={(id) => setForm({ ...form, status: id, effectivite: id === ACTION_EFFICACE ? 100 : form.effectivite })} />
        </Field>
        <Field label={`Avancement : ${form.effectivite} %`} htmlFor="ae-progress">
          <input
            id="ae-progress"
            type="range"
            min={0}
            max={100}
            step={5}
            value={form.effectivite}
            onChange={set("effectivite")}
            className="h-2 w-full cursor-pointer accent-[var(--color-brand-800)]"
          />
        </Field>

        <div className="flex flex-col gap-2.5">
          <p className="text-[13px] font-semibold text-ink-700">Preuves</p>
          {files.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {files.map((f) => (
                <li key={f.name} className="flex items-center gap-2.5 rounded-xl bg-paper px-3 py-2 text-sm">
                  <Icon name="paperclip" size={15} className="shrink-0 text-ink-500" />
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-medium text-brand-700 hover:underline">
                    {fileLabel(f.name)}
                  </a>
                  <button
                    type="button"
                    onClick={() => removeFile(f.name)}
                    aria-label={`Retirer ${fileLabel(f.name)}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-white hover:text-bad-700"
                  >
                    <Icon name="x" size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            id="ae-files"
            onChange={(e) => upload(e.target.files)}
          />
          <label
            htmlFor="ae-files"
            className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-ink-300 bg-ink-50 text-[13.5px] font-medium text-ink-600 hover:border-brand-600 hover:text-brand-800"
          >
            {busy === "upload" ? "Envoi en cours…" : (
              <>
                <Icon name="paperclip" size={16} />
                Joindre une preuve (PDF, photo, Word, Excel · 10 Mo max)
              </>
            )}
          </label>
        </div>
      </form>
    </Modal>
  );
}

/** Compact card of an action (plan board and text page). */
export function ActionCard({
  action,
  onOpen,
  draggable,
  onDragStart,
  showText = true,
}: {
  action: ActionPlan;
  onOpen?: () => void;
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  showText?: boolean;
}) {
  const chip = dueChip(action.dueIn, action.status?.id);
  const meta = [action.texte?.theme, action.texte?.secteur].filter(Boolean).join(" · ");
  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      className={cn(
        "lift group relative flex flex-col gap-2.5 rounded-[14px] border border-ink-200/80 bg-white px-4 py-3.5",
        draggable && "cursor-grab active:cursor-grabbing",
        action.onHold && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-ink-500">
          {showText ? meta || action.texte?.titre : action.createdBy ? `Créée par ${action.createdBy}` : ""}
        </span>
        {action.onHold ? (
          <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", toneBadge("neutral"))}>En pause</span>
        ) : (
          chip && (
            <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", toneBadge(chip.tone))}>
              {chip.label}
            </span>
          )
        )}
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="line-clamp-3 text-left text-[14.5px] font-semibold leading-snug text-ink-900 after:absolute after:inset-0 group-focus-within:underline"
      >
        {action.description || "Action"}
      </button>
      {showText && action.texte?.titre && (
        <p className="line-clamp-1 text-xs text-ink-500" title={action.texte.titre}>
          {action.texte.titre}
        </p>
      )}
      <div className="flex items-center gap-2.5">
        <Progress value={action.effectivite ?? 0} className="flex-1" tone={action.status?.id === ACTION_EFFICACE ? "ok" : "brand"} />
        <span className="tabular text-xs font-semibold text-ink-600">{action.effectivite ?? 0} %</span>
      </div>
      <div className="flex items-center gap-2 text-[12.5px] text-ink-600">
        {action.responsable ? (
          <>
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-800">
              {initials(action.responsable)}
            </span>
            <span className="truncate">{action.responsable}</span>
          </>
        ) : (
          <span className="text-ink-400">Sans responsable</span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-3 text-ink-500">
          {action.dateCloture && !chip && <span>{formatDate(action.dateCloture)}</span>}
          {action.files.length > 0 && (
            <span className="inline-flex items-center gap-1" title={`${action.files.length} preuve(s)`}>
              <Icon name="paperclip" size={14} strokeWidth={2} />
              {action.files.length}
            </span>
          )}
        </span>
      </div>
    </article>
  );
}
