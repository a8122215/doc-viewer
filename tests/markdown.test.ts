import { describe, expect, it } from 'vitest';
import { renderMarkdownToSafeHtml } from '../server/markdown';
import { containsMermaidBlock, extractTitleFromMarkdown, titleFromPath } from '../src/shared/markdown';

describe('markdown helpers', () => {
  it('extracts title from the first h1', () => {
    expect(extractTitleFromMarkdown('# Title\n\nBody')).toBe('Title');
  });

  it('generates title from the filename when no h1 exists', () => {
    expect(titleFromPath('phase/implementation-plan.md')).toBe('Implementation Plan');
  });

  it('detects Mermaid code blocks', () => {
    const markdown = [
      '# Sample',
      '',
      '```mermaid',
      'flowchart TD',
      '  A --> B',
      '```',
    ].join('\n');

    expect(containsMermaidBlock(markdown)).toBe(true);
  });

  it('does not emit executable script html', () => {
    const html = renderMarkdownToSafeHtml('# X\n\n<script>alert(1)</script>\n<img src="x" onerror="alert(1)">');

    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
  });
});
