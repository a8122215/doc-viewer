import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface DocViewerConfig {
  projectsRoot: string;
  docsDirName: string;
  host: string;
  port: number;
  exclude: string[];
  viewerProjectName: string;
  allowContainerHost: boolean;
}

interface RawConfig {
  projectsRoot?: unknown;
  docsDirName?: unknown;
  host?: unknown;
  port?: unknown;
  exclude?: unknown;
}

const defaultConfig = {
  projectsRoot: '../',
  docsDirName: 'docs',
  host: '127.0.0.1',
  port: 4321,
  exclude: [
    'doc-viewer/**',
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/.vite/**',
    '**/coverage/**',
  ],
};

export async function loadConfig(configPath = path.resolve(process.cwd(), 'config/doc-viewer.config.json')): Promise<DocViewerConfig> {
  const rawConfig = await readRawConfig(configPath);
  const merged = { ...defaultConfig, ...rawConfig };
  const host = stringValue(process.env.DOC_VIEWER_HOST ?? merged.host, defaultConfig.host);
  const docsDirName = stringValue(process.env.DOC_VIEWER_DOCS_DIR_NAME ?? merged.docsDirName, defaultConfig.docsDirName);
  const projectsRootValue = stringValue(process.env.DOC_VIEWER_PROJECTS_ROOT ?? merged.projectsRoot, defaultConfig.projectsRoot);
  const port = numberValue(envNumber(process.env.DOC_VIEWER_PORT) ?? merged.port, defaultConfig.port);
  const exclude = stringArrayValue(merged.exclude, defaultConfig.exclude);
  const allowContainerHost = process.env.DOC_VIEWER_ALLOW_CONTAINER_HOST === 'true';
  const viewerProjectName = stringValue(process.env.DOC_VIEWER_VIEWER_PROJECT_NAME, path.basename(process.cwd()));

  assertLocalOnlyHost(host, allowContainerHost);
  assertValidPort(port);

  return {
    projectsRoot: path.resolve(process.cwd(), projectsRootValue),
    docsDirName,
    host,
    port,
    exclude,
    viewerProjectName,
    allowContainerHost,
  };
}

export function assertLocalOnlyHost(host: string, allowContainerHost = false): void {
  const allowed = new Set(['127.0.0.1', 'localhost', '::1']);
  if (!allowed.has(host) && !(allowContainerHost && host === '0.0.0.0')) {
    throw new Error('Unsafe host rejected. Use 127.0.0.1, localhost, or ::1.');
  }
}

async function readRawConfig(configPath: string): Promise<RawConfig> {
  try {
    const content = await readFile(configPath, 'utf8');
    return JSON.parse(content) as RawConfig;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

function envNumber(value: string | undefined): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringArrayValue(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : fallback;
}

function assertValidPort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid port.');
  }
}
