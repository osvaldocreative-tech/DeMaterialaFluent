#!/bin/zsh

# Uso:
#   doble clic en este archivo, o:
#   ./abrir-localhost.command [puerto]
# Ejemplos:
#   ./abrir-localhost.command
#   ./abrir-localhost.command 5173

PORT="${1:-3000}"
URL="http://localhost:${PORT}"

open "$URL"
echo "Abriendo localhost directo en: $URL"
