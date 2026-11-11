import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const directory = await mkdtemp(join(tmpdir(), 'daily-news-tests-'));
try {
    const outfile = join(directory, 'regression.cjs');
    await build({ entryPoints: ['tests/regression.test.ts'], outfile, bundle: true, platform: 'node', format: 'cjs',
        plugins: [{ name: 'obsidian-stub', setup(build) {
            build.onResolve({ filter: /^obsidian$/ }, () => ({ path: resolve('tests/obsidian-stub.ts') }));
        } }],
    });
    const result = spawnSync(process.execPath, ['--test', outfile, resolve('tests/release.test.mjs'), resolve('tests/packaged-transport.mjs')], {
        stdio: 'inherit', env: { ...process.env, TZ: 'Asia/Shanghai' },
    });
    process.exitCode = result.status ?? 1;
} finally {
    await rm(directory, { recursive: true, force: true });
}
