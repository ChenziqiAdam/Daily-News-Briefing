# Publishing a release

The release workflow runs when a stable version tag such as `1.13.4` is pushed.
Obsidian requires the tag to match `manifest.json` exactly, without a `v` prefix.
The GitHub Release title includes the prefix (`v1.13.4`).

## Prepare

1. Keep `package.json`, both root version fields in `package-lock.json`, and
   `manifest.json` on the same version.
2. Add the version and its `minAppVersion` to `versions.json`. Preserve historical entries.
3. Write the release notes under an exact `### v1.13.4` heading in `README.md`.
4. Run `node scripts/validate-release.mjs 1.13.4`, `npm test`, and `npm run build`.
5. Review and commit the source, tests, documentation and workflow changes, then push
   that commit to the repository's default branch. Obsidian reads its manifest there.

Before tagging, check `git status --short`. New files marked `??` are not committed
and will not be available to GitHub Actions. Include `scripts/validate-release.mjs`,
the production source modules and the `tests` directory used by `npm test`.

For later releases, `npm version patch` updates the version files through the existing
version hook and creates a commit/tag. The project `.npmrc` omits the `v` tag prefix.
Update and commit the release notes before using this command from a clean checkout.

## Publish 1.13.4

After committing and pushing the prepared changes:

```sh
git tag 1.13.4
git push origin 1.13.4
```

The workflow validates version consistency, rejects an existing Release, installs
locked dependencies, runs offline tests and builds the production plugin. It uploads
`main.js`, `manifest.json`, `styles.css`, and `SHA256SUMS.txt` to a draft, then publishes
it after successful uploads. It also retains a build artifact and attests the three
plugin assets. No live AI calls or provider API keys are needed during CI.

The workflow uses GitHub's automatic `GITHUB_TOKEN`; no personal access token is needed.
Repository/organization policies must allow GitHub Actions and the declared job permissions.

## Failure recovery

Actions checks out the tagged commit. Committing a missing file on the default branch
does not change an existing tag, and rerunning its failed workflow still uses that
old commit. Prefer a new patch version/tag containing the complete fix. Replace a
failed tag only after explicitly checking that no release was published and agreeing
to update that tag; never move a tag for a published release.

Version errors, failing tests, build errors and attestation failures stop publication.
Do not move a published tag or overwrite existing release assets. If upload/publication
fails after draft creation, inspect the retained draft and build artifact first.
An automatic rerun deliberately refuses an existing draft or published Release; remove
only an unpublished failed draft before rerunning, or prepare a new version.

See the official [Obsidian release instructions](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)
and [GitHub CLI release documentation](https://cli.github.com/manual/gh_release_create).
