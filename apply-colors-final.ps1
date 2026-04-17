$files = Get-ChildItem -Path 'd:\Projects\gym\gym-dashboard\src' -Recurse -Filter '*.jsx'
Write-Host "Processing $($files.Count) JSX files"
$updated = 0

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $original = $content
    
    # Replace #8e949d with the new secondary color
    $content = $content -replace '#8e949d', '#D1D5DB'
    
    # Replace bg-white with bg-card
    $content = $content -replace 'bg-white(["\s])', 'bg-card$1'
    
    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $updated++
        Write-Host "Updated: $($file.Name)"
    }
}

Write-Host ""
Write-Host "Total files updated: $updated"
Write-Host "Replacements completed successfully"
