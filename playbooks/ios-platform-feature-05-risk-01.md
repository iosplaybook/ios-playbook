## ios-platform-feature-05-risk-01

### Title

Access app sandbox data

### Description

Access application sandbox data by using elevated privileges on a jailbroken device to read files stored inside the app's container (MITRE ATT&CK: ***Collection*** - TA0035).

A finding means sensitive data was recovered from the app's sandbox using root access. Running on a jailbroken device is a test prerequisite, not itself a vulnerability. The finding reflects what an attacker with elevated privileges could read, not a flaw in iOS sandboxing.

### Demonstration
#### 01. Prepare the environment

Set up the required environment with:
* A Corellium virtual iPhone running a jailbroken iOS 27.0.1 image, with the target app installed through the device's `Apps` tab
* An SSH client and a file transfer tool


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

#### 05. Locate the app container

Find the app's data container by comparing its container metadata with the target bundle identifier. A device-wide SQLite search alone does not prove app ownership. The commands below use the `plutil -key` syntax available on the tested Corellium image; a different `plutil` implementation may need its equivalent key-extraction option. Replace the fixture bundle identifier when testing another app.

```bash
BUNDLE_ID=com.mobileplaybook.JailbreakLab
APP_CONTAINER=
for metadata in /var/mobile/Containers/Data/Application/*/.com.apple.mobile_container_manager.metadata.plist; do
    [ -f "$metadata" ] || continue
    identifier=$(plutil -key MCMMetadataIdentifier "$metadata" 2>/dev/null)
    if [ "$identifier" = "$BUNDLE_ID" ]; then
        APP_CONTAINER=${metadata%/*}
        break
    fi
done
if [ -n "$APP_CONTAINER" ]; then
    printf '%s\n' "$APP_CONTAINER"
    find "$APP_CONTAINER" -iname '*.sqlite' 2>/dev/null
else
    echo "No matching app container; stop and verify the bundle identifier."
fi
```

*Code block shows matching MCMMetadataIdentifier first, then searching only the matched app container*

#### 06. Inspect stored files

Exercise the relevant app flow before inspection. In the fixture, tap `1 Sign in / save sandbox session` to generate synthetic data. Review `Documents`, `Library` and `Library/Caches` inside the matched container, including property lists, databases and cached responses. Keep the same SSH session so `APP_CONTAINER` remains set.

```bash
test -n "$APP_CONTAINER" && ls -la "$APP_CONTAINER/Documents" "$APP_CONTAINER/Library" "$APP_CONTAINER/Library/Caches"
```

<img src="assets/feature5_risk1_ss2.png" width="400" alt="Recorded SSH inspection of the matched Jailbreak Lab container">

*Screenshot shows a labelled excerpt of the recorded SSH directory listing for the matched app container*

#### 07. Check for sensitive data

Examine the recovered files for sensitive information such as authentication tokens, personal data, or credentials held in plaintext. Finding such data in the container demonstrates the exposure. Do not retain the recovered values themselves as report evidence; record only the file location and the type of data observed. For the fixture, inspect the session plist with guest-side redaction and query only token metadata from SQLite:

```bash
sed -E 's/Bearer LAB-ONLY-[A-F0-9-]+/[REDACTED SYNTHETIC BEARER TOKEN]/g' "$APP_CONTAINER/Documents/session.plist"
sqlite3 "$APP_CONTAINER/Documents/session.sqlite" "SELECT kind,length(token),substr(token,1,7)='Bearer ' AS bearer_prefix FROM session;"
```

For another app, adapt the redaction and schema before retaining output. Do not assume these fixture-specific patterns cover real secrets.

<img src="assets/feature5_risk1_ss3.png" width="400" alt="Recorded plist inspection with the synthetic bearer token redacted">

*Screenshot shows the recorded file structure and data type after redaction; no recovered token value is retained*

Feature-05-Risk-01 control measures:

- [ios-platform-feature-05-risk-01-control-01](ios-platform-feature-05-risk-01-control-01.md)

References:

- https://mas.owasp.org/MASTG/techniques/ios/MASTG-TECH-0053/
- https://attack.mitre.org/tactics/TA0035/
