$files = Get-ChildItem -Path 'd:\Projects\gym\gym-dashboard\src\pages' -Recurse -Filter '*.jsx'
Write-Host "Found $($files.Count) JSX files"
$updated = 0

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $original = $content
    
    # Replace hover states
    $content = $content -replace 'hover:bg-gray-50', 'hover:bg-slate-800/20'
    $content = $content -replace 'hover:bg-gray-100', 'hover:bg-slate-800/30'
    $content = $content -replace 'hover:bg-white', 'hover:bg-primary-blue'
    $content = $content -replace 'hover:bg-gray-600', 'hover:bg-slate-800'
    $content = $content -replace 'hover:text-gray-800', 'hover:text-white'
    
    # Replace badge/status colors
    $content = $content -replace 'bg-green-50\s+text-green-700', 'badge-success'
    $content = $content -replace 'bg-red-50\s+text-red-700', 'badge-error'
    $content = $content -replace 'bg-yellow-50\s+text-yellow-700', 'badge-warning'
    $content = $content -replace 'bg-blue-50\s+text-blue-700', 'badge-info'
    
    # Replace other color patterns
    $content = $content -replace 'text-gray-700', 'text-white'
    $content = $content -replace 'text-gray-800', 'text-white'
    
    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $updated++
        Write-Host "Updated: $($file.Name)"
    }
}

Write-Host "Total files updated: $updated"
