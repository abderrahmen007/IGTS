import type { EmailContent } from '../notifications/email-templates';
import {
  CLIENT_FOOTER,
  emailButton,
  emailShell,
  esc,
  p,
} from '../notifications/email-shell';

export interface ReminderLine {
  /** What is due (« Visite technique — Camion Isuzu », or an action) */
  label: string;
  /** « en retard de 9 jours », « dans 7 jours », « aujourd’hui » */
  when: string;
  late: boolean;
  /** Optional second line (legal text, responsible person…) */
  detail?: string | null;
}

function list(title: string, lines: ReminderLine[]): string {
  if (!lines.length) return '';
  const rows = lines
    .map(
      (
        l,
        i,
      ) => `<tr><td style="padding:12px 16px;${i ? 'border-top:1px solid #e3e4e9;' : ''}">
        <div style="font-size:14px;line-height:20px;color:#171a2b">${esc(l.label)}</div>
        <div style="font-size:13px;line-height:19px;font-weight:bold;color:${l.late ? '#b42318' : '#8a5300'}">${esc(l.when)}</div>
        ${l.detail ? `<div style="font-size:12.5px;line-height:18px;color:#66647c">${esc(l.detail)}</div>` : ''}
      </td></tr>`,
    )
    .join('');
  return `<p style="margin:22px 0 8px;font-size:13px;font-weight:bold;letter-spacing:.4px;text-transform:uppercase;color:#66647c">${esc(title)}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3e4e9;border-radius:8px">${rows}</table>`;
}

/**
 * Daily digest of what is due: regular checks and renewals, then the actions
 * of the action plan. Sent to the main account (everything) and to each
 * person named responsible (only their own lines).
 */
export function remindersEmail(o: {
  name: string;
  company: string;
  /** True for a person named responsible (not the main account) */
  asResponsible: boolean;
  items: ReminderLine[];
  actions: ReminderLine[];
  appUrl: string;
}): EmailContent {
  const all = [...o.items, ...o.actions];
  const late = all.filter((l) => l.late).length;
  const subject = late
    ? `${late} échéance${late > 1 ? 's' : ''} en retard${o.asResponsible ? '' : ` chez ${o.company}`}`
    : `Échéances à venir${o.asResponsible ? '' : ` chez ${o.company}`}`;
  const intro = o.asResponsible
    ? `Vous êtes indiqué(e) comme responsable de ces échéances chez <b>${esc(o.company)}</b> :`
    : 'Voici ce qui arrive à échéance ou qui est en retard :';
  const body =
    p(`Bonjour ${esc(o.name)},`, 'font-size:16px;color:#171a2b') +
    p(intro) +
    list('Contrôles et renouvellements', o.items) +
    list('Plan d’action', o.actions) +
    (o.items.length
      ? emailButton('Voir les échéances', `${o.appUrl}/dashboard/echeances`)
      : '') +
    (o.actions.length
      ? emailButton(
          'Voir le plan d’action',
          `${o.appUrl}/dashboard/actions`,
          !o.items.length,
        )
      : '') +
    p(
      'Une fois le contrôle fait ou le document renouvelé, indiquez-le sur la plateforme : la prochaine échéance se calcule seule.',
      'margin-top:18px;font-size:13.5px;color:#66647c',
    );
  const text = [
    `Bonjour ${o.name},`,
    o.asResponsible
      ? `Vous êtes indiqué(e) comme responsable de ces échéances chez ${o.company} :`
      : 'Voici ce qui arrive à échéance ou qui est en retard :',
    ...(o.items.length
      ? [
          '\nContrôles et renouvellements',
          ...o.items.map((l) => `• ${l.label} — ${l.when}`),
        ]
      : []),
    ...(o.actions.length
      ? ['\nPlan d’action', ...o.actions.map((l) => `• ${l.label} — ${l.when}`)]
      : []),
    `\n${o.appUrl}/dashboard/echeances`,
  ].join('\n');
  return {
    subject,
    html: emailShell({ preheader: subject, body, footer: CLIENT_FOOTER }),
    text,
  };
}
