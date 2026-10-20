## ios-platform-feature-01-risk-01

### Title

Analyse the IPA for secrets

### Description

Analyse the exported IPA for plaintext secrets such as API keys and credentials (MITRE ATT&CK: ***Discovery*** - TA0032).

### Demonstration
#### 01. Export the IPA

Export the IPA by following the steps in ios-platform-feature-01.

#### 02. Scan the IPA

Upload the IPA to MobSF and review the hardcoded secrets section of the report.

<img src="assets/feature1_risk1_ss1.png" width="400" alt="MobSF report listing hardcoded secrets">

*Screenshot shows plaintext secrets reported by MobSF*

Feature-01-Risk-01 control measures:

- [ios-platform-feature-01-risk-01-control-01](ios-platform-feature-01-risk-01-control-01.md)

References:

- https://mas.owasp.org/MASTG/techniques/ios/MASTG-TECH-0058/
