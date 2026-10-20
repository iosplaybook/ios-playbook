## ios-platform-feature-05-risk-01-control-01

### Title

Protect stored secrets with the Keychain

### Description

Protect stored secrets with the Keychain by holding sensitive values in the Keychain with a restrictive accessibility class and keeping plaintext copies out of the app's container, so less is exposed when the sandbox is read with elevated privileges.

### Demonstration
#### 01. Minimise what is stored

Review what the app writes to its container and remove sensitive values that do not need to persist, such as tokens that can be re-fetched. Reducing stored data limits what can be recovered from the sandbox.

#### 02. Store secrets in the Keychain

Move the remaining secrets into the Keychain instead of files or `UserDefaults`. The Keychain is managed outside the app's readable container and is the supported store for sensitive values.

``` swift
let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrAccount as String: "session_token",
    kSecValueData as String: tokenData,
    kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
]
SecItemAdd(query as CFDictionary, nil)
```

*Code block shows storing a token in the Keychain with a restrictive accessibility class*

#### 03. Use a restrictive accessibility class

Set the accessibility to `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` so the item is readable only while the device is unlocked and never migrates to another device through a backup. A restrictive class narrows when and where the secret can be read.

#### 04. Verify the container no longer exposes the secret

Repeat the sandbox inspection from the risk and confirm the sensitive value is no longer present in the container files. Verifying confirms the secret moved out of the readable sandbox. Note: the Keychain can still be read on a jailbroken device, so this control reduces exposure rather than removing it entirely.

### References

- https://developer.apple.com/documentation/security/ksecattraccessiblewhenunlockedthisdeviceonly
- https://mas.owasp.org/MASTG/0x06d-Testing-Data-Storage/

The source code with the implemented control can be found [here](control-examples/ios-platform-feature-05-risk-01-control-01.zip).
