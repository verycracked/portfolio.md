#!/usr/bin/env bash
# Install the portfolio skill globally so it can be invoked from any repo.
# Symlinks this directory into ~/.claude/skills/portfolio.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${HOME}/.claude/skills/portfolio"

mkdir -p "${HOME}/.claude/skills"

if [[ -L "$DEST" ]]; then
  echo "Already installed: $DEST -> $(readlink "$DEST")"
  exit 0
fi

if [[ -e "$DEST" ]]; then
  echo "Refusing to overwrite existing non-symlink: $DEST" >&2
  echo "Remove it first or back it up, then re-run this script." >&2
  exit 1
fi

ln -s "$SRC" "$DEST"
mkdir -p "$DEST/state"

if [[ ! -f "$DEST/config.env" ]]; then
  cp "$DEST/config.env.example" "$DEST/config.env"
  chmod 600 "$DEST/config.env"
  echo "Created $DEST/config.env — fill in PORTFOLIO_URL and OWNER_PASSWORD before first use."
fi

echo "Installed. Invoke with /portfolio from any repo."
