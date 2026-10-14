"use client";

import Link from "next/link";
import { EcheancesBoard } from "@/components/echeances/echeances-board";
import { Icon } from "@/components/icons";
import { useMeOptional } from "@/components/me-context";
import { useUser } from "@/components/session-context";
import { LockedNote, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";

/**
 * Regular checks and renewals (supervisor's notes, 10/2026): vehicles,
 * regulatory checks, certificates, approvals, insurance… with reminders.
 * A company sees its own; IGTS sees every client's.
 */
export default function EcheancesPage() {
  const user = useUser();
  const me = useMeOptional();
  const admin = user.type === "admin";
  const canEdit = admin || (me?.canEdit ?? true);

  return (
    <>
      <PageHeader
        eyebrow={admin ? "Administration IGTS" : undefined}
        title={admin ? "Échéances des clients" : "Échéances"}
        description={
          admin
            ? "Contrôles, visites et renouvellements suivis par vos clients. Ouvrez une entreprise pour ajouter ou corriger ses échéances."
            : "Ce que votre entreprise doit renouveler ou faire contrôler régulièrement. Vous êtes prévenu 30 et 7 jours avant, le jour même, puis chaque semaine en cas de retard."
        }
        actions={
          admin ? (
            <Button variant="outline" asChild>
              <Link href="/dashboard/echeances/catalogue">
                <Icon name="listChecks" size={16} />
                Types et textes de loi
              </Link>
            </Button>
          ) : undefined
        }
      />
      {!canEdit && (
        <div className="mb-5">
          <LockedNote>Votre compte est en lecture seule : vous voyez les échéances sans pouvoir les modifier.</LockedNote>
        </div>
      )}
      <EcheancesBoard mode={admin ? "admin" : "company"} canEdit={canEdit} />
    </>
  );
}
