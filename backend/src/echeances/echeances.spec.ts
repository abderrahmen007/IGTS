import { ConfigService } from '@nestjs/config';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { addDays, addMonths, tunisDay } from '../common/json-file';
import type { AuthUser } from '../common/auth-user';
import { EcheancesStore } from './echeances.store';
import { EcheancesService, statusOf } from './echeances.service';
import {
  RemindersService,
  emailsIn,
  reminderStage,
  whenLabel,
} from './reminders.service';

const dir = mkdtempSync(join(tmpdir(), 'igts-echeances-'));
const config = (values: Record<string, string>) =>
  ({ get: (k: string) => values[k] }) as unknown as ConfigService;
const today = tunisDay();

const prisma = {
  company: {
    findFirst: () => Promise.resolve({ id: 10 }),
    findMany: () =>
      Promise.resolve([
        {
          id: 10,
          email: 'boss@acme.tn',
          nom: 'Ali',
          raisonsociale: 'ACME',
          activated: true,
        },
      ]),
  },
  texte: { findMany: () => Promise.resolve([]) },
  texteSociete: { findMany: () => Promise.resolve([]) },
  plusaction: { findMany: () => Promise.resolve([]) },
  notification: {
    create: () => Promise.resolve({}),
    createMany: () => Promise.resolve({}),
    count: () => Promise.resolve(1),
  },
};
const activity = { log: () => undefined };
const company: AuthUser = {
  id: 10,
  type: 'company',
  email: 'boss@acme.tn',
  nom: 'Ali',
  ownerId: 10,
  canEdit: true,
};

const store = new EcheancesStore(
  config({ ECHEANCES_FILE: join(dir, 'echeances.json') }),
);
const service = new EcheancesService(store, prisma as never, activity as never);

describe('échéances — dates et étapes de rappel', () => {
  it('ajoute des mois en restant dans le mois', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-10-14', 12)).toBe('2027-10-14');
  });

  it('rappelle à J-30, J-7, le jour même puis chaque semaine (12 semaines)', () => {
    expect(reminderStage(31)).toBeNull();
    expect(reminderStage(30)).toBe('j30');
    expect(reminderStage(8)).toBe('j30');
    expect(reminderStage(7)).toBe('j7');
    expect(reminderStage(1)).toBe('j7');
    expect(reminderStage(0)).toBe('j0');
    expect(reminderStage(-6)).toBe('j0');
    expect(reminderStage(-7)).toBe('late1');
    expect(reminderStage(-84)).toBe('late12');
    expect(reminderStage(-85)).toBeNull();
  });

  it('dit quand en français', () => {
    expect(whenLabel(0)).toBe('aujourd’hui');
    expect(whenLabel(7)).toBe('dans 7 jours');
    expect(whenLabel(-9)).toBe('en retard de 9 jours');
  });

  it('lit les adresses du champ « courriel du responsable »', () => {
    expect(emailsIn('Sami <sami@acme.tn>; RH@Acme.tn')).toEqual([
      'sami@acme.tn',
      'rh@acme.tn',
    ]);
    expect(emailsIn('pas d’adresse')).toEqual([]);
  });

  it('classe en retard, bientôt ou à jour', () => {
    expect(statusOf(addDays(today, -1)).status).toBe('late');
    expect(statusOf(addDays(today, 30)).status).toBe('soon');
    expect(statusOf(addDays(today, 31)).status).toBe('ok');
  });
});

describe('échéances — fiches de l’entreprise', () => {
  it('propose le catalogue de départ, à confirmer par IGTS', () => {
    expect(store.data.types.length).toBe(10);
    expect(store.data.types.every((t) => t.toConfirm)).toBe(true);
  });

  it('calcule l’échéance à partir de la dernière date et de la périodicité', async () => {
    const item = await service.create(
      10,
      {
        typeId: 4,
        category: 'controles',
        label: 'Extincteurs de l’atelier B',
        everyMonths: 12,
        lastDone: '2026-03-01',
      },
      company,
    );
    expect(item.dueOn).toBe('2027-03-01');
    expect(item.title).toBe(
      'Vérification des extincteurs — Extincteurs de l’atelier B',
    );
  });

  it('demande une échéance quand rien ne permet de la calculer', async () => {
    let error: unknown = null;
    try {
      await service.create(
        10,
        { category: 'autorisations', label: 'Agrément ANPE' },
        company,
      );
    } catch (e) {
      error = e;
    }
    expect((error as Error).message).toContain('date d’échéance');
  });

  it('« Fait » reporte l’échéance et garde l’historique', async () => {
    const id = store.data.items[0].id;
    const done = await service.markDone(
      id,
      { doneOn: '2027-02-20' },
      company,
      10,
    );
    expect(done.lastDone).toBe('2027-02-20');
    expect(done.dueOn).toBe('2028-02-20');
    expect(done.history.length).toBe(1);
  });

  it('une autre entreprise ne voit pas la fiche', async () => {
    let error: unknown = null;
    try {
      await service.markDone(
        store.data.items[0].id,
        { doneOn: '2027-02-21' },
        company,
        99,
      );
    } catch (e) {
      error = e;
    }
    expect((error as Error).message).toBe('Échéance introuvable');
  });
});

describe('échéances — rappels quotidiens', () => {
  const mails: { to: string[]; subject: string }[] = [];
  const reminders = new RemindersService(
    store,
    service,
    prisma as never,
    {
      send: (m: { to: string[]; subject: string }) => {
        mails.push(m);
        return Promise.resolve();
      },
    } as never,
    { publish: () => undefined } as never,
    { filter: <T>(a: T[]) => a } as never,
    { isLocked: () => false } as never,
    config({}),
  );

  it('prévient le compte principal et le responsable, une seule fois par étape', async () => {
    await service.create(
      10,
      {
        category: 'vehicules',
        typeId: 1,
        label: 'Camion Isuzu',
        reference: '123 TU 4567',
        dueOn: addDays(today, 7),
        responsibleName: 'Sami',
        responsibleEmail: 'sami@acme.tn',
      },
      company,
    );
    const first = await reminders.run();
    expect(first.items).toBe(1);
    expect(mails.map((m) => m.to[0]).sort()).toEqual([
      'boss@acme.tn',
      'sami@acme.tn',
    ]);
    expect(mails[0].subject).toContain('ACME');

    mails.length = 0;
    const second = await reminders.run();
    expect(second.items).toBe(0);
    expect(mails.length).toBe(0);
  });
});
