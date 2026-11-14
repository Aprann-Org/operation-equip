<#
.SYNOPSIS
    Reads this laptop's hardware specs and fills in its Operation Equip record.

.DESCRIPTION
    Run this on the laptop being processed. It reads make, model, CPU, RAM,
    disk, screen size, Windows version, BIOS, serial number, hardware UUID and
    battery health using only what ships with Windows, shows you what it
    found and what would change, and, once you confirm, sends it to
    Operation Equip.

    The laptop must already exist in Operation Equip with its laptop number.
    On the first scan the laptop's serial number is linked to that record;
    after that, a mistyped laptop number is rejected instead of overwriting
    a different laptop.

    Only blank fields are filled. Fields that already hold a different value
    are listed as conflicts and left alone, unless you pass -Overwrite.

    Needs no installation. From a USB stick:
        powershell -ExecutionPolicy Bypass -File .\Invoke-EquipIntake.ps1

.PARAMETER InternalId
    The laptop number on the sticker. Prompted for if omitted.

.PARAMETER ApiUrl
    Base URL of Operation Equip, e.g. https://equip.example.org.
    Defaults to $env:OPEQUIP_URL, then intake-config.json next to the script.

.PARAMETER ApiKey
    Intake API key from Settings -> Intake Keys (starts with oeq_).
    Defaults to $env:OPEQUIP_API_KEY, then intake-config.json, then a prompt.

.PARAMETER Overwrite
    Replace fields that already hold a different value. Serial number and
    hardware UUID are never overwritten; an admin changes those by hand.

.PARAMETER DryRun
    Show what would change, then stop without saving anything.

.PARAMETER SkipBattery
    Do not generate or send a battery report.

.PARAMETER Yes
    Do not ask for confirmation before saving.

.EXAMPLE
    .\Invoke-EquipIntake.ps1
    Prompts for the laptop number, previews the changes, asks to confirm.

.EXAMPLE
    .\Invoke-EquipIntake.ps1 -InternalId 1042 -DryRun
    Shows what would be filled in for laptop 1042 without saving.
