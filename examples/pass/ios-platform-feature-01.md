## ios-platform-feature-01

### Title

Exporting an app's IPA file

### Description

The iOS platform lets a paired workstation copy installed apps off a device, which gives testers the IPA file for static analysis.

> Note: Only export apps you are authorised to test.

### Demonstration
#### 01. Prepare the environment

Set up the required environment with:
* An iPhone paired with a macOS workstation
* Apple Configurator installed on the workstation

#### 02. Export the IPA

Select the app in Apple Configurator and export it. The exported IPA is written to the workstation's cache directory.

<img src="assets/feature1_ss1.png" width="400" alt="Apple Configurator listing installed apps">

*Screenshot shows the installed apps listed in Apple Configurator*

#### 03. Locate the IPA

List the cache directory to confirm the IPA was saved.

``` shell
ls ~/Library/Group\ Containers/K36BKF7T3D.group.com.apple.configurator/Library/Caches/Assets/TemporaryItems/MobileApps/
```

*Code block shows listing the directory that holds the exported IPA*

Because a paired workstation can copy the app's IPA file, your app is at risk of:

- [ios-platform-feature-01-risk-01](ios-platform-feature-01-risk-01.md)
