# Releasing Opaline

The latest tagged release is [`v0.2.1`](https://github.com/MooketsiMagwaza/opaline/releases/tag/v0.2.1). Its known trackpad gesture issue is recorded in [WORKORDER §13](../WORKORDER.md#13-known-issues).

Tagged releases are built on GitHub Actions and publish three Windows downloads: an NSIS installer, an MSI installer and a portable
ZIP containing `opaline.exe`. A `SHA256SUMS.txt` file is published beside them.

## Before tagging

1. Complete the manual acceptance checklist in [WORKORDER.md](../WORKORDER.md#9-acceptance-checklist-run-before-every-release).
2. Run `npm ci`, `npm test`, `npm run build`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`,
   `cargo test --locked` and `cargo check --locked`.
3. Update `CHANGELOG.md`; set the same version in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`.
4. Confirm the installer creates **Start Menu → Opaline**, creates no Desktop shortcut, and that uninstall removes the Start entry.
5. Commit, then tag `vX.Y.Z` and push the commit and tag.

The tag starts `.github/workflows/release.yml`. Do not draft a release by hand before the workflow completes; it creates the release,
generates notes and attaches every artifact. Download the installer from the finished release and perform one clean-machine smoke test.

The initial artifacts are unsigned and may trigger SmartScreen. Publish the generated checksums and say this plainly in the release
notes. Code-signing credentials must be introduced as GitHub secrets with a documented rotation process; never commit a certificate.

## Rollback

If an artifact is bad, delete the GitHub release while keeping the tag for diagnosis, fix the problem, increment the patch version and
publish a new tag. Do not silently replace a versioned binary without a version bump.
