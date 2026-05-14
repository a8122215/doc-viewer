import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { DocViewerConfig } from './config';

export interface ResolvedMarkdownDocument {
  filePath: string;
  docsRoot: string;
  projectRoot: string;
  relativePath: string;
}

export class PathGuardError extends Error {
  constructor(
    public readonly publicMessage = 'Document not found',
    public readonly statusCode = 404,
  ) {
    super(publicMessage);
    this.name = 'PathGuardError';
  }
}

const blockedSegments = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.vite', 'coverage']);

export async function resolveProjectDocsRoot(projectId: string, config: DocViewerConfig): Promise<{ projectRoot: string; docsRoot: string }> {
  validateProjectId(projectId, config);

  const projectsRoot = await checkedRealpath(config.projectsRoot);
  const projectRootCandidate = path.resolve(projectsRoot, projectId);

  if (path.dirname(projectRootCandidate) !== projectsRoot) {
    throw new PathGuardError();
  }

  const projectRoot = await checkedRealpath(projectRootCandidate);
  if (path.dirname(projectRoot) !== projectsRoot) {
    throw new PathGuardError();
  }

  const docsRootCandidate = path.join(projectRoot, config.docsDirName);
  const docsRoot = await checkedRealpath(docsRootCandidate);
  if (!isInsideOrEqual(projectRoot, docsRoot)) {
    throw new PathGuardError();
  }

  const docsStats = await stat(docsRoot);
  if (!docsStats.isDirectory()) {
    throw new PathGuardError();
  }

  return { projectRoot, docsRoot };
}

export async function resolveMarkdownDocumentPath(projectId: string, docId: string, config: DocViewerConfig): Promise<ResolvedMarkdownDocument> {
  const relativePath = normalizeDocumentId(docId, config.docsDirName);
  const { projectRoot, docsRoot } = await resolveProjectDocsRoot(projectId, config);
  const candidate = path.resolve(docsRoot, relativePath);

  if (!isInsideOrEqual(docsRoot, candidate)) {
    throw new PathGuardError();
  }

  const filePath = await checkedRealpath(candidate);
  if (!isInsideOrEqual(docsRoot, filePath)) {
    throw new PathGuardError();
  }

  const fileStats = await stat(filePath);
  if (!fileStats.isFile() || path.extname(filePath).toLowerCase() !== '.md') {
    throw new PathGuardError();
  }

  return {
    filePath,
    docsRoot,
    projectRoot,
    relativePath,
  };
}

export function normalizeDocumentId(docId: string, docsDirName: string): string {
  if (typeof docId !== 'string' || docId.length === 0 || docId.includes('\0')) {
    throw new PathGuardError('Invalid document id', 400);
  }

  const slashNormalized = docId.replaceAll('\\', '/');
  if (slashNormalized.startsWith('/') || /^[A-Za-z]:/.test(slashNormalized)) {
    throw new PathGuardError('Invalid document id', 400);
  }

  const docsPrefix = `${docsDirName}/`;
  const withoutDocsPrefix = slashNormalized.startsWith(docsPrefix)
    ? slashNormalized.slice(docsPrefix.length)
    : slashNormalized;
  const segments = withoutDocsPrefix.split('/');

  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    throw new PathGuardError('Invalid document id', 400);
  }

  if (segments.some((segment) => blockedSegments.has(segment))) {
    throw new PathGuardError('Invalid document id', 400);
  }

  const normalized = path.posix.normalize(withoutDocsPrefix);
  if (normalized.startsWith('../') || normalized === '..' || path.posix.isAbsolute(normalized)) {
    throw new PathGuardError('Invalid document id', 400);
  }

  if (path.posix.extname(normalized).toLowerCase() !== '.md') {
    throw new PathGuardError('Invalid document id', 400);
  }

  return normalized;
}

function validateProjectId(projectId: string, config: DocViewerConfig): void {
  if (
    typeof projectId !== 'string' ||
    projectId.length === 0 ||
    projectId.includes('\0') ||
    projectId.includes('/') ||
    projectId.includes('\\') ||
    projectId === '.' ||
    projectId === '..' ||
    projectId === config.viewerProjectName ||
    config.exclude.includes(`${projectId}/**`)
  ) {
    throw new PathGuardError('Invalid project id', 400);
  }
}

function isInsideOrEqual(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function checkedRealpath(targetPath: string): Promise<string> {
  try {
    return await realpath(targetPath);
  } catch {
    throw new PathGuardError();
  }
}
