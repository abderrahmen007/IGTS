import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  TaskType,
  type EmbedContentRequest,
} from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';
import { JsonFile } from '../common/json-file';
import { htmlToText } from '../common/text-utils';

export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIM = 768;
/** Texts per request, and pause between two requests of the background indexing */
const BATCH = 50;
const PAUSE_MS = 40_000;

export interface IndexDoc {
  id: number;
  title: string;
  content: string;
}

interface IndexFile {
  model: string;
  dim: number;
  /** texteId → { hash of the content, base64 float32 unit vector } */
  items: Record<string, { h: string; v: string }>;
}

/** Short hash of a text's content (FNV-1a), to re-embed a text that changed. */
export function contentHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function encodeVector(values: number[]): string {
  let norm = 0;
  for (const x of values) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  const v = new Float32Array(values.length);
  values.forEach((x, i) => (v[i] = x / norm));
  return Buffer.from(v.buffer).toString('base64');
}

export function decodeVector(b64: string): Float32Array {
  return new Float32Array(new Uint8Array(Buffer.from(b64, 'base64')).buffer);
}

export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

/** What is embedded for a text: its title, classification and summary. */
export function docContent(t: {
  titre: string;
  description: string;
  type?: { name: string } | null;
  secteur?: { name: string } | null;
  theme?: { name: string } | null;
}): string {
  return [
    t.titre,
    [t.type?.name, t.secteur?.name, t.theme?.name].filter(Boolean).join(' · '),
    htmlToText(t.description),
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 6000);
}

/**
 * Semantic index of the texts for the assistant, kept in data/embeddings.json
 * so it survives restarts. Texts are embedded 50 at a time in the background
 * (the free Gemini quota allows about 100 a minute), and those of a company
 * asking a question first. Before, each question embedded every text one by
 * one, hit the quota at once and fell back to a poor keyword match.
 */
