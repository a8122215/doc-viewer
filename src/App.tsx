import { useEffect, useMemo, useState } from 'react';
import type { DocContent, DocSummary, ProjectSummary } from './shared/api';
import { fetchDocument, fetchProjectDocs, fetchProjects } from './api';
import MarkdownViewer from './components/MarkdownViewer';

const refreshIntervalMs = 5000;

export default function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [currentDoc, setCurrentDoc] = useState<DocContent | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [docSearch, setDocSearch] = useState('');
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      setProjectsLoading(true);
      setError(null);

      try {
        const nextProjects = await fetchProjects();
        if (cancelled) {
          return;
        }

        setProjects(nextProjects);
        setSelectedProjectId((current) => current ?? nextProjects[0]?.id ?? null);
      } catch (loadError) {
        if (!cancelled) {
          setError(toErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setProjectsLoading(false);
        }
      }
    }

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setDocs([]);
      setCurrentDoc(null);
      return undefined;
    }

    const projectId = selectedProjectId;
    let cancelled = false;

    async function loadDocs() {
      setDocsLoading(true);
      setError(null);
      setDocs([]);
      setCurrentDoc(null);

      try {
        const nextDocs = await fetchProjectDocs(projectId);
        if (cancelled) {
          return;
        }

        setDocs(nextDocs);
        setSelectedDocId((current) => {
          if (current && nextDocs.some((doc) => doc.id === current)) {
            return current;
          }

          return nextDocs.find((doc) => doc.relativePath === 'index.md')?.id ?? nextDocs[0]?.id ?? null;
        });
      } catch (loadError) {
        if (!cancelled) {
          setSelectedDocId(null);
          setError(toErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setDocsLoading(false);
        }
      }
    }

    void loadDocs();

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      return undefined;
    }

    const projectId = selectedProjectId;
    let cancelled = false;

    async function refreshDocs() {
      if (document.visibilityState !== 'visible') {
        return;
      }

      try {
        const nextDocs = await fetchProjectDocs(projectId);
        if (cancelled) {
          return;
        }

        setDocs(nextDocs);
        setSelectedDocId((current) => {
          if (current && nextDocs.some((doc) => doc.id === current)) {
            return current;
          }

          return nextDocs.find((doc) => doc.relativePath === 'index.md')?.id ?? nextDocs[0]?.id ?? null;
        });
      } catch {
        // Keep the current view stable during background refresh failures.
      }
    }

    const intervalId = window.setInterval(() => {
      void refreshDocs();
    }, refreshIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !selectedDocId) {
      setCurrentDoc(null);
      return undefined;
    }

    const projectId = selectedProjectId;
    const docId = selectedDocId;
    let cancelled = false;

    async function loadDocument() {
      setDocLoading(true);
      setError(null);

      try {
        const nextDoc = await fetchDocument(projectId, docId);
        if (!cancelled) {
          setCurrentDoc(nextDoc);
        }
      } catch (loadError) {
        if (!cancelled) {
          setCurrentDoc(null);
          setError(toErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setDocLoading(false);
        }
      }
    }

    void loadDocument();

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, selectedDocId]);

  useEffect(() => {
    if (!selectedProjectId || !selectedDocId) {
      return undefined;
    }

    const projectId = selectedProjectId;
    const docId = selectedDocId;
    let cancelled = false;

    async function refreshDocument() {
      if (document.visibilityState !== 'visible') {
        return;
      }

      try {
        const nextDoc = await fetchDocument(projectId, docId);
        if (!cancelled) {
          setCurrentDoc(nextDoc);
        }
      } catch {
        // The explicit load path still surfaces errors; background refresh should not replace content with an error.
      }
    }

    const intervalId = window.setInterval(() => {
      void refreshDocument();
    }, refreshIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedProjectId, selectedDocId]);

  const filteredProjects = useMemo(
    () => filterByText(projects, projectSearch, (project) => `${project.name} ${project.id}`),
    [projects, projectSearch],
  );
  const filteredDocs = useMemo(
    () => filterByText(docs, docSearch, (doc) => `${doc.title} ${doc.relativePath}`),
    [docs, docSearch],
  );
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  return (
    <div className="app-shell">
      <aside className="pane project-pane">
        <div className="pane-header">
          <h1>Doc Viewer</h1>
          <span className="meta-count">{projects.length}</span>
        </div>
        <input
          className="search-input"
          type="search"
          value={projectSearch}
          onChange={(event) => setProjectSearch(event.target.value)}
          placeholder="プロジェクト検索"
          aria-label="プロジェクト検索"
        />
        <div className="list-scroll">
          {projectsLoading ? <LoadingLine label="プロジェクトを読み込み中" /> : null}
          {!projectsLoading && filteredProjects.length === 0 ? <EmptyLine label="プロジェクトがありません" /> : null}
          {filteredProjects.map((project) => (
            <button
              key={project.id}
              className={project.id === selectedProjectId ? 'list-item is-active' : 'list-item'}
              type="button"
              onClick={() => {
                setSelectedProjectId(project.id);
                setSelectedDocId(null);
                setDocSearch('');
              }}
            >
              <span className="item-title">{project.name}</span>
              <span className="item-meta">{project.docsCount} docs · {formatDate(project.updatedAt)}</span>
            </button>
          ))}
        </div>
      </aside>

      <aside className="pane docs-pane">
        <div className="pane-header">
          <h2>{selectedProject?.name ?? 'Documents'}</h2>
          <span className="meta-count">{docs.length}</span>
        </div>
        <input
          className="search-input"
          type="search"
          value={docSearch}
          onChange={(event) => setDocSearch(event.target.value)}
          placeholder="ドキュメント検索"
          aria-label="ドキュメント検索"
          disabled={!selectedProjectId}
        />
        <div className="list-scroll">
          {docsLoading ? <LoadingLine label="ドキュメントを読み込み中" /> : null}
          {!docsLoading && selectedProjectId && filteredDocs.length === 0 ? <EmptyLine label="ドキュメントがありません" /> : null}
          {filteredDocs.map((doc) => (
            <button
              key={doc.id}
              className={doc.id === selectedDocId ? 'list-item doc-item is-active' : 'list-item doc-item'}
              type="button"
              onClick={() => setSelectedDocId(doc.id)}
            >
              <span className="item-title">{doc.title}</span>
              <span className="item-path">{doc.relativePath}</span>
              <span className="item-meta">{formatDate(doc.updatedAt)}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="reader-pane">
        {error ? <div className="error-banner">{error}</div> : null}
        {docLoading ? <LoadingLine label="本文を読み込み中" /> : null}
        {!docLoading && currentDoc ? (
          <>
            <header className="document-header">
              <div>
                <p className="document-project">{currentDoc.projectId}</p>
                <h2>{currentDoc.title}</h2>
              </div>
              <div className="document-meta">
                <span>{currentDoc.relativePath}</span>
                <time dateTime={currentDoc.updatedAt}>{formatDate(currentDoc.updatedAt)}</time>
              </div>
            </header>
            <MarkdownViewer markdown={currentDoc.markdown} />
          </>
        ) : null}
        {!docLoading && !currentDoc && !error ? <EmptyReader /> : null}
      </main>
    </div>
  );
}

function LoadingLine({ label }: { label: string }) {
  return <div className="state-line is-loading">{label}</div>;
}

function EmptyLine({ label }: { label: string }) {
  return <div className="state-line">{label}</div>;
}

function EmptyReader() {
  return (
    <div className="empty-reader">
      <h2>No document selected</h2>
    </div>
  );
}

function filterByText<T>(items: T[], search: string, getText: (item: T) => string): T[] {
  const normalized = search.trim().toLowerCase();
  if (!normalized) {
    return items;
  }

  return items.filter((item) => getText(item).toLowerCase().includes(normalized));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}
