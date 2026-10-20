import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, "scripts", "validate-playbooks.mjs");

const FEATURE = [
  "## ios-platform-feature-01",
  "",
  "### Title",
  "",
  "Secure Storage",
  "",
  "### Description",
  "",
  "Secure Storage protects application secrets stored on the device.",
  "",
  "### Demonstration",
  "#### 01. Prepare the environment",
  "",
  "Set up the required environment with:",
  "* An iPhone running the demo app",
  "",
  "#### 02. Enable encrypted storage",
  "",
  "Open the project settings and enable encrypted storage.",
  "",
  "Because Secure Storage keeps secrets on the device, your app is at risk of:",
  "",
  "- [ios-platform-feature-01-risk-01](ios-platform-feature-01-risk-01.md)",
];

const RISK = [
  "## ios-platform-feature-01-risk-01",
  "",
  "### Title",
  "",
  "Extract stored secrets",
  "",
  "### Description",
  "",
  "Extract secrets from the app container on a compromised device.",
  "",
  "A finding means a secret was recovered in plaintext.",
  "",
  "### Demonstration",
  "#### 01. Locate the container",
  "",
  "Open the backup directory to locate the exported application data.",
  "",
  "Feature-01-Risk-01 control measures:",
  "",
  "- [ios-platform-feature-01-risk-01-control-01](ios-platform-feature-01-risk-01-control-01.md)",
];

const CONTROL = [
  "## ios-platform-feature-01-risk-01-control-01",
  "",
  "### Title",
  "",
  "Store secrets in the Keychain",
  "",
  "### Description",
  "",
  "Store secrets in the Keychain instead of the app container.",
  "",
  "### Demonstration",
  "#### 01. Store secrets in the Keychain",
  "",
  "Save the token with `SecItemAdd` so it never reaches the container.",
  "",
  "``` swift",
  "SecItemAdd(query as CFDictionary, nil)",
  "```",
  "",
  "*Code block shows storing a token in the Keychain*",
  "",
  "### References",
  "",
  "- https://developer.apple.com/documentation/security/keychain_services",
  "",
  "The source code with the implemented control can be found [here](control-examples/ios-platform-feature-01-risk-01-control-01.zip).",
];

test("the example pass playbooks are accepted without warnings", () => {
  const files = fs.readdirSync(path.join(repoRoot, "examples", "pass")).filter((name) => name.endsWith(".md"));
  const result = runValidator(files.map((name) => path.join("examples", "pass", name)));

  assert.equal(result.status, 0, result.stdout);
  assert.doesNotMatch(result.stdout, /::warning/);
  assert.match(result.stdout, /Step 03 heading passed the 'feature\.steps'/);
  assert.match(result.stdout, /The source code archive 'control-examples\/ios-platform-feature-01-risk-01-control-01\.zip' exists/);
});

test("the example fail playbooks report each seeded problem", () => {
  const files = fs.readdirSync(path.join(repoRoot, "examples", "fail")).filter((name) => name.endsWith(".md"));
  const result = runValidator(files.map((name) => path.join("examples", "fail", name)));

  assert.equal(result.status, 1);
  for (const rule of [
    "placeholder.unreplaced",
    "feature.title_line",
    "feature.steps",
    "feature.steps_body",
    "caption.screenshot",
    "caption.code_block",
    "note.format",
    "feature.related_risks_link_match",
    "code.unclosed_fence",
    "control.references_heading",
    "control.source_archive_name",
  ]) {
    assert.match(result.stdout, new RegExp(`\\[${rule.replace(".", "\\.")}\\]`), `expected ${rule}`);
  }
  assert.doesNotMatch(result.stdout, /extra_content/);
});

test("feature, risk and control playbooks in the new layout pass", () => {
  const result = validate({
    "ios-platform-feature-01.md": FEATURE,
    "ios-platform-feature-01-risk-01.md": RISK,
    "ios-platform-feature-01-risk-01-control-01.md": CONTROL,
    "control-examples/ios-platform-feature-01-risk-01-control-01.zip": "zip",
  });

  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /feature\.related_risks_list/);
  assert.match(result.stdout, /risk\.controls_list/);
  assert.match(result.stdout, /control\.source_reference/);
});

test("feature tool variants share the feature identifier", () => {
  const result = validate({ "ios-platform-feature-01-iMazing.md": FEATURE });

  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /The top heading matches the filename identifier 'ios-platform-feature-01'/);
});

test("the top heading must match the filename", () => {
  const result = validate({ "ios-platform-feature-02.md": FEATURE });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /heading\.filename_match/);
});

test("steps must be numbered 01, 02, ... and a gap is reported once", () => {
  const lines = replace(FEATURE, "#### 02. Enable encrypted storage", "#### 03. Enable encrypted storage");
  const result = validate({ "ios-platform-feature-01.md": [...lines.slice(0, -4), "#### 04. Verify", "", "Check the setting.", "", ...lines.slice(-4)] });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /This step is numbered '03', but step '02' was expected/);
  assert.doesNotMatch(result.stdout, /numbered '04'/);
});

