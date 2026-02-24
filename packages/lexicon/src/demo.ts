/**
 * Quick integration example for leximorph TypeScript
 *
 * To use in your code:
 * ```ts
 * import { buildRegistry, LexiStore } from '@world-engine/lexicon';
 *
 * const reg = buildRegistry();
 * const store = new LexiStore('./leximorph.sqlite');
 * store.init();
 *
 * const analyzed = reg.analyze('unbelievable', 'en', 'word');
 * console.log(analyzed.parts);  // { prefix: 'un-', root: 'believe', suffix: '-able' }
 *
 * const id = store.insert(analyzed);
 * const results = store.queryContains('believe');
 *
 * store.close();
 * ```
 */

import { buildRegistry, LexiStore } from './leximorph';

export function quickDemo() {
    console.log('🧠 Leximorph Quick Demo\n');

    const reg = buildRegistry();
    const dbPath = './demo.leximorph.sqlite';
    const store = new LexiStore(dbPath);

    try {
        store.init();

        // Test 1: English word
        console.log('Test 1: English morphological analysis');
        const word = reg.analyze('unbelievable', 'en', 'word');
        console.log('  Input: "unbelievable"');
        console.log('  Parts:', word.parts);
        console.log('  Meta:', word.meta);
        console.log();

        // Test 2: JS identifier
        console.log('Test 2: JavaScript identifier tokenization');
        const id = reg.analyze('getUserName', 'js', 'identifier');
        console.log('  Input: "getUserName"');
        console.log('  Parts:', id.parts);
        console.log('  Meta:', id.meta);
        console.log();

        // Test 3: HTML
        console.log('Test 3: HTML tag + attributes');
        const html = reg.analyze('<div class="foo-bar bazQux" id="mainPane">', 'html', 'html');
        console.log('  Input: <div class="foo-bar bazQux" id="mainPane">');
        console.log('  Parts:', html.parts);
        console.log();

        // Storage demo
        console.log('Test 4: Store and query');
        const wordId = store.insert(word);
        const idId = store.insert(id);
        const htmlId = store.insert(html);
        console.log(`  Stored 3 entries: #${wordId}, #${idId}, #${htmlId}`);

        const results = store.queryContains('User');
        console.log(`  Query "User" returned ${results.length} results`);
        if (results.length > 0) {
            console.log('  First result:', results[0]);
        }
    } finally {
        store.close();
        console.log('\n✅ Demo complete');
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    quickDemo();
}
