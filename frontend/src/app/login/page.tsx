"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Field, Input, cn } from "@/components/ui";
import { Icon } from "@/components/icons";
import { motion, useReducedMotion } from "motion/react";
import { AnimatedContent } from "@/components/reactbits/animated-content";
import { BlurText } from "@/components/reactbits/blur-text";
import { Prism } from "@/components/reactbits/prism";
import { RotatingText } from "@/components/reactbits/rotating-text";
import { spotlight } from "@/components/reactbits/spotlight-card";
import { StarBorder } from "@/components/reactbits/star-border";
import { ProductPreview } from "@/components/login/product-preview";
import { useMediaQuery } from "@/lib/use-media-query";
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
  const reduce = useReducedMotion();
  // Short screens: a smaller prism, higher up, and two notifications
  const short = useMediaQuery("(max-height: 820px)");

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
    <div className="relative isolate flex min-h-screen overflow-hidden bg-[#fbfaf7]">
      {/* The whole page sits on the blurred prism of light */}
      <Prism className="fixed inset-0 -z-10 h-screen w-screen" />

      <div className="mx-auto flex w-full max-w-[1240px] flex-1 items-center gap-16 px-5 py-10 sm:px-10 lg:px-14">
        {/* Brand */}
        <section className="hidden min-w-0 flex-1 flex-col lg:flex">
          <Image src="/brand/igts-veille.png" alt="IGTS Veille" width={132} height={92} loading="eager" />
          <h1 className={cn("font-serif font-semibold leading-[1.1] text-ink-900", short ? "mt-8 text-[40px]" : "mt-14 text-[46px]")}>
            <BlurText text="Veille réglementaire" />
            <br />
            <RotatingText
              words={["santé et sécurité", "environnement", "qualité", "énergie"]}
              className="mt-2 rounded-xl bg-saffron-500 px-3 pb-1 text-[#2b1700]"
            />
          </h1>
          <AnimatedContent delay={0.35} distance={10}>
            <p className="mt-5 max-w-[460px] text-[16px] leading-relaxed text-ink-700">
              Les textes applicables à votre activité, votre conformité et vos plans d’action, au même endroit.
            </p>
          </AnimatedContent>
          <ProductPreview className={cn("max-w-[440px]", short ? "mt-6" : "mt-9")} count={short ? 2 : 3} />
          <p className="mt-10 text-xs text-ink-500">© {new Date().getFullYear()} IGTS — International Gold Training &amp; Services</p>
        </section>

        {/* Form */}
        <main className="flex w-full justify-center lg:w-auto">
        <motion.div
          className="w-full max-w-[420px]"
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.165, 0.84, 0.44, 1] }}
        >
        <StarBorder className="rounded-[26px]">
        <div className="glass spotlight w-full rounded-[26px] px-7 py-9 sm:px-9" {...spotlight("rgb(130 121 223 / 0.14)")}>
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
          <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-600 lg:hidden">
            Veille
            <RotatingText words={["santé et sécurité", "environnement", "qualité", "énergie"]} className="rounded-lg bg-saffron-100 px-2 font-semibold text-saffron-700" />
          </p>

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
        </StarBorder>
        </motion.div>
        </main>
      </div>
    </div>
  );
}
