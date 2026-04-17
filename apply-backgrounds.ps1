$files = Get-ChildItem -Path 'd:\Projects\gym\gym-dashboard\src\pages' -Recurse -Filter '*.jsx'
Write-Host "Found $($files.Count) JSX files"
$updated = 0

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $original = $content
    
    # Replace background colors
    # Be careful with these - only replace in specific card/div contexts
    $content = $content -replace 'bg-gray-50(["\s])', 'bg-slate-800/50$1'
    $content = $content -replace 'from-blue-50', 'from-primary-blue'
    $content = $content -replace 'from-emerald-50', 'from-primary-blue'
    $content = $content -replace 'from-green-50', 'from-primary-blue'
    $content = $content -replace 'from-slate-50', 'from-primary-blue'
    $content = $content -replace 'from-amber-50', 'from-primary-blue'
    $content = $content -replace 'from-indigo-50', 'from-primary-blue'
    $content = $content -replace 'from-rose-50', 'from-primary-blue'
    $content = $content -replace 'to-white', 'to-navy'
    
    # Replace borders
    $content = $content -replace 'border-blue-100', 'border-secondary-blue'
    $content = $content -replace 'border-gray-200', 'border-slate-700/20'
    $content = $content -replace 'border-slate-200', 'border-slate-700/20'
    $content = $content -replace 'border-slate-100', 'border-slate-700/30'
    $content = $content -replace 'border-gray-100', 'border-slate-700/30'
    
    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $updated++
        Write-Host "Updated: $($file.Name)"
    }
}

Write-Host "Total files updated: $updated"
