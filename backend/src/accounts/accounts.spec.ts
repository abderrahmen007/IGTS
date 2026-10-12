import { ConfigService } from '@nestjs/config';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  addDays,
  addYears,
  daysBetween,
  frenchDay,
  tunisDay,
} from '../common/json-file';
import { SubscriptionsService } from './subscriptions.service';
import { FeedbackService } from '../feedback/feedback.service';

const dir = mkdtempSync(join(tmpdir(), 'igts-accounts-'));
const config = (values: Record<string, string>) =>
  ({ get: (k: string) => values[k] }) as unknown as ConfigService;
const prisma = {
  company: {
    findFirst: () => Promise.resolve({ raisonsociale: 'ACME', nom: 'Ali' }),
    findUnique: () => Promise.resolve({ raisonsociale: 'ACME', nom: 'Ali' }),
    findMany: () =>
      Promise.resolve([
        { email: 'ali@acme.tn', nom: 'Ali', multicompte: 0, id: 1 },
      ]),
    count: () => Promise.resolve(3),
  },
};
const sent: string[] = [];
const mailer = {
  send: (m: { subject: string }) => {
    sent.push(m.subject);
    return Promise.resolve();
  },
};
const activity = { log: () => undefined };
const admins = {
  list: () =>
    Promise.resolve([{ id: 1, email: 'admin@igts.tn', nom: 'Admin' }]),
};

const subscriptions = new SubscriptionsService(
  prisma as never,
  mailer as never,
  activity as never,
  admins as never,
  config({ SUBSCRIPTIONS_FILE: join(dir, 'subscriptions.json') }),
);
const today = tunisDay();

describe('dates', () => {
  it('un an après le 29 février tombe le 28 février', () =>
    expect(addYears('2024-02-29', 1)).toBe('2025-02-28'));
  it('compte les jours', () =>
    expect(daysBetween('2026-10-01', '2026-10-31')).toBe(30));
  it('écrit la date en français', () =>
    expect(frenchDay('2026-11-02')).toBe('2 novembre 2026'));
});

describe('abonnement (superviseur, 10/2026)', () => {
  it('une entreprise sans période enregistrée n’est pas bloquée', () => {
    expect(subscriptions.info(99).status).toBe('none');
    expect(subscriptions.isLocked(99)).toBe(false);
  });

  it('actif à plus de 30 jours de la fin', async () => {
    await subscriptions.setDates(
      1,
      addDays(today, -100),
      addDays(today, 200),
      'IGTS',
    );
    expect(subscriptions.info(1).status).toBe('active');
  });

  it('prévient dans les 30 derniers jours, sans bloquer', async () => {
    await subscriptions.setDates(
      1,
      addDays(today, -300),
      addDays(today, 10),
      'IGTS',
    );
    const info = subscriptions.info(1);
    expect(info.status).toBe('expiring');
    expect(info.daysLeft).toBe(10);
    expect(info.locked).toBe(false);
  });

  it('bloque le lendemain de la fin, avec un message', async () => {
    await subscriptions.setDates(
      1,
      addDays(today, -366),
      addDays(today, -1),
      'IGTS',
    );
    const info = subscriptions.info(1);
    expect(info.status).toBe('expired');
    expect(info.locked).toBe(true);
    expect(info.message).toMatch('Contactez IGTS');
  });

  it('le renouvellement d’un abonnement expiré repart d’aujourd’hui pour un an', async () => {
    const info = await subscriptions.renew(1, 'IGTS');
    expect(info.start).toBe(today);
    expect(info.end).toBe(addDays(addYears(today, 1), -1));
    expect(info.locked).toBe(false);
  });

  it('le renouvellement d’un abonnement en cours prolonge sa fin d’un an', async () => {
    const before = subscriptions.info(1).end!;
    const info = await subscriptions.renew(1, 'IGTS');
    expect(info.end).toBe(addYears(before, 1));
  });

  it('la suspension pour impayé bloque, la reprise débloque', async () => {
    expect(
      (await subscriptions.suspend(1, 'facture 2026 impayée', 'IGTS')).locked,
    ).toBe(true);
    expect(subscriptions.info(1).message).toMatch('facture 2026 impayée');
    expect((await subscriptions.resume(1, 'IGTS')).locked).toBe(false);
  });

  it('rappel à J-30 puis J-7, une seule fois chacun', async () => {
    await subscriptions.setDates(
      2,
      addDays(today, -300),
      addDays(today, 20),
      'IGTS',
    );
    sent.length = 0;
    expect((await subscriptions.remind()).ending).toBe(1);
    expect(sent.some((s) => s.includes('se termine'))).toBe(true);
    expect((await subscriptions.remind()).ending).toBe(0);
    await subscriptions.setDates(
      2,
      addDays(today, -300),
      addDays(today, 5),
      'IGTS',
    );
    expect((await subscriptions.remind()).ending).toBe(1);
  });

  it('refuse une fin avant le début', async () => {
    let refused = false;
    try {
      await subscriptions.setDates(1, '2026-10-10', '2026-01-01', 'IGTS');
    } catch {
      refused = true;
    }
    expect(refused).toBe(true);
  });
});

