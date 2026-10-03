import {
    cloneJson,
    convertKeyword,
    convertProtectedText,
    createStats,
} from './converter.js';

const CHARACTER_TEXT_FIELDS = [
    'name',
    'char_name',
    'description',
    'char_persona',
    'personality',
    'scenario',
    'world_scenario',
    'first_mes',
    'char_greeting',
    'mes_example',
    'example_dialogue',
    'creator_notes',
    'creatorcomment',
    'system_prompt',
    'post_history_instructions',
    'depth_prompt_prompt',
];

const CHARACTER_TEXT_ARRAY_FIELDS = [
    'alternate_greetings',
    'group_only_greetings',
    'tags',
];

const WORLD_ENTRY_TEXT_FIELDS = [
    'comment',
    'content',
    'name',
    'title',
    'description',
    'displayName',
];

const WORLD_ENTRY_KEY_FIELDS = [
    'key',
    'keys',
    'keysecondary',
    'secondary_keys',
    'secondaryKeys',
    'triggers',
];

const PRESET_TEXT_FIELDS = [
    'name',
    'description',
    'system_prompt',
    'jailbreak_system',
    'jailbreak_message',
    'impersonation_prompt',
    'new_chat_prompt',
    'new_group_chat_prompt',
    'new_example_chat_prompt',
    'continue_nudge_prompt',
    'group_nudge_prompt',
    'wi_format',
    'scenario_format',
    'personality_format',
    'send_if_empty',
    'assistant_prefill',
    'continue_prefill',
    'nsfw_prompt',
    'enhance_definitions_prompt',
];

function convertField(object, field, stats, converter = convertProtectedText) {
    if (object && typeof object[field] === 'string') {
        object[field] = converter(object[field], stats);
    }
}

function convertStringArrayField(object, field, stats, converter = convertProtectedText) {
    if (!object || !Array.isArray(object[field])) {
        return;
    }

    object[field] = object[field].map(value => (
        typeof value === 'string' ? converter(value, stats) : value
    ));
}

function convertEntry(entry, stats) {
    if (!entry || typeof entry !== 'object') {
        return;
    }

    for (const field of WORLD_ENTRY_TEXT_FIELDS) {
        convertField(entry, field, stats);
    }

    for (const field of WORLD_ENTRY_KEY_FIELDS) {
        if (typeof entry[field] === 'string') {
            entry[field] = convertKeyword(entry[field], stats);
        } else {
            convertStringArrayField(entry, field, stats, convertKeyword);
        }
    }
}

function convertEntries(entries, stats) {
    if (Array.isArray(entries)) {
        for (const entry of entries) {
            convertEntry(entry, stats);
        }
        return;
    }

    if (entries && typeof entries === 'object') {
        for (const entry of Object.values(entries)) {
            convertEntry(entry, stats);
        }
    }
}

export function convertWorldBookInPlace(book, stats = createStats()) {
    if (!book || typeof book !== 'object') {
        return book;
    }

    convertField(book, 'name', stats);
    convertField(book, 'description', stats);
    convertEntries(book.entries, stats);
    return book;
}

function convertCharacterLayer(layer, stats) {
    if (!layer || typeof layer !== 'object') {
        return;
    }

    for (const field of CHARACTER_TEXT_FIELDS) {
        convertField(layer, field, stats);
    }

    for (const field of CHARACTER_TEXT_ARRAY_FIELDS) {
        convertStringArrayField(layer, field, stats);
    }

    convertWorldBookInPlace(layer.character_book, stats);

    const depthPrompt = layer.extensions?.depth_prompt;
    if (depthPrompt && typeof depthPrompt === 'object') {
        convertField(depthPrompt, 'prompt', stats);
    }
}

export function convertCharacterCard(input, stats = createStats()) {
    if (!input || typeof input !== 'object') {
        throw new TypeError('角色卡 JSON 必須是物件。');
    }

    const card = cloneJson(input);
    convertCharacterLayer(card, stats);
    convertCharacterLayer(card.data, stats);

    if (!card.name && !card.char_name && !card.data?.name) {
        throw new Error('找不到角色名稱，這不像有效的角色卡。');
    }

    return card;
}

export function convertWorldBook(input, stats = createStats()) {
    if (!input || typeof input !== 'object' || !('entries' in input)) {
        throw new Error('找不到 entries，這不像有效的世界書。');
    }

    const book = cloneJson(input);
    return convertWorldBookInPlace(book, stats);
}

export function convertPreset(input, stats = createStats()) {
    if (!input || typeof input !== 'object' || !Array.isArray(input.prompts)) {
        throw new Error('找不到 prompts，這不像聊天補全預設。');
    }

    const preset = cloneJson(input);

    for (const field of PRESET_TEXT_FIELDS) {
        convertField(preset, field, stats);
    }

    for (const prompt of preset.prompts) {
        if (!prompt || typeof prompt !== 'object') {
            continue;
        }
        convertField(prompt, 'name', stats);
        convertField(prompt, 'content', stats);
        convertField(prompt, 'prompt', stats);
    }

    return preset;
}
