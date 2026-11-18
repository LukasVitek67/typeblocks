# TypeBlocks installer for Windows.
# Downloads the newest release from GitHub and installs it into VS Code.
#   irm https://raw.githubusercontent.com/LukasVitek67/typeblocks/main/install.ps1 | iex
$ErrorActionPreference = 'Stop'
$repo = 'LukasVitek67/typeblocks'

$release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers @{ 'User-Agent' = 'typeblocks-installer' }
$asset = $release.assets | Where-Object { $_.name -like '*.vsix' } | Select-Object -First 1
if (-not $asset) { throw 'No .vsix file found in the latest release.' }

$file = Join-Path $env:TEMP $asset.name
Write-Host "Downloading $($asset.name) ..."
Invoke-WebRequest $asset.browser_download_url -OutFile $file -UseBasicParsing

$code = (Get-Command code -ErrorAction SilentlyContinue).Source
if (-not $code) {
  foreach ($guess in @("$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd", "$env:ProgramFiles\Microsoft VS Code\bin\code.cmd")) {
    if (Test-Path $guess) { $code = $guess; break }
  }
}
if (-not $code) {
  Write-Host "VS Code's 'code' command was not found." -ForegroundColor Yellow
  Write-Host "Install it by hand: VS Code > Extensions > ... > Install from VSIX... and pick:`n  $file"
  return
}

& $code --install-extension $file --force
Write-Host ''
Write-Host "TypeBlocks $($release.tag_name) is installed." -ForegroundColor Green
Write-Host 'Open any .ts file and click the blocks button in the top-right corner of the editor.'
