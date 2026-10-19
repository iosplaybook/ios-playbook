## ios-platform-feature-05-risk-03

### Title

Bypass jailbreak detection

### Description

Bypass jailbreak detection by hooking the checks the app uses to decide whether the device is jailbroken, so the app continues to run on a compromised device (MITRE ATT&CK: ***Defense Evasion*** - TA0030).

A finding means the app's jailbreak detection was defeated and the app ran normally afterwards. Detection that can be fully bypassed from a single layer offers limited protection. The finding assesses the resilience of the detection, not its presence.

### Demonstration
#### 01. Prepare the environment

Set up the required environment with:
* A Corellium virtual iPhone running a jailbroken iOS 27.0.1 image, with the target app installed through the device's `Apps` tab
* A workstation with Frida and objection installed
* A Frida server running on the Corellium device


For a reproducible workflow check, use the minimal offline Jailbreak Lab 1.0 fixture, bundle `com.mobileplaybook.JailbreakLab`, saved in iOS intake. It contains only the four deliberately vulnerable test behaviors and generates synthetic session data. These demonstrations validate the procedure rather than the security of a production app. The tested tools were Frida client 17.9.10, the existing Frida server 17.19.0 and objection 1.12.4. Record versions when repeating the test.

#### 02. Create and boot the device

Reuse an existing authorised jailbroken device when it already runs iOS 27.0.1. Confirm the project, device identity, OS version and jailbroken setting before continuing. If no matching device exists, create an iPhone in Corellium, choose iOS 27.0.1 and the jailbroken option, then boot it. The screenshots below illustrate device creation; this manual test reused the existing jailbroken iPhone in the testing project.

<img src="assets/feature5_ss2.png" width="400" alt="Corellium device creation with an iPhone model, iOS 27.0.1, and the jailbroken option selected">

*Screenshot shows creating an iPhone device and booting the jailbroken image in the Corellium project*

#### 03. Connect to the device

Open the device's `Connect` tab. Use either the Corellium VPN and device service IP, or the SSH Quick Connect command shown for this exact device. Quick Connect requires a public key already authorised for the selected project; guest authentication is separate. Use the guest credentials supplied for the test image. A project proxy accepting a key does not by itself establish a root session on the iPhone.

Over the VPN:

```bash
ssh root@<device-ip>
```

Through SSH Quick Connect:

```bash
ssh -J <project-id>@<proxy-host> root@<device-ip>
```

*Commands show connecting to the selected Corellium iPhone; copy the actual project, proxy and service IP from its Connect tab*

#### 04. Confirm elevated access

Run `id` in the SSH session and confirm the output shows `uid=0(root)`. Confirming elevated access establishes that the device is ready for the risks that follow.

```bash
id
```

*Command shows checking that the session runs with root privileges*

<img src="assets/feature5_ss3.png" width="400" alt="Output of the id command showing uid=0(root)">

*Screenshot shows recorded SSH command output confirming uid=0(root); the evidence view is labelled and contains no authentication values*

#### 05. Confirm the detection behaviour

Launch the target app on the jailbroken device without any instrumentation and record what it does, such as refusing to start, blocking a protected feature or showing a warning. In the fixture, tap `3 Open jailbreak-protected feature` and confirm it blocks. If no detection occurs, there is no observed detection behavior to claim as bypassed. This establishes the baseline detection behaviour to bypass.

<img src="assets/feature5_risk3_ss1.png" width="400" alt="Jailbreak Lab blocks its protected feature before instrumentation">

*Screenshot shows the app blocking use on a jailbroken device*

#### 06. Attach instrumentation to the app

For a Corellium server reachable through SSH, keep a separate SSH forwarding session open. This binds only the workstation's loopback interface and forwards to the selected iPhone's existing Frida server:

```bash
ssh -N -L 127.0.0.1:27052:127.0.0.1:27042 -J <project-id>@<proxy-host> root@<device-ip>
```

If using the Corellium VPN, omit `-J <project-id>@<proxy-host>` from this command. Keep port 27052 and the same target device consistent in the commands that follow. Do not use an unqualified USB selector when other phones are connected.

Attach objection to the already running target through the same explicit endpoint. Use the target bundle identifier; for the fixture it is `com.mobileplaybook.JailbreakLab`. The current command spelling below avoids the deprecated `-g` and `explore` aliases accepted by objection 1.12.4.

```bash
objection -N -h 127.0.0.1 -P 27052 -n <bundle-id> start
```

*Code block shows attaching to the selected Corellium app without relying on an implicit USB device*

#### 07. Disable the detection

Apply the jailbreak detection bypass, which hooks common checks such as file existence, protocol handlers, and process forking. The command attempts to bypass common checks; it is not guaranteed to cover every app or detection layer. Confirm live hook output and the app behavior before declaring success.

``` bash
ios jailbreak disable
```

*Code block shows applying the jailbreak detection bypass*

#### 08. Confirm the app now runs

Continue into the app and confirm it proceeds past the point where it previously blocked. In the fixture, retry the same protected-feature button and confirm it opens. Exit objection and retry without hooks to confirm it blocks again. Reaching the previously blocked functionality confirms the tested detection was bypassed.

<img src="assets/feature5_risk3_ss2.png" width="400" alt="The same protected feature opens after the objection jailbreak bypass">

*Screenshot shows the app running normally after the bypass*

Feature-05-Risk-03 control measures:

- [ios-platform-feature-05-risk-03-control-01](ios-platform-feature-05-risk-03-control-01.md)

References:

- https://mas.owasp.org/MASTG/techniques/ios/MASTG-TECH-0087/
- https://attack.mitre.org/tactics/TA0030/
