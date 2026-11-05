import path from 'node:path';
import fs from 'node:fs';

// Put both SQLite and user photos on the hosting provider's persistent disk.
export const dataDirectory = path.resolve(process.env.DATA_DIR || 'data');
export const uploadsDirectory = path.resolve(process.env.UPLOADS_DIR || 'uploads');
for (const directory of [dataDirectory, uploadsDirectory]) {
  fs.mkdirSync(directory, { recursive: true });
}
