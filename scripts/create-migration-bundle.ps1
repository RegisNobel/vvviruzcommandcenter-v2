param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$MigrationRoot = "C:\Users\regis\Desktop\Codex\lyriclab-workstation-migration-2026-08-18"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
[System.IO.Directory]::CreateDirectory($MigrationRoot) | Out-Null
$MigrationRoot = (Resolve-Path -LiteralPath $MigrationRoot).Path
$stage = Join-Path $MigrationRoot (".staging-" + [guid]::NewGuid().ToString("N"))
[System.IO.Directory]::CreateDirectory($stage) | Out-Null
$stage = (Resolve-Path -LiteralPath $stage).Path

if (-not $stage.StartsWith($MigrationRoot + "\", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Staging path validation failed."
}

$plainZip = Join-Path $MigrationRoot "lyriclab-project-data-2026-08-18.zip"
$encryptedBundle = "$plainZip.aes"

try {
  Copy-Item -LiteralPath (Join-Path $ProjectRoot "storage") -Destination $stage -Recurse -Force

  $artifactPath = Join-Path $ProjectRoot ".artifacts"
  if (Test-Path -LiteralPath $artifactPath) {
    Copy-Item -LiteralPath $artifactPath -Destination $stage -Recurse -Force
  }

  Copy-Item -LiteralPath (Join-Path $ProjectRoot ".env.production.local") -Destination $stage -Force
  Copy-Item -LiteralPath (Join-Path $ProjectRoot "MIGRATION_HANDOFF.md") -Destination $stage -Force

  $manifest = Get-ChildItem $stage -File -Recurse -Force | ForEach-Object {
    [pscustomobject]@{
      Path = $_.FullName.Substring($stage.Length + 1)
      Bytes = $_.Length
      LastWriteTimeUtc = $_.LastWriteTimeUtc.ToString("o")
      SHA256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    }
  }
  $manifest | Export-Csv -LiteralPath (Join-Path $stage "MANIFEST.csv") -NoTypeInformation -Encoding utf8

  Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $plainZip -CompressionLevel Optimal -Force
  $plainHash = (Get-FileHash -LiteralPath $plainZip -Algorithm SHA256).Hash
  $plaintext = [System.IO.File]::ReadAllBytes($plainZip)

  $magic = [System.Text.Encoding]::ASCII.GetBytes("LLMIG001")
  $iterations = 600000
  $salt = [byte[]]::new(16)
  $nonce = [byte[]]::new(12)
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($salt)
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($nonce)

  $passwordBytes = [byte[]]::new(32)
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($passwordBytes)
  $password = [Convert]::ToBase64String($passwordBytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")

  $derive = [System.Security.Cryptography.Rfc2898DeriveBytes]::new(
    $password,
    $salt,
    $iterations,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256
  )
  try {
    $key = $derive.GetBytes(32)
  } finally {
    $derive.Dispose()
  }

  $associatedData = [byte[]]::new(40)
  [Array]::Copy($magic, 0, $associatedData, 0, 8)
  [Array]::Copy([BitConverter]::GetBytes($iterations), 0, $associatedData, 8, 4)
  [Array]::Copy($salt, 0, $associatedData, 12, 16)
  [Array]::Copy($nonce, 0, $associatedData, 28, 12)

  $ciphertext = [byte[]]::new($plaintext.Length)
  $tag = [byte[]]::new(16)
  $aes = [System.Security.Cryptography.AesGcm]::new($key, 16)
  try {
    $aes.Encrypt($nonce, $plaintext, $ciphertext, $tag, $associatedData)
  } finally {
    $aes.Dispose()
  }

  $encryptedPayload = [byte[]]::new(56 + $ciphertext.Length)
  [Array]::Copy($associatedData, 0, $encryptedPayload, 0, 40)
  [Array]::Copy($tag, 0, $encryptedPayload, 40, 16)
  [Array]::Copy($ciphertext, 0, $encryptedPayload, 56, $ciphertext.Length)
  [System.IO.File]::WriteAllBytes($encryptedBundle, $encryptedPayload)

  # Prove that the encrypted payload can be authenticated and decrypted before
  # the temporary plaintext archive is removed.
  $verificationPlaintext = [byte[]]::new($ciphertext.Length)
  $aes = [System.Security.Cryptography.AesGcm]::new($key, 16)
  try {
    $aes.Decrypt($nonce, $ciphertext, $tag, $verificationPlaintext, $associatedData)
  } finally {
    $aes.Dispose()
  }
  $verificationHash = [Convert]::ToHexString(
    [System.Security.Cryptography.SHA256]::HashData($verificationPlaintext)
  )
  if ($verificationHash -ne $plainHash) {
    throw "Encrypted bundle verification failed."
  }

  $bundleItem = Get-Item -LiteralPath $encryptedBundle
  [pscustomobject]@{
    EncryptedBundle = $bundleItem.FullName
    SizeMiB = [math]::Round($bundleItem.Length / 1MB, 2)
    SHA256 = (Get-FileHash -LiteralPath $encryptedBundle -Algorithm SHA256).Hash
    IncludedFiles = $manifest.Count
    Password = $password
    DecryptionHelper = (Resolve-Path -LiteralPath (Join-Path $ProjectRoot "scripts\decrypt-migration-bundle.ps1")).Path
  }
} finally {
  foreach ($bufferName in @("plaintext", "ciphertext", "verificationPlaintext", "key", "passwordBytes", "encryptedPayload")) {
    $buffer = Get-Variable -Name $bufferName -ValueOnly -ErrorAction SilentlyContinue
    if ($buffer -is [byte[]]) {
      [Array]::Clear($buffer, 0, $buffer.Length)
    }
  }

  if (Test-Path -LiteralPath $plainZip -PathType Leaf) {
    [System.IO.File]::Delete($plainZip)
  }
  if (Test-Path -LiteralPath $stage -PathType Container) {
    $resolvedStage = (Resolve-Path -LiteralPath $stage).Path
    if (-not $resolvedStage.StartsWith($MigrationRoot + "\", [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to remove an unexpected staging directory: $resolvedStage"
    }
    [System.IO.Directory]::Delete($resolvedStage, $true)
  }
}
