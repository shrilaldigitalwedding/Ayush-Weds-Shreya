@echo off
setlocal
cd /d "%~dp0"
echo ====================================================================
echo  Starting Local Server for Ayush ^& Shreya's Wedding Invitation
echo ====================================================================
start "" "http://localhost:8080/invite/shahi-patra-1d92be.html"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = (Get-Item '%~dp0').FullName; " ^
  "if (-not (Test-Path (Join-Path $root 'invite'))) { $root = Join-Path $root 'www.itsbalcony.com' }; " ^
  "$listener = New-Object System.Net.HttpListener; " ^
  "$listener.Prefixes.Add('http://localhost:8080/'); " ^
  "$listener.Start(); " ^
  "Write-Host 'Preview server running at http://localhost:8080/invite/shahi-patra-1d92be.html' -ForegroundColor Green; " ^
  "Write-Host 'Press Ctrl+C to stop the server' -ForegroundColor Yellow; " ^
  "while ($listener.IsListening) { " ^
  "  $c = $listener.GetContext(); " ^
  "  $p = $c.Request.Url.LocalPath.TrimStart('/'); " ^
  "  if ([string]::IsNullOrEmpty($p)) { $p = 'invite/shahi-patra-1d92be.html' }; " ^
  "  $f = Join-Path $root ($p -replace '/', '\'); " ^
  "  if (Test-Path $f -PathType Leaf) { " ^
  "    $b = [IO.File]::ReadAllBytes($f); " ^
  "    $c.Response.ContentLength64 = $b.Length; " ^
  "    $ext = [IO.Path]::GetExtension($f).ToLower(); " ^
  "    $ct = switch ($ext) { " ^
  "      '.html' { 'text/html; charset=utf-8' } " ^
  "      '.css'  { 'text/css' } " ^
  "      '.js'   { 'application/javascript' } " ^
  "      '.mp4'  { 'video/mp4' } " ^
  "      '.mp3'  { 'audio/mpeg' } " ^
  "      '.webp' { 'image/webp' } " ^
  "      '.svg'  { 'image/svg+xml' } " ^
  "      '.woff2'{ 'font/woff2' } " ^
  "      '.otf'  { 'font/otf' } " ^
  "      '.jpg'  { 'image/jpeg' } " ^
  "      '.png'  { 'image/png' } " ^
  "      default { 'application/octet-stream' } " ^
  "    }; " ^
  "    $c.Response.ContentType = $ct; " ^
  "    $c.Response.OutputStream.Write($b, 0, $b.Length) " ^
  "  } else { " ^
  "    $c.Response.StatusCode = 404 " ^
  "  }; " ^
  "  $c.Response.OutputStream.Close() " ^
  "}"
