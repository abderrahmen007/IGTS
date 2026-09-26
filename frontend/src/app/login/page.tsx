"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Field, Input, cn } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api, ApiError } from "@/lib/api";
import { getSession, saveSession, type AccountType, type SessionUser } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [type, setType] = useState<AccountType>("company");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getSession()) router.replace("/dashboard");
    if (new URLSearchParams(window.location.search).get("expired")) {
      setNotice("Votre session a expiré. Veuillez vous reconnecter.");
    }
  }, [router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await api<{ access_token: string; user: SessionUser }>(`/auth/${type}/login`, {
        method: "POST",
        body: { email: email.trim(), password },
        auth: false,
      });
      saveSession({ token: res.access_token, user: res.user });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion impossible.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Brand panel */}
      <aside className="relative hidden w-[44%] max-w-[620px] flex-col justify-between bg-brand-900 p-12 text-white lg:flex">
        <Image src="/brand/igts-veille-white.png" alt="IGTS Veille" width={148} height={103} loading="eager" />

        <div className="max-w-md">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
            Veille réglementaire
            <br />
            santé, sécurité, environnement.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            Retrouvez les textes applicables à votre activité, évaluez votre conformité et suivez vos plans
            d’action, au même endroit.
          </p>

          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-white/15 pt-6">
            {[
              ["Textes", "suivis et résumés"],
              ["Conformité", "évaluée texte par texte"],
              ["Actions", "suivies jusqu’à clôture"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm font-semibold">{k}</dt>
                <dd className="mt-1 text-[13px] leading-snug text-white/60">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-xs text-white/45">
          © {new Date().getFullYear()} IGTS — International Gold Training &amp; Services
        </p>
      </aside>

      {/* Form */}
      <main className="flex flex-1 items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[380px]">
          <Image
            src="/brand/igts-veille.png"
            alt="IGTS Veille"
            width={112}
            height={78}
            loading="eager"
            className="mb-10 lg:hidden"
          />

          <h2 className="text-2xl font-semibold tracking-tight text-ink-950">Connexion</h2>
          <p className="mt-1.5 text-sm text-ink-600">Accédez à votre espace de veille.</p>

          <div
            role="tablist"
            aria-label="Type de compte"
            className="mt-8 grid grid-cols-2 rounded-md border border-ink-200 bg-ink-50 p-0.5"
          >
            {(
              [
                ["company", "Entreprise"],
                ["admin", "Administration IGTS"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={type === value}
                onClick={() => {
                  setType(value);
                  setError(null);
                }}
                className={cn(
                  "h-8 rounded-[5px] text-[13px] font-medium transition-colors",
                  type === value ? "bg-white text-ink-900 shadow-sm ring-1 ring-ink-200" : "text-ink-600 hover:text-ink-900",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {(error || notice) && (
              <div
                role="alert"
                className={cn(
                  "flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[13px]",
                  error ? "border-bad-100 bg-bad-50 text-bad-700" : "border-info-100 bg-info-50 text-info-700",
                )}
              >
                <Icon name={error ? "alert" : "info"} size={15} className="mt-0.5 shrink-0" />
                {error ?? notice}
              </div>
            )}

            <Field label="Adresse e-mail" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@entreprise.tn"
                className="h-10"
              />
            </Field>

            <Field label="Mot de passe" htmlFor="password">
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 px-3 text-[13px] font-medium text-ink-600 hover:text-ink-900"
                >
                  {showPassword ? "Masquer" : "Afficher"}
                </button>
              </div>
            </Field>

            <Button type="submit" loading={loading} disabled={!email || !password} className="h-10 w-full">
              Se connecter
            </Button>
          </form>

          <p className="mt-8 border-t border-ink-150 pt-6 text-[13px] leading-relaxed text-ink-500">
            Mot de passe oublié ou accès à créer ? Contactez votre conseiller IGTS.
          </p>
        </div>
      </main>
    </div>
  );
}
