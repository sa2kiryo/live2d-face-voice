$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$repoRootPrefix = [System.IO.Path]::GetFullPath($repoRoot).TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
$hasError = $false

Get-ChildItem -Path $repoRoot -Recurse -Filter *.json -File | ForEach-Object {
    $path = $_.FullName
    $fullPath = [System.IO.Path]::GetFullPath($path)
    $relativePath = $fullPath

    if ($fullPath.StartsWith($repoRootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        $relativePath = $fullPath.Substring($repoRootPrefix.Length)
    }

    try {
        Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null
        Write-Output "OK $relativePath"
    }
    catch {
        Write-Output "NG $relativePath"
        $hasError = $true
    }
}

if ($hasError) {
    exit 1
}

exit 0
