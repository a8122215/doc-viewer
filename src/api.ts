import type { DocContent, DocSummary, ProjectSummary } from './shared/api';

export async function fetchProjects(): Promise<ProjectSummary[]> {
  return fetchJson<ProjectSummary[]>('/api/projects');
}

export async function fetchProjectDocs(projectId: string): Promise<DocSummary[]> {
  return fetchJson<DocSummary[]>(`/api/projects/${encodeURIComponent(projectId)}/docs`);
}

export async function fetchDocument(projectId: string, docId: string): Promise<DocContent> {
  return fetchJson<DocContent>(`/api/projects/${encodeURIComponent(projectId)}/docs/${encodeURIComponent(docId)}`);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    const error = await readError(response);
    throw new Error(error);
  }

  return response.json() as Promise<T>;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error.length > 0) {
      return body.error;
    }
  } catch {
    // Fall through to the generic status message.
  }

  return `Request failed with status ${response.status}`;
}
