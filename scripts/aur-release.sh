#!/usr/bin/env bash
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
echo "→ AUR release for version ${VERSION}"

sha256_url() {
  # Works on both Linux (sha256sum) and macOS (shasum)
  curl -fsSL "$1" | (command -v sha256sum &>/dev/null && sha256sum || shasum -a 256) | awk '{print $1}'
}

url_exists() {
  curl -fsI "$1" &>/dev/null
}

sed_inplace() {
  # Portable sed -i (macOS requires an extension argument)
  sed -i.bak "$@" && rm -f "${@: -1}.bak"
}

# ── tobby (npm) ───────────────────────────────────────────────────────────────

NPM_URL="https://registry.npmjs.org/@mattfillipe/tobby/-/tobby-${VERSION}.tgz"
echo "  checking npm tarball exists..."
if ! url_exists "$NPM_URL"; then
  echo "✗ npm package @mattfillipe/tobby@${VERSION} not found. Publish to npm first."
  exit 1
fi

echo "  fetching npm tarball sha256..."
NPM_SHA256=$(sha256_url "$NPM_URL")

sed_inplace \
  -e "s/^pkgver=.*/pkgver=${VERSION}/" \
  -e "s/sha256sums=.*/sha256sums=('${NPM_SHA256}')/" \
  aur/tobby/PKGBUILD

cat > aur/tobby/.SRCINFO <<SRCINFO
# This file is auto-generated. Do NOT edit by hand.
# Regenerate on an Arch Linux machine with:
#   makepkg --printsrcinfo > .SRCINFO

pkgbase = tobby
	pkgdesc = The Terminal Obby — a modern IRC client for the terminal
	pkgver = ${VERSION}
	pkgrel = 1
	url = https://github.com/ObsidianIRC/tobby
	arch = any
	license = MIT
	makedepends = npm
	makedepends = jq
	depends = nodejs
	depends = bun
	provides = tobby
	conflicts = tobby-bin
	options = !strip
	noextract = mattfillipe-tobby-${VERSION}.tgz
	source = mattfillipe-tobby-${VERSION}.tgz::https://registry.npmjs.org/@mattfillipe/tobby/-/tobby-${VERSION}.tgz
	sha256sums = ${NPM_SHA256}

pkgname = tobby
SRCINFO

echo "  pushing tobby AUR..."
git -C aur/tobby add -A && git -C aur/tobby commit -m "update to ${VERSION}" && git -C aur/tobby push

# ── tobby-bin (GitHub releases) ───────────────────────────────────────────────

BASE_URL="https://github.com/ObsidianIRC/tobby/releases/download/v${VERSION}"
echo "  checking GitHub release binaries exist..."

MISSING=()
url_exists "${BASE_URL}/tobby-x86_64-linux" || MISSING+=("tobby-x86_64-linux")
url_exists "${BASE_URL}/tobby-aarch64-linux" || MISSING+=("tobby-aarch64-linux")

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "⚠  tobby-bin skipped: missing from GitHub release v${VERSION}: ${MISSING[*]}"
  echo "   Push a new version tag to trigger the release workflow, which builds both binaries."
  echo "✓ tobby AUR updated to ${VERSION} (tobby-bin skipped)"
  exit 0
fi

echo "  fetching GitHub release sha256s..."
LICENSE_SHA256=$(sha256_url "https://raw.githubusercontent.com/ObsidianIRC/tobby/v${VERSION}/LICENSE")
X86_SHA256=$(sha256_url "${BASE_URL}/tobby-x86_64-linux")
AARCH64_SHA256=$(sha256_url "${BASE_URL}/tobby-aarch64-linux")

sed_inplace "s/^pkgver=.*/pkgver=${VERSION}/" aur/tobby-bin/PKGBUILD

# Update sha256 arrays in tobby-bin/PKGBUILD
node - <<JS
const fs = require('fs')
let c = fs.readFileSync('aur/tobby-bin/PKGBUILD', 'utf8')
c = c.replace(/sha256sums=\([^)]*\)/,       "sha256sums=('${LICENSE_SHA256}')")
c = c.replace(/sha256sums_x86_64=\([^)]*\)/, "sha256sums_x86_64=('${X86_SHA256}')")
c = c.replace(/sha256sums_aarch64=\([^)]*\)/,"sha256sums_aarch64=('${AARCH64_SHA256}')")
fs.writeFileSync('aur/tobby-bin/PKGBUILD', c)
JS

cat > aur/tobby-bin/.SRCINFO <<SRCINFO
# This file is auto-generated. Do NOT edit by hand.
# Regenerate on an Arch Linux machine with:
#   makepkg --printsrcinfo > .SRCINFO

pkgbase = tobby-bin
	pkgdesc = The Terminal Obby — a modern IRC client for the terminal (pre-built binary)
	pkgver = ${VERSION}
	pkgrel = 1
	url = https://github.com/ObsidianIRC/tobby
	arch = x86_64
	arch = aarch64
	license = MIT
	provides = tobby
	conflicts = tobby
	options = !strip
	source = LICENSE::https://raw.githubusercontent.com/ObsidianIRC/tobby/v${VERSION}/LICENSE
	sha256sums = ${LICENSE_SHA256}
	source_x86_64 = tobby-${VERSION}-x86_64::${BASE_URL}/tobby-x86_64-linux
	sha256sums_x86_64 = ${X86_SHA256}
	source_aarch64 = tobby-${VERSION}-aarch64::${BASE_URL}/tobby-aarch64-linux
	sha256sums_aarch64 = ${AARCH64_SHA256}

pkgname = tobby-bin
SRCINFO

echo "  pushing tobby-bin AUR..."
git -C aur/tobby-bin add -A && git -C aur/tobby-bin commit -m "update to ${VERSION}" && git -C aur/tobby-bin push

echo "✓ AUR release ${VERSION} done"
