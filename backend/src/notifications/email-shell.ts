/**
 * Shared frame of the IGTS e-mails (table layout and inline styles, for
 * Outlook, Gmail and phones). Templates only write their body.
 */

export const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function emailButton(
  label: string,
  url: string,
  primary = true,
): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr>
    <td style="border-radius:6px;${primary ? 'background:#1c076c' : 'border:1px solid #c9c7d6'}">
      <a href="${esc(url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:bold;color:${primary ? '#ffffff' : '#1c076c'};text-decoration:none">${esc(label)}</a>
    </td></tr></table>`;
}

export const p = (html: string, style = '') =>
  `<p style="margin:0 0 12px;font-size:15px;line-height:23px;color:#414458;${style}">${html}</p>`;

export function emailShell(opts: {
  preheader: string;
  body: string;
  footer: string;
  badge?: string;
}): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IGTS Veille</title></head>
<body style="margin:0;padding:0;background:#f7f7f9;font-family:Arial,Helvetica,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f9;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e3e4e9">
      <tr><td style="background:#1c076c;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:.5px">IGTS <span style="font-weight:normal">Veille</span>${opts.badge ? ` <span style="font-weight:normal;font-size:13px;color:#c9c3f2">· ${esc(opts.badge)}</span>` : ''}</td></tr>
      <tr><td style="padding:28px">${opts.body}</td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid #e3e4e9;font-size:12px;line-height:18px;color:#9699aa">${opts.footer}</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export const CLIENT_FOOTER =
  'Vous recevez cet e-mail car votre entreprise est abonnée à la veille réglementaire IGTS.<br>IGTS — International Gold Training &amp; Services';
export const ADMIN_FOOTER =
  'Vous recevez cet e-mail car vous administrez la veille réglementaire IGTS.';
