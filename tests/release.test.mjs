import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRelease } from '../scripts/validate-release.mjs';

function fixture(run, overrides = {}) {
    const directory = mkdtempSync(join(tmpdir(), 'daily-news-release-'));
    try {
        const files = {
            'package.json': { version: '1.13.4' },
            'manifest.json': { version: '1.13.4', minAppVersion: '1.11.4' },
            'package-lock.json': { version: '1.13.4', packages: { '': { version: '1.13.4' } } },
            'versions.json': { '1.13.4': '1.11.4' },
            'README.md': '# Plugin\n\n### v1.13.4\n- Current changes.\n\n### v1.13.3\n- Old changes.\n',
            ...overrides,
        };
        for (const [name, value] of Object.entries(files)) writeFileSync(join(directory, name), typeof value === 'string' ? value : JSON.stringify(value));
        run(directory);
    } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('release extracts only matching version notes', () => fixture(dir => assert.equal(validateRelease(dir, '1.13.4'), '- Current changes.\n')));
test('release rejects invalid and prefixed tags', () => fixture(dir => {
    for (const tag of ['v1.13.4', '1.13.4-beta', '01.13.4', undefined]) assert.throws(() => validateRelease(dir, tag), /stable version tag/);
}));
test('release rejects inconsistent manifest, package and lock versions', () => {
    for (const file of ['package.json', 'manifest.json', 'package-lock.json']) fixture(dir => assert.throws(() => validateRelease(dir, '1.13.4'), /does not match/), { [file]: { version: '1.13.3' } });
    fixture(dir => assert.throws(() => validateRelease(dir, '1.13.4'), /root package/), {
        'package-lock.json': { version: '1.13.4', packages: { '': { version: '1.13.3' } } },
    });
});
test('release rejects wrong compatibility mapping', () => fixture(dir => assert.throws(() => validateRelease(dir, '1.13.4'), /must map/), { 'versions.json': { '1.13.4': '0.15.0' } }));
test('release rejects empty or missing notes', () => {
    for (const readme of ['### Unreleased\n- Changes.\n', '### v1.13.4\n\n### v1.13.3\n- Old.\n']) fixture(dir => assert.throws(() => validateRelease(dir, '1.13.4'), /nonempty release notes/), { 'README.md': readme });
});
