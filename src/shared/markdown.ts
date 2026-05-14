export interface HeadingItem {
  id: string;
  level: number;
  text: string;
}

const h1Pattern = /^#\s+(.+?)\s*#*\s*$/;
const headingPattern = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const mermaidFencePattern = /(^|\n)\s*(```|~~~)\s*mermaid\b/i;

export function extractTitleFromMarkdown(markdown: string): string | null {
  for (const line of markdownLinesOutsideFences(markdown)) {
    const match = line.match(h1Pattern);
    if (match) {
      const title = stripInlineMarkdown(match[1]).trim();
      return title.length > 0 ? title : null;
    }
  }

  return null;
}

export function titleFromPath(relativePath: string): string {
  const filename = relativePath.split('/').pop() ?? relativePath;
  const withoutExtension = filename.replace(/\.[^.]+$/, '');
  const spaced = withoutExtension.replace(/[-_]+/g, ' ').trim();

  if (!spaced) {
    return 'Untitled';
  }

  return spaced.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function containsMermaidBlock(markdown: string): boolean {
  return mermaidFencePattern.test(markdown);
}

export function extractHeadingsFromMarkdown(markdown: string): HeadingItem[] {
  const headings: HeadingItem[] = [];
  const seen = new Map<string, number>();

  for (const line of markdownLinesOutsideFences(markdown)) {
    const match = line.match(headingPattern);
    if (!match) {
      continue;
    }

    const text = stripInlineMarkdown(match[2]).trim();
    if (!text) {
      continue;
    }

    const baseId = slugifyHeading(text);
    const count = seen.get(baseId) ?? 0;
    seen.set(baseId, count + 1);

    headings.push({
      id: count === 0 ? baseId : `${baseId}-${count + 1}`,
      level: match[1].length,
      text,
    });
  }

  return headings;
}

export function stripInlineMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

function slugifyHeading(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');

  return slug || 'heading';
}

function markdownLinesOutsideFences(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const visibleLines: string[] = [];
  let fence: string | null = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```|~~~)/);
    if (fenceMatch) {
      if (fence === null) {
        fence = fenceMatch[1];
      } else if (fenceMatch[1] === fence) {
        fence = null;
      }
      continue;
    }

    if (fence === null) {
      visibleLines.push(line);
    }
  }

  return visibleLines;
}
