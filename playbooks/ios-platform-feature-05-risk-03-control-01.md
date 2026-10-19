## ios-platform-feature-05-risk-03-control-01

### Title

Layer jailbreak detection and attestation

### Description

Layer jailbreak detection and attestation by combining several independent on-device checks with runtime integrity checks and server-side attestation, so that defeating one layer does not silently defeat the whole defence.

### Demonstration
#### 01. Use several independent checks

Implement more than one jailbreak signal, such as checking for known file paths, restricted directory writes, and suspicious dynamic libraries. Independent checks make a single generic bypass less likely to cover every signal.

``` swift
let signals = [checkKnownPaths(), checkSandboxWrite(), checkLoadedDylibs()]
let suspicious = signals.contains(true)
```

*Code block shows combining several independent detection signals*

#### 02. Add runtime integrity checks

Detect common instrumentation, such as injected hooking frameworks, so that tampering with the detection itself is also observable. Watching for hooks raises the effort needed to disable the checks at runtime.

#### 03. Attest device integrity server-side

Use App Attest or DeviceCheck and verify the attestation on the backend, so the server can judge device integrity rather than trusting a client-reported result. Server-side verification means a bypassed client check does not convince the server.

#### 04. Respond on the server, not only the client

Have the backend restrict sensitive actions when attestation fails or is absent, rather than relying on the app to block itself. Enforcing server-side means a defeated client check still does not unlock protected functionality. Note: attestation relies on genuine Apple hardware and will not succeed on a virtual device, so confirm this layer on a physical device.

### References

- https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity
- https://mas.owasp.org/MASTG/0x06j-Testing-Resiliency-Against-Reverse-Engineering/
