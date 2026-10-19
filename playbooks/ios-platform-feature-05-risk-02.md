## ios-platform-feature-05-risk-02

### Title

Manipulate runtime decisions

### Description

Manipulate runtime decisions by attaching a dynamic instrumentation framework to the running app and altering security-critical logic in memory (MITRE ATT&CK: ***Defense Evasion*** - TA0030).

A finding means a client-side decision was changed at runtime without restarting the app. This shows the decision is enforced only on the device. Server-enforced decisions cannot be changed this way.

### Demonstration
#### 01. Prepare the environment

Set up the required environment with:
* A Corellium virtual iPhone running a jailbroken iOS 17.6 image
* A workstation with Frida installed
* A Frida server running on the Corellium device
* The target app installed on the Corellium device

#### 02. Create and boot the device

In the Corellium project, create a new device, select an iPhone model running iOS 27.0.1, and start it using the jailbroken image option so it boots with the standard restrictions removed. Creating and booting the device this way provides a controlled iOS environment with the elevated access used during testing.

<img src="assets/feature5_ss1.png" width="400" alt="Alt text">

*Screenshot shows creating an iPhone device and booting the jailbroken image in the Corellium project*

#### 03. Connect to the device

Connect to the device over the Corellium network and open an SSH session using the credentials shown in the device console. The connection provides a shell for running the test tooling.

<img src="assets/feature5_ss2.png" width="400" alt="Alt text">

*Screenshot shows an SSH session established to the device*

#### 04. Confirm elevated access

Run `id` in the SSH session and confirm the session has root privileges. Confirming elevated access establishes that the device is ready for the risks that follow.

<img src="assets/feature5_ss3.png" width="400" alt="Alt text">

*Screenshot shows the session running with root privileges*

#### 05. Confirm the device is reachable

List the running applications on the device from the workstation to confirm Frida can reach the target process. A returned process list confirms the instrumentation channel is working.

``` bash
frida-ps -Ua
```

*Code block shows listing running apps through the Frida server*

#### 06. Attach to the target app

Attach Frida to the running target app by its bundle identifier or process name. Attaching gives the instrumentation script access to the app's loaded code and memory.

<img src="assets/feature5_risk2_ss1.png" width="400" alt="Alt text">

*Screenshot shows Frida attached to the target app*

#### 07. Identify the security-critical function

Locate a method that returns a security-critical decision, such as an entitlement check or a login validation that returns a boolean. Identifying the method shows where the decision is made on the client.

#### 08. Override the decision in memory

Hook the method and replace its return value so the app behaves as though the check passed. Overriding the value demonstrates that the decision can be changed at runtime.

``` javascript
Interceptor.attach(target, {
    onLeave(retval) {
        retval.replace(0x1);
    }
});
```

*Code block shows a hook forcing a security check to return true*

#### 09. Observe the changed behaviour

Continue using the app and confirm it now follows the overridden decision, for example by exposing a gated feature. The changed behaviour confirms the decision was enforced only on the client.

<img src="assets/feature5_risk2_ss2.png" width="400" alt="Alt text">

*Screenshot shows the app behaving as though the check passed*

Feature-05-Risk-02 control measures:

- [ios-platform-feature-05-risk-02-control-01](ios-platform-feature-05-risk-02-control-01.md)

References:

- https://mas.owasp.org/MASTG/techniques/ios/MASTG-TECH-0084/
- https://attack.mitre.org/tactics/TA0030/
