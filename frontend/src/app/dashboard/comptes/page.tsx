"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, cn, td, th } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { PasswordModal } from "@/components/admin/company-users";
import { useApi } from "@/lib/use-api";
import { relativeTime } from "@/lib/format";

interface PendingAccount {
  id: number;
  nom: string;
  email: string;
  fonction: string | null;
  companyId: number;
  company: string;
  requestedBy: string;
  requestedAt: string;
}

/**
 * Accounts that companies added for their colleagues. Passwords are managed by
 * IGTS only: an administrator sets each one, which switches the account on and
 * welcomes the person by e-mail.
 */
export default function PendingAccountsPage() {
  const { data, error, loading, reload } = useApi<PendingAccount[]>("/admin/accounts/pending");
  const [activating, setActivating] = useState<PendingAccount | null>(null);

  return (
    <>
      <PageHeader
        title="Comptes à activer"
        description="Collègues ajoutés par les entreprises. Définissez leur mot de passe pour ouvrir l’accès, puis transmettez-le à la personne."
      />
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <Skeleton className="h-48 rounded-[20px]" />}
      {data && (
        <Card>
          {data.length === 0 ? (
            <EmptyState icon="users" title="Aucun compte en attente" description="Les nouveaux comptes ajoutés par les entreprises apparaîtront ici." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-ink-150 bg-ink-50/60">
                  <tr>
                    <th className={th}>Personne</th>
                    <th className={th}>Entreprise</th>
                    <th className={th}>Demandé</th>
                    <th className={th}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-150">
                  {data.map((a) => (
                    <tr key={a.id}>
                      <td className={td}>
                        <p className="font-medium text-ink-900">{a.nom}</p>
                        <p className="text-[13px] text-ink-500">
                          {a.email}
                          {a.fonction ? ` · ${a.fonction}` : ""}
                        </p>
                      </td>
                      <td className={td}>
                        <Link href={`/dashboard/companies/${a.companyId}?tab=utilisateurs`} className="font-medium text-brand-700 hover:underline">
                          {a.company}
                        </Link>
                      </td>
                      <td className={cn(td, "text-ink-600")}>
                        {relativeTime(a.requestedAt)} par {a.requestedBy}
                      </td>
                      <td className={cn(td, "text-right")}>
                        <Button size="sm" onClick={() => setActivating(a)}>
                          Activer
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      {activating && (
        <PasswordModal
          accountId={activating.id}
          name={activating.nom}
          activate
          open
          onClose={() => setActivating(null)}
          onDone={() => void reload()}
        />
      )}
    </>
  );
}
