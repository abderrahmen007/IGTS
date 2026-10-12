import type { EmailContent } from '../notifications/email-templates';
import {
  ADMIN_FOOTER,
  CLIENT_FOOTER,
  emailButton,
  emailShell,
  esc,
  p,
} from '../notifications/email-shell';

// ─── Subscription ───────────────────────────────────────────────────

export function subscriptionEndingEmail(o: {
  name: string;
  company: string;
  endLabel: string;
  daysLeft: number;
  appUrl: string;
}): EmailContent {
  const subject = `Votre abonnement IGTS Veille se termine le ${o.endLabel}`;
  const body =
    p(`Bonjour ${esc(o.name)},`, 'font-size:16px;color:#171a2b') +
    p(
      `L’abonnement de <b>${esc(o.company)}</b> à la veille réglementaire IGTS se termine le <b>${esc(o.endLabel)}</b>, dans ${o.daysLeft} jour${o.daysLeft > 1 ? 's' : ''}.`,
    ) +
    p(
      'Pour continuer à recevoir les nouveaux textes et garder l’accès à votre suivi de conformité, contactez IGTS pour le renouveler. Vos données sont conservées.',
    ) +
    emailButton('Ouvrir IGTS Veille', `${o.appUrl}/dashboard`);
  return {
    subject,
    html: emailShell({ preheader: subject, body, footer: CLIENT_FOOTER }),
    text: `Bonjour ${o.name},\n\nL’abonnement de ${o.company} à la veille IGTS se termine le ${o.endLabel} (dans ${o.daysLeft} jours). Contactez IGTS pour le renouveler.\n\n${o.appUrl}/dashboard`,
  };
}

export function subscriptionLockedEmail(o: {
  name: string;
  company: string;
  reason: string;
}): EmailContent {
  const subject = 'Votre accès à IGTS Veille est suspendu';
  const body =
    p(`Bonjour ${esc(o.name)},`, 'font-size:16px;color:#171a2b') +
    p(
      `L’accès de <b>${esc(o.company)}</b> à la veille réglementaire IGTS est suspendu : ${esc(o.reason)}.`,
    ) +
    p(
      'Vos textes, évaluations et plans d’action sont conservés. Contactez IGTS pour rétablir l’accès : il sera rouvert immédiatement.',
    );
  return {
    subject,
    html: emailShell({ preheader: subject, body, footer: CLIENT_FOOTER }),
    text: `Bonjour ${o.name},\n\nL’accès de ${o.company} à IGTS Veille est suspendu : ${o.reason}. Vos données sont conservées. Contactez IGTS pour le rétablir.`,
  };
}

export function adminSubscriptionsEmail(o: {
  name: string;
  ending: { company: string; endLabel: string; daysLeft: number }[];
  expired: { company: string; endLabel: string }[];
  url: string;
}): EmailContent {
  const n = o.ending.length + o.expired.length;
  const subject = `Abonnements : ${n} entreprise${n > 1 ? 's' : ''} à relancer`;
  const rows = [
    ...o.expired.map(
      (e) =>
        `<li style="margin:0 0 6px"><b>${esc(e.company)}</b> — expiré le ${esc(e.endLabel)}, accès bloqué</li>`,
    ),
    ...o.ending.map(
      (e) =>
        `<li style="margin:0 0 6px"><b>${esc(e.company)}</b> — se termine le ${esc(e.endLabel)} (J-${e.daysLeft})</li>`,
    ),
  ].join('');
  const body =
    p(`Bonjour ${esc(o.name)},`, 'font-size:16px;color:#171a2b') +
    p(
      'Ces abonnements arrivent à échéance. Une fois le paiement reçu, renouvelez-les en un clic depuis la fiche de l’entreprise.',
    ) +
    `<ul style="margin:0 0 8px;padding-left:20px;font-size:14px;line-height:21px;color:#171a2b">${rows}</ul>` +
    emailButton('Voir les abonnements', o.url);
  return {
    subject,
    html: emailShell({
      preheader: subject,
      body,
      footer: ADMIN_FOOTER,
      badge: 'administration',
    }),
    text: `${subject}\n\n${[...o.expired.map((e) => `- ${e.company} : expiré le ${e.endLabel}`), ...o.ending.map((e) => `- ${e.company} : fin le ${e.endLabel}`)].join('\n')}\n\n${o.url}`,
  };
}

// ─── Accounts created by a company, activated by IGTS ───────────────

export function accountRequestEmail(o: {
  name: string;
  member: string;
  memberEmail: string;
  company: string;
  requestedBy: string;
  canEdit: boolean;
  url: string;
}): EmailContent {
  const subject = `Compte à activer : ${o.member} (${o.company})`;
  const body =
    p(`Bonjour ${esc(o.name)},`, 'font-size:16px;color:#171a2b') +
    p(
      `<b>${esc(o.requestedBy)}</b> a ajouté un compte pour <b>${esc(o.member)}</b> (${esc(o.memberEmail)}) chez <b>${esc(o.company)}</b>, en ${o.canEdit ? 'lecture et modification' : 'lecture seule'}.`,
    ) +
    p(
      'Les mots de passe sont gérés par IGTS : définissez celui de ce compte pour l’activer, puis transmettez-le à la personne.',
    ) +
    emailButton('Activer le compte', o.url);
  return {
    subject,
    html: emailShell({
      preheader: subject,
      body,
      footer: ADMIN_FOOTER,
      badge: 'administration',
    }),
    text: `${subject}\n\n${o.requestedBy} a ajouté ${o.member} (${o.memberEmail}). Définissez son mot de passe pour activer le compte : ${o.url}`,
  };
}

export function accountActivatedEmail(o: {
  name: string;
  company: string;
  email: string;
  canEdit: boolean;
  appUrl: string;
}): EmailContent {
  const subject = 'Votre accès à IGTS Veille est prêt';
  const body =
    p(`Bonjour ${esc(o.name)},`, 'font-size:16px;color:#171a2b') +
    p(
      `Votre compte sur la veille réglementaire de <b>${esc(o.company)}</b> est actif, en ${o.canEdit ? 'lecture et modification' : 'lecture seule'}.`,
    ) +
    p(
      `Identifiant : <b>${esc(o.email)}</b>. Votre mot de passe vous est communiqué par IGTS ; pour le changer, adressez-vous à IGTS.`,
    ) +
    emailButton('Se connecter', `${o.appUrl}/login`);
  return {
    subject,
    html: emailShell({ preheader: subject, body, footer: CLIENT_FOOTER }),
    text: `Bonjour ${o.name},\n\nVotre compte IGTS Veille (${o.company}) est actif. Identifiant : ${o.email}. Votre mot de passe vous est communiqué par IGTS.\n\n${o.appUrl}/login`,
  };
}
