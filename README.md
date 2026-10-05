# ios-playbook

iOS mobile application security playbooks documenting platform features, the risks associated with those features, and application controls that address those risks.

Playbook documents live under `playbooks/`. Each feature can have multiple risk entries, and each risk can have multiple control entries.

## Repository structure

```text
playbooks/
├── ios-platform-feature-*.md
├── sample-apps/          # Sample application source projects
├── assets/              # Screenshots and supporting media
├── control-examples/    # Projects demonstrating security controls
└── demo-scripts/        # Scripts used in playbook demonstrations
docs/                   # Repository and authoring documentation
examples/               # Example playbook submissions and templates
scripts/                # Repository validation and review tooling
.github/workflows/      # GitHub Actions review workflows
```

The supporting folders contain sample application source, screenshots, control implementation archives, documentation, examples, and review tooling. `playbooks/demo-scripts/` is currently empty. Root-level `scripts/` contains repository review tools; `playbooks/demo-scripts/` is reserved for demonstration scripts.

## Playbook coverage

The repository currently contains 5 feature entries, 5 risk entries, and 7 control entries covering:

- IPA acquisition via Apple Configurator and iMazing
- HTTP proxy configuration and HTTPS traffic inspection
- Screenshots, screen recording, and screen mirroring
- Third-party custom keyboards

The two IPA acquisition entries describe different retrieval methods for the same platform feature.

## Expected filename patterns

- Feature: `ios-platform-feature-01.md`
- Risk: `ios-platform-feature-01-risk-01.md`
- Control: `ios-platform-feature-01-risk-01-control-01.md`

Use two-digit identifiers, such as `01`, `02`, and `03`, for each feature, risk, and control. Keep the document's top heading consistent with its filename.

The existing IPA retrieval variants use `ios-platform-feature-01-Apple_Configurator.md` and `ios-platform-feature-01-iMazing.md`, with the shared heading `## ios-platform-feature-01`.

## Document format

The common entry layout includes a top-level identifier, a `Title`, a `Description`, and a `Demonstration` with descriptive numbered step headings such as `#### 01. Prepare the environment`. Some control entries still omit one or more of these sections.

Feature entries link to related risks. Risk descriptions include the attacker's goal, and risk entries link to related control measures. Control entries can include references and links to implementation archives.

Use relative paths from the playbook document when linking supporting files, for example `assets/example.png` or `control-examples/example.zip`.

## Review status

The `Review Playbooks` GitHub Actions workflow is configured for pull requests and manual runs. It uses Node.js 24 and reviews Markdown files under `playbooks/`.

The following review phases are implemented:

1. **Format validation:** filename and heading consistency, required sections, internal links, Markdown tables, trailing whitespace, and unreplaced placeholders.
2. **Advisory clarity review:** ambiguous wording, section flow, demonstration steps, and terminology consistency.
3. **Advisory technical fact check:** iOS-specific accuracy, unsupported claims, and missing technical assumptions.
4. **Advisory technical completeness review:** gaps in demonstration sequences and additional context needed to carry out the steps.

Format validation is a blocking check. The GitHub Models review phases provide advisory feedback and run after the format validator passes. Their scripts require a `GITHUB_TOKEN` with access to GitHub Models.

The format validator currently enforces the earlier template illustrated in `examples/pass/`. It does not yet accept all current entry layouts or the tool suffixes used by the IPA retrieval variants.

Run the local reviews from the repository root:

```bash
node scripts/validate-playbooks.mjs
GITHUB_TOKEN=your_token_here node scripts/clarity-playbooks.mjs
GITHUB_TOKEN=your_token_here node scripts/factcheck-playbooks.mjs
GITHUB_TOKEN=your_token_here node scripts/completeness-playbooks.mjs
```

Run the review parser and validator tests:

```bash
node --test scripts/*.test.mjs
```

The technical completeness design notes are in [docs/technical-completeness-phase.md](docs/technical-completeness-phase.md).

## Manual review checklist

1. Check filenames, headings, and related-entry links against the iOS naming convention, including the existing IPA retrieval variants.
2. Confirm that required sections and demonstration steps are complete, including any remaining placeholders.
3. Verify that local links and image paths resolve to files in the repository.
4. Check technical content against cited iOS documentation and the supporting application projects.
5. Confirm that formatting changes preserve the original wording and commands; review content corrections separately.
6. For pull requests that change playbooks, confirm that the format review and the three advisory phases run as expected. Resolve GitHub Models access errors when advisory reviews cannot run.
