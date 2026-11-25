#!/bin/sh
# Explicit exit: negation under `set -e` does not make a failed guard fatal.
set -eu
for tool in node npm; do
    if command -v "$tool" >/dev/null 2>&1; then
        echo "Forbidden runtime tool: $tool" >&2
        exit 1
    fi
done
