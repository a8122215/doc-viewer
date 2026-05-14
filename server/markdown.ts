import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const allowedTags = sanitizeHtml.defaults.allowedTags.concat([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
]);

export function renderMarkdownToSafeHtml(markdown: string): string {
  const parsed = marked.parse(markdown, {
    async: false,
    gfm: true,
    breaks: false,
  });

  if (typeof parsed !== 'string') {
    throw new Error('Unexpected async markdown parse result.');
  }

  return sanitizeHtml(parsed, {
    allowedTags,
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      code: ['class'],
      img: ['src', 'alt', 'title'],
      th: ['align'],
      td: ['align'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    disallowedTagsMode: 'discard',
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'noopener noreferrer',
      }, true),
    },
  });
}
