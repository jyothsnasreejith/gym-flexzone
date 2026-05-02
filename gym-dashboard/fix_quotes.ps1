$filePath = "src/modals/AddPackageModal.jsx"
$content = Get-Content $filePath -Raw
$content = $content -replace '(?<!\\)className=\\"w-full border rounded-md px-3 py-2 text-sm bg-card text-white\\"', 'className="w-full border rounded-md px-3 py-2 text-sm bg-card text-white"'
Set-Content $filePath $content
Write-Host "Fixed AddPackageModal.jsx"
