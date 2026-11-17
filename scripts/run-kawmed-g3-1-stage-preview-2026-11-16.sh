#!/usr/bin/env bash
# KAW-G3-003. Default: remote reads and local evidence/build only.
# Stage and promotion are separate, explicitly authorized invocations.
set -euo pipefail
umask 077
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/kawmed-g3-1-pages.mjs" "$@"
