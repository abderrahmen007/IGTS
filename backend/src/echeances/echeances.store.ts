import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonFile } from '../common/json-file';

export const CATEGORIES = [
  'vehicules',
  'controles',
  'equipements',
  'personnel',
  'autorisations',
  'assurances',
  'autres',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  vehicules: 'Véhicules',
  controles: 'Contrôles réglementaires',
  equipements: 'Équipements',
  personnel: 'Personnel',
  autorisations: 'Autorisations et agréments',
  assurances: 'Assurances',
  autres: 'Autres',
};

/** A kind of recurring obligation, kept by IGTS (catalogue). */
export interface EcheanceType {
  id: number;
  category: Category;
  label: string;
  /** Frequency in months (null: the date is given by the document itself) */
  everyMonths: number | null;
  /** Legal texts (table `texte`) that impose it */
  textIds: number[];
  notes: string | null;
  /** Proposed by default: frequency and legal text still to be confirmed by IGTS */
  toConfirm: boolean;
  active: boolean;
}

export interface EcheanceHistory {
  doneOn: string;
  nextDue: string;
  by: string;
  at: string;
  note: string | null;
}

/** Something a company must renew or have checked regularly. */
export interface EcheanceItem {
  id: number;
  /** Main company account (owner) */
  companyId: number;
  typeId: number | null;
  category: Category;
  /** What it is: « Camion Isuzu », « Extincteurs de l’atelier B »… */
  label: string;
  /** Plate, serial number, policy or approval number… */
  reference: string | null;
  everyMonths: number | null;
  /** YYYY-MM-DD */
  lastDone: string | null;
  /** YYYY-MM-DD */
  dueOn: string;
  responsible: { name: string; email: string | null } | null;
  textIds: number[];
  notes: string | null;
  archived: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  history: EcheanceHistory[];
}

interface EcheancesData {
  nextId: number;
  nextTypeId: number;
  seeded: boolean;
  types: EcheanceType[];
  items: EcheanceItem[];
  /** Reminders already sent: key → ISO date */
  sent: Record<string, string>;
  /** Day (Tunis) of the last reminder run */
  lastRun: string | null;
}

type Seed = Omit<EcheanceType, 'id' | 'textIds' | 'toConfirm' | 'active'>;

/**
 * Common types proposed at first start. Their frequency is a usual practice,
 * not a legal reference: each one is marked « à confirmer » until IGTS checks
 * it and attaches the legal text.
 */
const SEED: Seed[] = [
  {
    category: 'vehicules',
    label: 'Visite technique du véhicule',
    everyMonths: 12,
    notes: 'La périodicité dépend de la catégorie et de l’âge du véhicule.',
  },
  {
    category: 'vehicules',
    label: 'Assurance du véhicule',
    everyMonths: 12,
    notes: null,
  },
  {
    category: 'controles',
    label: 'Vérification des installations électriques',
    everyMonths: 12,
    notes: null,
  },
  {
    category: 'controles',
    label: 'Vérification des extincteurs',
    everyMonths: 12,
    notes: null,
  },
  {
    category: 'controles',
    label:
      'Contrôle des appareils à pression (chaudières, compresseurs, réservoirs)',
    everyMonths: null,
    notes: null,
  },
  {
    category: 'controles',
    label: 'Contrôle des ascenseurs et appareils de levage',
    everyMonths: null,
    notes: null,
  },
  {
    category: 'personnel',
    label: 'Certificat médical d’aptitude',
    everyMonths: 12,
    notes:
      'Indiquer seulement le nom et les dates, jamais d’information médicale.',
  },
  {
    category: 'autorisations',
    label: 'Autorisation ou agrément administratif',
    everyMonths: null,
    notes: 'La date de fin de validité figure sur l’acte.',
  },
  {
    category: 'assurances',
    label: 'Police d’assurance (responsabilité civile, incendie…)',
    everyMonths: 12,
    notes: null,
  },
  {
    category: 'equipements',
    label: 'Entretien périodique d’un équipement',
    everyMonths: null,
    notes: null,
  },
];

/**
 * Recurring obligations of the companies and their catalogue, in
 * data/echeances.json (the MySQL schema is shared with Symfony and stays as
 * it is).
 */
@Injectable()
export class EcheancesStore {
  private readonly file: JsonFile<EcheancesData>;

  constructor(config: ConfigService) {
    this.file = new JsonFile<EcheancesData>(
      config.get<string>('ECHEANCES_FILE') ?? 'data/echeances.json',
      () => ({
        nextId: 1,
        nextTypeId: 1,
        seeded: false,
        types: [],
        items: [],
        sent: {},
        lastRun: null,
      }),
      'EcheancesStore',
    );
    if (!this.file.data.seeded) {
      for (const s of SEED) {
        this.file.data.types.push({
          ...s,
          id: this.file.data.nextTypeId++,
          textIds: [],
          toConfirm: true,
          active: true,
        });
      }
      this.file.data.seeded = true;
      void this.file.save();
    }
  }

  get data(): EcheancesData {
    return this.file.data;
  }

  save(): Promise<void> {
    return this.file.save();
  }

  nextItemId(): number {
    return this.file.data.nextId++;
  }

  nextTypeId(): number {
    return this.file.data.nextTypeId++;
  }
}
