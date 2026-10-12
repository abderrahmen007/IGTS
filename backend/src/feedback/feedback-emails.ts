import type { EmailContent } from '../notifications/email-templates';
import {
  CLIENT_FOOTER,
  emailButton,
  emailShell,
  esc,
  p,
} from '../notifications/email-shell';

export function feedbackInviteEmail(o: {
  name: string;
  title: string;
  closesOn: string;
  url: string;
}): EmailContent {
  const subject = `${o.title} : votre avis sur la veille IGTS`;
  const body =
    p(`Bonjour ${esc(o.name)},`, 'font-size:16px;color:#171a2b') +
    p(
      'Comme chaque année, IGTS vous demande votre avis sur la veille réglementaire : la pertinence des textes, les résumés, la plateforme et notre accompagnement.',
    ) +
    p(
      `Cela prend deux minutes, jusqu’au <b>${esc(o.closesOn)}</b>. Vos réponses nous aident directement à améliorer le service.`,
    ) +
    emailButton('Donner mon avis', o.url);
  return {
    subject,
    html: emailShell({ preheader: subject, body, footer: CLIENT_FOOTER }),
    text: `Bonjour ${o.name},\n\n${o.title} : donnez votre avis sur la veille IGTS (2 minutes, jusqu’au ${o.closesOn}).\n\n${o.url}`,
  };
}