test("step headings must use the '#### NN. <Heading>' form", () => {
  const result = validate({ "ios-platform-feature-01.md": replace(FEATURE, "#### 02. Enable encrypted storage", "#### 2 Enable encrypted storage") });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /\[feature\.steps\] Step headings must be written as '#### 02\. <Heading>'/);
});

test("each step needs a paragraph of body text", () => {
  const result = validate({
    "ios-platform-feature-01.md": replace(FEATURE, "Open the project settings and enable encrypted storage.", [
      '<img src="assets/step.png" width="400" alt="Settings">',
      "",
      "*Screenshot shows the settings screen*",
    ]),
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /\[feature\.steps_body\] Step '#### 02\. Enable encrypted storage' has no paragraph/);
});

test("the title must be one line and the description must open with a paragraph", () => {
  const withLongTitle = replace(FEATURE, "Secure Storage", ["Secure Storage", "on iOS"]);
  const withoutParagraph = replace(FEATURE, "Secure Storage protects application secrets stored on the device.", "> Note: Only test apps you own.");
  const result = validate({ "ios-platform-feature-01.md": withLongTitle });
  const second = validate({ "ios-platform-feature-01.md": withoutParagraph });

  assert.match(result.stdout, /\[feature\.title_line\] The title must be a single line/);
  assert.doesNotMatch(result.stdout, /\[feature\.description_heading\]/);
  assert.match(second.stdout, /\[feature\.description_paragraph\]/);
});

test("code blocks and images need 'Code block shows' and 'Screenshot shows' captions", () => {
  const result = validate({
    "ios-platform-feature-01.md": replace(FEATURE, "Open the project settings and enable encrypted storage.", [
      "Open the project settings and enable encrypted storage.",
      "",
      "```bash",
      "defaults write demo encrypted -bool true",
      "```",
      "",
      "*Command shows enabling the setting*",
      "",
      '<img src="assets/step.png" width="400" alt="Settings">',
      "",
      "Next, restart the app.",
    ]),
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /\[caption\.code_block\].*'\*Command shows enabling the setting\*'/);
  assert.match(result.stdout, /\[caption\.screenshot\].*'Next, restart the app\.'/);
});

test("notes must be written as '> Note:' block quotes", () => {
  const result = validate({
    "ios-platform-feature-01.md": replace(FEATURE, "Open the project settings and enable encrypted storage.", [
      "Open the project settings and enable encrypted storage.",
      "",
      "> Note: Restart the app afterwards.",
      "> The setting is read at launch.",
      "",
      "**Note:** Back up the device first.",
      "",
      "> Tip: Use a test device.",
    ]),
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout.match(/\[note\.format\]/g).length, 2);
  assert.match(result.stdout, /found '\*\*Note:\*\* Back up the device first\.'/);
  assert.match(result.stdout, /found '> Tip: Use a test device\.'/);
});

test("feature playbooks must end with the related risks list", () => {
  const result = validate({
    "ios-platform-feature-01.md": [
      ...replace(FEATURE, "- [ios-platform-feature-01-risk-01](ios-platform-feature-01-risk-01.md)", "- [ios-platform-feature-02-risk-01](ios-platform-feature-02-risk-01.md)"),
      "",
      "Trailing text.",
    ],
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /\[feature\.related_risks_link_match\] The risk 'ios-platform-feature-02-risk-01' does not belong to 'ios-platform-feature-01'/);
  assert.equal(result.stdout.match(/\[feature\.extra_content\]/g).length, 1);
  assert.match(result.stdout, /\[feature\.extra_content\].*'Trailing text\.'/);
});

test("risk playbooks accept a trailing 'References:' list after the controls", () => {
  const result = validate({
    "ios-platform-feature-01-risk-01.md": [...RISK, "", "References:", "", "- https://mas.owasp.org/MASTG/techniques/ios/MASTG-TECH-0053/"],
  });

  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /risk\.references_list/);
});

test("risk control list introduction must name this risk", () => {
  const result = validate({ "ios-platform-feature-01-risk-01.md": replace(RISK, "Feature-01-Risk-01 control measures:", "Feature-01-Risk-02 control measures:") });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /\[risk\.controls_intro_id\]/);
});

test("controls must use '### References', not 'References:'", () => {
  const result = validate({
    "ios-platform-feature-01-risk-01-control-01.md": replace(CONTROL, "### References", "References:"),
    "control-examples/ios-platform-feature-01-risk-01-control-01.zip": "zip",
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /\[control\.references_heading\] The references section must use the heading '### References', but the review found 'References:'/);
});

test("controls must link an existing source archive named after the control", () => {
  const missing = validate({ "ios-platform-feature-01-risk-01-control-01.md": CONTROL });
  const misnamed = validate({
    "ios-platform-feature-01-risk-01-control-01.md": CONTROL.map((line) => line.replace("control-01.zip", "control-02.zip")),
    "control-examples/ios-platform-feature-01-risk-01-control-02.zip": "zip",
  });

  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /\[control\.source_archive_exists\]/);
  assert.equal(misnamed.status, 1);
  assert.match(misnamed.stdout, /\[control\.source_archive_name\]/);
});

test("controls need a references list before the source code line", () => {
  const result = validate({
    "ios-platform-feature-01-risk-01-control-01.md": CONTROL.filter((line) => !line.startsWith("- https://")),
    "control-examples/ios-platform-feature-01-risk-01-control-01.zip": "zip",
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /\[control\.references_list\]/);
});

test("playbooks still in the old sentence template get a single layout failure", () => {
  const result = validate({
    "ios-platform-feature-01-risk-01-control-01.md": [
      "## ios-platform-feature-01-risk-01-control-01",
      "",
      "Your app can prevent the risk of an attacker extracting secrets by taking the following steps:",
      "",
      "1. Detect suspicious access patterns in secure storage calls.",
      "",
      "### References",
      "",
      "The IPA with the implemented control can be found [here](https://example.com/control.ipa).",
    ],
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout.match(/::error/g).length, 1);
  assert.match(result.stdout, /\[structure\.layout\]/);
});

test("a stray fence after a code block is reported without hiding later content", () => {
  const result = validate({
    "ios-platform-feature-01-risk-01-control-01.md": replace(CONTROL, "*Code block shows storing a token in the Keychain*", [
      "```",
      "",
      "*Code block shows storing a token in the Keychain*",
      "",
      "#### 02. Read the token back",
      "",
      "Read the token with `SecItemCopyMatching` when it is needed.",
      "",
      "``` swift",
      "SecItemCopyMatching(query as CFDictionary, &item)",
      "```",
      "",
      "*Code block shows reading the token from the Keychain*",
    ]),
    "control-examples/ios-platform-feature-01-risk-01-control-01.zip": "zip",
  });

  const strayLine = CONTROL.indexOf("*Code block shows storing a token in the Keychain*") + 1;
  assert.equal(result.status, 1);
  assert.match(result.stdout, new RegExp(`line=${strayLine},.*\\[code\\.stray_fence\\]`));
  assert.equal(result.stdout.match(/::error/g).length, 1, result.stdout);
  assert.match(result.stdout, /Step 02 heading passed/);
});

test("an unclosed fence is reported", () => {
  const result = validate({
    "ios-platform-feature-01-risk-01-control-01.md": CONTROL.filter((line, index) => !(line === "```" && CONTROL[index - 1].startsWith("SecItemAdd"))),
    "control-examples/ios-platform-feature-01-risk-01-control-01.zip": "zip",
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /\[code\.unclosed_fence\]/);
});

test("format checks ignore fenced Markdown code blocks", () => {
  const result = validate({
    "ios-platform-feature-01.md": replace(FEATURE, "Open the project settings and enable encrypted storage.", [
      "Open the project settings and enable encrypted storage.",
      "",
      "```md",
      "{feature_name}",
      "- [broken](missing.md)",
      "| Bad | Table |",
      "#### 03. This heading inside a code block should be ignored",
      "```",
      "",
      "*Code block shows template text that must not be validated*",
    ]),
    "ios-platform-feature-01-risk-01.md": RISK,
  });

  assert.equal(result.status, 0, result.stdout);
  assert.doesNotMatch(result.stdout, /placeholder\./);
  assert.doesNotMatch(result.stdout, /missing\.md/);
  assert.doesNotMatch(result.stdout, /table\.markdown_/);
  assert.doesNotMatch(result.stdout, /Step 03 heading/);
});

test("hygiene checks still apply", () => {
  const result = validate({
    "ios-platform-feature-01.md": replace(FEATURE, "Open the project settings and enable encrypted storage.", [
      "Open the project settings and enable encrypted storage. ",
      "",
      "| Setting | Value |",
      "| Encrypted | Yes |",
    ]),
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /whitespace\.trailing/);
  assert.match(result.stdout, /table\.separator/);
});

// Writes the given files into a temporary playbooks directory and validates
// every Markdown file in it.
function validate(files) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ios-playbook-validator-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      const filePath = path.join(tempRoot, name);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, Array.isArray(content) ? `${content.join("\n")}\n` : content, "utf8");
    }
    return runValidator(Object.keys(files).filter((name) => name.endsWith(".md")).map((name) => path.join(tempRoot, name)));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function replace(lines, target, replacement) {
  const index = lines.indexOf(target);
  assert.notEqual(index, -1, `fixture line not found: ${target}`);
  return [...lines.slice(0, index), ...[replacement].flat(), ...lines.slice(index + 1)];
}

function runValidator(filePaths) {
  return spawnSync(process.execPath, [scriptPath, "--stdin"], {
    cwd: repoRoot,
    input: `${filePaths.join("\n")}\n`,
    encoding: "utf8",
  });
}
