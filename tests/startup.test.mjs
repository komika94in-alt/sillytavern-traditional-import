import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const toolbar = `
<div id="character_import_button"></div><input id="character_import_file" type="file">
<div id="import_oai_preset"></div><input id="openai_preset_import_file" type="file">
<div id="world_import_button"></div><input id="world_import_file" type="file">`;
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

test('built extension starts without hooks, tolerates hooks, repairs UI, and cleans up', async () => {
    const dom = new JSDOM(`<body>${toolbar}</body>`);
    const previous = new Map();
    for (const key of ['document', 'HTMLElement', 'HTMLInputElement', 'MutationObserver']) {
        previous.set(key, globalThis[key]);
        globalThis[key] = dom.window[key];
    }
    let extension;
    try {
        await flush();
        // Import the distributable itself: the legacy loader only executes this module.
        extension = await import('../index.js?startup-regression');
        assert.equal(document.querySelectorAll('.stti-import-button').length, 3);
        for (const [original, added] of [
            ['character_import_button', 'stti_character_import_button'],
            ['import_oai_preset', 'stti_preset_import_button'],
            ['world_import_button', 'stti_world_import_button'],
        ]) {
            assert.equal(document.getElementById(original).nextElementSibling.id, added);
        }

        await extension.init();
        await extension.init();
        assert.equal(document.querySelectorAll('.stti-import-button').length, 3);
        let clicks = 0;
        document.getElementById('stti_character_import_file').click = () => clicks++;
        document.getElementById('stti_character_import_button').click();
        assert.equal(clicks, 1);

        document.getElementById('stti_character_import_button').remove();
        await flush();
        assert.equal(document.querySelectorAll('.stti-import-button').length, 3);
        // Queue an observer callback, then disable before the callback can re-inject.
        document.body.append(document.createElement('div'));
        extension.cleanup();
        await flush();
        assert.equal(document.querySelectorAll('.stti-owned').length, 0);

        document.body.innerHTML = '';
        await extension.init();
        document.body.innerHTML = toolbar;
        await flush();
        assert.equal(document.querySelectorAll('.stti-import-button').length, 3);
        extension.cleanup();

        // Hook or auto-start during initial HTML parsing waits for DOM readiness.
        Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' });
        await extension.init();
        assert.equal(document.querySelectorAll('.stti-import-button').length, 0);
        Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
        document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
        assert.equal(document.querySelectorAll('.stti-import-button').length, 3);
    } finally {
        extension?.cleanup();
        dom.window.close();
        for (const [key, value] of previous) {
            if (value === undefined) delete globalThis[key];
            else globalThis[key] = value;
        }
    }
});
