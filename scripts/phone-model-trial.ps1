$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$nodeExecutable = (Get-Command node.exe -ErrorAction Stop).Source
$trialScript = Join-Path $PSScriptRoot 'phone-model-trial.cjs'
& $nodeExecutable $trialScript '--check'
if ($LASTEXITCODE -ne 0) { throw 'Phone-model preflight failed before credential access.' }
$encryptedKeyPath = Join-Path $env:LOCALAPPDATA 'Codex\nebius-tokenfactory\hackathon-20261010-local-01\api-key.dpapi.json'
$checkedKeyPath = $encryptedKeyPath
while ($checkedKeyPath) {
    $keyItem = Get-Item -LiteralPath $checkedKeyPath -Force -ErrorAction Stop
    if (($keyItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Credential storage cannot use reparse points.' }
    $keyParentPath = Split-Path -Parent $checkedKeyPath
    if (-not $keyParentPath -or $keyParentPath -eq $checkedKeyPath) { break }
    $checkedKeyPath = $keyParentPath
}
$keyEnvelope = Get-Content -LiteralPath $encryptedKeyPath -Raw | ConvertFrom-Json
if ($keyEnvelope.schema_version -ne 1 -or $keyEnvelope.protection -cne 'windows-dpapi-current-user') { throw 'Unexpected encrypted credential envelope.' }
Add-Type -AssemblyName System.Security.Cryptography.ProtectedData
$clearKeyBytes = $null; $encryptedKeyBytes = $null; $clearApiKey = $null
$priorProcessKey = [Environment]::GetEnvironmentVariable('NEBIUS_API_KEY','Process')
$priorPhoneApproval = [Environment]::GetEnvironmentVariable('AF_PHONE_MODEL_APPROVED','Process')
try {
    $encryptedKeyBytes = [Convert]::FromBase64String($keyEnvelope.ciphertext)
    $clearKeyBytes = [Security.Cryptography.ProtectedData]::Unprotect($encryptedKeyBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    $clearApiKey = [Text.Encoding]::UTF8.GetString($clearKeyBytes)
    if ($clearApiKey.Length -lt 40 -or -not $clearApiKey.StartsWith('v1.')) { throw 'Unexpected credential format.' }
    [Environment]::SetEnvironmentVariable('NEBIUS_API_KEY',$clearApiKey,'Process')
    [Environment]::SetEnvironmentVariable('AF_PHONE_MODEL_APPROVED','20261023-two-requests-0.50','Process')
    & $nodeExecutable $trialScript '--run'
    if ($LASTEXITCODE -ne 0) { throw 'Phone generation stopped. Preserve its reservation; no automatic retry.' }
} finally {
    [Environment]::SetEnvironmentVariable('NEBIUS_API_KEY',$priorProcessKey,'Process')
    [Environment]::SetEnvironmentVariable('AF_PHONE_MODEL_APPROVED',$priorPhoneApproval,'Process')
    if ($null -ne $clearKeyBytes) { [Array]::Clear($clearKeyBytes,0,$clearKeyBytes.Length) }
    if ($null -ne $encryptedKeyBytes) { [Array]::Clear($encryptedKeyBytes,0,$encryptedKeyBytes.Length) }
    $clearApiKey = $null; $clearKeyBytes = $null; $encryptedKeyBytes = $null; $keyEnvelope = $null
}
