#!/usr/bin/env sh
# TypeBlocks installer for macOS and Linux.
# Downloads the newest release from GitHub and installs it into VS Code.
#   curl -fsSL https://raw.githubusercontent.com/LukasVitek67/typeblocks/main/install.sh | sh
set -e
repo="LukasVitek67/typeblocks"

url=$(curl -fsSL -H "User-Agent: typeblocks-installer" "https://api.github.com/repos/$repo/releases/latest" \
  | grep -o '"browser_download_url": *"[^"]*\.vsix"' | head -n 1 | sed 's/.*"\(https[^"]*\)"$/\1/')
if [ -z "$url" ]; then
  echo "No .vsix file found in the latest release." >&2
  exit 1
fi

file="${TMPDIR:-/tmp}/typeblocks.vsix"
echo "Downloading $url ..."
curl -fsSL "$url" -o "$file"

if command -v code >/dev/null 2>&1; then
  CODE=code
elif [ -x "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" ]; then
  CODE="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
else
  echo "VS Code's 'code' command was not found."
  echo "Install it by hand: VS Code > Extensions > ... > Install from VSIX... and pick: $file"
  exit 0
fi

"$CODE" --install-extension "$file" --force
echo
echo "TypeBlocks is installed. Open any .ts file and click the blocks button in the top-right corner of the editor."
