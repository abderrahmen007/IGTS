import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IortSource } from './iort.source';
import { JortAnalyzerService, excludedScope } from './jort-analyzer.service';
import { DraftsService, normalizeTitle } from './drafts.service';
import { frenchDate } from './scraper.service';

const config = (values: Record<string, string>) =>
  ({ get: (k: string) => values[k] }) as unknown as ConfigService;

/** Excerpt of the "Recherche journal" page of www.iort.tn (09/10/2026). */
const RECHERCHE_JORT = `<!DOCTYPE html><html><body>
<form name="PAGE_RECHERCHEJORT" action="/siteiort/PAGE_RechercheJORT/aFIAABPJvpoBAAAAKQA" method="post">
<input type="hidden" name="WD_JSON_PROPRIETE_" value='{"m_oProprietesSecurisees":{}}'>
<input type="hidden" name="WD_BUTTON_CLICK_" value=""><input type="hidden" name="WD_ACTION_" value="">
<select name="A11"><option value="1" selected></option><option value="2">2026</option></select>
<input type="text" name="A13" value=""><input type="hidden" name="A4" value="1"><input type="hidden" name="_A4_OCC" value="3">
<a href="#" onclick="oGetObjetChamp('A4').OnSelectLigne(1,0,event);event.preventDefault(); if(clWDUtil.pfGetTraitement('PAGE_RECHERCHEJORT',18,void 0)(event)){_JSL(_PAGE_,'A14','_self','','');} " id="zrl_1_A14">JORT n°: 099 du 09/10/2026</a>
<a href="#" onclick="oGetObjetChamp('A4').OnSelectLigne(1,0,event);event.preventDefault(); if(clWDUtil.pfGetTraitement('PAGE_RECHERCHEJORT',18,void 0)(event)){_JSL(_PAGE_,'A30','_self','','');} " id="zrl_1_A30">Téléchargement</a>
<a href="#" onclick="oGetObjetChamp('A4').OnSelectLigne(2,0,event);" id="zrl_2_A14">JORT n°: 098 du 06/10/2026</a>
<a href="#" onclick="oGetObjetChamp('A4').OnSelectLigne(2,0,event);_JSL(_PAGE_,'A30','_self','','');" id="zrl_2_A30">Téléchargement</a>
<a href="#" onclick="oGetObjetChamp('A4').OnSelectLigne(3,0,event);" id="zrl_3_A14">JORT n°: 097 du 02/10/2026</a>
</form></body></html>`;

