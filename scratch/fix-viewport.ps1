# Fix 1: Remove user-scalable=no from all HTML files
$root = "c:\Users\khush\Desktop\yodhamind\yodhamind college antigravity\yodhamindcollege-main\yodhamindcollege-nopsy-V2\FIXING YODHAMIND\yodhamindcollege-nopsy-V2"

$dirs = @("pages", "games", "tools")

foreach ($dir in $dirs) {
    $path = Join-Path $root $dir
    Get-ChildItem -Path $path -Filter "*.html" | ForEach-Object {
        $content = Get-Content $_.FullName -Raw
        $original = $content

        # Handle variant with viewport-fit=cover
        $content = $content -replace 'width=device-width, initial-scale=1\.0, maximum-scale=1\.0, user-scalable=no, viewport-fit=cover', 'width=device-width, initial-scale=1.0, viewport-fit=cover'
        # Handle standard variant
        $content = $content -replace 'width=device-width, initial-scale=1\.0, maximum-scale=1\.0, user-scalable=no', 'width=device-width, initial-scale=1.0'

        if ($content -ne $original) {
            Set-Content $_.FullName $content -NoNewline
            Write-Host "Fixed viewport: $($_.FullName)"
        } else {
            Write-Host "No change: $($_.Name)"
        }
    }
}

Write-Host "`nDone - Fix 1 complete"
