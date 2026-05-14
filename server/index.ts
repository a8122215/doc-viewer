import path from 'node:path';
import { existsSync } from 'node:fs';
import express, { type NextFunction, type Request, type Response } from 'express';
import { loadConfig } from './config';
import { listProjectDocs, listProjects, readProjectDocument } from './docsService';
import { PathGuardError } from './pathGuard';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

const config = await loadConfig();
const app = express();

app.disable('x-powered-by');

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/projects', asyncRoute(async (_req, res) => {
  res.json(await listProjects(config));
}));

app.get('/api/projects/:projectId/docs', asyncRoute(async (req, res) => {
  res.json(await listProjectDocs(req.params.projectId, config));
}));

app.get('/api/projects/:projectId/docs/*', asyncRoute(async (req, res) => {
  const docId = req.params[0];
  res.json(await readProjectDocument(req.params.projectId, docId, config));
}));

const staticRoot = path.resolve(process.cwd(), 'dist');
if (existsSync(staticRoot)) {
  app.use(express.static(staticRoot, {
    extensions: ['html'],
    index: false,
    maxAge: '1h',
  }));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticRoot, 'index.html'));
  });
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof PathGuardError) {
    res.status(error.statusCode).json({ error: error.publicMessage });
    return;
  }

  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, config.host, () => {
  console.log(`doc-viewer API listening on http://${config.host}:${config.port}`);
});

function asyncRoute(handler: AsyncHandler): AsyncHandler {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}