@Injectable()
export class EmbeddingsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly genAI: GoogleGenerativeAI | null;
  private readonly file: JsonFile<IndexFile>;
  private readonly cache = new Map<number, Float32Array>();
  private pausedUntil = 0;
  private indexing = false;
  private lastWarn = 0;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    const key = config.get<string>('GEMINI_API_KEY')?.trim();
    this.genAI = key ? new GoogleGenerativeAI(key) : null;
    this.file = new JsonFile<IndexFile>(
      config.get<string>('EMBEDDINGS_FILE') ?? 'data/embeddings.json',
      () => ({ model: EMBEDDING_MODEL, dim: EMBEDDING_DIM, items: {} }),
      'EmbeddingsService',
    );
    if (
      this.file.data.model !== EMBEDDING_MODEL ||
      this.file.data.dim !== EMBEDDING_DIM
    ) {
      this.file.data = {
        model: EMBEDDING_MODEL,
        dim: EMBEDDING_DIM,
        items: {},
      };
    }
  }

  get available(): boolean {
    return Boolean(this.genAI);
  }

  get size(): number {
    return Object.keys(this.file.data.items).length;
  }

  onApplicationBootstrap() {
    if (!this.genAI) return;
    setTimeout(() => void this.indexAll(), 20_000).unref();
    setInterval(() => void this.indexAll(), 10 * 60_000).unref();
  }

  vector(id: number): Float32Array | null {
    const hit = this.cache.get(id);
    if (hit) return hit;
    const item = this.file.data.items[String(id)];
    if (!item) return null;
    const v = decodeVector(item.v);
    this.cache.set(id, v);
    return v;
  }

  /** Embeds a question (null when the AI cannot be reached). */
  async embedQuery(text: string): Promise<Float32Array | null> {
    if (!this.genAI || Date.now() < this.pausedUntil) return null;
    try {
      const model = this.genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
      const req: EmbedContentRequest & { outputDimensionality: number } = {
        content: { role: 'user', parts: [{ text: text.slice(0, 2000) }] },
        taskType: TaskType.RETRIEVAL_QUERY,
        outputDimensionality: EMBEDDING_DIM,
      };
      const res = await model.embedContent(req);
      const values = res.embedding?.values;
      return values?.length ? decodeVector(encodeVector(values)) : null;
    } catch (e) {
      this.failed(e);
      return null;
    }
  }

  /** Embeds up to `limit` texts that are missing or changed. */
  async ensure(docs: IndexDoc[], limit = BATCH * 2): Promise<number> {
    if (!this.genAI) return 0;
    const todo = docs
      .filter((d) => {
        const item = this.file.data.items[String(d.id)];
        return !item || item.h !== contentHash(d.content);
      })
      .slice(0, limit);
    let done = 0;
    for (let i = 0; i < todo.length; i += BATCH) {
      if (Date.now() < this.pausedUntil) break;
      const ok = await this.embedBatch(todo.slice(i, i + BATCH));
      if (!ok) break;
      done += Math.min(BATCH, todo.length - i);
    }
    if (done) await this.file.save();
    return done;
  }

  /** Background: every text assigned to a company, a batch every 40 s. */
  async indexAll(): Promise<void> {
    if (!this.genAI || this.indexing) return;
    this.indexing = true;
    try {
      const ids = await this.prisma.texteSociete.findMany({
        where: {
          OR: [{ deleted: false }, { deleted: null }],
          texte: { deleted: false },
        },
        select: { texteId: true },
        distinct: ['texteId'],
      });
      const texts = await this.prisma.texte.findMany({
        where: {
          id: {
            in: ids
              .map((r) => r.texteId)
              .filter((x): x is number => x !== null),
          },
        },
        select: {
          id: true,
          titre: true,
          description: true,
          type: { select: { name: true } },
          secteur: { select: { name: true } },
          theme: { select: { name: true } },
        },
      });
      const docs = texts.map((t) => ({
        id: t.id,
        title: t.titre,
        content: docContent(t),
      }));
      let missing = docs.filter((d) => {
        const item = this.file.data.items[String(d.id)];
        return !item || item.h !== contentHash(d.content);
      });
      if (!missing.length) return;
      this.logger.log(
        `Index de l’assistant : ${missing.length} texte(s) à préparer sur ${docs.length}`,
      );
      while (missing.length && Date.now() >= this.pausedUntil) {
        const ok = await this.embedBatch(missing.slice(0, BATCH));
        if (!ok) break;
        missing = missing.slice(BATCH);
        await this.file.save();
        if (missing.length) await new Promise((r) => setTimeout(r, PAUSE_MS));
      }
      if (!missing.length)
        this.logger.log(`Index de l’assistant à jour : ${this.size} texte(s)`);
    } catch (e) {
      this.logger.warn(`Index de l’assistant : ${(e as Error).message}`);
    } finally {
      this.indexing = false;
    }
  }

  private async embedBatch(docs: IndexDoc[]): Promise<boolean> {
    if (!this.genAI || !docs.length) return false;
    try {
      const model = this.genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
      const requests = docs.map((d) => {
        const req: EmbedContentRequest & { outputDimensionality: number } = {
          content: { role: 'user', parts: [{ text: d.content }] },
          taskType: TaskType.RETRIEVAL_DOCUMENT,
          title: d.title.slice(0, 300),
          outputDimensionality: EMBEDDING_DIM,
        };
        return req;
      });
      const res = await model.batchEmbedContents({ requests });
      res.embeddings.forEach((e, i) => {
        const d = docs[i];
        if (!d || !e.values?.length) return;
        this.file.data.items[String(d.id)] = {
          h: contentHash(d.content),
          v: encodeVector(e.values),
        };
        this.cache.delete(d.id);
      });
      return true;
    } catch (e) {
      this.failed(e);
      return false;
    }
  }

  /** Quota or network trouble: wait before the next call (as long as Gemini asks). */
  private failed(e: unknown) {
    const msg = (e as Error).message ?? '';
    const retry = /retry in ([\d.]+)s/i.exec(msg);
    const wait = retry ? Math.ceil(Number(retry[1]) * 1000) : 60_000;
    this.pausedUntil = Date.now() + Math.max(wait, 15_000);
    if (Date.now() - this.lastWarn > 60_000) {
      this.lastWarn = Date.now();
      this.logger.warn(
        `Gemini (embeddings) indisponible, nouvel essai dans ${Math.round(Math.max(wait, 15_000) / 1000)} s : ${msg.slice(0, 160)}`,
      );
    }
  }
}
