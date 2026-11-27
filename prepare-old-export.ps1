[CmdletBinding()]
param([string]$OldProjectPath = 'C:\Проекты\Мастер-папка\todayIS')
$ErrorActionPreference = 'Stop'
$oldRoot = (Resolve-Path -LiteralPath $OldProjectPath).ProviderPath
$manifest = Get-Content -LiteralPath (Join-Path $oldRoot 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.name -ne 'Today Is') { throw 'This is not a Today Is extension folder.' }
$files = @('settings-backup.js','settings-backup.css','export-settings.html','export-settings.js')
# Only add the exporter. Existing extension code and browser settings stay in place.
foreach ($name in $files) {
    $destination = Join-Path $oldRoot $name
    if ((Test-Path -LiteralPath $destination) -and
        (Get-FileHash -LiteralPath $destination).Hash -ne (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $name)).Hash) {
        throw "A different file already exists: $destination"
    }
}
foreach ($name in $files) {
    $destination = Join-Path $oldRoot $name
    if (!(Test-Path -LiteralPath $destination)) {
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $destination
    }
}
Write-Host 'Exporter added. Reload the OLD extension at chrome://extensions.'
Write-Host 'In its extension URL, replace newtab.html with export-settings.html, then download settings.'
Write-Host 'Keep the old extension installed until the new one has imported your JSON file.'
