import { convertImportFile } from './file-converter.js';

const EXTENSION_CLASS = 'stti-owned';
const BUTTON_CLASS = 'stti-import-button';

const targets = [
    {
        kind: 'character',
        targetSelector: '#character_import_button',
        originalInputSelector: '#character_import_file',
        buttonId: 'stti_character_import_button',
        inputId: 'stti_character_import_file',
        accept: '.json,image/png',
        eventName: 'change',
        multiple: true,
        title: '簡轉繁後匯入角色卡',
    },
    {
        kind: 'preset',
        targetSelector: '#import_oai_preset',
        originalInputSelector: '#openai_preset_import_file',
        buttonId: 'stti_preset_import_button',
        inputId: 'stti_preset_import_file',
        accept: '.json,.settings',
        eventName: 'input',
        multiple: false,
        title: '簡轉繁後匯入聊天補全預設',
    },
    {
        kind: 'world',
        targetSelector: '#world_import_button',
        originalInputSelector: '#world_import_file',
        buttonId: 'stti_world_import_button',
        inputId: 'stti_world_import_file',
        accept: '.json,.lorebook',
        eventName: 'change',
        multiple: false,
        title: '簡轉繁後匯入世界書',
    },
];

let observer;
let injectQueued = false;
let active = false;
let waitingForDom = false;

function toast(level, message, title = '繁體匯入') {
    const service = globalThis.toastr;
    if (service && typeof service[level] === 'function') {
        service[level](message, title);
        return;
    }
    const logger = level === 'error' ? console.error : console.log;
    logger(`[${title}] ${message}`);
}

function setBusy(button, busy) {
    button.classList.toggle('stti-busy', busy);
    button.setAttribute('aria-busy', String(busy));
}

function handOffFiles(config, files) {
    const originalInput = document.querySelector(config.originalInputSelector);
    if (!(originalInput instanceof HTMLInputElement)) {
        throw new Error('找不到酒館原本的匯入入口，可能是目前版本不相容。');
    }

    const transfer = new DataTransfer();
    for (const file of files) {
        transfer.items.add(file);
    }
    originalInput.files = transfer.files;
    originalInput.dispatchEvent(new Event(config.eventName, { bubbles: true }));
}

async function handleSelection(config, input, button) {
    const selectedFiles = Array.from(input.files ?? []);
    input.value = '';
    if (selectedFiles.length === 0) {
        return;
    }

    setBusy(button, true);
    try {
        const convertedFiles = [];
        const totals = {
            changedStrings: 0,
            changedCharacters: 0,
            protectedSegments: 0,
            skippedRegexKeys: 0,
        };

        for (const file of selectedFiles) {
            const result = await convertImportFile(file, config.kind);
            convertedFiles.push(result.file);
            for (const key of Object.keys(totals)) {
                totals[key] += result.stats[key] ?? 0;
            }
        }

        handOffFiles(config, convertedFiles);
        const details = [`已轉換 ${totals.changedStrings} 個文字欄位`];
        if (totals.protectedSegments > 0) {
            details.push(`保留 ${totals.protectedSegments} 個巨集／技術區段`);
        }
        if (totals.skippedRegexKeys > 0) {
            details.push(`略過 ${totals.skippedRegexKeys} 個正則觸發詞`);
        }
        toast('success', `${details.join('，')}；已交給酒館匯入。`);
    } catch (error) {
        console.error('[繁體匯入] 轉換失敗', error);
        toast('error', error instanceof Error ? error.message : String(error));
    } finally {
        setBusy(button, false);
    }
}

function createInput(config) {
    const input = document.createElement('input');
    input.id = config.inputId;
    input.className = EXTENSION_CLASS;
    input.type = 'file';
    input.accept = config.accept;
    input.multiple = config.multiple;
    input.hidden = true;
    document.body.append(input);
    return input;
}

function createButton(config, target, input) {
    const button = document.createElement('div');
    button.id = config.buttonId;
    button.className = `${EXTENSION_CLASS} ${BUTTON_CLASS} margin0 menu_button menu_button_icon`;
    button.title = config.title;
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('aria-label', config.title);

    const glyph = document.createElement('span');
    glyph.className = 'stti-import-glyph';
    glyph.textContent = '繁';
    button.append(glyph);

    const openPicker = () => {
        input.value = '';
        input.click();
    };
    button.addEventListener('click', openPicker);
    button.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPicker();
        }
    });
    input.addEventListener('change', () => handleSelection(config, input, button));

    target.insertAdjacentElement('afterend', button);
}

function injectButtons() {
    if (!active) return;
    for (const config of targets) {
        if (document.getElementById(config.buttonId)) {
            continue;
        }
        const target = document.querySelector(config.targetSelector);
        if (!(target instanceof HTMLElement)) {
            continue;
        }
        // A replaced toolbar must not retain the previous button's change handler.
        document.getElementById(config.inputId)?.remove();
        const input = createInput(config);
        createButton(config, target, input);
    }
}

function queueInjection() {
    if (injectQueued) {
        return;
    }
    injectQueued = true;
    queueMicrotask(() => {
        injectQueued = false;
        if (active) injectButtons();
    });
}

export async function init() {
    if (!document.body || document.readyState === 'loading') {
        if (!waitingForDom) {
            waitingForDom = true;
            document.addEventListener('DOMContentLoaded', onDomReady, { once: true });
        }
        return;
    }
    if (active) {
        injectButtons();
        return;
    }
    active = true;
    injectButtons();
    observer = new MutationObserver(queueInjection);
    observer.observe(document.body, { childList: true, subtree: true });
    console.info('[繁體匯入] 擴充已啟用');
}

export function cleanup() {
    active = false;
    waitingForDom = false;
    document.removeEventListener('DOMContentLoaded', onDomReady);
    observer?.disconnect();
    observer = undefined;
    document.querySelectorAll(`.${EXTENSION_CLASS}`).forEach(element => element.remove());
}

function onDomReady() {
    waitingForDom = false;
    void init();
}

// Older SillyTavern releases load the module without calling manifest hooks.
// Newer releases may also call init(); initialization is intentionally idempotent.
if (typeof document !== 'undefined') {
    void init();
}
