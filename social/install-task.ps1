# Registers the Windows scheduled task that opens the tool three times a week.
#
#   powershell -ExecutionPolicy Bypass -File social\install-task.ps1
#   powershell -ExecutionPolicy Bypass -File social\install-task.ps1 -Remove
#   powershell -ExecutionPolicy Bypass -File social\install-task.ps1 -At 08:30
#
# Weekly on Mon/Wed/Fri rather than a logon trigger: Task Scheduler's logon
# trigger has no day filter, so it would fire every single day.
#
# StartWhenAvailable is what makes a fixed time workable on a machine that is
# not always on - miss Monday 09:00 because the PC was off and it runs at the
# next opportunity instead of skipping the week.

param(
    [string]$TaskName = 'AgentinFlow Social',
    [string]$At = '09:00',
    [switch]$Remove
)

$ErrorActionPreference = 'Stop'

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($Remove) {
    if ($existing) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "  Removed '$TaskName'." -ForegroundColor Green
    } else {
        Write-Host "  '$TaskName' was not registered."
    }
    return
}

# Resolve the launcher from this script's own location, so the task keeps
# working if the repo is moved and re-registered.
$launcher = Join-Path $PSScriptRoot 'run.cmd'
if (-not (Test-Path $launcher)) { throw "Cannot find $launcher" }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'node is not on PATH. The task would fail silently every time.'
}

$action = New-ScheduledTaskAction -Execute $launcher

$trigger = New-ScheduledTaskTrigger -Weekly `
    -DaysOfWeek Monday, Wednesday, Friday `
    -At $At

# Interactive, so the console window actually appears on the desktop. Run it
# under a service logon type and the process starts invisibly and waits
# forever for input nobody can see.
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -WakeToRun `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -MultipleInstances IgnoreNew

if ($existing) { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false }

Register-ScheduledTask -TaskName $TaskName `
    -Action $action -Trigger $trigger -Principal $principal -Settings $settings `
    -Description 'Opens the AgentinFlow social tool: pick a story, give your view, approve the post.' | Out-Null

Write-Host ''
Write-Host "  Registered '$TaskName'" -ForegroundColor Green
Write-Host "    runs      Mon, Wed, Fri at $At"
Write-Host "    launches  $launcher"
Write-Host '    missed    runs at the next opportunity if the PC was off'
Write-Host ''
Write-Host '  Test it now without waiting:' -ForegroundColor DarkGray
Write-Host "    Start-ScheduledTask -TaskName '$TaskName'"
Write-Host ''
Write-Host '  Remove it:' -ForegroundColor DarkGray
Write-Host '    powershell -ExecutionPolicy Bypass -File social\install-task.ps1 -Remove'
Write-Host ''
