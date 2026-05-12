$path = "."
$files = Get-ChildItem -Path $path -Filter "*.html" -Recurse

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    if ($content -match "<head>" -and $content -notmatch "tokens\.css") {
        $folder = Split-Path $file.FullName
        $root = (Get-Item .).FullName
        
        $relativeFolder = $folder.Substring($root.Length).TrimStart("\")
        
        $upDirs = ""
        if ($relativeFolder.Length -gt 0) {
            $parts = $relativeFolder.Split("\")
            foreach ($p in $parts) {
                $upDirs += "../"
            }
        }
        
        $tokensPath = $upDirs + "css/tokens.css"
        
        $linkTag = "    <link rel=`"stylesheet`" href=`"$tokensPath`">"
        
        $content = $content -replace "(?i)(<head>\r?\n?)", "`$1$linkTag`r`n"
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "Updated $($file.FullName)"
    }
}
