[CmdletBinding()]
param(
    [string]$ProjectPath = 'C:\Проекты\GNTD GPT'
)

$ErrorActionPreference = 'Stop'
$project = (Resolve-Path -LiteralPath $ProjectPath).ProviderPath
$manifestPath = Join-Path $project 'manifest.json'
$installed = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($installed.name -ne 'Today Is') {
    throw "Expected the installed Today Is folder: $project"
}

$work = Join-Path ([IO.Path]::GetTempPath()) ('TodayIs-update-' + [Guid]::NewGuid().ToString('N'))
$archive = Join-Path $work 'TodayIs.zip'
$unpacked = Join-Path $work 'files'
$backup = Join-Path $work 'backup'
$applied = New-Object 'System.Collections.Generic.List[object]'
New-Item -ItemType Directory -Path $work | Out-Null

try {
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/ney4teach/TodayIs/archive/refs/heads/main.zip' -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $unpacked
    $source = Join-Path $unpacked 'TodayIs-main'
    $incoming = Get-Content -LiteralPath (Join-Path $source 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($incoming.name -ne $installed.name -or $incoming.manifest_version -ne 3 -or
        $incoming.chrome_url_overrides.newtab -ne 'newtab.html' -or
        [string]$incoming.key -cne [string]$installed.key) {
        throw 'The archive manifest does not match the installed extension.'
    }

    $required = @('manifest.json', 'newtab.html', 'newtab.js', 'newtab.css', 'activity-worker.js', 'bookmarks.js',
        'cloud-config.js', 'cloud.js', 'system-music.js', 'weather.js')
    foreach ($name in $required) {
        if (!(Test-Path -LiteralPath (Join-Path $source $name) -PathType Leaf)) {
            throw "Missing extension file: $name"
        }
    }

    $files = @(Get-ChildItem -LiteralPath $source -File |
        Where-Object { $_.Extension -eq '.js' -or $_.Name -in @('newtab.html', 'newtab.css') })
    foreach ($folder in @('icons', 'wallpapers')) {
        $files += Get-ChildItem -LiteralPath (Join-Path $source $folder) -Recurse -File
    }
    $files += Get-Item -LiteralPath (Join-Path $source 'manifest.json')

    foreach ($file in $files) {
        $relative = $file.FullName.Substring($source.Length + 1)
        $destination = Join-Path $project $relative
        $existed = Test-Path -LiteralPath $destination -PathType Leaf
        if ($existed -and ($relative -eq 'cloud-config.js' -or
                (Get-FileHash -LiteralPath $destination).Hash -eq (Get-FileHash -LiteralPath $file.FullName).Hash)) {
            continue
        }

        $saved = Join-Path $backup $relative
        if ($existed) {
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $saved) | Out-Null
            Copy-Item -LiteralPath $destination -Destination $saved
        }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
        $applied.Add(@{ Destination = $destination; Backup = $saved; Existed = $existed })
        Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
    }

    Write-Host "Updated files: $($applied.Count)"
    if (Test-Path -LiteralPath $backup) { Write-Host "Backup: $backup" }
    Write-Host 'Open chrome://extensions and click Reload on Today Is.'
} catch {
    $failure = $_
    for ($index = $applied.Count - 1; $index -ge 0; $index--) {
        $entry = $applied[$index]
        try {
            if ($entry.Existed) {
                Copy-Item -LiteralPath $entry.Backup -Destination $entry.Destination -Force
            } elseif (Test-Path -LiteralPath $entry.Destination -PathType Leaf) {
                Remove-Item -LiteralPath $entry.Destination
            }
        } catch {
            Write-Warning "Could not restore $($entry.Destination): $_"
        }
    }
    if (Test-Path -LiteralPath $backup) { Write-Host "Backup: $backup" }
    throw $failure
}
