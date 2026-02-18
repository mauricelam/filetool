import express from 'express';
import type { Request, Response } from 'express';
import serveStatic from 'serve-static';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname: string = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port: number = 8080;

/**
 * Custom header logic for COOP/COEP (SharedArrayBuffer support)
 */
function setHeaders(res: Response, filePath: string): void {
  // filePath is the absolute path on the disk
  console.log(`Serving: ${filePath}`);

  // Note: serve-static provides the absolute OS path here
  // Using case-insensitive check and normalized separators
  if (filePath.toLowerCase().includes('ffmpeg') || filePath.toLowerCase().includes('libreoffice')) {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  }
}

// Redirect root "/" to "/filetool"
app.get('/', (req: Request, res: Response) => {
  res.redirect('/filetool');
});

// Map the URL path 'filetool' to the directory 'dist'
// Express automatically handles stripping '/filetool' before serveStatic looks at the disk
app.use('/filetool', serveStatic(path.join(__dirname, 'dist'), {
  setHeaders: setHeaders,
  index: ['index.html'] // Default file to serve
}));

// Optional: Fallback for requests not starting with /filetool
app.use((req: Request, res: Response) => {
  res.status(404).send(`Path "${req.url}" not found`);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/filetool/`);
});