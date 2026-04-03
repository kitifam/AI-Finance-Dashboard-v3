import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const LOCAL_CSV_ROUTE = '/__local-default-csv';

/** Serves DEFAULT_CSV_PATH from disk during dev / preview only (browser cannot read R:\...). */
function localDefaultCsvPlugin(resolvedFilePath: string): Plugin {
  const middleware = (
    req: { url?: string },
    res: { statusCode?: number; setHeader: (k: string, v: string) => void; end: (b?: string) => void },
    next: () => void
  ) => {
    const url = req.url?.split('?')[0];
    if (url !== LOCAL_CSV_ROUTE) {
      next();
      return;
    }
    fs.readFile(resolvedFilePath, 'utf8', (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('X-Local-Default-Csv', '1');
      res.end(data);
    });
  };
  return {
    name: 'local-default-csv',
    configureServer(server) {
      server.middlewares.use(middleware as never);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware as never);
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // .env / .env.local: DEFAULT_CSV_PATH (optional). If unset, defaults to R:\FastBudget.csv
    const csvPathRaw = env.DEFAULT_CSV_PATH?.trim();
    const csvPath = csvPathRaw && csvPathRaw.length > 0 ? csvPathRaw : 'R:\\FastBudget.csv';
    const resolvedCsvPath = path.resolve(csvPath);

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), localDefaultCsvPlugin(resolvedCsvPath)],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
