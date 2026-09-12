# 验证 XAML 的 XML 结构
$ErrorActionPreference = 'Stop'
$result = ''
try {
  $x = New-Object System.Xml.XmlDocument
  $x.Load('I:\workbuddy\公司分析\玄学工作台\_test\float_zip_check\xaml_new.xml')
  $result = "XML OK - root: " + $x.DocumentElement.Name + " - " + $x.DocumentElement.OuterXml.Length + " chars"
} catch {
  $result = "XML ERROR: " + $_.Exception.Message
}
[System.IO.File]::WriteAllText('I:\workbuddy\公司分析\玄学工作台\_test\float_zip_check\xml_result_new.txt', $result, [System.Text.Encoding]::UTF8)
