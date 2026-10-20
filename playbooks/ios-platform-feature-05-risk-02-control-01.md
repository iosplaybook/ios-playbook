## ios-platform-feature-05-risk-02-control-01

### Title

Enforce security decisions server-side

### Description

Enforce security decisions server-side by making the backend the authority for security-critical outcomes, so that overriding a client-side check in memory does not grant access the server has not approved.

### Demonstration
#### 01. Identify the client-side decision

Locate the security-critical decisions the app currently makes on its own, such as entitlement or authorisation checks that return a boolean. Identifying them shows what must move to the server.

#### 02. Move the decision to the server

Change the flow so the app requests the outcome from the backend and the backend applies the rule against the authenticated session. Moving the decision means the client reports intent rather than deciding access.

``` swift
// The client asks the server; it does not decide locally.
let decision = try await api.authorize(action: .exportReport)
guard decision.allowed else { return }
```

*Code block shows the client acting on a server-issued decision*

#### 03. Return only what the decision allows

Have the server release the gated data or action only when its own check passes, rather than relying on the client to hide it. Withholding the resource server-side means a bypassed client check yields nothing.

#### 04. Verify the bypass no longer grants access

Repeat the runtime manipulation from the risk and confirm that overriding the client check does not return the protected data or action. Verifying confirms the decision is enforced where it cannot be hooked.

### References

- https://mas.owasp.org/MASTG/0x04f-Testing-Local-Authentication/
- https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

The source code with the implemented control can be found [here](control-examples/ios-platform-feature-05-risk-02-control-01.zip).
