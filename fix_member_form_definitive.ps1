$path = "c:\Users\HP\Desktop\gymog\gym-project\gym-project\gym-dashboard\src\components\MemberForm.jsx"
$lines = Get-Content -Path $path
$newList = New-Object System.Collections.Generic.List[string]

for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($i -eq 1429) { # Line 1430
        $newList.Add('                    {pkg.is_student_offer && (')
        $newList.Add('                      <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] bg-yellow-400 text-yellow-900 border border-yellow-500/30 shadow-sm animate-pulse-subtle">')
        $newList.Add('                        Students Offer')
        $newList.Add('                      </span>')
        $newList.Add('                    )}')
        $i += 4 # Skip broken lines 1431-1434
    } elseif ($i -eq 1516) { # Line 1517 (previously 1517, but might have shifted)
        # Check if it's the broken block
        if ($lines[$i] -match 'span className') {
             # Skip the broken lines 1517, 1518, 1519, 1520 (which was the )} ${v.pricing_type)
             # Wait, Step Id 408 showed:
             # 1516: `${pkg.title}
             # 1517: <span ...
             # 1518: Students Offer
             # 1519: </span>
             # 1520: )} ${v.pricing_type ...
             
             # We want to restore 1516 to include the rest of the template literal
             $newList.Add('                                          `${pkg.title} ${v.pricing_type === "duration"')
             $i += 4
        } else {
             $newList.Add($lines[$i])
        }
    } else {
        $newList.Add($lines[$i])
    }
}

$newList | Set-Content -Path $path
