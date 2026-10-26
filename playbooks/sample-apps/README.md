# iOS risk-test sample sources

Source coverage reviewed on 2026-10-21. Binary paths in [inventory.json](inventory.json) are relative to the automation backend repository, `mobile_playbook_automation`. The inventory records bundle identifiers and reference binary/archive SHA-256 checksums.

| Archive | Bundle identifier | Purpose | Review |
| --- | --- | --- | --- |
| [ios-platform-feature-03-risk-01-replay-consent-recorder-source.zip](ios-platform-feature-03-risk-01-replay-consent-recorder-source.zip) | `com.example.ReplayConsentRecorder` | ReplayKit recorder companion for feature 03 risk 01 | Added from the current `iosplaybook_sideload/ScreenRecording` working tree, including local evidence-export changes. |
| [ios-platform-feature-04-risk-01-local-keyboard-source.zip](ios-platform-feature-04-risk-01-local-keyboard-source.zip) | `com.example.LocalKeyboard` | Custom-keyboard companion for feature 04 risk 01 | Pre-existing archive preserved as supplied; equivalence to the reference IPA was not revalidated. |
| [ios-platform-feature-05-jailbreak-lab-source.zip](ios-platform-feature-05-jailbreak-lab-source.zip) | `com.mobileplaybook.JailbreakLab` | Offline synthetic fixture for feature 05 risks 01–04 | Pre-existing archive; all archived source files match the backend intake fixture. |

The Replay Consent Recorder ZIP contains the app, broadcast extension, Xcode project, shared scheme, entitlements and build/setup README. `SOURCE.json` records checksums for its source snapshot and reference companion IPA; it does not assert byte-identical build provenance. Build products, provisioning profiles, private signing keys and local IDE state are excluded.

A fresh extraction builds successfully for the iOS simulator with code signing disabled. To install on a physical device, configure your own signing team and App Group using the included README. Device provisioning and ReplayKit runtime operation were not tested during this archive review.

ZIP files remain local sample artifacts under the repository's existing ignore rule. Third-party production IPAs and the synthetic `example_app.ipa` placeholder are outside this inventory. The duplicate Jailbreak Lab IPA under the intake fixture has the same checksum as the top-level IPA.
