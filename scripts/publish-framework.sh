#!/usr/bin/env bash
# scripts/publish-framework.sh — one-way publish of packages/toolkit-framework
# to the public standalone repo. The monorepo is the dev home; the public repo
# is the consumption point (machine-iteration design §2 d5).
# Usage: scripts/publish-framework.sh [remote-url]
set -euo pipefail

# GUARDED (2026-09): packages/toolkit-framework here is now an unedited, pinned COPY vendored from org-os
# (see packages/org-os-kms/VENDORED.md); org-os is the canonical home. Publishing this copy would push the AT Proto
# plane files and the org-os port to the PUBLIC repo below, with `rsync --delete` and a push. Do not run this
# by accident. Whether the public repo keeps a role is an operator decision; until then it refuses.
if [ "${PUBLISH_FRAMEWORK_OVERRIDE:-}" != "publish-the-vendored-copy" ]; then
  echo "publish-framework.sh is disabled: packages/toolkit-framework is a vendored copy of org-os (canonical home)." >&2
  echo "Change org-os, tag, re-vendor. To publish this copy anyway, set PUBLISH_FRAMEWORK_OVERRIDE=publish-the-vendored-copy" >&2
  echo "(it rsyncs with --delete and PUSHES to a public repo; run it only with the operator present)." >&2
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$REPO_ROOT/packages/toolkit-framework"
REMOTE="${1:-https://github.com/luizfernandosg/toolkit-framework.git}"
STAGE="$(mktemp -d)/toolkit-framework"

git clone --depth 1 "$REMOTE" "$STAGE" 2>/dev/null || { mkdir -p "$STAGE"; git -C "$STAGE" init -b main; git -C "$STAGE" remote add origin "$REMOTE"; }
rsync -a --delete --exclude node_modules --exclude .git "$PKG/" "$STAGE/"
SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
git -C "$STAGE" add -A
git -C "$STAGE" commit -m "publish: sync from regen-toolkit@$SHA" || { echo "nothing to publish"; exit 0; }
git -C "$STAGE" push -u origin main
echo "published → $REMOTE (from $SHA)"
