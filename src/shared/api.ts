export interface ProjectSummary {
  id: string;
  name: string;
  docsCount: number;
  updatedAt: string;
}

export interface DocSummary {
  id: string;
  title: string;
  relativePath: string;
  updatedAt: string;
}

export interface DocContent extends DocSummary {
  projectId: string;
  docId: string;
  markdown: string;
}
