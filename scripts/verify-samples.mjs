import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { convertImportFile } from '../src/file-converter.js';
import { extractCharacterCardFromPng, getPngImagePayload } from '../src/png-card.js';

const sampleDirectory = process.env.STTI_SAMPLE_DIR
    ?? 'C:\\Users\\komic\\.codex\\codex-remote-attachments\\01a0fb98-d5fd-7c90-a7b6-9b8448c2e461\\188983A3-9D41-4562-A8B9-0FB49A5863EB';

const samples = {
    world: '4-see-see-your-pussy3.0.json',
    regex: '5-char-.json',
    preset: '6-日月西-float-v0.1-电波系.json',
    character: '7-1.PNG',
};

function hash(bytes) {
    return createHash('sha256').update(bytes).digest('hex');
}

async function loadFile(name, type) {
    const bytes = await readFile(path.join(sampleDirectory, name));
    return {
        bytes,
        file: new File([bytes], name, { type }),
        hash: hash(bytes),
    };
}

const worldSource = await loadFile(samples.world, 'application/json');
const worldOriginal = JSON.parse(worldSource.bytes.toString('utf8'));
const worldResult = await convertImportFile(worldSource.file, 'world');
assert.equal(Object.keys(worldResult.data.entries).length, 12);
assert.equal(worldResult.data.entries['0'].uid, worldOriginal.entries['0'].uid);
assert.equal(worldResult.data.entries['6'].key.length, worldOriginal.entries['6'].key.length);
assert.match(worldResult.data.entries['0'].content, /絕對禁止照搬照抄/);
assert.match(worldResult.data.entries['0'].content, /<原创性约束>/);

const presetSource = await loadFile(samples.preset, 'application/json');
const presetOriginal = JSON.parse(presetSource.bytes.toString('utf8'));
const presetResult = await convertImportFile(presetSource.file, 'preset');
assert.equal(presetResult.data.prompts.length, 159);
assert.deepEqual(
    presetResult.data.prompts.map(prompt => prompt.identifier),
    presetOriginal.prompts.map(prompt => prompt.identifier),
);
const formattedPrompt = presetResult.data.prompts.find(prompt => prompt.identifier === 'story_output_format');
assert.match(formattedPrompt.content, /當前正在進行的日程/);
assert.match(formattedPrompt.content, /\{\{当前日程\}\}/);

const characterSource = await loadFile(samples.character, 'image/png');
const originalPayload = getPngImagePayload(characterSource.bytes);
const characterResult = await convertImportFile(characterSource.file, 'character');
const convertedBytes = new Uint8Array(await characterResult.file.arrayBuffer());
const convertedPayload = getPngImagePayload(convertedBytes);
const convertedCard = extractCharacterCardFromPng(convertedBytes).card;
assert.deepEqual(convertedPayload, originalPayload);
assert.equal(convertedCard.data.name, '抹布模擬器');
assert.equal(convertedCard.data.character_book.entries.length, 22);

const regexSource = await loadFile(samples.regex, 'application/json');
await assert.rejects(() => convertImportFile(regexSource.file, 'preset'), /找不到 prompts/);

assert.equal(hash(await readFile(path.join(sampleDirectory, samples.world))), worldSource.hash);
assert.equal(hash(await readFile(path.join(sampleDirectory, samples.preset))), presetSource.hash);
assert.equal(hash(await readFile(path.join(sampleDirectory, samples.character))), characterSource.hash);

console.log(JSON.stringify({
    world: {
        entries: Object.keys(worldResult.data.entries).length,
        changedStrings: worldResult.stats.changedStrings,
    },
    preset: {
        prompts: presetResult.data.prompts.length,
        changedStrings: presetResult.stats.changedStrings,
        protectedSegments: presetResult.stats.protectedSegments,
    },
    character: {
        embeddedWorldEntries: convertedCard.data.character_book.entries.length,
        changedStrings: characterResult.stats.changedStrings,
        imagePayloadUnchanged: true,
    },
    regexRejectedByDesign: true,
    sourceFilesUnchanged: true,
}, null, 2));
