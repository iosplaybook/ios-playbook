## ios-platform-feature-01

### Title

Exporting an app's IPA file
A second title line is not allowed.

### Description

The iOS platform provides {feature_name} feature.

### Demonstration
#### 01. Prepare the environment

Set up the required environment with:
* An iPhone paired with a macOS workstation

#### 03. Export the IPA

<img src="assets/feature1_ss1.png" width="400" alt="Apple Configurator listing installed apps">

*Image of the installed apps*

#### 04. Locate the IPA

List the cache directory to confirm the IPA was saved.

``` shell
ls ~/Library/Caches
```

Note: the directory name differs between Configurator versions.

Because a paired workstation can copy the app's IPA file, your app is at risk of:

- [ios-platform-feature-01-risk-01](ios-platform-feature-01-risk-02.md)
