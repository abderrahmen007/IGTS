import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, promises as fs } from 'fs';
import { basename, extname, join, resolve } from 'path';

export interface UploadedPdf {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
export type UploadedFile = UploadedPdf;

export const MAX_PDF_SIZE = 20 * 1024 * 1024;
export const MAX_PROOF_SIZE = 10 * 1024 * 1024;
export const MAX_PROOFS_PER_UPLOAD = 5;

/** Proof documents accepted on an action (same kinds as the legacy form, plus Office files). */
const PROOF_TYPES: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

const slug = (s: string, fallback: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || fallback;

/**
 * Stores documents. New uploads are kept on this server (UPLOADS_DIR); files
 * that only exist on the legacy platform are served by redirecting to it, so
 * old and new documents both work.
 *  - textes/      official PDF of each text
 *  - responsable/ proofs attached to actions (same folder name as Symfony)
 */
@Injectable()
export class FilesService {
  readonly dir: string;
  readonly proofsDir: string;
  private readonly legacyUrl: string;
  private readonly legacyProofsUrl: string;
  private readonly publicApiUrl: string;

  constructor(config: ConfigService) {
    const root = config.get<string>('UPLOADS_DIR') ?? 'uploads';
    this.dir = resolve(root, 'textes');
    this.proofsDir = resolve(root, 'responsable');
    mkdirSync(this.dir, { recursive: true });
    mkdirSync(this.proofsDir, { recursive: true });
    this.legacyUrl = (
      config.get<string>('LEGACY_UPLOADS_URL') ?? 'https://veille.inter-gts.com/uploads/texte/photos'
    ).replace(/\/$/, '');
    this.legacyProofsUrl = (
      config.get<string>('LEGACY_PROOFS_URL') ?? 'https://veille.inter-gts.com/uploads/responsable'
    ).replace(/\/$/, '');
    // Relative by default: works behind the Next.js /api proxy and through tunnels
    this.publicApiUrl = (config.get<string>('PUBLIC_API_URL') ?? '/api').replace(/\/$/, '');
  }

  /** Public URL for a stored file name (null when the text has no PDF). */
  pdfUrl(name: string | null | undefined): string | null {
    return name ? `${this.publicApiUrl}/files/textes/${encodeURIComponent(name)}` : null;
  }

  proofUrl(name: string): string {
    return `${this.publicApiUrl}/files/preuves/${encodeURIComponent(name)}`;
  }

  /** Resolves a request: local path if stored here, otherwise the legacy URL. */
  locate(rawName: string): { path?: string; redirect?: string } {
    const name = basename(rawName);
    const local = join(this.dir, name);
    if (existsSync(local)) return { path: local };
    return { redirect: `${this.legacyUrl}/${encodeURIComponent(name)}` };
  }

  locateProof(rawName: string): { path?: string; redirect?: string } {
    const name = basename(rawName);
    const local = join(this.proofsDir, name);
    if (existsSync(local)) return { path: local };
    return { redirect: `${this.legacyProofsUrl}/${encodeURIComponent(name)}` };
  }

  async savePdf(file: UploadedPdf): Promise<string> {
    const isPdf = file.mimetype === 'application/pdf' && file.buffer.subarray(0, 5).toString() === '%PDF-';
    if (!isPdf) throw new BadRequestException('Le fichier doit être un PDF');
    if (file.size > MAX_PDF_SIZE) throw new BadRequestException('Le PDF ne doit pas dépasser 20 Mo');

    const name = `${slug(basename(file.originalname, '.pdf'), 'texte')}-${randomBytes(6).toString('hex')}.pdf`;
    await fs.writeFile(join(this.dir, name), file.buffer);
    return name;
  }

  /** Saves an action proof; the random suffix makes the public URL unguessable. */
  async saveProof(file: UploadedFile): Promise<string> {
    const ext = extname(file.originalname).toLowerCase();
    const allowed = PROOF_TYPES[ext];
    if (!allowed || !allowed.includes(file.mimetype)) {
      throw new BadRequestException('Formats acceptés : PDF, image (JPG, PNG), Word ou Excel');
    }
    if (file.size > MAX_PROOF_SIZE) throw new BadRequestException('Chaque fichier doit faire moins de 10 Mo');
    const name = `${slug(basename(file.originalname, ext), 'preuve')}-${randomBytes(8).toString('hex')}${ext}`;
    await fs.writeFile(join(this.proofsDir, name), file.buffer);
    return name;
  }

  /** Deletes a proof stored here (legacy files on the old server are left alone). */
  async removeProof(rawName: string) {
    const local = join(this.proofsDir, basename(rawName));
    if (existsSync(local)) await fs.unlink(local);
  }
}

/** The legacy app stores several file names in one column, separated by "|". */
export const splitFiles = (v: string | null | undefined) =>
  (v ?? '').split('|').map((s) => s.trim()).filter(Boolean);
export const joinFiles = (names: string[]) => (names.length ? names.join('|') : null);
