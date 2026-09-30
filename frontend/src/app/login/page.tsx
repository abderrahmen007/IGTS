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
    <div className="relative isolate flex min-h-screen overflow-hidden bg-paper">
      {/* Brand panel */}
      <aside className="zellige relative hidden w-[44%] max-w-[620px] flex-col justify-between overflow-hidden bg-brand-800 p-12 text-white lg:flex">
        <div
          aria-hidden="true"
          className="absolute -bottom-32 -right-24 h-[420px] w-[420px] rounded-full border-[70px] border-saffron-500 opacity-40 blur-[40px]"
        />
        <Image src="/brand/igts-veille-white.png" alt="IGTS Veille" width={148} height={103} loading="eager" />

        <div className="relative max-w-md">
          <h1 className="font-serif text-[34px] font-semibold leading-tight">
            Veille réglementaire
            <br />
            santé, sécurité, environnement.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-brand-100">
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
                <dd className="mt-1 text-[13px] leading-snug text-brand-100/80">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative text-xs text-brand-100/70">
          © {new Date().getFullYear()} IGTS — International Gold Training &amp; Services
        </p>
      </aside>

      {/* Form */}
      <main className="relative flex flex-1 items-center justify-center px-5 py-12 sm:px-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -right-40 -top-48 h-[560px] w-[560px] rounded-full border-[110px] border-brand-600 opacity-25 blur-[46px]" />
          <div className="absolute -bottom-40 left-10 h-[420px] w-[420px] rounded-full bg-saffron-500 opacity-20 blur-[90px]" />
        </div>
        <div className="glass w-full max-w-[420px] rounded-[26px] px-7 py-9 sm:px-9">
          <Image
            src="/brand/igts-veille.png"
            alt="IGTS Veille"
            width={112}
            height={78}
            loading="eager"
            className="mb-10 lg:hidden"
          />

          <h2 className="font-serif text-[30px] font-semibold text-ink-900">Connexion</h2>
          <p className="mt-1.5 text-sm text-ink-600">Accédez à votre espace de veille.</p>

          <div
            role="tablist"
            aria-label="Type de compte"
            className="mt-7 grid grid-cols-2 rounded-xl bg-ink-100 p-1"
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
                  "h-9 rounded-[9px] text-[13px] font-semibold transition-colors",
                  type === value ? "bg-white text-ink-900 shadow-[0_1px_2px_rgb(22_20_43/0.12)]" : "text-ink-600 hover:text-ink-900",
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
                  "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[13px]",
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

            <Button type="submit" size="lg" loading={loading} disabled={!email || !password} className="w-full">
              Se connecter
            </Button>
          </form>

          <p className="mt-7 border-t border-ink-150 pt-5 text-[13px] leading-relaxed text-ink-500">
            Mot de passe oublié ou accès à créer ? Contactez votre conseiller IGTS.
          </p>
        </div>
      </main>
    </div>
  );
}
