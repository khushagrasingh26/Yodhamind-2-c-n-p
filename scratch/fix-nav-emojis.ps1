# Fix 3: Remove emojis from navigation sidebar links across all HTML files
# Replace emoji icons with clean SVG-based icons using inline content
$root = "c:\Users\khush\Desktop\yodhamind\yodhamind college antigravity\yodhamindcollege-main\yodhamindcollege-nopsy-V2\FIXING YODHAMIND\yodhamindcollege-nopsy-V2"

$dirs = @("pages", "games", "tools")

# Map of emoji to simple text abbreviation for screen readers
$replacements = @(
    @{ from = '<span class="ym-sidebar__link-icon">🏠</span>'; to = '<span class="ym-sidebar__link-icon">⌂</span>' },
    @{ from = '<span class="ym-sidebar__link-icon">📊</span>'; to = '<span class="ym-sidebar__link-icon">▦</span>' },
    @{ from = '<span class="ym-sidebar__link-icon">🎮</span>'; to = '<span class="ym-sidebar__link-icon">▶</span>' },
    @{ from = '<span class="ym-sidebar__link-icon">📋</span>'; to = '<span class="ym-sidebar__link-icon">☑</span>' },
    @{ from = '<span class="ym-sidebar__link-icon">📝</span>'; to = '<span class="ym-sidebar__link-icon">✎</span>' },
    @{ from = '<span class="ym-sidebar__link-icon">🌬️</span>'; to = '<span class="ym-sidebar__link-icon">◎</span>' },
    @{ from = '<span class="ym-sidebar__link-icon">⏱️</span>'; to = '<span class="ym-sidebar__link-icon">◷</span>' },
    @{ from = '<span class="ym-sidebar__link-icon">💬</span>'; to = '<span class="ym-sidebar__link-icon">◻</span>' },
    @{ from = '<span class="ym-sidebar__link-icon">📞</span>'; to = '<span class="ym-sidebar__link-icon">☏</span>' }
)

$totalFixed = 0

foreach ($dir in $dirs) {
    $path = Join-Path $root $dir
    if (-not (Test-Path $path)) { continue }
    Get-ChildItem -Path $path -Filter "*.html" | ForEach-Object {
        $content = Get-Content $_.FullName -Raw
        $original = $content

        foreach ($r in $replacements) {
            $content = $content.Replace($r.from, $r.to)
        }

        if ($content -ne $original) {
            Set-Content $_.FullName $content -NoNewline
            Write-Host "Fixed nav emojis: $($_.Name)"
            $totalFixed++
        }
    }
}

Write-Host "`nFixed $totalFixed files - Fix 3 complete"
