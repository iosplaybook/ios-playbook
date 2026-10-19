## ios-platform-feature-05-risk-04

### Title

Extract secrets from memory

### Description

Extract secrets from memory by inspecting the running app's process memory for sensitive values such as tokens or credentials (MITRE ATT&CK: ***Credential Access*** - TA0031).

A finding means sensitive values were recovered from the app's live memory. Values held in memory longer than needed widen the window in which they can be captured. The finding reflects secret lifetime and handling, not a flaw in iOS memory protection.

### Demonstration
#### 01. Prepare the environment

Set up the required environment with:
* A Corellium virtual iPhone running a jailbroken iOS 17.6 image
* A workstation with Frida and objection installed
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

#### 05. Attach to the running process

Start an instrumented session against the running target app. Attaching gives the memory tooling access to the app's address space.

``` bash
objection -g <bundle_id> explore
```

*Code block shows starting an instrumented session against the target app*

#### 06. Exercise the app to load secrets

Use the app so that sensitive values are loaded into memory, for example by signing in so that a session token is held. Exercising the relevant flow ensures the secrets are present to be found.

#### 07. Scan process memory

Scan or dump the app's heap and search it for sensitive values. Scanning the live memory shows which values are resident while the app runs.

``` bash
memory search --string "Bearer"
```

*Code block shows searching live memory for a token prefix*

#### 08. Check for sensitive values

Review the matches for authentication tokens, credentials, or other secrets. Recovering such values from memory demonstrates the exposure. Do not retain the recovered values themselves as report evidence; record only the type of data observed and where it was found.

<img src="assets/feature5_risk4_ss1.png" width="400" alt="Alt text">

*Screenshot shows a sensitive value recovered from process memory*

Feature-05-Risk-04 control measures:

- [ios-platform-feature-05-risk-04-control-01](ios-platform-feature-05-risk-04-control-01.md)

References:

- https://mas.owasp.org/MASTG/techniques/ios/MASTG-TECH-0086/
- https://attack.mitre.org/tactics/TA0031/
