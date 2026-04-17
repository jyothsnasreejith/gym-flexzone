$files = Get-ChildItem -Path 'd:\Projects\gym\gym-dashboard\src' -Recurse -Filter '*.jsx'
Write-Host "Found $($files.Count) JSX files"
$updated = 0

$replacements = @(
    @{ old = 'bg-white'; new = 'style={{ backgroundColor: "#114689" }}' },
    @{ old = '"#ffffff"'; new = '"#FFFFFF"' },
    @{ old = "'#ffffff'"; new = "'#FFFFFF'" },
    @{ old = '#8e949d'; new = '#D1D5DB' },
    @{ old = 'text-gray-900'; new = 'style={{ color: "#FFFFFF" }}' },
    @{ old = 'text-gray-600'; new = 'style={{ color: "#D1D5DB" }}' },
    @{ old = 'text-gray-500'; new = 'style={{ color: "#9CA3AF" }}' },
    @{ old = 'border-gray-200'; new = 'style={{ borderColor: "rgba(255,255,255,0.08)" }}' }
)

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $original = $content
    
    foreach ($replacement in $replacements) {
        if ($content -match [regex]::Escape($replacement.old)) {
            $content = $content -replace [regex]::Escape($replacement.old), $replacement.new
        }
    }
    
    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $updated++
        Write-Host "Updated: $($file.Name)"
    }
}

Write-Host "Total files updated: $updated"
