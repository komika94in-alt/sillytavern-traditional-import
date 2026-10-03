import { convertCharacterCard } from './schemas.js';
import { convertFileName, createStats } from './converter.js';

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const textDecoder = new TextDecoder('utf-8', { fatal: true });
const textEncoder = new TextEncoder();

let crcTable;

function getCrcTable() {
    if (crcTable) {
        return crcTable;
    }

    crcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index++) {
        let value = index;
        for (let bit = 0; bit < 8; bit++) {
            value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
        }
        crcTable[index] = value >>> 0;
    }
    return crcTable;
}

function crc32(bytes) {
    const table = getCrcTable();
    let crc = 0xFFFFFFFF;
    for (const byte of bytes) {
        crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function uint32Bytes(value) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value >>> 0, false);
    return bytes;
}

function concatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        output.set(part, offset);
        offset += part.length;
    }
    return output;
}

function asciiBytes(value) {
    return Uint8Array.from(Array.from(value, character => character.charCodeAt(0) & 0xFF));
}

function asciiText(bytes) {
    let output = '';
    for (const byte of bytes) {
        output += String.fromCharCode(byte);
    }
    return output;
}

function bytesToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
}

function base64ToBytes(value) {
    const binary = atob(value.replace(/\s+/g, ''));
    return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function encodeChunk(type, data) {
    const typeBytes = asciiBytes(type);
    const checksum = crc32(concatBytes([typeBytes, data]));
    return concatBytes([
        uint32Bytes(data.length),
        typeBytes,
        data,
        uint32Bytes(checksum),
    ]);
}

function decodeTextChunk(data) {
    const separator = data.indexOf(0);
    if (separator < 1) {
        return null;
    }
    return {
        keyword: asciiText(data.subarray(0, separator)),
        text: asciiText(data.subarray(separator + 1)),
    };
}

function encodeTextChunk(keyword, text) {
    return encodeChunk('tEXt', concatBytes([
        asciiBytes(keyword),
        new Uint8Array([0]),
        asciiBytes(text),
    ]));
}

export function parsePng(bytes) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (data.length < PNG_SIGNATURE.length
        || !PNG_SIGNATURE.every((byte, index) => data[index] === byte)) {
        throw new Error('檔案不是有效的 PNG。');
    }

    const chunks = [];
    let offset = PNG_SIGNATURE.length;

    while (offset + 12 <= data.length) {
        const length = new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, false);
        const end = offset + 12 + length;
        if (end > data.length) {
            throw new Error('PNG 區塊長度無效。');
        }

        const type = asciiText(data.subarray(offset + 4, offset + 8));
        chunks.push({
            type,
            data: data.slice(offset + 8, offset + 8 + length),
            raw: data.slice(offset, end),
        });
        offset = end;

        if (type === 'IEND') {
            break;
        }
    }

    if (!chunks.some(chunk => chunk.type === 'IEND')) {
        throw new Error('PNG 缺少 IEND 區塊。');
    }

    return chunks;
}

function decodeCharacterChunk(chunk) {
    if (chunk.type !== 'tEXt') {
        return null;
    }

    const decoded = decodeTextChunk(chunk.data);
    const keyword = decoded?.keyword?.toLowerCase();
    if (keyword !== 'chara' && keyword !== 'ccv3') {
        return null;
    }

    try {
        const jsonBytes = base64ToBytes(decoded.text);
        return {
            keyword: decoded.keyword,
            normalizedKeyword: keyword,
            card: JSON.parse(textDecoder.decode(jsonBytes)),
        };
    } catch (error) {
        throw new Error(`PNG 的 ${decoded.keyword} 角色資料無法解析：${error.message}`);
    }
}

export function extractCharacterCardFromPng(bytes) {
    const chunks = parsePng(bytes);
    const cards = chunks.map(decodeCharacterChunk).filter(Boolean);
    const selected = cards.find(item => item.normalizedKeyword === 'ccv3')
        ?? cards.find(item => item.normalizedKeyword === 'chara');

    if (!selected) {
        throw new Error('PNG 裡找不到 chara 或 ccv3 角色資料。');
    }

    return { card: selected.card, keyword: selected.normalizedKeyword, chunks };
}

export function getPngImagePayload(bytes) {
    return concatBytes(parsePng(bytes)
        .filter(chunk => chunk.type === 'IDAT')
        .map(chunk => chunk.data));
}

export function rewriteCharacterCardPng(bytes, stats = createStats()) {
    const chunks = parsePng(bytes);
    const decodedCards = chunks.map(decodeCharacterChunk).filter(Boolean);
    const selected = decodedCards.find(item => item.normalizedKeyword === 'ccv3')
        ?? decodedCards.find(item => item.normalizedKeyword === 'chara');

    if (!selected) {
        throw new Error('PNG 裡找不到 chara 或 ccv3 角色資料。');
    }

    const convertedCard = convertCharacterCard(selected.card, stats);
    const encodedJson = bytesToBase64(textEncoder.encode(JSON.stringify(convertedCard)));
    const outputChunks = chunks.map(chunk => {
        const decoded = chunk.type === 'tEXt' ? decodeTextChunk(chunk.data) : null;
        const keyword = decoded?.keyword?.toLowerCase();
        return keyword === 'chara' || keyword === 'ccv3'
            ? encodeTextChunk(decoded.keyword, encodedJson)
            : chunk.raw;
    });

    return {
        bytes: concatBytes([PNG_SIGNATURE, ...outputChunks]),
        card: convertedCard,
        stats,
    };
}

export async function convertCharacterPngFile(file, stats = createStats()) {
    const originalBytes = new Uint8Array(await file.arrayBuffer());
    const result = rewriteCharacterCardPng(originalBytes, stats);
    const output = new File([result.bytes], convertFileName(file.name, stats), {
        type: 'image/png',
        lastModified: file.lastModified,
    });

    return { file: output, card: result.card, stats };
}
