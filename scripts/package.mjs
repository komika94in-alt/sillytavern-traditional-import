import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseDirectory = path.join(projectDirectory, 'release');
const stagedDirectory = path.join(releaseDirectory, 'sillytavern-traditional-import');
const zipPath = path.join(releaseDirectory, 'sillytavern-traditional-import-v1.0.1.zip');

await rm(stagedDirectory, { recursive: true, force: true });
await rm(zipPath, { force: true });
await mkdir(stagedDirectory, { recursive: true });

for (const item of [
    'manifest.json',
    'index.js',
    'style.css',
    'README.md',
    'LICENSE',
    'third-party',
]) {
    await cp(path.join(projectDirectory, item), path.join(stagedDirectory, item), { recursive: true });
}

const packageScript = `Compress-Archive -LiteralPath '${stagedDirectory.replaceAll("'", "''")}' -DestinationPath '${zipPath.replaceAll("'", "''")}' -CompressionLevel Optimal`;

await execFileAsync('powershell', ['-NoProfile', '-Command', packageScript]);

const manifest = JSON.parse(await readFile(path.join(stagedDirectory, 'manifest.json'), 'utf8'));
await writeFile(path.join(releaseDirectory, 'BUILD-INFO.json'), JSON.stringify({
    name: manifest.display_name,
    version: manifest.version,
    artifact: path.basename(zipPath),
    createdAt: new Date().toISOString(),
}, null, 2));

console.log(`Created ${zipPath}`);
