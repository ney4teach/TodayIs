param([string]$ExtensionId, [string]$BuildOnly)
$ErrorActionPreference = 'Stop'
$framework = "$env:windir\Microsoft.NET\Framework64\v4.0.30319"
if (!(Test-Path "$framework\csc.exe")) { $framework = "$env:windir\Microsoft.NET\Framework\v4.0.30319" }
$metadata = "$env:windir\System32\WinMetadata"
if ($BuildOnly) { $exe = $BuildOnly } else {
    if (!$ExtensionId) {
        $root = Split-Path $PSScriptRoot -Parent
        $manifestData = Get-Content -LiteralPath (Join-Path $root 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($manifestData.key) {
            $source = [Convert]::FromBase64String($manifestData.key)
        } else {
            if ($root -match '^[a-zA-Z]:') { $root = $root.Substring(0,1).ToUpperInvariant() + $root.Substring(1) }
            $source = [Text.Encoding]::Unicode.GetBytes($root)
        }
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $digest = $sha.ComputeHash($source) } finally { $sha.Dispose() }
        $alphabet = 'abcdefghijklmnop'
        $ExtensionId = -join $(foreach ($b in $digest[0..15]) { $alphabet[$b -shr 4]; $alphabet[$b -band 15] })
    }
    if ($ExtensionId -cnotmatch '^[a-p]{32}$') { throw 'Invalid extension ID' }
    $folder = Join-Path $env:LOCALAPPDATA 'GNTD\MediaHost'
    New-Item -ItemType Directory -Force $folder | Out-Null
    $version = (Get-FileHash -LiteralPath "$PSScriptRoot\MediaHost.cs" -Algorithm SHA256).Hash
    $exe = Join-Path $folder "MediaHost-$version.exe"
}
function Build-MediaHost([string]$outputPath) {
    & "$framework\csc.exe" /nologo /target:exe "/out:$outputPath" "/r:$framework\System.Runtime.dll" "/r:$framework\System.Runtime.WindowsRuntime.dll" "/r:$framework\System.Runtime.InteropServices.WindowsRuntime.dll" "/r:$metadata\Windows.Foundation.winmd" "/r:$metadata\Windows.Storage.winmd" "/r:$metadata\Windows.Media.winmd" /r:System.Web.Extensions.dll /r:System.Drawing.dll "$PSScriptRoot\MediaHost.cs"
    if ($LASTEXITCODE) { throw 'Media host compilation failed' }
}
if ($BuildOnly) { Build-MediaHost $exe; return }
if (!(Test-Path -LiteralPath $exe -PathType Leaf)) {
    $staging = Join-Path $folder ("build-" + [guid]::NewGuid() + ".exe")
    try {
        Build-MediaHost $staging
        try { [IO.File]::Move($staging, $exe) }
        catch [IO.IOException] { if (!(Test-Path -LiteralPath $exe -PathType Leaf)) { throw } }
    } finally {
        if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging }
    }
}
$manifest = Join-Path $folder 'host.json'
@{ name='gntd.media'; description='GNTD Windows media'; path=$exe; type='stdio'; allowed_origins=@("chrome-extension://$ExtensionId/") } | ConvertTo-Json | ForEach-Object { [IO.File]::WriteAllText($manifest, $_, [Text.UTF8Encoding]::new($false)) }
foreach ($browser in 'Google\Chrome','Microsoft\Edge','Yandex\YandexBrowser') {
    $key = New-Item -Force "HKCU:\Software\$browser\NativeMessagingHosts\gntd.media"
    $key.SetValue('', $manifest)
}
Write-Host 'Installed. Open a new dashboard tab.'