#>
[CmdletBinding()]
param(
    [string]$InternalId,
    [string]$ApiUrl,
    [string]$ApiKey,
    [switch]$Overwrite,
    [switch]$DryRun,
    [switch]$SkipBattery,
    [switch]$Yes
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$ScriptVersion = '1.0.0'

# Windows PowerShell 5.1 defaults to TLS 1.0/1.1 on older builds.
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch { }

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Get-Cim([string]$Class, [string]$Namespace = 'root\cimv2') {
    # A missing class (no battery, no WMI monitor data in a VM) is normal: return nothing.
    try { return @(Get-CimInstance -ClassName $Class -Namespace $Namespace -ErrorAction Stop) }
    catch { return @() }
}

function Clean([object]$Value) {
    if ($null -eq $Value) { return $null }
    $s = ([string]$Value).Trim() -replace '\s+', ' '
    if ($s -eq '') { return $null }
    return $s
}

function Get-Make([string]$Manufacturer) {
    $m = Clean $Manufacturer
    if (-not $m) { return $null }
    switch -Regex ($m) {
        '^Dell'                  { return 'Dell' }
        '^(HP|Hewlett)'          { return 'HP' }
        '^Lenovo'                { return 'Lenovo' }
        '^Microsoft'             { return 'Microsoft' }
        '^(ASUS|ASUSTeK)'        { return 'ASUS' }
        '^Acer'                  { return 'Acer' }
        '^Apple'                 { return 'Apple' }
        '^(Samsung)'             { return 'Samsung' }
        '^(Toshiba|Dynabook)'    { return $m }
        '^(Micro-Star|MSI)'      { return 'MSI' }
        '^(Panasonic)'           { return 'Panasonic' }
        '^(Google)'              { return 'Google' }
        default                  { return $m }
    }
}

function Get-Processor {
    $cpu = Get-Cim 'Win32_Processor' | Select-Object -First 1
    if (-not $cpu) { return $null }
    $name = [string]$cpu.Name
    $name = $name -replace '\((R|TM|tm|r)\)', ''
    $name = $name -replace '\s+CPU\b', ''
    $name = $name -replace '\s*@\s*[\d.]+\s*GHz', ''
    $name = $name -replace '\s+(\d+-Core|Dual-Core|Quad-Core|Six-Core|Eight-Core) Processor$', ''
    $name = $name -replace '\s+Processor$', ''
    return Clean $name
}

function Get-RamGb {
    $sticks = Get-Cim 'Win32_PhysicalMemory'
    $bytes = ($sticks | Measure-Object -Property Capacity -Sum).Sum
    if (-not $bytes) {
        $bytes = (Get-Cim 'Win32_ComputerSystem' | Select-Object -First 1).TotalPhysicalMemory
    }
    if (-not $bytes) { return $null }
    return [int][math]::Round($bytes / 1GB)
}

function Get-BootDisk {
    # The disk holding C:, reported in decimal GB like the label on the drive.
    $result = @{ capacity_gb = $null; disk_type = $null }
    try {
        $diskNumber = (Get-Partition -DriveLetter C -ErrorAction Stop).DiskNumber
        $physical = Get-PhysicalDisk -ErrorAction Stop | Where-Object { [string]$_.DeviceId -eq [string]$diskNumber } | Select-Object -First 1
        if ($physical) {
            $result.capacity_gb = [int][math]::Round($physical.Size / 1e9)
            if ([string]$physical.BusType -eq 'NVMe') { $result.disk_type = 'nvme' }
            elseif ([string]$physical.MediaType -eq 'SSD') { $result.disk_type = 'ssd' }
            elseif ([string]$physical.MediaType -eq 'HDD') { $result.disk_type = 'hdd' }
            return $result
        }
    } catch { }

    # Fallback without the Storage module: size only.
    $disk = Get-Cim 'Win32_DiskDrive' | Sort-Object Index | Select-Object -First 1
    if ($disk -and $disk.Size) { $result.capacity_gb = [int][math]::Round($disk.Size / 1e9) }
    return $result
}

function Get-ScreenSizeIn {
    # EDID reports the panel size in whole centimetres, so snap to the common
    # laptop sizes when the measurement is close to one.
    $params = Get-Cim 'WmiMonitorBasicDisplayParams' 'root\wmi'
    if (-not $params) { return $null }

    # Prefer the built-in panel (VideoOutputTechnology 0x80000000 = internal).
    $internal = @()
    foreach ($c in (Get-Cim 'WmiMonitorConnectionParams' 'root\wmi')) {
        if ([uint32]$c.VideoOutputTechnology -eq 0x80000000) { $internal += $c.InstanceName }
    }
    $panel = $params | Where-Object { $internal -contains $_.InstanceName } | Select-Object -First 1
    if (-not $panel) { $panel = $params | Select-Object -First 1 }

    $w = [double]$panel.MaxHorizontalImageSize
    $h = [double]$panel.MaxVerticalImageSize
    if ($w -le 0 -or $h -le 0) { return $null }
    $inches = [math]::Sqrt($w * $w + $h * $h) / 2.54

    $common = @(10.1, 11.6, 12.0, 12.5, 13.3, 13.5, 14.0, 15.0, 15.6, 16.0, 17.3)
    $nearest = $common | Sort-Object { [math]::Abs($_ - $inches) } | Select-Object -First 1
    if ([math]::Abs($nearest - $inches) -le 0.4) { return $nearest }
    return [math]::Round($inches, 1)
}

function Get-Battery {
    if (-not (Get-Cim 'Win32_Battery')) { return $null }
    $xmlPath = Join-Path $env:TEMP ("opequip-battery-{0}.xml" -f [guid]::NewGuid())
    try {
        & powercfg.exe /batteryreport /xml /output $xmlPath | Out-Null
        if (-not (Test-Path $xmlPath)) { return $null }
        [xml]$report = Get-Content -LiteralPath $xmlPath -Raw
        $ns = New-Object System.Xml.XmlNamespaceManager($report.NameTable)
        $ns.AddNamespace('b', 'http://schemas.microsoft.com/battery/2012')

        $battery = $report.SelectSingleNode('//b:Batteries/b:Battery', $ns)
        if (-not $battery) { return $null }

        $result = [ordered]@{
            design_capacity_mwh       = $null
            full_charge_capacity_mwh  = $null
            cycle_count               = $null
            estimated_runtime_minutes = $null
        }
        $design = $battery.SelectSingleNode('b:DesignCapacity', $ns)
        $full   = $battery.SelectSingleNode('b:FullChargeCapacity', $ns)
        $cycles = $battery.SelectSingleNode('b:CycleCount', $ns)
        if ($design -and [int]$design.InnerText -gt 0) { $result.design_capacity_mwh = [int]$design.InnerText }
        if ($full)   { $result.full_charge_capacity_mwh = [int]$full.InnerText }
        # Some batteries never report cycles and leave 0; that is "unknown", not new.
        if ($cycles -and [int]$cycles.InnerText -gt 0) { $result.cycle_count = [int]$cycles.InnerText }

        # Latest "at full charge" runtime estimate, e.g. PT5H12M.
        $estimates = $report.SelectNodes('//b:RuntimeEstimates/b:FullChargeCapacity/b:ActiveRuntime', $ns)
        if ($estimates -and $estimates.Count -gt 0) {
            try {
                $span = [System.Xml.XmlConvert]::ToTimeSpan($estimates[$estimates.Count - 1].InnerText)
                if ($span.TotalMinutes -gt 0) { $result.estimated_runtime_minutes = [int][math]::Round($span.TotalMinutes) }
            } catch { }
        }
        return $result
    } catch {
        Write-Warning "Battery report failed: $($_.Exception.Message)"
        return $null
    } finally {
        Remove-Item -LiteralPath $xmlPath -ErrorAction SilentlyContinue
    }
}

function Get-HardwareInfo {
    $cs      = Get-Cim 'Win32_ComputerSystem' | Select-Object -First 1
    $product = Get-Cim 'Win32_ComputerSystemProduct' | Select-Object -First 1
    $bios    = Get-Cim 'Win32_BIOS' | Select-Object -First 1
    $os      = Get-Cim 'Win32_OperatingSystem' | Select-Object -First 1

    $manufacturer = $null; if ($cs) { $manufacturer = $cs.Manufacturer }
    $make = Get-Make $manufacturer

    # Lenovo puts the machine-type code (20L5...) in Model and the friendly
    # name (ThinkPad T480) in the product Version.
    $model = $null
    if ($cs) { $model = Clean $cs.Model }
    if ($make -eq 'Lenovo' -and $product -and (Clean $product.Version)) { $model = Clean $product.Version }

    $osName = $null
    if ($os) { $osName = Clean (([string]$os.Caption) -replace '^Microsoft\s+', '') }

    $biosVersion = $null; $biosDate = $null; $serial = $null
    if ($bios) {
        $biosVersion = Clean $bios.SMBIOSBIOSVersion
        if ($bios.ReleaseDate) { $biosDate = ([datetime]$bios.ReleaseDate).ToString('yyyy-MM-dd') }
        $serial = Clean $bios.SerialNumber
    }

    $uuid = $null; if ($product) { $uuid = Clean $product.UUID }
    $disk = Get-BootDisk

    return [ordered]@{
        serial_number    = $serial
        hardware_uuid    = $uuid
        make             = $make
        model            = $model
        processor        = Get-Processor
        ram_gb           = Get-RamGb
        disk_capacity_gb = $disk.capacity_gb
        disk_type        = $disk.disk_type
        screen_size_in   = Get-ScreenSizeIn
        os               = $osName
        bios_version     = $biosVersion
        bios_date        = $biosDate
    }
}

function Read-Config {
    $path = Join-Path $PSScriptRoot 'intake-config.json'
    if (-not (Test-Path $path)) { return $null }
    try { return Get-Content -LiteralPath $path -Raw | ConvertFrom-Json }
    catch { Write-Warning "Could not read ${path}: $($_.Exception.Message)"; return $null }
}

function Invoke-Intake([hashtable]$Body) {
    $json = $Body | ConvertTo-Json -Depth 5 -Compress
    $headers = @{ Authorization = "Bearer $ApiKey" }
    $uri = $ApiUrl.TrimEnd('/') + '/api/intake/autofill'
    try {
        return Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType 'application/json; charset=utf-8' `
            -Body ([System.Text.Encoding]::UTF8.GetBytes($json)) -UseBasicParsing
    } catch {
        $message = $null
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            try { $message = ($_.ErrorDetails.Message | ConvertFrom-Json).error } catch { $message = $_.ErrorDetails.Message }
        }
        if (-not $message) { $message = $_.Exception.Message }
        throw "Operation Equip rejected the request: $message"
    }
}

function Format-Value([object]$Value) {
    if ($null -eq $Value -or [string]$Value -eq '') { return '(blank)' }
    return [string]$Value
}

function Show-Result($Result) {
    Write-Host ''
    Write-Host ("Laptop #{0}  ->  {1}" -f $Result.equipment.internal_id, $Result.equipment.url) -ForegroundColor Cyan

    if (@($Result.changes).Count -gt 0) {
        $verb = 'Will fill in'; if (-not $Result.dry_run) { $verb = 'Filled in' }
        Write-Host "${verb}:" -ForegroundColor Green
        foreach ($c in $Result.changes) {
            Write-Host ("  {0,-22} {1}  ->  {2}" -f $c.field, (Format-Value $c.from), (Format-Value $c.to))
        }
    } else {
        Write-Host 'Nothing to fill in: every reported field already matches.' -ForegroundColor Green
    }

    if (@($Result.conflicts).Count -gt 0) {
        Write-Host 'Left alone (already set to something else; re-run with -Overwrite to replace):' -ForegroundColor Yellow
        foreach ($c in $Result.conflicts) {
            Write-Host ("  {0,-22} stored: {1}   this laptop: {2}" -f $c.field, (Format-Value $c.current), (Format-Value $c.reported))
        }
    }

    switch ($Result.battery) {
        'would_add'         { Write-Host 'Battery report: will be added.' }
        'added'             { Write-Host 'Battery report: added.' -ForegroundColor Green }
        'skipped_duplicate' { Write-Host 'Battery report: identical report already recorded today, skipped.' }
        'error'             { Write-Host 'Battery report: could not be saved.' -ForegroundColor Yellow }
    }

    foreach ($w in @($Result.warnings)) { if ($w) { Write-Warning $w } }
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

$config = Read-Config
if (-not $ApiUrl) { $ApiUrl = $env:OPEQUIP_URL }
if (-not $ApiUrl -and $config -and $config.PSObject.Properties['api_url']) { $ApiUrl = $config.api_url }
if (-not $ApiKey) { $ApiKey = $env:OPEQUIP_API_KEY }
if (-not $ApiKey -and $config -and $config.PSObject.Properties['api_key']) { $ApiKey = $config.api_key }

if (-not $ApiUrl) { $ApiUrl = Read-Host 'Operation Equip URL (e.g. https://equip.example.org)' }
if (-not $ApiKey) {
    $secure = Read-Host 'Intake API key (from Settings -> Intake Keys)' -AsSecureString
    $ApiKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
$ApiKey = $ApiKey.Trim()
if (-not $ApiUrl -or -not $ApiKey) { throw 'An Operation Equip URL and API key are required.' }

if (-not $InternalId) { $InternalId = Read-Host 'Laptop number (from the sticker)' }
$InternalId = $InternalId.Trim()
if (-not $InternalId) { throw 'A laptop number is required.' }

Write-Host 'Reading hardware...' -ForegroundColor Cyan
$hw = Get-HardwareInfo
$battery = $null
if (-not $SkipBattery) {
    Write-Host 'Generating battery report...' -ForegroundColor Cyan
    $battery = Get-Battery
}

Write-Host ''
Write-Host 'This laptop reports:' -ForegroundColor Cyan
foreach ($k in $hw.Keys) { Write-Host ("  {0,-18} {1}" -f $k, (Format-Value $hw[$k])) }
if ($battery) {
    $health = '(unknown)'
    if ($battery.design_capacity_mwh -and $null -ne $battery.full_charge_capacity_mwh) {
        $health = '{0:N0}%' -f (100 * $battery.full_charge_capacity_mwh / $battery.design_capacity_mwh)
    }
    Write-Host ("  {0,-18} {1} of design ({2} / {3} mWh, {4} cycles)" -f 'battery', $health,
        (Format-Value $battery.full_charge_capacity_mwh), (Format-Value $battery.design_capacity_mwh), (Format-Value $battery.cycle_count))
} elseif (-not $SkipBattery) {
    Write-Host ("  {0,-18} {1}" -f 'battery', '(none found)')
}

$body = @{ internal_id = $InternalId; overwrite = [bool]$Overwrite; script_version = $ScriptVersion }
foreach ($k in $hw.Keys) { $body[$k] = $hw[$k] }
if ($battery) { $body.battery = $battery }

# Always preview first: the server decides what is blank, what conflicts, and
# whether this laptop's serial matches the laptop number.
$body.dry_run = $true
$preview = Invoke-Intake $body
Show-Result $preview

if ($DryRun) {
    Write-Host ''
    Write-Host 'Dry run: nothing was saved.' -ForegroundColor Cyan
    return
}

$hasWork = (@($preview.changes).Count -gt 0) -or ($preview.battery -eq 'would_add')
if (-not $hasWork) { return }

if (-not $Yes) {
    Write-Host ''
    $answer = Read-Host ("Save these changes to laptop #{0}? [y/N]" -f $preview.equipment.internal_id)
    if ($answer -notmatch '^(y|yes)$') { Write-Host 'Cancelled: nothing was saved.'; return }
}

$body.dry_run = $false
$result = Invoke-Intake $body
Show-Result $result
Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
