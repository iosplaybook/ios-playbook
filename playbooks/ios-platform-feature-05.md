## ios-platform-feature-05

### Title

Jailbroking an iOS device

### Description

Jailbreaking an iOS device removes the standard iOS security restrictions on a test device, granting elevated privileges and unrestricted access to the file system, running processes, and app memory, enabling authorised security testers to inspect how an application stores data, enforces decisions, and protects secrets when the device itself is compromised.

### Demonstration
#### 01. Prepare the environment

Set up the required environment with:
* A Corellium virtual iPhone running a jailbroken iOS 27.0.1 image
* A workstation with network access to the Corellium device
* The target app available for installation

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

Because jailbreaking a device provides unrestricted access to the app and its data, your app is at risk of:

- [ios-platform-feature-05-risk-01](ios-platform-feature-05-risk-01.md)
- [ios-platform-feature-05-risk-02](ios-platform-feature-05-risk-02.md)
- [ios-platform-feature-05-risk-03](ios-platform-feature-05-risk-03.md)
- [ios-platform-feature-05-risk-04](ios-platform-feature-05-risk-04.md)
