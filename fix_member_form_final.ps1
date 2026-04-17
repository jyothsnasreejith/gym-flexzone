$path = "c:\Users\HP\Desktop\gymog\gym-project\gym-project\gym-dashboard\src\components\MemberForm.jsx"
$content = [IO.File]::ReadAllText($path)

# Regex to catch the standalone badge at line 1431 and its broken span
$content = $content -replace '\{pkg\.title\}\r?\n\s+\{pkg\.is_student_offer && \(\r?\n\s+<span.*?/span>\r?\n\s+\)\}', '{pkg.title}`n                    {pkg.is_student_offer && (`n                      <span className=\"ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] bg-yellow-400 text-yellow-900 border border-yellow-500/30\">`n                        Students Offer`n                      </span>`n                    )}'

# Regex to catch the broken template literal at line 1516-1520
$content = $content -replace '`\$\{pkg\.title\}\r?\n\s+<span.*?/span>\r?\n\s+\)\}\s+\$\{v\.pricing_type', '`${pkg.title} ${v.pricing_type'

[IO.File]::WriteAllText($path, $content)
