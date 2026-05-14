import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import type { DocContent, DocSummary, ProjectSummary } from '../src/shared/api';
import { extractTitleFromMarkdown, titleFromPath } from '../src/shared/markdown';
import type { DocViewerConfig } from './config';
import { PathGuardError, resolveMarkdownDocumentPath, resolveProjectDocsRoot } from './pathGuard';

const innerDocsIgnores = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/.next/**', '**/.vite/**', '**/coverage/**'];

export async function listProjects(config: DocViewerConfig): Promise<ProjectSummary[]> {
  const entries = await readdir(config.projectsRoot, { withFileTypes: true });
  const projects: ProjectSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === config.viewerProjectName || isProjectExcluded(entry.name, config.exclude)) {
      continue;
    }

    try {
      const docsRootPath = path.join(config.projectsRoot, entry.name, config.docsDirName);
      const docsRootStats = await stat(docsRootPath);
      if (!docsRootStats.isDirectory()) {
        continue;
      }

      const docs = await listProjectDocs(entry.name, config);
      const updatedAt = docs.length > 0
        ? maxIsoDate(docs.map((doc) => doc.updatedAt))
        : docsRootStats.mtime.toISOString();

      projects.push({
        id: entry.name,
        name: entry.name,
        docsCount: docs.length,
        updatedAt,
      });
    } catch (error) {
      if (!(error instanceof PathGuardError) && !isNotFoundError(error)) {
        throw error;
      }
    }
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listProjectDocs(projectId: string, config: DocViewerConfig): Promise<DocSummary[]> {
  const { docsRoot } = await resolveProjectDocsRoot(projectId, config);
  const matches = await fg('**/*.md', {
    cwd: docsRoot,
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: false,
    ignore: innerDocsIgnores,
  });
  const docs: DocSummary[] = [];

  for (const match of matches) {
    const relativePath = match.split(path.sep).join('/');

    try {
      const resolved = await resolveMarkdownDocumentPath(projectId, relativePath, config);
      const [markdown, fileStats] = await Promise.all([
        readFile(resolved.filePath, 'utf8'),
        stat(resolved.filePath),
      ]);
      const title = extractTitleFromMarkdown(markdown) ?? titleFromPath(resolved.relativePath);

      docs.push({
        id: resolved.relativePath,
        title,
        relativePath: resolved.relativePath,
        updatedAt: fileStats.mtime.toISOString(),
      });
    } catch (error) {
      if (!(error instanceof PathGuardError)) {
        throw error;
      }
    }
  }

  return docs.sort(compareDocs);
}

export async function readProjectDocument(projectId: string, docId: string, config: DocViewerConfig): Promise<DocContent> {
  const resolved = await resolveMarkdownDocumentPath(projectId, docId, config);
  const [markdown, fileStats] = await Promise.all([
    readFile(resolved.filePath, 'utf8'),
    stat(resolved.filePath),
  ]);
  const title = extractTitleFromMarkdown(markdown) ?? titleFromPath(resolved.relativePath);

  return {
    id: resolved.relativePath,
    projectId,
    docId: resolved.relativePath,
    relativePath: resolved.relativePath,
    title,
    markdown,
    updatedAt: fileStats.mtime.toISOString(),
  };
}

function compareDocs(a: DocSummary, b: DocSummary): number {
  if (a.relativePath === 'index.md') {
    return -1;
  }

  if (b.relativePath === 'index.md') {
    return 1;
  }

  return a.relativePath.localeCompare(b.relativePath);
}

function maxIsoDate(values: string[]): string {
  return values.reduce((latest, value) => (Date.parse(value) > Date.parse(latest) ? value : latest));
}

function isProjectExcluded(projectName: string, exclude: string[]): boolean {
  return exclude.includes(`${projectName}/**`);
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
