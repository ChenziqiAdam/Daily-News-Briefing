import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';

test('browser CommonJS bundle resolves real Obsidian host transport', async () => {
    const result = await build({ entryPoints: ['src/providers/request-policy.ts'], bundle: true, write: false,
        platform: 'browser', format: 'cjs', external: ['obsidian'],
    });
    const exported = {};
    let response = { status: 200, json: { ok: true } };
    const context = { module: { exports: exported }, exports: exported, setTimeout, clearTimeout, require(name) {
        assert.equal(name, 'obsidian');
        return { requestUrl: async () => response };
    } };
    vm.runInNewContext(result.outputFiles[0].text, context);
    const { requestJson, retryRequest } = context.module.exports;
    const settings = { requestTimeoutSeconds: 10, requestRetries: 0 };
    assert.equal((await requestJson({ url: 'https://example.com' }, settings)).ok, true);
    response = { status: 401, json: {} };
    await assert.rejects(() => requestJson({ url: 'https://example.com' }, settings), /HTTP 401/);
    let attempts = 0;
    const waits = [];
    const answer = await retryRequest(async () => {
        if (++attempts === 1) throw { status: 429, headers: { get: () => '60' } };
        return 'ok';
    }, 1, async ms => waits.push(ms));
    assert.equal(answer, 'ok');
    assert.equal(attempts, 2);
    assert.deepEqual(waits, [5000]);
    attempts = 0;
    await assert.rejects(() => retryRequest(async () => { attempts++; throw { status: 401 }; }, 2, async () => {}));
    assert.equal(attempts, 1);
});
