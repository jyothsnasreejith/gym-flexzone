$files = Get-ChildItem -Path 'd:\Projects\gym\gym-dashboard\src' -Recurse -Filter '*.jsx'
Write-Host "Processing $($files.Count) JSX files for inline hex colors"
$updated = 0

# Inline hex color replacements
$hexReplacements = @(
    @{ old = 'text-\[#101418\]'; new = 'text-white' },
    @{ old = "text-\['#101418'\]"; new = 'text-white' },
    @{ old = 'text-\[#5e718d\]'; new = 'text-secondary' },
    @{ old = "text-\['#5e718d'\]"; new = 'text-secondary' },
    @{ old = '#101418'; new = '#FFFFFF' },
    @{ old = '#5e718d'; new = '#D1D5DB' },
    @{ old = '#ffffff'; new = '#FFFFFF' }
)

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $original = $content
    
    foreach ($replacement in $hexReplacements) {
        $content = $content -replace $replacement.old, $replacement.new
    }
    
    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $updated++
        Write-Host "Updated: $($file.Name)"
    }
}

Write-Host ""
Write-Host "Total files updated: $updated"
