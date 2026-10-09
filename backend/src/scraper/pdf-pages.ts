import { Logger } from '@nestjs/common';

const logger = new Logger('PdfPages');

interface PdfLib {
  PDFDocument: {
    load(
      bytes: Uint8Array,
      opts?: { ignoreEncryption?: boolean },
    ): Promise<PdfDoc>;
    create(): Promise<PdfDoc>;
  };
}
interface PdfDoc {
  getPageCount(): number;
  copyPages(src: PdfDoc, indices: number[]): Promise<unknown[]>;
  addPage(page: unknown): void;
  save(): Promise<Uint8Array>;
}

let lib: PdfLib | null | undefined;

/** pdf-lib is optional: without it, drafts keep the whole issue PDF. */
function pdfLib(): PdfLib | null {
  if (lib !== undefined) return lib;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    lib = require('pdf-lib') as PdfLib;
  } catch {
    logger.warn(
      'Paquet "pdf-lib" absent : les brouillons joindront le numéro complet du JORT (lancez scripts/start-app.command ou « npm install » dans backend/).',
    );
    lib = null;
  }
  return lib;
}

export function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

/** Number of pages, or null when it cannot be read. */
export async function pageCount(buffer: Buffer): Promise<number | null> {
  const l = pdfLib();
  if (!l) return null;
  try {
    const doc = await l.PDFDocument.load(new Uint8Array(buffer), {
      ignoreEncryption: true,
    });
    return doc.getPageCount();
  } catch {
    return null;
  }
}

/**
 * Copies pages [from, to] (1-based, inclusive) into a new PDF. Returns null
 * when the range is invalid or pdf-lib is not installed.
 */
export async function extractPages(
  buffer: Buffer,
  from: number,
  to: number,
): Promise<Buffer | null> {
  const l = pdfLib();
  if (!l) return null;
  try {
    const src = await l.PDFDocument.load(new Uint8Array(buffer), {
      ignoreEncryption: true,
    });
    const total = src.getPageCount();
    const start = Math.max(1, Math.floor(from));
    const end = Math.min(total, Math.floor(to));
    if (end < start) return null;
    const out = await l.PDFDocument.create();
    const pages = await out.copyPages(
      src,
      Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i),
    );
    for (const p of pages) out.addPage(p);
    return Buffer.from(await out.save());
  } catch (e) {
    logger.warn(`Découpage du PDF impossible : ${(e as Error).message}`);
    return null;
  }
}
