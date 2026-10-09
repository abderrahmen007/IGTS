import type { EmailContent } from '../notifications/email-templates';

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export interface DraftEmailItem {
  titre: string;
  summary: string;
  classement: string;
  confidence: number;
  needsReview: string[];
  companies: number;
  validateUrl: string;
  reviewUrl: string;
}

function shell(preheader: string, body: string): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IGTS Veille</title></head>
<body style="margin:0;padding:0;background:#f7f7f9;font-family:Arial,Helvetica,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f9;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e3e4e9">
      <tr><td style="background:#1c076c;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:.5px">IGTS <span style="font-weight:normal">Veille</span> <span style="font-weight:normal;font-size:13px;color:#c9c3f2">· administration</span></td></tr>
      <tr><td style="padding:28px">${body}</td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid #e3e4e9;font-size:12px;line-height:18px;color:#9699aa">
        Vous recevez cet e-mail car vous administrez la veille réglementaire IGTS.<br>
        Les liens de validation sont personnels et valables 14 jours. Ne les transférez pas.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

const button = (label: string, url: string, primary: boolean) =>
  `<td style="border-radius:6px;${primary ? 'background:#1c076c' : 'border:1px solid #c9c7d6'}">
    <a href="${esc(url)}" style="display:inline-block;padding:10px 18px;font-size:14px;font-weight:bold;color:${primary ? '#ffffff' : '#1c076c'};text-decoration:none">${esc(label)}</a>
  </td>`;

/** Sent after each collection that found texts: one block per draft, with its own buttons. */
export function newDraftsEmail(p: {
  name: string;
  issueLabels: string[];
  items: DraftEmailItem[];
  ignored: string;
  listUrl: string;
}): EmailContent {
  const n = p.items.length;
  const subject =
    n === 1
      ? `1 nouveau texte à valider (${p.issueLabels.join(', ')})`
      : `${n} nouveaux textes à valider (${p.issueLabels.join(', ')})`;

  const blocks = p.items
    .map((i) => {
      const pct = Math.round(i.confidence * 100);
      const review = i.needsReview.length
        ? `<p style="margin:10px 0 0;font-size:13px;line-height:19px;color:#8a4b00;background:#fff4e0;border-radius:6px;padding:8px 10px">À vérifier : ${esc(i.needsReview.join(' · '))}</p>`
        : '';
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;border:1px solid #e3e4e9;border-radius:8px">
        <tr><td style="padding:16px 18px">
          <p style="margin:0 0 6px;font-size:12px;color:#74778b;text-transform:uppercase;letter-spacing:.4px">${esc(i.classement)} · confiance ${pct} %</p>
          <p style="margin:0;font-size:15px;line-height:21px;font-weight:bold;color:#171a2b">${esc(i.titre)}</p>
          <p style="margin:8px 0 0;font-size:14px;line-height:21px;color:#414458">${esc(i.summary)}</p>
          ${review}
          <p style="margin:10px 0 0;font-size:13px;color:#74778b">${i.companies ? `Sera envoyé à ${i.companies} entreprise(s) abonnée(s) à ce thème.` : 'Aucune entreprise n’est encore abonnée à ce thème.'}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 0"><tr>
            ${button('Valider et publier', i.validateUrl, true)}
            <td style="width:10px"></td>
            ${button('Vérifier d’abord', i.reviewUrl, false)}
          </tr></table>
        </td></tr>
      </table>`;
    })
    .join('');

  const body = `
    <p style="margin:0 0 12px;font-size:16px;color:#171a2b">Bonjour ${esc(p.name)},</p>
    <p style="margin:0;font-size:15px;line-height:23px;color:#414458">
      La collecte de ce matin a lu le ${esc(p.issueLabels.join(' et le '))}.
      ${n === 1 ? 'Un texte concerne' : `${n} textes concernent`} la veille de vos clients. L’IA a préparé ${n === 1 ? 'sa fiche' : 'leurs fiches'} (classement, résumé, PDF) : il ne reste qu’à valider.
    </p>
    ${blocks}
    ${p.ignored ? `<p style="margin:18px 0 0;font-size:13px;line-height:20px;color:#74778b">Textes écartés par l’IA : ${esc(p.ignored)}.</p>` : ''}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 0"><tr>${button('Voir tous les brouillons', p.listUrl, false)}</tr></table>`;

  const text = [
    `Bonjour ${p.name},`,
    '',
    `La collecte de ce matin a lu le ${p.issueLabels.join(' et le ')}. ${n} texte(s) à valider :`,
    ...p.items.map(
      (i) =>
        `\n- ${i.titre}\n  ${i.summary}\n  Valider et publier : ${i.validateUrl}\n  Vérifier d’abord : ${i.reviewUrl}`,
    ),
    '',
    `Tous les brouillons : ${p.listUrl}`,
  ].join('\n');

  return { subject, html: shell(subject, body), text };
}

/** Sent when the scheduled collection fails, so that nobody relies on a silent robot. */
export function collectFailedEmail(p: {
  name: string;
  message: string;
  statusUrl: string;
}): EmailContent {
  const subject = 'La collecte du JORT de ce matin a échoué';
  const body = `
    <p style="margin:0 0 12px;font-size:16px;color:#171a2b">Bonjour ${esc(p.name)},</p>
    <p style="margin:0;font-size:15px;line-height:23px;color:#414458">La collecte automatique du Journal officiel n’a pas pu aboutir :</p>
    <p style="margin:12px 0 0;font-size:14px;line-height:21px;color:#8a1f11;background:#fdecea;border-radius:6px;padding:10px 12px">${esc(p.message)}</p>
    <p style="margin:12px 0 0;font-size:14px;line-height:21px;color:#414458">Vous pouvez relancer la collecte ou importer le PDF du JORT depuis la plateforme.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 0"><tr>${button('Ouvrir la veille automatique', p.statusUrl, true)}</tr></table>`;
  return {
    subject,
    html: shell(subject, body),
    text: `Bonjour ${p.name},\n\nLa collecte automatique du JORT a échoué : ${p.message}\n\n${p.statusUrl}`,
  };
}
