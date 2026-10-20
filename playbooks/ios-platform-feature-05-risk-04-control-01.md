## ios-platform-feature-05-risk-04-control-01

### Title

Limit secret lifetime in memory

### Description

Limit secret lifetime in memory by keeping sensitive values resident for as short a time as possible and favouring short-lived credentials, so that memory inspection has a narrow window in which to recover them.

### Demonstration
#### 01. Use short-lived credentials

Issue access tokens with a short expiry and refresh them as needed, rather than holding long-lived secrets. A short expiry limits the value of any token recovered from memory.

#### 02. Release secrets promptly

Hold sensitive values only for the operation that needs them, then overwrite them. Dropping a reference does not erase the value: the bytes stay in memory until that memory is reused, and Swift `String` values cannot be reliably overwritten. Keep secrets in a mutable `Data` buffer and zero it as soon as the operation completes.

``` swift
func useToken(_ token: inout Data) {
    perform(with: token)
    // Overwrite the bytes rather than only dropping the reference.
    token.resetBytes(in: 0..<token.count)
}
```

*Code block shows overwriting a secret after the operation that needs it*

#### 03. Avoid unnecessary plaintext copies

Avoid copying secrets into long-lived caches, logs, or UI state where they persist beyond their use. Fewer copies means fewer places a scan can find the value.

#### 04. Verify the exposure window is reduced

Repeat the memory inspection from the risk at different points and confirm the secret is present only briefly, not for the whole session. Verifying confirms the lifetime is limited. Note: a value is still recoverable while it is in use, so this control reduces the window rather than removing it.

### References

- https://mas.owasp.org/MASTG/0x06d-Testing-Data-Storage/
- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
