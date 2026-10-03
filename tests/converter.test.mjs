import assert from 'node:assert/strict';
import test from 'node:test';

import { createStats } from '../src/converter.js';
import { convertCharacterCard, convertPreset, convertWorldBook } from '../src/schemas.js';

test('預設正文轉繁，但保留巨集、標記、網址和識別碼', () => {
    const source = {
        id: 'preset_1',
        name: '测试预设',
        prompts: [{
            identifier: 'story_output',
            name: '剧情格式',
            content: '<story_output> 当前日程：{{当前日程}}，打开软件。https://example.com/简体',
        }],
        prompt_order: [{ identifier: 'story_output', enabled: true }],
    };
    const stats = createStats();
    const result = convertPreset(source, stats);

    assert.equal(result.name, '測試預設');
    assert.match(result.prompts[0].content, /當前日程/);
    assert.match(result.prompts[0].content, /打開軟件/);
    assert.match(result.prompts[0].content, /\{\{当前日程\}\}/);
    assert.match(result.prompts[0].content, /<story_output>/);
    assert.match(result.prompts[0].content, /https:\/\/example\.com\/简体/);
    assert.equal(result.prompts[0].identifier, 'story_output');
    assert.deepEqual(result.prompt_order, source.prompt_order);
    assert.ok(stats.protectedSegments >= 3);
});

test('世界書一般觸發詞直接轉繁，正則觸發詞保持原樣', () => {
    const source = {
        entries: {
            0: {
                uid: 7,
                comment: '图书馆规则',
                key: ['图书馆', '/图书[馆館]/i'],
                keysecondary: ['软件'],
                content: '角色走进图书馆。',
                probability: 100,
            },
        },
    };
    const stats = createStats();
    const result = convertWorldBook(source, stats);
    const entry = result.entries[0];

    assert.equal(entry.comment, '圖書館規則');
    assert.deepEqual(entry.key, ['圖書館', '/图书[馆館]/i']);
    assert.deepEqual(entry.keysecondary, ['軟件']);
    assert.equal(entry.content, '角色走進圖書館。');
    assert.equal(entry.uid, 7);
    assert.equal(entry.probability, 100);
    assert.equal(stats.skippedRegexKeys, 1);
});

test('角色卡頂層、data 與內嵌世界書同步轉換', () => {
    const source = {
        name: '模拟器',
        description: '打开软件。',
        spec: 'chara_card_v3',
        data: {
            name: '模拟器',
            description: '打开软件。',
            alternate_greetings: ['进入房间。'],
            extensions: {
                depth_prompt: { prompt: '保持安静，{{user}}。' },
                regex_scripts: [{ findRegex: '/进入/', replaceString: '不要改这里' }],
            },
            character_book: {
                entries: [{ uid: 1, key: ['房间'], content: '房间说明。' }],
            },
        },
    };
    const result = convertCharacterCard(source);

    assert.equal(result.name, '模擬器');
    assert.equal(result.data.name, '模擬器');
    assert.equal(result.description, '打開軟件。');
    assert.equal(result.data.alternate_greetings[0], '進入房間。');
    assert.equal(result.data.extensions.depth_prompt.prompt, '保持安靜，{{user}}。');
    assert.equal(result.data.extensions.regex_scripts[0].replaceString, '不要改这里');
    assert.deepEqual(result.data.character_book.entries[0].key, ['房間']);
    assert.equal(result.data.character_book.entries[0].content, '房間說明。');
});
