import * as OpenCC from 'opencc-js/cn2t';

let converter;

const PROTECTED_PATTERNS = [
    /```[\s\S]*?```/g,
    /~~~[\s\S]*?~~~/g,
    /<!--[\s\S]*?-->/g,
    /\{\{[\s\S]*?\}\}/g,
    /\$\{[\s\S]*?\}/g,
    /`[^`\r\n]*`/g,
    /(?:https?|ftp):\/\/[^\s<>"']+/g,
    /<\/?[^<>\r\n]+>/g,
];

export function createStats() {
    return {
        visitedStrings: 0,
        changedStrings: 0,
        changedCharacters: 0,
        protectedSegments: 0,
        skippedRegexKeys: 0,
    };
}

function getConverter() {
    converter ??= OpenCC.Converter({ from: 'cn', to: 'tw' });
    return converter;
}

function collectProtectedRanges(text) {
    const matches = [];

    for (const pattern of PROTECTED_PATTERNS) {
        pattern.lastIndex = 0;
        for (const match of text.matchAll(pattern)) {
            matches.push({
                start: match.index,
                end: match.index + match[0].length,
                value: match[0],
            });
        }
    }

    matches.sort((a, b) => a.start - b.start || b.end - a.end);

    const ranges = [];
    let occupiedUntil = -1;
    for (const match of matches) {
        if (match.start < occupiedUntil) {
            continue;
        }
        ranges.push(match);
        occupiedUntil = match.end;
    }

    return ranges;
}

function countChangedCharacters(before, after) {
    const left = Array.from(before);
    const right = Array.from(after);
    const length = Math.max(left.length, right.length);
    let changed = 0;

    for (let index = 0; index < length; index++) {
        if (left[index] !== right[index]) {
            changed++;
        }
    }

    return changed;
}

export function convertProtectedText(value, stats = createStats()) {
    if (typeof value !== 'string' || value.length === 0) {
        return value;
    }

    stats.visitedStrings++;
    const protectedRanges = collectProtectedRanges(value);
    const protectedValues = [];
    let cursor = 0;
    let prepared = '';

    for (const range of protectedRanges) {
        prepared += value.slice(cursor, range.start);
        const token = `\uFDD0STTI${protectedValues.length}\uFDD1`;
        prepared += token;
        protectedValues.push({ token, value: range.value });
        cursor = range.end;
    }
    prepared += value.slice(cursor);
    stats.protectedSegments += protectedValues.length;

    let converted = getConverter()(prepared);
    for (const item of protectedValues) {
        converted = converted.split(item.token).join(item.value);
    }

    if (converted !== value) {
        stats.changedStrings++;
        stats.changedCharacters += countChangedCharacters(value, converted);
    }

    return converted;
}

export function isRegexLike(value) {
    if (typeof value !== 'string') {
        return false;
    }

    const text = value.trim();
    return /^\/(?:\\.|[^/\r\n])+\/[dgimsuvy]*$/.test(text)
        || /^(?:regex|regexp):/i.test(text);
}

export function convertKeyword(value, stats = createStats()) {
    if (isRegexLike(value)) {
        stats.skippedRegexKeys++;
        return value;
    }
    return convertProtectedText(value, stats);
}

export function cloneJson(value) {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}

export function convertFileName(fileName, stats = createStats()) {
    const dot = fileName.lastIndexOf('.');
    const base = dot > 0 ? fileName.slice(0, dot) : fileName;
    const extension = dot > 0 ? fileName.slice(dot) : '';
    return `${convertProtectedText(base, stats)}${extension}`;
}
