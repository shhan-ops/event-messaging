#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/release.sh <patch|minor|major|x.y.z> [--skip-test]
usage() {
  echo "Usage: $0 <patch|minor|major|x.y.z> [--skip-test]" >&2
  exit 1
}

TARGET="${1:-}"
SKIP_TEST="${2:-}"

# Validate args
if [[ -z "$TARGET" ]]; then
  usage
fi

if [[ "$TARGET" != "patch" && "$TARGET" != "minor" && "$TARGET" != "major" ]] && \
   ! [[ "$TARGET" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: invalid version argument '$TARGET'. Must be patch, minor, major, or x.y.z" >&2
  usage
fi

if [[ -n "$SKIP_TEST" && "$SKIP_TEST" != "--skip-test" ]]; then
  echo "Error: unknown option '$SKIP_TEST'" >&2
  usage
fi

# Must be on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Error: must be on 'main' branch (currently on '$CURRENT_BRANCH')" >&2
  exit 1
fi

# Working tree must be clean
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree is not clean. Commit or stash your changes first." >&2
  exit 1
fi

echo "[1/5] git pull --ff-only origin main"
git pull --ff-only origin main

echo "[2/5] Running tests and build"
if [[ "$SKIP_TEST" == "--skip-test" ]]; then
  echo "  (skipping tests)"
else
  npm test && npm run build
fi

echo "[3/5] npm version $TARGET"
npm version "$TARGET"
NEW_TAG=$(git describe --tags --abbrev=0)

echo "[4/5] git push origin main"
git push origin main

echo "[5/5] git push origin $NEW_TAG"
git push origin "$NEW_TAG"

echo "Done. Publish workflow should start for tag $NEW_TAG."
