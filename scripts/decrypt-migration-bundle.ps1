param(
  [Parameter(Mandatory = $true)]
  [string]$EncryptedBundle,

  [string]$OutputZip,

  [System.Security.SecureString]$BundlePassword
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $EncryptedBundle -PathType Leaf)) {
  throw "Encrypted bundle not found: $EncryptedBundle"
}

if (-not ([System.Security.Cryptography.AesGcm] -as [type])) {
  throw "This helper requires PowerShell 7 with a modern .NET runtime."
}

$sourcePath = (Resolve-Path -LiteralPath $EncryptedBundle).Path
if (-not $OutputZip) {
  $OutputZip = if ($sourcePath.EndsWith(".aes", [System.StringComparison]::OrdinalIgnoreCase)) {
    $sourcePath.Substring(0, $sourcePath.Length - 4)
  } else {
    "$sourcePath.decrypted.zip"
  }
}

$expectedMagic = [System.Text.Encoding]::ASCII.GetBytes("LLMIG001")
$payload = [System.IO.File]::ReadAllBytes($sourcePath)
$minimumLength = 8 + 4 + 16 + 12 + 16 + 1
if ($payload.Length -lt $minimumLength) {
  throw "The encrypted bundle is too short or damaged."
}

$magic = [byte[]]::new(8)
[Array]::Copy($payload, 0, $magic, 0, 8)
if (-not [System.Linq.Enumerable]::SequenceEqual([byte[]]$magic, [byte[]]$expectedMagic)) {
  throw "The encrypted bundle header is not recognized."
}

$iterations = [System.BitConverter]::ToInt32($payload, 8)
if ($iterations -lt 100000) {
  throw "The encrypted bundle uses an invalid key-derivation setting."
}

$salt = [byte[]]::new(16)
$nonce = [byte[]]::new(12)
$tag = [byte[]]::new(16)
$ciphertext = [byte[]]::new($payload.Length - 56)
$associatedData = [byte[]]::new(40)
[Array]::Copy($payload, 12, $salt, 0, 16)
[Array]::Copy($payload, 28, $nonce, 0, 12)
[Array]::Copy($payload, 40, $tag, 0, 16)
[Array]::Copy($payload, 56, $ciphertext, 0, $ciphertext.Length)
[Array]::Copy($payload, 0, $associatedData, 0, 40)

$securePassword = if ($BundlePassword) {
  $BundlePassword
} else {
  Read-Host "Migration bundle password" -AsSecureString
}
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$passwordText = $null
$key = $null

try {
  $passwordText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $derive = [System.Security.Cryptography.Rfc2898DeriveBytes]::new(
    $passwordText,
    [byte[]]$salt,
    $iterations,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256
  )
  try {
    $key = $derive.GetBytes(32)
  } finally {
    $derive.Dispose()
  }

  $plaintext = [byte[]]::new($ciphertext.Length)
  $aes = [System.Security.Cryptography.AesGcm]::new($key, 16)
  try {
    $aes.Decrypt(
      [byte[]]$nonce,
      [byte[]]$ciphertext,
      [byte[]]$tag,
      $plaintext,
      [byte[]]$associatedData
    )
  } finally {
    $aes.Dispose()
  }

  [System.IO.File]::WriteAllBytes($OutputZip, $plaintext)
  [Array]::Clear($plaintext, 0, $plaintext.Length)
  Write-Output "Decrypted ZIP: $OutputZip"
} catch [System.Security.Cryptography.AuthenticationTagMismatchException] {
  throw "Decryption failed. The password is incorrect or the bundle is damaged."
} finally {
  if ($key) {
    [Array]::Clear($key, 0, $key.Length)
  }
  if ($passwordText) {
    $passwordText = $null
  }
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  [Array]::Clear($payload, 0, $payload.Length)
}
