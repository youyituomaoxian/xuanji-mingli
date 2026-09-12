# 解析 float-card.ps1 输出语法错误（含 trap 块）
$ErrorActionPreference = 'Stop'
$ps1 = 'I:\workbuddy\公司分析\玄学工作台\_test\float_zip_check\float-card.ps1'
$tokens = $null
$errors = $null
$content = [System.IO.File]::ReadAllText($ps1, [System.Text.Encoding]::UTF8)
$null = [System.Management.Automation.Language.Parser]::ParseInput($content, [ref]$tokens, [ref]$errors)
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("PS1 file: " + $ps1)
[void]$sb.AppendLine("Errors: " + $errors.Count)
if ($errors.Count -gt 0) {
  $i = 0
  foreach ($e in $errors) {
    $i++
    [void]$sb.AppendLine("[" + $i + "] Line " + $e.Extent.StartLineNumber + " Col " + $e.Extent.StartColumnNumber + ": " + $e.Message)
    [void]$sb.AppendLine("    text: " + $e.Extent.Text)
  }
} else {
  [void]$sb.AppendLine("SYNTAX OK - no errors")
}
[System.IO.File]::WriteAllText('I:\workbuddy\公司分析\玄学工作台\_test\float_zip_check\parser_result.txt', $sb.ToString(), [System.Text.Encoding]::UTF8)
Write-Output "done"
