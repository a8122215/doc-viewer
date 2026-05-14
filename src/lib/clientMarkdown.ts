import DOMPurify from 'dompurify';
import { marked } from 'marked';

export function renderMarkdownToSafeHtml(markdown: string): string {
  const parsed = marked.parse(markdown, {
    async: false,
    gfm: true,
    breaks: false,
  });

  if (typeof parsed !== 'string') {
    throw new Error('Unexpected async markdown parse result.');
  }

  return DOMPurify.sanitize(parsed, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['class', 'target', 'rel'],
  });
}

export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
}
