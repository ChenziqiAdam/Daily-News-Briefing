import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function validateRelease(directory, tag) {
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag ?? '')) {
        throw new Error('Use a stable version tag such as 1.13.4, without a v prefix.');
    }
    const readJson = name => JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
    const pkg = readJson('package.json');
    const manifest = readJson('manifest.json');
    const lock = readJson('package-lock.json');
    const versions = readJson('versions.json');
    for (const [name, version] of Object.entries({
        'package.json': pkg.version,
        'manifest.json': manifest.version,
        'package-lock.json': lock.version,
        'package-lock.json root package': lock.packages?.['']?.version,
    })) {
        if (version !== tag) throw new Error(`${name} version ${version} does not match tag ${tag}.`);
    }
    if (versions[tag] !== manifest.minAppVersion) {
        throw new Error(`versions.json must map ${tag} to ${manifest.minAppVersion}.`);
    }
    const readme = readFileSync(resolve(directory, 'README.md'), 'utf8');
    const heading = `### v${tag}`;
    const sections = readme.split(/\r?\n(?=### )/);
    const section = sections.find(value => value.split(/\r?\n/, 1)[0] === heading);
    const notes = section?.slice(heading.length).trim();
    if (!notes) throw new Error(`README.md must contain nonempty release notes under ${heading}.`);
    return `${notes}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        const notes = validateRelease(process.cwd(), process.argv[2]);
        if (process.argv[3]) writeFileSync(process.argv[3], notes);
        console.log(`Release ${process.argv[2]} validated.`);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
