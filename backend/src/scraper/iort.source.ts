import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';
import { isPdf } from './pdf-pages';

/** One issue of the "Journal officiel lois, décrets et arrêtés". */
export interface JortIssue {
  /** "2026-099" */
  key: string;
  numero: string;
  /** "09/10/2026" as shown on the site */
  date: string;
  /** "JORT n° 099 du 09/10/2026" */
  label: string;
  /** Row of the issue in the site's result list (needed to download it) */
  row: number;
}

interface WebDevPage {
  url: string;
  html: string;
  $: cheerio.CheerioAPI;
  /** Form action: the page URL with its session context */
  action: string;
  fields: URLSearchParams;
}

const DEFAULT_URL = 'https://www.iort.tn/siteiort/';
const ISSUE_RE =
  /JORT\s*n[°o]\s*:?\s*(\d{1,4})\s*du\s*(\d{2})\/(\d{2})\/(\d{4})/i;

export class IortError extends Error {}

/**
 * Client for www.iort.tn (Imprimerie Officielle), a WEBDEV 30 site:
 *  - the session context is part of every page URL, the page form posts back
 *    to it, and a click is a POST with WD_BUTTON_CLICK_=<alias>;
 *  - the layout is chosen from the "wbNavigateurLargeur" cookie, which a
 *    browser sets with JavaScript: without it the site answers with an error.
 *
 * Path followed (checked on 09/10/2026):
 *   home (Arabic) → "Français" → menu "Recherche journal", which lists the
 *   latest issues → "Téléchargement" on a row returns the French PDF.
 * Links are found by their labels, with the aliases seen that day as fallback.
 */
@Injectable()
export class IortSource {
  private readonly logger = new Logger(IortSource.name);
  private readonly startUrl: string;
  private readonly userAgent: string;
  private cookies = new Map<string, string>();
  /** Receives a human-readable trace of the visit, saved with each run */
  private log: (step: string) => void = () => undefined;

  constructor(config: ConfigService) {
    this.startUrl = config.get<string>('IORT_URL')?.trim() || DEFAULT_URL;
    this.userAgent =
      config.get<string>('SCRAPER_USER_AGENT')?.trim() ||
      'Mozilla/5.0 (compatible; IGTS-Veille/1.0; veille réglementaire; +https://veille.inter-gts.com)';
  }

  /** Opens a fresh session and returns the issues listed by the site (newest first). */
  async latestIssues(
    log: (step: string) => void = () => undefined,
  ): Promise<{ issues: JortIssue[]; page: WebDevPage }> {
    this.log = log;
    this.cookies = new Map([['wbNavigateurLargeur', '1440']]);

    let page = await this.get(this.startUrl);
    this.step(
      `Accueil ouvert (${page.$('title').text().trim() || 'sans titre'})`,
    );

    const fr = this.aliasByLabel(page, /^fran[cç]ais$/i, '_JSL') ?? 'M4';
    page = await this.click(page, fr);
    this.step(`Passage en français (${fr})`);

    const menu =
      this.aliasByLabel(page, /^recherche journal$/i, '_JEM') ?? 'M64';
    page = await this.get(`${page.action}?WD_ACTION_=MENU&ID=${menu}`);
    this.step(`Page « Recherche journal » ouverte (${menu})`);

    const issues = this.listIssues(page);
    if (!issues.length) {
      throw new IortError(
        'Aucun numéro du JORT n’apparaît sur la page « Recherche journal » : le site a peut-être changé.',
      );
    }
    this.step(`Numéros listés : ${issues.map((i) => i.numero).join(', ')}`);
    return { issues, page };
  }

  /** Downloads the French PDF of an issue listed on `page`. */
  async download(page: WebDevPage, issue: JortIssue): Promise<Buffer> {
    const row = page
      .$(`[id^="zrl_${issue.row}_"]`)
      .filter((_, el) => /t[ée]l[ée]chargement/i.test(page.$(el).text()));
    const onclick = row.first().attr('onclick') ?? '';
    const alias = /_JSL\(_PAGE_,'(\w+)'/.exec(onclick)?.[1] ?? 'A30';
    const looper =
      /oGetObjetChamp\('(\w+)'\)\.OnSelectLigne/.exec(onclick)?.[1] ?? 'A4';

    const fields = new URLSearchParams(page.fields);
    fields.set(looper, String(issue.row));
    const res = await this.request(page.action, {
      method: 'POST',
      fields,
      click: alias,
    });
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!isPdf(buffer)) {
      throw new IortError(
        `Le téléchargement du ${issue.label} n’a pas renvoyé de PDF.`,
      );
    }
    this.step(
      `${issue.label} téléchargé (${Math.round(buffer.length / 1024)} Ko)`,
    );
    return buffer;
  }

  // ─── Parsing ────────────────────────────────────────────────────────

