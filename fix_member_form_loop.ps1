$path = "c:\Users\HP\Desktop\gymog\gym-project\gym-project\gym-dashboard\src\components\MemberForm.jsx"
$lines = Get-Content -Path $path

$newLines = @()
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($i -eq 1429) { # PowerShell index is 0-based, so line 1430 is index 1429
        $newLines += '                    {pkg.is_student_offer && ('
        $newLines += '                      <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] bg-yellow-400 text-yellow-900 border border-yellow-500/30 shadow-sm animate-pulse-subtle">'
        $newLines += '                        Students Offer'
        $newLines += '                      </span>'
        $newLines += '                    )}'
        $i += 4 # Skip the next 4 broken lines
    } else {
        $newLines += $lines[$i]
    }
}

$newLines | Set-Content -Path $path
