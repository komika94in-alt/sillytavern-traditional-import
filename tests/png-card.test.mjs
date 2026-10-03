import assert from 'node:assert/strict';
import test from 'node:test';

import {
    extractCharacterCardFromPng,
    getPngImagePayload,
    parsePng,
    rewriteCharacterCardPng,
} from '../src/png-card.js';

const ONE_PIXEL_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
);

let crcTable;
function crc32(bytes) {
    crcTable ??= Array.from({ length: 256 }, (_, index) => {
        let value = index;
        for (let bit = 0; bit < 8; bit++) {
            value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
        }
        return value >>> 0;
    });
    let value = 0xFFFFFFFF;
    for (const byte of bytes) value = crcTable[(value ^ byte) & 0xFF] ^ (value >>> 8);
    return (value ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
    return Buffer.concat([length, typeBytes, data, checksum]);
}

function addCard(png, card) {
    const bytes = new Uint8Array(png);
    const chunks = parsePng(bytes);
    const signature = bytes.slice(0, 8);
    const encoded = Buffer.from(JSON.stringify(card), 'utf8').toString('base64');
    const text = makeChunk('tEXt', Buffer.concat([
        Buffer.from('chara', 'ascii'),
        Buffer.from([0]),
        Buffer.from(encoded, 'ascii'),
    ]));
    const output = [Buffer.from(signature)];
    for (const chunk of chunks) {
        if (chunk.type === 'IEND') output.push(text);
        output.push(Buffer.from(chunk.raw));
    }
    return Buffer.concat(output);
}

test('PNG 角色資料轉繁且 IDAT 圖像資料完全相同', () => {
    const card = {
        name: '模拟器',
        description: '进入房间。',
        data: {
            name: '模拟器',
            description: '进入房间。',
            character_book: {
                entries: [{ uid: 1, key: ['图书馆'], content: '世界说明。' }],
            },
        },
    };
    const original = addCard(ONE_PIXEL_PNG, card);
    const originalPayload = getPngImagePayload(original);
    const result = rewriteCharacterCardPng(original);
    const convertedPayload = getPngImagePayload(result.bytes);
    const extracted = extractCharacterCardFromPng(result.bytes).card;

    assert.deepEqual(convertedPayload, originalPayload);
    assert.equal(extracted.name, '模擬器');
    assert.equal(extracted.data.description, '進入房間。');
    assert.deepEqual(extracted.data.character_book.entries[0].key, ['圖書館']);
    assert.equal(extracted.data.character_book.entries[0].uid, 1);
});
