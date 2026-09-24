import fs from 'fs/promises';
import path from 'path';
import {
  KnowledgeImportSession,
  ImportCandidate,
  KnowledgeImportAuditEntry,
} from './kg-import-types';

export interface KgImportData {
  sessions: KnowledgeImportSession[];
  candidates: ImportCandidate[];
  audits: KnowledgeImportAuditEntry[];
  indexes?: {
    sessionBySourceKey: Record<string, string>;
    candidateBySourceKey: Record<string, string>;
  };
}

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'import-data.json');

const DEFAULT_DATA: KgImportData = {
  sessions: [],
  candidates: [],
  audits: [],
  indexes: {
    sessionBySourceKey: {},
    candidateBySourceKey: {},
  },
};

let memoryCache: KgImportData | null = null;

export function clearImportCache(): void {
  memoryCache = null;
}

export async function readImportData(): Promise<KgImportData> {
  if (memoryCache) return memoryCache;
  try {
    const data = await fs.readFile(FILE_PATH, 'utf-8');
    memoryCache = JSON.parse(data);
    memoryCache!.indexes ??= {
      sessionBySourceKey: Object.fromEntries(
        memoryCache!.sessions
          .filter((session) => session.sourceKey)
          .map((session) => [session.sourceKey!, session.id])
      ),
      candidateBySourceKey: Object.fromEntries(
        memoryCache!.candidates.map((candidate) => [candidate.sourceKey, candidate.id])
      ),
    };
    return memoryCache!;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      memoryCache = { ...DEFAULT_DATA };
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(FILE_PATH, JSON.stringify(memoryCache, null, 2), 'utf-8');
      return memoryCache;
    }
    throw error;
  }
}

async function safeRename(src: string, dest: string): Promise<void> {
  let retries = 10;
  while (retries > 0) {
    try {
      await fs.rename(src, dest);
      return;
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'EPERM' || nodeErr.code === 'EBUSY') {
        retries--;
        await new Promise((resolve) => setTimeout(resolve, 100));
      } else {
        throw err;
      }
    }
  }
  await fs.rename(src, dest);
}

export async function writeImportData(data: KgImportData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  // Atomic write via tmp file
  const tmpPath = `${FILE_PATH}.tmp.${Date.now()}`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await safeRename(tmpPath, FILE_PATH);
  memoryCache = data;
}
