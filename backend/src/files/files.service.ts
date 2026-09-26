import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, promises as fs } from 'fs';
import { basename, join, resolve } from 'path';

export interface UploadedPdf {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export const MAX_PDF_SIZE = 20 * 1024 * 1024;

/**
 * Stores the official PDF of each text. New uploads are kept on this server
 * (UPLOADS_DIR); files that only exist on the legacy platform are served by
 * redirecting to it, so old and new documents both work.
 */
@Injectable()
export class FilesService {
  readonly dir: string;
  private readonly legacyUrl: string;
  private readonly publicApiUrl: string;

  constructor(config: ConfigService) {
    this.dir = resolve(config.get<string>('UPLOADS_DIR') ?? 'uploads', 'textes');
    mkdirSync(this.dir, { recursive: true });
    this.legacyUrl = (
      config.get<string>('LEGACY_UPLOADS_URL') ?? 'https://veille.inter-gts.com/uploads/texte/photos'
    ).replace(/\/$/, '');
    this.publicApiUrl = (config.get<string>('PUBLIC_API_URL') ?? 'http://localhost:3001/api').replace(/\/$/, '');
  }

  /** Public URL for a stored file name (null when the text has no PDF). */
  pdfUrl(name: string | null | undefined): string | null {
    return name ? `${this.publicApiUrl}/files/textes/${encodeURIComponent(name)}` : null;
  }

  /** Resolves a request: local path if stored here, otherwise the legacy URL. */
  locate(rawName: string): { path?: string; redirect?: string } {
    const name = basename(rawName);
    const local = join(this.dir, name);
    if (existsSync(local)) return { path: local };
    return { redirect: `${this.legacyUrl}/${encodeURIComponent(name)}` };
  }

  async savePdf(file: UploadedPdf): Promise<string> {
    const isPdf = file.mimetype === 'application/pdf' && file.buffer.subarray(0, 5).toString() === '%PDF-';
    if (!isPdf) throw new BadRequestException('Le fichier doit être un PDF');
    if (file.size > MAX_PDF_SIZE) throw new BadRequestException('Le PDF ne doit pas dépasser 20 Mo');

    const stem =
      basename(file.originalname, '.pdf')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'texte';
    const name = `${stem}-${randomBytes(6).toString('hex')}.pdf`;
    await fs.writeFile(join(this.dir, name), file.buffer);
    return name;
  }
}
