# AUR

## Setup

These directories are git submodules over SSH — requires your key registered on AUR.

```sh
git submodule update --init aur/tobby aur/tobby-bin
```

## Publishing

After the GitHub release binaries are up:

```sh
bun run aur-release
```

This updates `pkgver`/`sha256sums` in both PKGBUILDs, regenerates `.SRCINFO`, and pushes both AUR repos. If the binaries aren't up yet, `tobby-bin` is skipped with a warning.