  listIssues(page: WebDevPage): JortIssue[] {
    const issues: JortIssue[] = [];
    page.$('a[id^="zrl_"]').each((_, el) => {
      const text = page.$(el).text().replace(/\s+/g, ' ').trim();
      const m = ISSUE_RE.exec(text);
      const row = /^zrl_(\d+)_/.exec(page.$(el).attr('id') ?? '')?.[1];
      if (!m || !row) return;
      const [, numero, dd, mm, yyyy] = m;
      const num = numero.padStart(3, '0');
      if (issues.some((i) => i.key === `${yyyy}-${num}`)) return;
      issues.push({
        key: `${yyyy}-${num}`,
        numero: num,
        date: `${dd}/${mm}/${yyyy}`,
        label: `JORT n° ${num} du ${dd}/${mm}/${yyyy}`,
        row: Number(row),
      });
    });
    return issues.sort((a, b) => b.key.localeCompare(a.key));
  }

  /** Alias of the link whose label matches (from its onclick handler). */
  private aliasByLabel(
    page: WebDevPage,
    label: RegExp,
    fn: '_JSL' | '_JEM',
  ): string | null {
    let alias: string | null = null;
    page.$('a').each((_, el) => {
      if (alias) return;
      const a = page.$(el);
      if (!label.test(a.text().replace(/\s+/g, ' ').trim())) return;
      const re = fn === '_JSL' ? /_JSL\(_PAGE_,'(\w+)'/ : /_JEM\('(\w+)'/;
      alias = re.exec(a.attr('onclick') ?? '')?.[1] ?? null;
    });
    return alias;
  }

  // ─── HTTP ───────────────────────────────────────────────────────────

  private step(s: string) {
    this.log(s);
    this.logger.log(`IORT : ${s}`);
  }

  private async get(url: string): Promise<WebDevPage> {
    const res = await this.request(url, { method: 'GET' });
    return this.parse(res.url || url, await res.text());
  }

  private async click(page: WebDevPage, alias: string): Promise<WebDevPage> {
    const res = await this.request(page.action, {
      method: 'POST',
      fields: new URLSearchParams(page.fields),
      click: alias,
    });
    return this.parse(res.url || page.action, await res.text());
  }

  private parse(url: string, html: string): WebDevPage {
    const $ = cheerio.load(html);
    if (
      /Error opening the|ERR_BAD_CONTEXT|Erreur d'ouverture|a rencontré l'erreur suivante/i.test(
        $('body').text(),
      )
    ) {
      throw new IortError(
        `Le site de l’IORT a renvoyé une erreur : ${$('body').text().replace(/\s+/g, ' ').trim().slice(0, 160)}`,
      );
    }
    const form = $('form').first();
    const action = form.attr('action');
    if (!action)
      throw new IortError(
        'Page de l’IORT inattendue (formulaire introuvable).',
      );
    const fields = new URLSearchParams();
    form.find('input, select, textarea').each((_, el) => {
      const e = $(el);
      const name = e.attr('name');
      if (!name) return;
      const type = (e.attr('type') ?? '').toLowerCase();
      if (
        (type === 'checkbox' || type === 'radio') &&
        e.attr('checked') === undefined
      )
        return;
      if (el.tagName === 'select') {
        const selected = e.find('option[selected]').first();
        fields.append(
          name,
          (selected.length ? selected : e.find('option').first()).attr(
            'value',
          ) ?? '',
        );
      } else {
        fields.append(name, e.attr('value') ?? e.text() ?? '');
      }
    });
    return { url, html, $, action: new URL(action, url).toString(), fields };
  }

  private async request(
    url: string,
    opts: { method: 'GET' | 'POST'; fields?: URLSearchParams; click?: string },
  ): Promise<Response> {
    // One request at a time, with a pause: the site is a public service
    await new Promise((r) => setTimeout(r, 1200));
    const body = opts.fields ? new URLSearchParams(opts.fields) : undefined;
    if (body) {
      body.set('WD_BUTTON_CLICK_', opts.click ?? '');
      body.set('WD_ACTION_', '');
    }
    let res: Response;
    try {
      res = await fetch(url, {
        method: opts.method,
        headers: {
          'User-Agent': this.userAgent,
          'Accept-Language': 'fr-FR,fr;q=0.9',
          Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
          ...(body
            ? { 'Content-Type': 'application/x-www-form-urlencoded' }
            : {}),
        },
        body: body?.toString(),
        redirect: 'follow',
        signal: AbortSignal.timeout(90_000),
      });
    } catch (e) {
      throw new IortError(
        `Le site de l’IORT ne répond pas (${(e as Error).message}).`,
      );
    }
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      if (i > 0)
        this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    if (!res.ok)
      throw new IortError(
        `Le site de l’IORT a répondu ${res.status} (${new URL(url).pathname}).`,
      );
    return res;
  }
}
