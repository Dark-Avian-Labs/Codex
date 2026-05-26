$raw = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($raw)) {
  Write-Output '{"permission":"allow"}'
  exit 0
}

try {
  $payload = $raw | ConvertFrom-Json
  $toolName = $payload.tool_name
  if (-not $toolName) { $toolName = $payload.toolName }
  if ($toolName -ne 'Shell') {
    Write-Output '{"permission":"allow"}'
    exit 0
  }

  $toolInput = $payload.tool_input
  if (-not $toolInput) { $toolInput = $payload.toolInput }

  $command = $toolInput.command
  if ([string]::IsNullOrWhiteSpace($command)) {
    Write-Output '{"permission":"allow"}'
    exit 0
  }

  $systemNodeDir = $null

  function Test-SystemNodeDir([string]$dir) {
    if ([string]::IsNullOrWhiteSpace($dir)) { return $false }
    if ($dir -match '(?i)\\cursor\\resources\\') { return $false }
    return Test-Path (Join-Path $dir 'node.exe')
  }

  try {
    $nodeCmd = Get-Command node -ErrorAction Stop
    $candidateDir = Split-Path -Parent $nodeCmd.Source
    if (Test-SystemNodeDir $candidateDir) {
      $systemNodeDir = $candidateDir
    }
  } catch {}

  if (-not $systemNodeDir -and $env:Path) {
    foreach ($segment in ($env:Path -split ';')) {
      $segment = $segment.Trim()
      if ([string]::IsNullOrWhiteSpace($segment)) { continue }
      if (Test-SystemNodeDir $segment) {
        $systemNodeDir = $segment
        break
      }
    }
  }

  if (-not $systemNodeDir) {
    $fallbackDirs = @(
      $(if ($env:ProgramFiles) { Join-Path $env:ProgramFiles 'nodejs' }),
      $(if (${env:ProgramFiles(x86)}) { Join-Path ${env:ProgramFiles(x86)} 'nodejs' }),
      $env:NVM_SYMLINK,
      $(if ($env:NVM_HOME) { Join-Path $env:NVM_HOME 'nodejs' }),
      $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'nvm' }),
      $(if ($env:USERPROFILE) { Join-Path $env:USERPROFILE '.volta\bin' })
    ) | Where-Object { $_ -and -not [string]::IsNullOrWhiteSpace($_) }

    foreach ($dir in $fallbackDirs) {
      if (Test-SystemNodeDir $dir) {
        $systemNodeDir = $dir
        break
      }
    }  }

  if (-not $systemNodeDir) {
    Write-Output '{"permission":"allow"}'
    exit 0
  }

  $prepend = '$env:Path = ''' + $systemNodeDir + ';'' + $env:Path; '
  $newCommand = $prepend + $command
  $result = @{
    permission    = 'allow'
    updated_input = @{
      command = $newCommand
    }
  }

  $result | ConvertTo-Json -Compress -Depth 4
} catch {
  Write-Output '{"permission":"allow"}'
  exit 0
}
