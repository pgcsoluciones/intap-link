#!/usr/bin/env python3
"""Block production-only actions unless an exact SHA approval is present."""

from __future__ import annotations

import os
import re
import subprocess
import sys


def git_output(*args: str) -> str:
    return subprocess.check_output(["git", *args], text=True).strip()


def main() -> int:
    if os.getenv("INTAP_ENFORCE_PRODUCTION_APPROVAL") != "1":
        print("approval guard: audit-only mode")
        return 0

    approved = os.getenv("INTAP_APPROVED_COMMIT", "").strip().lower()
    current = git_output("rev-parse", "HEAD").lower()
    marker = os.getenv("INTAP_PRODUCTION_APPROVAL", "").strip().upper()

    if marker != "SÍ":
        print("approval guard: missing explicit production approval", file=sys.stderr)
        return 1
    if not re.fullmatch(r"[0-9a-f]{40}", approved or ""):
        print("approval guard: INTAP_APPROVED_COMMIT must be a full SHA", file=sys.stderr)
        return 1
    if approved != current:
        print(f"approval guard: approved SHA {approved} != current SHA {current}", file=sys.stderr)
        return 1

    print(f"approval guard: approved exact SHA {current}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
