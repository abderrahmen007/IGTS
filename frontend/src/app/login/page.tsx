"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Field, Input, cn } from "@/components/ui";
import { Icon } from "@/components/icons";
import { RadarShowcase } from "@/components/login/radar-showcase";
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
    const params = new URLSearchParams(window.location.search);
    if (params.get("locked")) {
      setError(
        "L’accès de votre entreprise à IGTS Veille est fermé : l’abonnement a pris fin ou a été suspendu. Contactez IGTS pour le renouveler ; vos données sont conservées.",
      );
    } else if (params.get("expired")) {
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
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(700px_520px_at_18%_78%,rgb(90_79_208/0.16),transparent_70%),radial-gradient(560px_460px_at_62%_12%,rgb(227_163_59/0.18),transparent_70%),radial-gradient(520px_520px_at_96%_96%,rgb(90_79_208/0.14),transparent_70%)]" />
      </div>

      <div className="mx-auto flex w-full max-w-[1480px] items-center gap-14 px-5 py-10 sm:px-10 xl:px-[72px]">
        {/* The platform inside its watch radar */}
        <section className="hidden h-[calc(100vh-80px)] min-h-[640px] min-w-0 flex-1 flex-col xl:flex">
          <Image src="/brand/igts-veille.png" alt="IGTS Veille" width={120} height={83} loading="eager" />
          <h1 className="mt-9 font-serif text-[46px] font-semibold leading-[1.06] tracking-[-0.01em] text-ink-900 2xl:text-[50px]">
            Votre conformité,
            <br />
            <span className="text-brand-600">à jour chaque matin.</span>
          </h1>
          <p className="mt-5 max-w-[480px] text-[16px] leading-relaxed text-ink-600">
            Les textes qui concernent votre activité arrivent classés et résumés. Vous les évaluez, suivez vos actions et vos échéances, au
            même endroit.
          </p>
          <RadarShowcase className="mt-6 flex-1" />
        </section>

        {/* Form */}
        <main className="flex w-full justify-center xl:w-auto">
        <div className="glass w-full max-w-[420px] rounded-[26px] px-7 py-9 sm:px-9">
          <Image
            src="/brand/igts-veille.png"
            alt="IGTS Veille"
            width={112}
            height={78}
            loading="eager"
            className="mb-10 xl:hidden"
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
    </div>
  );
}
