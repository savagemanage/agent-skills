#!/usr/bin/env bash
# Wrapper around the cross-platform Python packager.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec python3 "$ROOT/scripts/package-skills.py" "$@"
