# 玄机命理 · 桌面运势悬浮卡（PowerShell + WPF，零依赖）
# 数据同源：只读网页导出的 xuanji-data.json，自身不做任何排盘与推理
param([string]$DataPath = "")
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase, System.Windows.Forms | Out-Null
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ($DataPath -eq "") { $DataPath = Join-Path $dir "xuanji-data.json" }
$cardsPath = Join-Path $dir "float-cards.json"
$posPath   = Join-Path $dir "float-pos.txt"
$offline = "天机算力离线，请打开网页工作台获取最新运势"
function Read-JsonFile($p) {
  if (Test-Path $p) { try { return (Get-Content $p -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null } }
  return $null
}
$script:data = Read-JsonFile $DataPath
$script:cards = Read-JsonFile $cardsPath
if (-not $script:cards) { $script:cards = [pscustomobject]@{ cards = @(); current = 0 } }
[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="玄机命理·运势悬浮卡" Width="340" Height="470"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        Topmost="True" ShowInTaskbar="False" StartPosition="Manual">
  <Border x:Name="Root" Background="#F016242E" CornerRadius="14" BorderBrush="#80C9A961" BorderThickness="1">
    <Grid>
      <Grid.RowDefinitions>
        <RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="*"/>
        <RowDefinition Height="Auto"/><RowDefinition Height="Auto"/>
      </Grid.RowDefinitions>
      <Border Grid.Row="0" x:Name="StaleBar" Background="#5C8C2C2C" Padding="8,4" Visibility="Collapsed">
        <TextBlock x:Name="StaleText" Foreground="#F0D9C9C9" FontSize="11" TextWrapping="Wrap"/>
      </Border>
      <Grid Grid.Row="1" Margin="14,10,14,4">
        <Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/><ColumnDefinition Width="Auto"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions>
        <StackPanel Orientation="Horizontal" Grid.Column="0">
          <TextBlock Text="☯" Foreground="#C9A961" FontSize="15" VerticalAlignment="Center" Margin="0,0,6,0"/>
          <TextBlock Text="玄机命理 · 今日运势" Foreground="#E8EDF4" FontSize="13" FontWeight="SemiBold" VerticalAlignment="Center"/>
        </StackPanel>
        <Button x:Name="BtnEdit"  Content="档案" Grid.Column="1" Style="{x:Null}" Background="Transparent" Foreground="#C9A961" BorderThickness="0" FontSize="12" Cursor="Hand" Margin="0,0,8,0"/>
        <Button x:Name="BtnMini"  Content="—"  Grid.Column="2" Background="Transparent" Foreground="#949BA8" BorderThickness="0" FontSize="12" Cursor="Hand" Margin="0,0,8,0"/>
        <Button x:Name="BtnClose" Content="×"  Grid.Column="3" Background="Transparent" Foreground="#949BA8" BorderThickness="0" FontSize="13" Cursor="Hand"/>
      </Grid>
      <ScrollViewer Grid.Row="2" VerticalScrollBarVisibility="Auto" Padding="14,4,14,0">
        <StackPanel x:Name="MainPane">
          <Grid x:Name="EditGrid" Visibility="Collapsed" Margin="0,0,0,8">
            <Grid.RowDefinitions><RowDefinition/><RowDefinition/><RowDefinition/><RowDefinition/><RowDefinition/><RowDefinition/></Grid.RowDefinitions>
            <Grid.ColumnDefinitions><ColumnDefinition Width="52"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
            <TextBlock Text="名称" Foreground="#949BA8" FontSize="12" Grid.Row="0" VerticalAlignment="Center"/>
            <TextBox x:Name="InName" Grid.Row="0" Grid.Column="1" Margin="0,2"/>
            <TextBlock Text="性别" Foreground="#949BA8" FontSize="12" Grid.Row="1" VerticalAlignment="Center"/>
            <ComboBox x:Name="InSex" Grid.Row="1" Grid.Column="1" Margin="0,2"><ComboBoxItem Content="男"/><ComboBoxItem Content="女"/></ComboBox>
            <TextBlock Text="年月日" Foreground="#949BA8" FontSize="12" Grid.Row="2" VerticalAlignment="Center"/>
            <TextBox x:Name="InDate" Grid.Row="2" Grid.Column="1" Margin="0,2" ToolTip="格式：1990-5-15（公历）"/>
            <TextBlock Text="时辰" Foreground="#949BA8" FontSize="12" Grid.Row="3" VerticalAlignment="Center"/>
            <TextBox x:Name="InShichen" Grid.Row="3" Grid.Column="1" Margin="0,2" ToolTip="如：午"/>
            <TextBlock Text="地区" Foreground="#949BA8" FontSize="12" Grid.Row="4" VerticalAlignment="Center"/>
            <TextBox x:Name="InPlace" Grid.Row="4" Grid.Column="1" Margin="0,2"/>
            <Button x:Name="BtnSaveCard" Content="保存档案" Grid.Row="5" Grid.Column="1" Background="#2A70B8" Foreground="White" BorderThickness="0" Margin="0,6,0,2" Cursor="Hand"/>
          </Grid>
          <StackPanel x:Name="ViewPane">
            <TextBlock x:Name="TxtTone" FontSize="30" FontWeight="Bold" Foreground="#C9A961"/>
            <TextBlock x:Name="TxtToneNote" Foreground="#949BA8" FontSize="11" TextWrapping="Wrap" Margin="0,2,0,8"/>
            <TextBlock x:Name="TxtFour" Foreground="#E8EDF4" FontSize="12" TextWrapping="Wrap" Margin="0,0,0,8"/>
            <TextBlock x:Name="TxtYi"   Foreground="#949BA8" FontSize="11" TextWrapping="Wrap" Margin="0,0,0,4"/>
            <TextBlock x:Name="TxtJi"   Foreground="#949BA8" FontSize="11" TextWrapping="Wrap" Margin="0,0,0,4"/>
            <TextBlock x:Name="TxtWarn" Foreground="#C9A961" FontSize="11" TextWrapping="Wrap" Margin="0,0,0,8"/>
            <TextBlock x:Name="TxtLucky" Foreground="#E8EDF4" FontSize="11" Margin="0,0,0,8"/>
            <Border Background="#22242E" CornerRadius="8" Padding="10,8" Margin="0,0,0,8">
              <TextBlock x:Name="TxtQuote" Foreground="#C9D4DC" FontSize="11" TextWrapping="Wrap"/>
            </Border>
            <TextBlock Text="── 三派天机简析 ──" Foreground="#6B7280" FontSize="10" TextAlignment="Center" Margin="0,0,0,6"/>
            <TextBlock x:Name="TxtSchools" Foreground="#949BA8" FontSize="11" TextWrapping="Wrap"/>
          </StackPanel>
        </StackPanel>
      </ScrollViewer>
      <Separator Grid.Row="3" Background="#33C9A961" Margin="14,6"/>
      <Grid Grid.Row="4" Margin="14,0,14,12">
        <Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions>
        <CheckBox x:Name="ChkAuto" Content="开机自启" Foreground="#949BA8" FontSize="11" VerticalAlignment="Center"/>
        <Button x:Name="BtnOpen" Content="查看完整命盘 →" Grid.Column="1" Background="#2A70B8" Foreground="White" BorderThickness="0" Padding="10,5" Cursor="Hand"/>
      </Grid>
    </Grid>
  </Border>
</Window>
"@
$reader = New-Object System.Xml.XmlNodeReader $xaml
$window = [Windows.Markup.XamlReader]::Load($reader)
function Find($n) { return $window.FindName($n) }
$root = Find "Root"; $staleBar = Find "StaleBar"; $staleText = Find "StaleText"
$txtTone = Find "TxtTone"; $txtToneNote = Find "TxtToneNote"; $txtFour = Find "TxtFour"
$txtYi = Find "TxtYi"; $txtJi = Find "TxtJi"; $txtWarn = Find "TxtWarn"
$txtLucky = Find "TxtLucky"; $txtQuote = Find "TxtQuote"; $txtSchools = Find "TxtSchools"
$editGrid = Find "EditGrid"; $viewPane = Find "ViewPane"
function Show-Offline($why) {
  $txtTone.Text = "—"; $txtTone.Text = "离线"; $txtTone.Foreground = "#949BA8"
  $txtToneNote.Text = $offline
  $txtFour.Text = ""; $txtYi.Text = ""; $txtJi.Text = ""; $txtWarn.Text = ""
  $txtLucky.Text = ""; $txtQuote.Text = ""; $txtSchools.Text = ""
  $staleBar.Visibility = "Visible"; $staleText.Text = $why
}
function Render-Data($d) {
  $s = $d.snapshot
  $staleBar.Visibility = "Collapsed"
  $txtTone.Foreground = "#C9A961"
  $txtTone.Text = $s.daily.tone
  $txtToneNote.Text = $s.daily.toneNote
  $txtFour.Text = (($s.daily.four | ForEach-Object { $_.k + "：" + $_.v }) -join "`n")
  $txtYi.Text   = "宜：" + $s.daily.yi
  $txtJi.Text   = "忌：" + $s.daily.ji
  $txtWarn.Text = $s.daily.warn
  $txtLucky.Text = "幸运色：" + $s.daily.luckyColor + "　幸运方位：" + $s.daily.luckyDir
  $txtQuote.Text = "「" + $s.daily.quote + "」"
  $sc = $s.schools
  $txtSchools.Text = "【天机道】" + $sc.nihaixia + "`n【四柱】" + $sc.bazi + "`n【紫微】" + $sc.ziwei
}
function Render-All {
  if (-not $script:data) { Show-Offline "未找到 xuanji-data.json——请从网页端「悬浮卡」下载并放在本目录"; return }
  if (-not $script:data.snapshot) { Show-Offline "快照格式不正确，请重新从网页端导出"; return }
  Render-Data $script:data
  $today = Get-Date -Format "yyyy-MM-dd"
  if ($script:data.snapshot.date -ne $today) {
    $staleBar.Visibility = "Visible"
    $staleText.Text = "以上是 " + $script:data.snapshot.date + " 的快照——悬浮卡不内置算力，请打开网页重新导出今日运势"
  }
}
Render-All
$timer = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromSeconds(60)
$timer.Add_Tick({
  if (Test-Path $DataPath) {
    $mt = (Get-Item $DataPath).LastWriteTime
    if (-not $script:lastMt -or $mt -ne $script:lastMt) { $script:lastMt = $mt; $script:data = Read-JsonFile $DataPath; Render-All }
  }
})
$script:lastMt = if (Test-Path $DataPath) { (Get-Item $DataPath).LastWriteTime } else { $null }
$timer.Start()
# 位置记忆
if (Test-Path $posPath) {
  $pv = (Get-Content $posPath -Raw).Split(",")
  if ($pv.Count -ge 2) { $window.WindowStartupLocation = "Manual"; $window.Left = [double]$pv[0]; $window.Top = [double]$pv[1] }
} else {
  $window.WindowStartupLocation = "Manual"
  $wa = [System.Windows.SystemParameters]::WorkArea
  $window.Left = $wa.Right - $window.Width - 24; $window.Top = $wa.Top + 24
}
$window.Add_MouseLeftButtonDown({ $window.DragMove() })
$window.Add_Closing({
  ($window.Left.ToString() + "," + $window.Top.ToString()) | Out-File $posPath -Encoding ASCII
})
(Find "BtnClose").Add_Click({ $window.Close() })
(Find "BtnMini").Add_Click({
  if ($window.Height -gt 100) { $script:prevH = $window.Height; $window.Height = 64 }
  else { $window.Height = $script:prevH }
})
(Find "BtnEdit").Add_Click({
  $show = $editGrid.Visibility -eq "Collapsed"
  $editGrid.Visibility = if ($show) { "Visible" } else { "Collapsed" }
})
(Find "BtnSaveCard").Add_Click({
  $c = [pscustomobject]@{
    name = (Find "InName").Text; sex = if ((Find "InSex").Text -eq "女") { "female" } else { "male" };
    cal = "solar"; year = 0; month = 0; day = 0; shichen = (Find "InShichen").Text; place = (Find "InPlace").Text
  }
  $dp = (Find "InDate").Text.Split("-")
  if ($dp.Count -ge 3) { $c.year = [int]$dp[0]; $c.month = [int]$dp[1]; $c.day = [int]$dp[2] }
  $list = @($script:cards.cards)
  $list += $c
  $script:cards = [pscustomobject]@{ cards = $list; current = $list.Count - 1 }
  ($script:cards | ConvertTo-Json -Depth 4) | Out-File $cardsPath -Encoding UTF8
  $editGrid.Visibility = "Collapsed"
  [System.Windows.MessageBox]::Show("档案已保存（悬浮卡本地）", "玄机命理")
})
$autoPath = Join-Path ([Environment]::GetFolderPath("Startup")) "玄机运势卡.lnk"
$chk = Find "ChkAuto"
$chk.IsChecked = Test-Path $autoPath
$chk.Add_Click({
  if ($chk.IsChecked -eq $true) {
    $ws = New-Object -ComObject WScript.Shell
    $sc = $ws.CreateShortcut($autoPath)
    $sc.TargetPath = "powershell.exe"
    $sc.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"" + $MyInvocation.MyCommand.Path + "`""
    $sc.Save()
  } elseif (Test-Path $autoPath) { Remove-Item $autoPath -Force }
})
(Find "BtnOpen").Add_Click({
  $idx = Join-Path $dir "index.html"
  if (-not (Test-Path $idx)) { [System.Windows.MessageBox]::Show("未找到 index.html（请把悬浮卡放在网页工作台目录）"); return }
  $c = $null
  if ($script:cards -and $script:cards.cards.Count -gt 0) { $i = [Math]::Min($script:cards.current, $script:cards.cards.Count-1); $c = $script:cards.cards[$i] }
  $q = "auto=1"
  if ($c) {
    $q += "&name=" + [Uri]::EscapeDataString($c.name) + "&sex=" + $c.sex + "&cal=" + $c.cal +
          "&y=" + $c.year + "&m=" + $c.month + "&d=" + $c.day +
          "&shichen=" + [Uri]::EscapeDataString($c.shichen) + "&place=" + [Uri]::EscapeDataString($c.place)
  }
  Start-Process ("file:///" + ($idx -replace "\\", "/") + "?" + $q)
  $window.WindowState = "Minimized"
})
[System.Windows.Application]::new().Run($window)