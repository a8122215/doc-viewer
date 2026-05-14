import { useEffect, useMemo, useRef } from 'react';
import mermaid from 'mermaid';
import { extractHeadingsFromMarkdown, type HeadingItem } from '../shared/markdown';
import { renderMarkdownToSafeHtml, sanitizeSvg } from '../lib/clientMarkdown';

interface MarkdownViewerProps {
  markdown: string;
}

const attentionTerms = ['TODO', 'FIXME', '未対応', '要確認', '未決定'];

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
});

export default function MarkdownViewer({ markdown }: MarkdownViewerProps) {
  const articleRef = useRef<HTMLElement | null>(null);
  const headings = useMemo(() => extractHeadingsFromMarkdown(markdown), [markdown]);
  const html = useMemo(() => renderMarkdownToSafeHtml(markdown), [markdown]);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) {
      return undefined;
    }

    let cancelled = false;
    assignHeadingIds(article, headings);
    hardenLinks(article);
    highlightAttentionLines(article);

    void renderMermaidBlocks(article, () => cancelled);

    return () => {
      cancelled = true;
    };
  }, [html, headings]);

  return (
    <>
      {headings.length > 0 ? <TableOfContents headings={headings} /> : null}
      <article
        ref={articleRef}
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}

function TableOfContents({ headings }: { headings: HeadingItem[] }) {
  return (
    <nav className="toc" aria-label="見出し目次">
      {headings.map((heading) => (
        <a
          key={`${heading.id}-${heading.level}-${heading.text}`}
          className={`toc-link toc-level-${heading.level}`}
          href={`#${heading.id}`}
        >
          {heading.text}
        </a>
      ))}
    </nav>
  );
}

function assignHeadingIds(article: HTMLElement, headings: HeadingItem[]): void {
  const headingElements = Array.from(article.querySelectorAll<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6'));
  headingElements.forEach((element, index) => {
    const heading = headings[index];
    if (heading) {
      element.id = heading.id;
    }
  });
}

function hardenLinks(article: HTMLElement): void {
  article.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
    link.rel = 'noopener noreferrer';
    link.target = '_blank';
  });
}

function highlightAttentionLines(article: HTMLElement): void {
  article.querySelectorAll<HTMLElement>('p, li, td, th, blockquote, h1, h2, h3, h4, h5, h6').forEach((element) => {
    if (containsAttentionTerm(element.textContent ?? '')) {
      element.classList.add('attention-line');
    }
  });

  article.querySelectorAll<HTMLElement>('pre > code').forEach((code) => {
    if (code.classList.contains('language-mermaid')) {
      return;
    }

    const lines = (code.textContent ?? '').split('\n');
    code.replaceChildren(...lines.map((line) => {
      const span = document.createElement('span');
      span.className = containsAttentionTerm(line) ? 'code-line attention-line' : 'code-line';
      span.textContent = line || ' ';
      return span;
    }));
  });
}

async function renderMermaidBlocks(article: HTMLElement, isCancelled: () => boolean): Promise<void> {
  const blocks = Array.from(article.querySelectorAll<HTMLElement>('pre > code.language-mermaid'));

  for (const [index, block] of blocks.entries()) {
    const source = block.textContent ?? '';
    const pre = block.parentElement;
    if (!pre) {
      continue;
    }

    const container = document.createElement('div');
    container.className = 'mermaid-diagram';

    try {
      const renderId = `mermaid-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`;
      const result = await mermaid.render(renderId, source);
      if (isCancelled()) {
        return;
      }

      container.innerHTML = sanitizeSvg(result.svg);
      pre.replaceWith(container);
    } catch {
      if (isCancelled()) {
        return;
      }

      const error = document.createElement('pre');
      error.className = 'mermaid-error';
      error.textContent = 'Mermaid diagram could not be rendered.';
      pre.replaceWith(error);
    }
  }
}

function containsAttentionTerm(value: string): boolean {
  return attentionTerms.some((term) => value.includes(term));
}
