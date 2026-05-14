import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DocViewerConfig } from '../server/config';
import { PathGuardError, resolveMarkdownDocumentPath } from '../server/pathGuard';

let tempRoot: string;
let config: DocViewerConfig;

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), 'doc-viewer-'));
  await mkdir(path.join(tempRoot, 'project-a', 'docs'), { recursive: true });
  await writeFile(path.join(tempRoot, 'project-a', 'docs', 'index.md'), '# Index\n');
  await writeFile(path.join(tempRoot, 'project-a', 'secret.txt'), 'secret');
  await writeFile(path.join(tempRoot, 'outside.md'), '# Outside\n');

  config = {
    projectsRoot: tempRoot,
    docsDirName: 'docs',
    host: '127.0.0.1',
    port: 4321,
    exclude: [],
    viewerProjectName: 'doc-viewer',
    allowContainerHost: false,
  };
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

describe('path guard', () => {
  it('allows docs/index.md inside the project docs directory', async () => {
    const resolved = await resolveMarkdownDocumentPath('project-a', 'docs/index.md', config);

    expect(resolved.relativePath).toBe('index.md');
    expect(resolved.filePath.endsWith(path.join('project-a', 'docs', 'index.md'))).toBe(true);
  });

  it('rejects ../secret.txt traversal', async () => {
    await expect(resolveMarkdownDocumentPath('project-a', '../secret.txt', config)).rejects.toBeInstanceOf(PathGuardError);
  });

  it('rejects docs/../../secret.txt traversal', async () => {
    await expect(resolveMarkdownDocumentPath('project-a', 'docs/../../secret.txt', config)).rejects.toBeInstanceOf(PathGuardError);
  });

  it('rejects node_modules paths', async () => {
    await mkdir(path.join(tempRoot, 'project-a', 'docs', 'node_modules', 'pkg'), { recursive: true });
    await writeFile(path.join(tempRoot, 'project-a', 'docs', 'node_modules', 'pkg', 'readme.md'), '# Package\n');

    await expect(resolveMarkdownDocumentPath('project-a', 'node_modules/pkg/readme.md', config)).rejects.toBeInstanceOf(PathGuardError);
  });

  it('rejects .git paths', async () => {
    await mkdir(path.join(tempRoot, 'project-a', 'docs', '.git'), { recursive: true });
    await writeFile(path.join(tempRoot, 'project-a', 'docs', '.git', 'config.md'), '# Git\n');

    await expect(resolveMarkdownDocumentPath('project-a', '.git/config.md', config)).rejects.toBeInstanceOf(PathGuardError);
  });

  it('rejects non-markdown files', async () => {
    await writeFile(path.join(tempRoot, 'project-a', 'docs', 'notes.txt'), 'notes');

    await expect(resolveMarkdownDocumentPath('project-a', 'notes.txt', config)).rejects.toBeInstanceOf(PathGuardError);
  });

  it('rejects files whose real path is outside docs', async () => {
    try {
      await symlink(path.join(tempRoot, 'outside.md'), path.join(tempRoot, 'project-a', 'docs', 'leak.md'));
    } catch {
      return;
    }

    await expect(resolveMarkdownDocumentPath('project-a', 'leak.md', config)).rejects.toBeInstanceOf(PathGuardError);
  });
});
