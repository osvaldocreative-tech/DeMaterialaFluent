#!/bin/zsh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-3000}"

node "${SCRIPT_DIR}/ejecutor-localhost.js" "$PORT"
