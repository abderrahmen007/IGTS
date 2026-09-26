/**
 * IGTS-branded e-mail templates (French). Table-based layout with inline styles
 * so they render correctly in Outlook, Gmail and mobile clients.
 */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

function layout(opts: {
  preheader: string;
  greeting: string;
  intro: string;
  items?: string[];
  more?: number;
  cta: { label: string; url: string };
  outro?: string;
}): string {
  const list = opts.items?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #e3e4e9;border-radius:8px">
        ${opts.items
          .map(
            (i, idx) =>
              `<tr><td style="padding:12px 16px;font-size:14px;line-height:20px;color:#171a2b;${idx ? 'border-top:1px solid #e3e4e9;' : ''}">${esc(i)}</td></tr>`,
          )
          .join('')}
        ${opts.more ? `<tr><td style="padding:10px 16px;border-top:1px solid #e3e4e9;font-size:13px;color:#74778b">… et ${opts.more} autre(s)</td></tr>` : ''}
      </table>`
    : '';

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IGTS Veille</title></head>
<body style="margin:0;padding:0;background:#f7f7f9;font-family:Arial,Helvetica,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f9;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e3e4e9">
      <tr><td style="background:#1c076c;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:.5px">IGTS <span style="font-weight:normal">Veille</span></td></tr>
      <tr><td style="padding:28px">
        <p style="margin:0 0 12px;font-size:16px;color:#171a2b">${esc(opts.greeting)}</p>
        <p style="margin:0;font-size:15px;line-height:23px;color:#414458">${opts.intro}</p>
        ${list}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px"><tr><td style="border-radius:6px;background:#1c076c">
          <a href="${esc(opts.cta.url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none">${esc(opts.cta.label)}</a>
        </td></tr></table>
        ${opts.outro ? `<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:#74778b">${opts.outro}</p>` : ''}
      </td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid #e3e4e9;font-size:12px;line-height:18px;color:#9699aa">
        Vous recevez cet e-mail car votre entreprise est abonnée à la veille réglementaire IGTS.<br>
        IGTS — International Gold Training &amp; Services
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function textVersion(lines: string[]) {
  return lines.filter(Boolean).join('\n\n') + '\n\n— IGTS Veille';
}

export function newTextsEmail(p: { name: string; titles: string[]; appUrl: string }): EmailContent {
  const n = p.titles.length;
  const shown = p.titles.slice(0, 8);
  const subject = n === 1 ? 'Un nouveau texte dans votre veille réglementaire' : `${n} nouveaux textes dans votre veille réglementaire`;
  const url = `${p.appUrl}/dashboard/evaluations`;
  return {
    subject,
    html: layout({
      preheader: shown[0] ?? subject,
      greeting: `Bonjour ${p.name},`,
      intro:
        n === 1
          ? 'Un nouveau texte réglementaire concernant votre activité vient d’être ajouté à votre veille. Prenez quelques minutes pour indiquer s’il vous concerne.'
          : `<strong>${n} nouveaux textes</strong> réglementaires concernant votre activité viennent d’être ajoutés à votre veille. Prenez quelques minutes pour indiquer s’ils vous concernent.`,
      items: shown,
      more: n - shown.length,
      cta: { label: 'Évaluer maintenant', url },
    }),
    text: textVersion([`Bonjour ${p.name},`, subject + ' :', shown.map((t) => `• ${t}`).join('\n'), `Évaluer : ${url}`]),
  };
}

export function deadlinesEmail(p: {
  name: string;
  items: { label: string; when: string }[];
  appUrl: string;
}): EmailContent {
  const late = p.items.filter((i) => i.when === 'en retard').length;
  const subject = late ? `${late} action(s) en retard dans votre plan d’action` : 'Rappel : actions à clôturer prochainement';
  const url = `${p.appUrl}/dashboard/actions`;
  const lines = p.items.map((i) => `${i.label} — ${i.when}`);
  return {
    subject,
    html: layout({
      preheader: subject,
      greeting: `Bonjour ${p.name},`,
      intro: 'Voici les actions de votre plan d’action qui arrivent à échéance ou qui sont en retard :',
      items: lines,
      cta: { label: 'Voir mes actions', url },
      outro: 'Pensez à mettre à jour le statut et l’effectivité de chaque action une fois réalisée.',
    }),
    text: textVersion([`Bonjour ${p.name},`, subject, lines.map((l) => `• ${l}`).join('\n'), `Voir : ${url}`]),
  };
}