describe('enquête de satisfaction', () => {
  const feedback = new FeedbackService(
    prisma as never,
    mailer as never,
    activity as never,
    subscriptions,
    config({ FEEDBACK_FILE: join(dir, 'feedback.json') }),
  );
  const user = {
    id: 7,
    ownerId: 1,
    type: 'company' as const,
    email: 'a@acme.tn',
    nom: 'Ali',
    canEdit: true,
  };
  const full = {
    pertinence: 5,
    resumes: 4,
    plateforme: 4,
    accompagnement: 5,
    global: 5,
    ameliorer: '  Plus de textes sur l’énergie ',
  };

  it('aucune enquête ouverte au départ', () =>
    expect(feedback.forUser(user).campaign).toBeNull());

  it('une enquête ouverte par IGTS reprend les questions du moment', async () => {
    const c = await feedback.open({ by: 'Admin', trigger: 'manual' });
    expect(c.questions.length).toBe(6);
    expect(feedback.forUser(user).campaign?.id).toBe(c.id);
  });

  it('une seule enquête ouverte à la fois', async () => {
    let refused = false;
    try {
      await feedback.open({ by: 'Admin', trigger: 'manual' });
    } catch {
      refused = true;
    }
    expect(refused).toBe(true);
  });

  it('les notes vont de 1 à 5', async () => {
    let message = '';
    try {
      await feedback.submit(user, { ...full, global: 9 });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch('1 à 5');
  });

  it('une question obligatoire doit être notée', async () => {
    let message = '';
    try {
      await feedback.submit(user, { ...full, pertinence: '' });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch('Merci de noter');
  });

  it('enregistre la réponse une seule fois', async () => {
    await feedback.submit(user, full);
    expect(feedback.forUser(user).answered).toBe(true);
    let refused = false;
    try {
      await feedback.submit(user, full);
    } catch {
      refused = true;
    }
    expect(refused).toBe(true);
  });

  it('calcule les moyennes et la répartition des notes', async () => {
    await feedback.submit(
      { ...user, id: 8, nom: 'Sami' },
      { ...full, global: 3, ameliorer: '' },
    );
    const c = feedback.overview().campaigns[0];
    const r = await feedback.results(c.id);
    const global = r.questions.find((q) => q.id === 'global') as {
      average: number;
      distribution: number[];
    };
    expect(global.average).toBe(4);
    expect(global.distribution).toEqual([0, 0, 1, 0, 1]);
    const comments = r.questions.find((q) => q.id === 'ameliorer') as {
      comments: { text: string }[];
    };
    expect(comments.comments.map((x) => x.text)).toEqual([
      'Plus de textes sur l’énergie',
    ]);
  });

  it('pas de lancement automatique en septembre si une enquête a déjà été lancée depuis août', async () => {
    const before = feedback.overview().campaigns.length;
    await feedback.september();
    expect(feedback.overview().campaigns.length).toBe(before);
  });
});
