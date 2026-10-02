import { copyFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';

await build({
    entryPoints: ['src/index.js'],
    outfile: 'index.js',
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2022'],
    charset: 'utf8',
    legalComments: 'eof',
    banner: {
        js: '/* 繁體匯入 v1.0.0 — bundled with opencc-js 1.4.2 */',
    },
});

await mkdir('third-party', { recursive: true });
await copyFile('node_modules/opencc-js/LICENSE', 'third-party/opencc-js-LICENSE');

console.log('Built index.js and copied the OpenCC license.');
