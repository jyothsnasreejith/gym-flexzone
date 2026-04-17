$files = Get-ChildItem -Path 'd:\Projects\gym\gym-dashboard\src\pages' -Recurse -Filter '*.jsx'
Write-Host "Found $($files.Count) JSX files"
$updated = 0

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $original = $content
    
    $content = $content -replace 'text-slate-900', 'text-white'
    $content = $content -replace 'text-gray-900', 'text-white'
    $content = $content -replace 'text-slate-500', 'text-secondary'
    $content = $content -replace 'text-gray-500', 'text-secondary'
    $content = $content -replace 'text-gray-600', 'text-secondary'
    
    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $updated++
        Write-Host "Updated: $($file.Name)"
    }
}

Write-Host "Total files updated: $updated"