describe('veille automatique — site de l’IORT', () => {
  const source = new IortSource(config({}));
  const page = (
    source as unknown as { parse(u: string, h: string): never }
  ).parse('https://www.iort.tn/siteiort/', RECHERCHE_JORT);

  it('lit les numéros listés, du plus récent au plus ancien', () => {
    const issues = source.listIssues(page);
    expect(issues.map((i) => i.key)).toEqual([
      '2026-099',
      '2026-098',
      '2026-097',
    ]);
    expect(issues[0]).toEqual({
      key: '2026-099',
      numero: '099',
      date: '09/10/2026',
      label: 'JORT n° 099 du 09/10/2026',
      row: 1,
    });
  });

  it('reprend les champs du formulaire et l’adresse de la page (contexte de session)', () => {
    const p = page as unknown as { action: string; fields: URLSearchParams };
    expect(p.action).toBe(
      'https://www.iort.tn/siteiort/PAGE_RechercheJORT/aFIAABPJvpoBAAAAKQA',
    );
    expect(p.fields.get('A4')).toBe('1');
    expect(p.fields.get('A11')).toBe('1');
  });

  it('signale une page d’erreur du site', () => {
    let message = '';
    try {
      (source as unknown as { parse(u: string, h: string): void }).parse(
        'x',
        '<body>Error opening the PAGE_Principal page.</body>',
      );
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch('erreur');
  });
});

describe('veille automatique — lecture par l’IA', () => {
  const analyzer = new JortAnalyzerService(
    {} as never,
    config({ GEMINI_API_KEY: 'x' }),
  );
  const ref = {
    secteurs: [
      {
        id: 3,
        name: 'Santé et Sécurité au travail',
        themes: [{ id: 47, name: 'Hygiène et conditions de travail' }],
      },
      {
        id: 7,
        name: 'Environnement',
        themes: [{ id: 31, name: 'Gestion des déchets' }],
      },
    ],
    types: [
      { id: 2, name: 'Décret' },
      { id: 5, name: 'Arrêté' },
    ],
  };
  const text = {
    titre:
      '  Décret n° 2026-512 du 2 octobre 2026,  fixant les règles de gestion des déchets  ',
    typeId: 2,
    num: 'n° 2026-512',
    signedOn: '2 octobre 2026',
    ministere: 'Environnement',
    pageStart: 4,
    pageEnd: 6,
    secteurId: 7,
    themeId: 31,
    confidence: 0.92,
    reason: 'Obligations nouvelles pour les producteurs de déchets.',
    summary: 'Résumé.',
    keyPoints: ['Point 1'],
    needsReview: [],
  };

  it('garde un texte bien classé tel quel', () => {
    const out = analyzer.validate(
      {
        issueNumber: 'n° 099',
        issueDate: '9 octobre 2026',
        texts: [text],
        ignoredCount: 40,
        ignoredSummary: '40 nominations',
      },
      ref,
      80,
    );
    expect(out.issueNumber).toBe('099');
    expect(out.texts[0].titre).toBe(
      'Décret n° 2026-512 du 2 octobre 2026, fixant les règles de gestion des déchets',
    );
    expect(out.texts[0].pages).toEqual([4, 6]);
    expect(out.texts[0].needsReview).toEqual([]);
  });

  it('refuse un thème qui n’appartient pas au secteur', () => {
    const out = analyzer.validate(
      { texts: [{ ...text, secteurId: 3, themeId: 31 }] },
      ref,
      80,
    );
    expect(out.texts[0].secteurId).toBe(3);
    expect(out.texts[0].themeId).toBeNull();
    expect(out.texts[0].needsReview).toContain('Thème à choisir');
  });

  it('écarte un type inconnu et des pages hors du fichier', () => {
    const out = analyzer.validate(
      { texts: [{ ...text, typeId: 99, pageStart: 70, pageEnd: 90 }] },
      ref,
      80,
    );
    expect(out.texts[0].typeId).toBeNull();
    expect(out.texts[0].pages).toBeNull();
    expect(out.texts[0].needsReview).toContain('Type de texte à choisir');
  });

  it('borne la confiance entre 0 et 1', () => {
    const out = analyzer.validate(
      { texts: [{ ...text, confidence: 7 }] },
      ref,
      null,
    );
    expect(out.texts[0].confidence).toBe(1);
  });
});

describe('veille automatique — fiches et liens de validation', () => {
  it.each([
    ['09/10/2026', '9 octobre 2026'],
    ['01/08/2026', '1 août 2026'],
    ['9 octobre 2026', '9 octobre 2026'],
  ])('date %s → %s', (input, expected) => {
    expect(frenchDate(input)).toBe(expected);
  });

  it('reconnaît un titre déjà connu malgré accents et ponctuation', () => {
    expect(
      normalizeTitle(
        'Arrêté du ministre de l’Industrie du 2 octobre 2026, fixant…',
      ),
    ).toBe(
      normalizeTitle(
        "ARRETE du ministre de l'industrie du 2 octobre 2026 fixant",
      ),
    );
  });

  const secret = 'x'.repeat(48);
  const jwt = new JwtService({ secret });
  const service = new DraftsService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    jwt,
    config({ JWT_SECRET: secret }),
  );
  const read = (t: string) =>
    (
      service as unknown as {
        readToken(t: string): { draft: number; admin: number };
      }
    ).readToken(t);

  it('un lien de validation désigne un brouillon et un administrateur', () => {
    expect(read(service.validationToken(12, 3))).toEqual({
      draft: 12,
      admin: 3,
    });
  });

  it('un jeton de session ne vaut pas lien de validation', () => {
    const session = jwt.sign({
      sub: 3,
      type: 'admin',
      email: 'a@igts.tn',
      nom: 'A',
      ownerId: null,
    });
    let refused = false;
    try {
      read(session);
    } catch {
      refused = true;
    }
    expect(refused).toBe(true);
  });

  it('un lien de validation ne vaut pas jeton de session', () => {
    const link = service.validationToken(12, 3);
    let refused = false;
    try {
      jwt.verify(link);
    } catch {
      refused = true;
    }
    expect(refused).toBe(true);
  });
});

describe('veille automatique — portée individuelle ou locale', () => {
  it.each([
    "Arrêté du ministre de l'emploi et de la formation professionnelle du 6 octobre 2026 portant homologation, renouvellement d'homologation et prolongation d'homologation de certificats et diplômes de formation professionnelle.",
    'Décret Présidentiel n° 2026-512 du 3 octobre 2026, portant nomination du directeur général de l’office.',
    'Arrêté du ministre des finances du 2 octobre 2026, portant délégation de signature.',
    'Décret n° 2026-498 du 1er octobre 2026, portant expropriation pour cause d’utilité publique.',
    'Arrêté du 30 septembre 2026, portant ouverture d’un concours interne pour la promotion au grade d’ingénieur.',
  ])('écarte « %s »', (titre) => {
    expect(excludedScope(titre)).not.toBeNull();
  });

  it.each([
    'Décret gouvernemental n° 2026-450 du 28 septembre 2026, fixant les règles de sécurité contre les risques d’incendie dans les établissements recevant du public.',
    'Arrêté du ministre de l’environnement du 5 octobre 2026, fixant les valeurs limites de rejet des effluents industriels.',
    'Loi n° 2026-31 du 7 octobre 2026, relative à la santé et à la sécurité au travail.',
  ])('garde « %s »', (titre) => {
    expect(excludedScope(titre)).toBeNull();
  });

  it('compte les textes écartés après lecture avec ceux de l’IA', () => {
    const analyzer = new JortAnalyzerService({} as never, new ConfigService({}));
    const res = analyzer.validate(
      {
        texts: [
          { titre: 'Arrêté portant homologation de diplômes de formation professionnelle' },
          { titre: 'Loi relative à la santé et à la sécurité au travail', confidence: 0.9 },
        ],
        ignoredCount: 10,
        ignoredSummary: '10 nominations',
      },
      { secteurs: [], types: [] },
      null,
    );
    expect(res.texts.map((t) => t.titre)).toEqual([
      'Loi relative à la santé et à la sécurité au travail',
    ]);
    expect(res.ignoredCount).toBe(11);
    expect(res.ignoredSummary).toContain('homologation de diplômes');
  });
});
