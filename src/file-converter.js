import { convertFileName, createStats } from './converter.js';
import { convertCharacterCard, convertPreset, convertWorldBook } from './schemas.js';
import { convertCharacterPngFile } from './png-card.js';

const converters = {
    character: convertCharacterCard,
    preset: convertPreset,
    world: convertWorldBook,
};

export async function convertImportFile(file, kind) {
    const stats = createStats();
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (kind === 'character' && extension === 'png') {
        return convertCharacterPngFile(file, stats);
    }

    if (!['json', 'settings', 'lorebook'].includes(extension)) {
        throw new Error(`不支援 .${extension || '(無副檔名)'}；此入口只接受 JSON${kind === 'character' ? ' 或 PNG' : ''}。`);
    }

    let input;
    try {
        input = JSON.parse(await file.text());
    } catch (error) {
        throw new Error(`JSON 無法解析：${error.message}`);
    }

    const converter = converters[kind];
    if (!converter) {
        throw new Error(`未知的匯入類型：${kind}`);
    }

    const data = converter(input, stats);
    const output = new File(
        [JSON.stringify(data, null, 4)],
        convertFileName(file.name, stats),
        { type: 'application/json', lastModified: file.lastModified },
    );

    return { file: output, data, stats };
}
