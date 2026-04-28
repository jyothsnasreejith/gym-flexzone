$files = Get-ChildItem -Path 'd:\Projects\gym\gym-dashboard\src' -Recurse -Filter '*.jsx'
Write-Host "Processing $($files.Count) JSX files"
$updated = 0

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $original = $content
    
    # Replace hex colors carefully
    # Don't use regex replacement for these as they can match unintended contexts
    # Instead, do simple string replacement
    
    # Replace #8e949d with the new secondary color
    $content = $content -replace '#8e949d', '#D1D5DB'
    
    # Replace #ffffff (case insensitive) with appropriate alternatives depending on context
    # For now, leave #ffffff as it's the intended white text color in the new scheme
    
    # Replace specific color patterns that should not be used
    $content = $content -replace 'bg-white(["\s])', 'bg-card$1'
    
    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $updated++
        Write-Host "✓ Updated: $($file.Name)"
    }
}

Write-Host ""
Write-Host "✓ Total files updated: $updated"
Write-Host "✓ Replacements completed successfully"
