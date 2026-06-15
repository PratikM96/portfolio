# Stamp every site.css / site.js reference with a short content hash so the files
# can be cached immutably (a change to the file changes the hash, which is a new
# URL, so visitors always get the new version). Run this whenever you edit
# assets/site.css or assets/site.js. Safe to run anytime: if nothing changed it
# writes nothing. CI (check_site.py) fails a PR if you forgot to run it.
#
#   powershell -ExecutionPolicy Bypass -File .github\scripts\bump-assets.ps1

$root = (Resolve-Path "$PSScriptRoot\..\..").Path

function Get-Stamp([string]$path) {
  # Normalize line endings so the hash matches CI (which checks out LF on Linux).
  $text  = [System.IO.File]::ReadAllText($path) -replace "`r`n", "`n"
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
  $hash  = [System.Security.Cryptography.SHA1]::Create().ComputeHash($bytes)
  return (($hash | ForEach-Object { $_.ToString('x2') }) -join '').Substring(0, 8)
}

$css  = Get-Stamp (Join-Path $root 'assets\site.css')
$js   = Get-Stamp (Join-Path $root 'assets\site.js')
$utf8 = New-Object System.Text.UTF8Encoding $false

Get-ChildItem -Path $root -Recurse -Filter *.html |
  Where-Object { $_.FullName -notmatch '\\\.github\\' } |
  ForEach-Object {
    $p    = $_.FullName
    $orig = [System.IO.File]::ReadAllText($p)
    $new  = [regex]::Replace($orig, '(href|src)="([^"]*assets/site\.css)(\?v=[^"]*)?"', { param($m) $m.Groups[1].Value + '="' + $m.Groups[2].Value + '?v=' + $css + '"' })
    $new  = [regex]::Replace($new,  '(href|src)="([^"]*assets/site\.js)(\?v=[^"]*)?"',  { param($m) $m.Groups[1].Value + '="' + $m.Groups[2].Value + '?v=' + $js  + '"' })
    if ($new -ne $orig) {
      [System.IO.File]::WriteAllText($p, $new, $utf8)
      "stamped: " + $_.FullName.Substring($root.Length + 1)
    }
  }

Write-Host "Done. site.css -> ?v=$css   site.js -> ?v=$js"
