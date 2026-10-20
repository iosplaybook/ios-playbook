## ios-platform-feature-01-risk-01-control-01

### Title

Obfuscate plaintext literals

### Description

Obfuscate plaintext literals at build time so that secrets are not readable in the IPA.

### Demonstration
#### 01. Move literals into a configuration file

Move the literals into `confidential.yml` so the build plugin can generate obfuscated accessors for them.

``` yaml
secrets:
  - name: apiKey
    value: example-only
```

*Code block shows a literal declared for obfuscation*

> Note: Keep `confidential.yml` out of the app bundle.

#### 02. Verify the literals are obfuscated

Rebuild the app and scan the IPA again to confirm the literals are no longer reported.

### References

- https://github.com/securevale/swift-confidential

The source code with the implemented control can be found [here](control-examples/ios-platform-feature-01-risk-01-control-01.zip).
