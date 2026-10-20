import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const useStdin = args.includes("--stdin");

// Main review flow:
// 1. Gather the list of playbook files to examine.
// 2. Apply both general quality checks and type-specific structure checks.
// 3. Publish GitHub notices for passes and GitHub errors for failures.
//
// This script currently has three review outcomes:
// - Pass: reported as a plain console log line with a "[PASS]" prefix.
// - Warn: reported as a GitHub warning and a console "WARN" line.
// - Fail: reported as a GitHub error and a console "FAIL" line.
async function main() {
  const filePaths = useStdin ? await readPathsFromStdin() : walkMarkdownFiles("playbooks");

  if (filePaths.length === 0) {
    console.log("No playbook Markdown files were provided for review, so there is nothing to validate in this run.");
    return;
  }

  const diagnostics = [];
  const warnings = [];
  const passLogs = [];

  // Each file is reviewed independently so the workflow can report all known
  // issues across the submission, not just the first failing file.
  for (const filePath of filePaths) {
    if (!filePath.endsWith(".md")) {
      continue;
    }

    // Missing files are treated as a failure because the workflow was asked to
    // review a document that is no longer present in the repository snapshot.
    if (!fs.existsSync(filePath)) {
      diagnostics.push(
        makeDiagnostic(
          filePath,
          1,
          "file.exists",
          "This review expected to examine this changed file, but the file is not present in the current repository snapshot.",
          "Restore the file to the repository, or update the pull request so this file is no longer included in the review."
        )
      );
      continue;
    }

    const result = validateFile(filePath);
    diagnostics.push(...result.diagnostics);
    warnings.push(...result.warnings);
    passLogs.push(...result.passLogs);
  }

  // Passing checks are kept as plain logs so the workflow output remains
  // readable without turning successful checks into GitHub annotations.
  for (const passLog of passLogs) {
    console.log(`[PASS] ${passLog.message}`);
  }

  for (const warning of warnings) {
    emitGitHubWarning(warning);
  }

  if (diagnostics.length === 0) {
    console.log(
      `The review completed successfully. ${filePaths.length} playbook file(s) were examined, ${warnings.length} warning(s) were reported, and no blocking issues were found.`
    );
    return;
  }

  for (const diagnostic of diagnostics) {
    emitGitHubError(diagnostic);
  }

  console.error(`The playbook review found ${diagnostics.length} blocking issue(s). Please address the items above before this submission moves forward.`);
  process.exitCode = 1;
}

function validateFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const scan = splitMarkdownLinesIgnoringCodeBlocks(raw);
  const lines = scan.lines;
  const diagnostics = [];
  const warnings = [];
  const passLogs = [];

  // These are broad hygiene checks that apply to every playbook, regardless of
  // whether the file represents a feature, a risk, or a control.
  //
  // Any issue returned here is a failure because it means the document is not
  // yet ready for a clean, publishable review state.
  diagnostics.push(...checkTrailingWhitespace(filePath, lines, passLogs));
  diagnostics.push(...checkUnreplacedPlaceholders(filePath, lines, passLogs));
  warnings.push(...checkInternalLinks(filePath, lines, passLogs));
  diagnostics.push(...checkTables(filePath, lines, passLogs));
  diagnostics.push(...checkCodeFences(filePath, scan.fenceIssues, passLogs));
  diagnostics.push(...checkCaptionsAndNotes(filePath, lines, scan.codeBlocks, passLogs));
  diagnostics.push(...validateStructure(filePath, lines, passLogs));

  return { diagnostics, warnings, passLogs };
}

function validateStructure(filePath, lines, passLogs) {
  // Structure checks ignore empty lines so that authors may space sections for
  // readability without affecting the required sequence of meaningful content.
  const items = lines
    .map((text, index) => ({ raw: text, text: text.trim(), line: index + 1 }))
    .filter((item) => item.text.length > 0);

  if (items.length === 0) {
    return [
      makeDiagnostic(
        filePath,
        1,
        "file.not_empty",
        "This playbook file is empty, so the review cannot confirm the required public content.",
        "Add the required headings and content for a feature, risk, or control playbook before resubmitting this document for review."
      ),
    ];
  }

  const basename = path.basename(filePath, ".md");
  const classification = inferTypeFromFilename(basename);

  // The filename is the gateway to the correct rule set.
  // If the naming pattern is unclear, the validator stops with a failure
  // rather than guessing which public template the author intended to use.
  if (!classification) {
    return [
      makeDiagnostic(
        filePath,
        1,
        "filename.scheme",
        `The filename '${basename}.md' does not follow an approved playbook naming pattern, so the validator cannot determine which public template to apply.`,
        "Rename the file to one of the approved patterns: 'ios-platform-feature-01.md', 'ios-platform-feature-01-<Tool>.md', 'ios-platform-feature-01-risk-01.md', or 'ios-platform-feature-01-risk-01-control-01.md'. Each numbered placeholder must use two digits from 01 to 99."
      ),
    ];
  }

  const { type, id } = classification;
  passLogs.push(makePassLog(filePath, 1, `The filename follows the approved '${type}' playbook pattern.`));

  // Every playbook type shares the same opening: an identifier heading, a
  // one-line title, a description, and a demonstration made of numbered
  // '#### NN.' steps. Only the closing section differs per type.
  const state = createParser(filePath, items, passLogs);

  // A document with neither a demonstration nor any step is still in the
  // earlier sentence-template layout; one failure says more than a cascade.
  if (!items.some((item) => item.text === "### Demonstration" || /^#### /.test(item.text))) {
    state.error(
      items[0].line,
      "structure.layout",
      "This playbook does not use the required layout: it has no '### Demonstration' section and no '#### NN.' steps.",
      "Restructure the document as '## <id>', '### Title', '### Description' and '### Demonstration' with '#### 01. <Heading>' steps, followed by the closing section for its type."
    );
    return state.diagnostics;
  }

  checkHeadingInventory(state, items, type);
  validateCommonSections(state, type, id);

  if (type === "feature") {
    validateFeatureEnding(state, id);
  } else if (type === "risk") {
    validateRiskEnding(state, id);
  } else {
    validateControlEnding(state, filePath, id);
  }

  return state.diagnostics;
}

// A paragraph is prose: not a heading, image, caption, list item, note,
// table row, or (blanked) code line.
const PARAGRAPH_PATTERN = /^(?!#|<img\b|!\[|\*[^*\s]|[-*+] |\d+\. |>|\|)\S/;

// The step terminators mark where the last demonstration step ends and the
// closing section of each playbook type begins.
const STEP_TERMINATORS = {
  feature: /^Because .+, your app is at risk of:$/,
  risk: /^Feature-\d{2}-Risk-\d{2} control measures:$/,
  control: /^(### References|References:)$/,
};

function checkHeadingInventory(state, items, type) {
  // Only the agreed headings may appear. Steps use '####'; any other heading
  // level, or an extra '##' / '###' section, breaks the shared layout.
  const allowedSections = new Set(["### Title", "### Description", "### Demonstration"]);
  if (type === "control") {
    allowedSections.add("### References");
  }

  const seen = new Set();
  for (const item of items) {
    if (!/^#{1,6}(\s|$)/.test(item.text) || /^#### /.test(item.text) || /^## /.test(item.text)) {
      continue;
    }

    if (!allowedSections.has(item.text)) {
      state.error(
        item.line,
        "structure.heading",
        `The heading '${item.text}' is not part of the approved ${type} playbook layout.`,
        `Use only '## <id>', ${[...allowedSections].map((heading) => `'${heading}'`).join(", ")} and '#### NN. <Heading>' step headings.`
      );
      continue;
    }

    if (seen.has(item.text)) {
      state.error(item.line, "structure.heading_duplicate", `The heading '${item.text}' appears more than once in this document.`, "Merge the duplicate sections so each required heading appears exactly once.");
    }
    seen.add(item.text);
  }
}

function validateCommonSections(state, type, id) {
  const heading = state.expect(
    /^## (ios-platform-feature-\d{2}(?:-risk-\d{2}(?:-control-\d{2})?)?)$/,
    `${type}.heading`,
    `The top heading must be written exactly as '## ${id}'.`
  );

  const headingSlug = heading?.match[1] ?? null;
  if (headingSlug && headingSlug !== id) {
    state.error(
      heading.line,
      "heading.filename_match",
      `The top heading identifies this file as '${headingSlug}', but the filename identifies it as '${id}'. These two identifiers must match so the document can be reviewed consistently.`,
      `Rename the file to match '${headingSlug}', or change the heading to '## ${id}' so the heading and filename agree.`
    );
  }
  if (headingSlug === id) {
    state.pass(heading.line, `The top heading matches the filename identifier '${headingSlug}'.`);
  }

  // The title is a single line so it can be reused as a link label.
  if (state.section("### Title", `${type}.title_heading`)) {
    const title = state.expectContent(/^(?!#).+$/, `${type}.title_line`, "The '### Title' heading must be followed by a single line naming the playbook.");
    if (title && state.current() && !state.current().text.startsWith("#")) {
      state.error(
        state.current().line,
        `${type}.title_line`,
        `The title must be a single line, but the review found '${state.current().text}' after it instead of '### Description'.`,
        "Shorten the title to one line and move any explanation into the description."
      );
      while (state.current() && !state.current().text.startsWith("#")) {
        state.index += 1;
      }
    }
  }

  if (state.section("### Description", `${type}.description_heading`)) {
    state.expectParagraph(`${type}.description_paragraph`, "The '### Description' heading must be followed by a paragraph describing the playbook.");
    // Further paragraphs and notes may follow the opening paragraph.
    while (state.current() && !state.current().text.startsWith("#")) {
      state.index += 1;
    }
  }

  if (state.section("### Demonstration", `${type}.demonstration_heading`)) {
    state.expectSteps(`${type}.steps`, STEP_TERMINATORS[type]);
  }
}

function validateFeatureEnding(state, id) {
  const intro = state.section(
    STEP_TERMINATORS.feature,
    "feature.related_risks_intro",
    "After the last step, the related risks introduction must be written as 'Because <reason>, your app is at risk of:'."
  );
  if (!intro) {
    return;
  }

  state.expectBulletList(
    /^- \[(ios-platform-feature-\d{2}-risk-\d{2})\]\((ios-platform-feature-\d{2}-risk-\d{2}\.md)\)$/,
    "feature.related_risks_list",
    "Each related risk entry must follow the approved format '- [ios-platform-feature-01-risk-01](ios-platform-feature-01-risk-01.md)'.",
    ({ item, match, parser }) => checkLinkedId(parser, item, match, id, "feature.related_risks_link_match", "risk")
  );
  state.expectEnd("feature.extra_content", "The related risks list must be the last content in a feature playbook.");
}

function validateRiskEnding(state, id) {
  const [, featureNumber, riskNumber] = id.match(/^ios-platform-feature-(\d{2})-risk-(\d{2})$/);
  const expectedIntro = `Feature-${featureNumber}-Risk-${riskNumber} control measures:`;
  const intro = state.section(
    STEP_TERMINATORS.risk,
    "risk.controls_intro",
    `After the last step, the control list introduction must be written exactly as '${expectedIntro}'.`
  );
  if (!intro) {
    return;
  }
  if (intro.text !== expectedIntro) {
    state.error(intro.line, "risk.controls_intro_id", `The control list introduction reads '${intro.text}', but this risk is '${id}'.`, `Rewrite the line as '${expectedIntro}'.`);
  }

  state.expectBulletList(
    /^- \[(ios-platform-feature-\d{2}-risk-\d{2}-control-\d{2})\]\((ios-platform-feature-\d{2}-risk-\d{2}-control-\d{2}\.md)\)$/,
    "risk.controls_list",
    "Each control entry must follow the approved format '- [ios-platform-feature-01-risk-01-control-01](ios-platform-feature-01-risk-01-control-01.md)'.",
    ({ item, match, parser }) => checkLinkedId(parser, item, match, id, "risk.controls_link_match", "control")
  );

  // Risk playbooks may close with the external references the demonstration
  // relies on, such as MASTG techniques or MITRE ATT&CK tactics.
  if (state.current()?.text === "References:") {
    state.index += 1;
    state.expectBulletList(/^- .*https?:\/\/\S+/, "risk.references_list", "Each reference entry must be a bullet containing a URL.");
  }
  state.expectEnd("risk.extra_content", "The control list, optionally followed by 'References:' and a list of URLs, must be the last content in a risk playbook.");
}

function validateControlEnding(state, filePath, id) {
  const heading = state.section(STEP_TERMINATORS.control, "control.references_heading", "After the last step, the next required section heading is '### References'.");
  if (!heading) {
    return;
  }
  if (heading.text === "References:") {
    state.error(
      heading.line,
      "control.references_heading",
      "The references section must use the heading '### References', but the review found 'References:' instead.",
      `Replace line ${heading.line} with '### References'.`
    );
  }

  state.expectBulletList(/^- .*https?:\/\/\S+/, "control.references_list", "Each reference entry must be a bullet containing a URL.");

  const source = state.expect(
    /^The source code with the implemented control can be found \[here\]\(control-examples\/([^)\s]+)\.zip\)\.$/,
    "control.source_reference",
    `The final line must be written exactly as 'The source code with the implemented control can be found [here](control-examples/${id}.zip).'.`
  );
  if (source) {
    const archive = source.match[1];
    const archivePath = path.join(path.dirname(filePath), "control-examples", `${archive}.zip`);
    if (archive !== id) {
      state.error(source.line, "control.source_archive_name", `The source code link points to '${archive}.zip', but this control is '${id}'.`, `Link to 'control-examples/${id}.zip' instead.`);
    } else if (!fs.existsSync(archivePath)) {
      state.error(source.line, "control.source_archive_exists", `The source code archive 'control-examples/${archive}.zip' does not exist next to this playbook.`, `Add the archive at '${path.relative(process.cwd(), archivePath)}'.`);
    } else {
      state.pass(source.line, `The source code archive 'control-examples/${archive}.zip' exists and matches the control identifier.`);
    }
  }
  state.expectEnd("control.extra_content", "The source code line must be the last content in a control playbook.");
}

function checkLinkedId(parser, item, match, parentId, rule, childType) {
  const linkedId = match[1];
  const linkedFile = match[2];
  const expectedFile = `${linkedId}.md`;

  if (linkedFile !== expectedFile) {
    parser.error(
      item.line,
      rule,
      `The entry labels this ${childType} as '${linkedId}', but links to '${linkedFile}'. The link target must match the ${childType} identifier exactly.`,
      `Rewrite the link as '- [${linkedId}](${expectedFile})'.`
    );
    return false;
  }

  if (!linkedId.startsWith(`${parentId}-`)) {
    parser.error(item.line, rule, `The ${childType} '${linkedId}' does not belong to '${parentId}'.`, `Link only to ${childType} playbooks whose identifier starts with '${parentId}-'.`);
    return false;
  }

  return true;
}

function createParser(filePath, items, passLogs) {
  return {
    diagnostics: [],
    index: 0,
    pass(line, message) {
      passLogs.push(makePassLog(filePath, line, message));
    },
    error(line, rule, message, howToFix) {
      this.diagnostics.push(makeDiagnostic(filePath, line, rule, message, howToFix));
    },
    current() {
      return items[this.index];
    },
    // Generic sequential matcher:
    // - Pass: advances to the next meaningful line and records a notice.
    // - Fail: records a blocking diagnostic with a suggested repair.
    //
    // This pattern keeps new rule authoring scalable because most future
    // structure checks can be expressed as "expect this next line to match."
    expect(pattern, rule, message) {
      const item = this.current();
      if (!item) {
        this.error(items.at(-1)?.line ?? 1, rule, `${message} The document ends before that required line appears.`, "Add the missing line in the required position so the document can continue through review.");
        return null;
      }

      const match = item.text.match(pattern);
      if (!match) {
        this.error(item.line, rule, `${message} The review found '${item.text}' on this line instead.`, `Replace line ${item.line} with the required template text so the document matches the approved format.`);
        this.index += 1;
        return null;
      }

      this.index += 1;
      this.pass(item.line, `The required check '${rule}' passed at this line.`);
      return { ...item, match };
    },
    // Look-ahead matcher:
    // - Pass: scans forward until a matching meaningful line is found.
    // - Fail: records a blocking diagnostic if the required line never appears.
    //
    // This is used for cases where supporting content may appear between two
    // required sections, but the required line must still appear later in the
    // document.
    find(pattern, rule, message) {
      for (let offset = this.index; offset < items.length; offset += 1) {
        const item = items[offset];
        const match = item.text.match(pattern);
        if (match) {
          this.index = offset + 1;
          this.pass(item.line, `The required check '${rule}' passed at this line.`);
          return { ...item, match };
        }
      }

      this.error(
        items.at(-1)?.line ?? 1,
        rule,
        `${message} The document ends before that required line appears.`,
        "Add the missing line in the required position so the document matches the approved format."
      );
      return null;
    },
    expectText(text, rule, message) {
      return this.expect(new RegExp(`^${escapeRegex(text)}$`), rule, message);
    },
    // Section matcher:
    // - Pass: the required line is next, or appears later after content that
    //   does not belong there (which is reported, then skipped).
    // - Fail: the required line never appears; the position does not move so
    //   later sections can still be checked.
    section(pattern, rule, message) {
      const regex = typeof pattern === "string" ? new RegExp(`^${escapeRegex(pattern)}$`) : pattern;
      const item = this.current();
      const found = this.find(regex, rule, message ?? `The next required section heading is '${pattern}'.`);
      if (found && item && found.line !== item.line) {
        this.error(
          item.line,
          rule,
          `${message ?? `The next required section heading is '${pattern}'.`} The review found '${item.text}' before it, which is not part of the approved layout.`,
          `Remove the content between line ${item.line} and line ${found.line}, or move it into the section where it belongs.`
        );
      }
      return found;
    },
    // Like expect(), but a mismatch does not consume the line, so a missing
    // paragraph does not swallow the heading that follows it.
    expectContent(pattern, rule, message) {
      const item = this.current();
      if (item && pattern.test(item.text)) {
        return this.expect(pattern, rule, message);
      }

      this.error(
        item?.line ?? items.at(-1)?.line ?? 1,
        rule,
        item ? `${message} The review found '${item.text}' instead.` : `${message} The document ends before that content appears.`,
        "Add the missing content in this position."
      );
      return null;
    },
    expectParagraph(rule, message) {
      return this.expectContent(PARAGRAPH_PATTERN, rule, message);
    },
    // Demonstration step check:
    // - Pass: '#### NN. <Heading>' steps numbered 01, 02, ... in order, each
    //   with at least one paragraph of body text.
    // - Fail: a malformed heading, a gap or repeat in the numbering, or a step
    //   that only contains images, code, captions, lists or notes.
    //
    // A step body runs until the next heading or the terminator line that opens
    // the closing section of the playbook.
    expectSteps(rule, terminator) {
      const isBoundary = (item) => /^#{1,4}(\s|$)/.test(item.text) || terminator.test(item.text);
      const skipBody = () => {
        let paragraphs = 0;
        while (this.current() && !isBoundary(this.current())) {
          if (PARAGRAPH_PATTERN.test(this.current().text)) {
            paragraphs += 1;
          }
          this.index += 1;
        }
        return paragraphs;
      };

      const start = this.current();
      if (!start || !/^####(\s|$)/.test(start.text)) {
        this.error(
          start?.line ?? items.at(-1)?.line ?? 1,
          rule,
          start
            ? `The demonstration must start with the step heading '#### 01. <Heading>', but the review found '${start.text}' instead.`
            : "The demonstration must contain at least one step headed '#### 01. <Heading>', but the document ends first.",
          "Break the demonstration into steps headed '#### 01. <Heading>', '#### 02. <Heading>', and so on."
        );
        skipBody();
        return 0;
      }

      // After a gap the count follows the author's number, so one missing
      // step is reported once rather than on every later step.
      let count = 0;
      while (this.current() && /^####(\s|$)/.test(this.current().text)) {
        const heading = this.current();
        const expected = String(count + 1).padStart(2, "0");
        const match = heading.text.match(/^#### (\d{2})\. (\S.*)$/);
        this.index += 1;
        count = match ? Number(match[1]) : count + 1;

        if (!match) {
          this.error(heading.line, rule, `Step headings must be written as '#### ${expected}. <Heading>', but the review found '${heading.text}'.`, `Rewrite line ${heading.line} as '#### ${expected}. <Heading>'.`);
        } else if (match[1] !== expected) {
          this.error(
            heading.line,
            rule,
            `This step is numbered '${match[1]}', but step '${expected}' was expected. Steps must be numbered 01, 02, 03, ... in order with no gaps or repeats.`,
            `Renumber this step heading as '#### ${expected}. ${match[2]}'.`
          );
        } else {
          this.pass(heading.line, `Step ${expected} heading passed the '${rule}' review check.`);
        }

        if (skipBody() === 0) {
          this.error(
            heading.line,
            `${rule}_body`,
            `Step '${heading.text}' has no paragraph of body text explaining what to do.`,
            "Add at least one sentence under the step heading that explains the action and why it is taken."
          );
        }
      }

      return count;
    },
    expectBulletList(itemPattern, rule, message, validateItem = null) {
      const start = this.current();
      if (!start || !/^- /.test(start.text)) {
        this.error(
          start?.line ?? items.at(-1)?.line ?? 1,
          rule,
          `${message} A bullet list item was required at this point, but none was found.`,
          "Add at least one bullet item that follows the required template."
        );
        return null;
      }

      let count = 0;
      while (this.current() && /^- /.test(this.current().text)) {
        const item = this.current();
        const match = item.text.match(itemPattern);
        if (!match) {
          this.error(
            item.line,
            rule,
            `${message} The review found '${item.text}' on this line instead.`,
            `Rewrite line ${item.line} so it follows the required bullet-list format.`
          );
          this.skipBullets();
          return null;
        }

        if (validateItem) {
          const isValid = validateItem({ item, match, parser: this });
          if (!isValid) {
            this.skipBullets();
            return null;
          }
        }

        count += 1;
        this.pass(item.line, `Bullet list item ${count} passed the '${rule}' review check.`);
        this.index += 1;
      }

      return true;
    },
    // Moves past the rest of a bullet list after a failure so the list is not
    // reported again as unexpected content.
    skipBullets() {
      while (this.current() && /^- /.test(this.current().text)) {
        this.index += 1;
      }
    },
    // End-of-document guard:
    // - Pass implicitly when no extra content remains.
    // - Fail when unexpected material appears after the final required section.
    expectEnd(rule, message) {
      if (this.current()) {
        this.error(
          this.current().line,
          rule,
          `${message} The review found additional content here: '${this.current().text}'.`,
          "Remove the extra content that appears after the final required section."
        );
      }
    },
  };
}

function inferTypeFromFilename(basename) {
  // Filename classification is strict because the filename determines which
  // public template will be enforced next. The returned id is the identifier
  // the top heading must repeat.
  const number = "(?:0[1-9]|[1-9][0-9])";
  if (new RegExp(`^ios-platform-feature-${number}-risk-${number}-control-${number}$`).test(basename)) {
    return { type: "control", id: basename };
  }

  if (new RegExp(`^ios-platform-feature-${number}-risk-${number}$`).test(basename)) {
    return { type: "risk", id: basename };
  }

  // A feature may have tool-specific variants, such as
  // 'ios-platform-feature-01-iMazing.md', which share the feature identifier.
  const feature = basename.match(new RegExp(`^(ios-platform-feature-${number})(?:-(?!risk$|control$)[A-Za-z][A-Za-z0-9_]*)?$`));
  if (feature) {
    return { type: "feature", id: feature[1] };
  }

  return null;
}

function checkTrailingWhitespace(filePath, lines, passLogs) {
  const diagnostics = [];
  let foundIssue = false;

  // Trailing whitespace is a fail-only hygiene check.
  // It does not change the meaning of the content, but it does reduce
  // consistency and creates avoidable noise in reviews and diffs.
  for (const [index, line] of lines.entries()) {
    if (/[ \t]+$/.test(line)) {
      foundIssue = true;
      diagnostics.push(
        makeDiagnostic(
          filePath,
          index + 1,
          "whitespace.trailing",
          `This line ends with trailing whitespace, which is not allowed in the reviewed document. The line appears as '${visualizeWhitespace(line)}'.`,
          "Remove the spaces or tabs at the end of this line."
        )
      );
    }
  }

  if (!foundIssue) {
    passLogs.push(makePassLog(filePath, 1, "No trailing whitespace was found in this document."));
  }

  return diagnostics;
}

function checkUnreplacedPlaceholders(filePath, lines, passLogs) {
  const diagnostics = [];
  let foundIssue = false;

  // Placeholder checks protect against unfinished template content reaching a
  // public review. Any remaining placeholder or stray brace is a failure.
  for (const [index, line] of lines.entries()) {
    const placeholder = line.match(/\{[^}]*\}/);
    if (placeholder) {
      foundIssue = true;
      diagnostics.push(
        makeDiagnostic(
          filePath,
          index + 1,
          "placeholder.unreplaced",
          `This line still contains the placeholder '${placeholder[0]}', which indicates that template text was not replaced with final content. The affected line is '${line.trim()}'.`,
          "Replace the placeholder with the final playbook content intended for public review."
        )
      );
      continue;
    }

    if (/[{}]/.test(line)) {
      foundIssue = true;
      diagnostics.push(
        makeDiagnostic(
          filePath,
          index + 1,
          "placeholder.braces",
          `This line contains an unexpected brace character, which may indicate leftover template content. The affected line is '${line.trim()}'.`,
          "Remove the '{' or '}' character, or replace the remaining template text with final content."
        )
      );
    }
  }

  if (!foundIssue) {
    passLogs.push(makePassLog(filePath, 1, "No unreplaced placeholders or stray template braces were found."));
  }

  return diagnostics;
}

function checkInternalLinks(filePath, lines, passLogs) {
  const warnings = [];
  const directory = path.dirname(filePath);
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
  let linkCount = 0;

  // Internal link checks confirm that local repository references still point
  // to real files. External links and in-page anchors are excluded because
  // this validator is focused on repository integrity.
  for (const [index, line] of lines.entries()) {
    for (const match of line.matchAll(linkPattern)) {
      const rawTarget = match[1].trim();
      const target = rawTarget.startsWith("<") && rawTarget.endsWith(">") ? rawTarget.slice(1, -1) : rawTarget;

      if (target.startsWith("http://") || target.startsWith("https://") || target.startsWith("mailto:") || target.startsWith("#")) {
        continue;
      }

      const [relativePath] = target.split("#");
      const resolvedPath = path.resolve(directory, relativePath);

      if (!fs.existsSync(resolvedPath)) {
        warnings.push(
          makeWarning(
            filePath,
            index + 1,
            "link.internal_exists",
            `This internal repository link points to '${relativePath}', but that file does not exist from the perspective of this document. The affected line is '${line.trim()}'.`,
            "Correct the relative path, or add the missing file so the link can be reviewed successfully."
          )
        );
        continue;
      }

      linkCount += 1;
      passLogs.push(makePassLog(filePath, index + 1, `The internal repository link target '${relativePath}' exists and can be resolved from this document.`));
    }
  }

  if (linkCount === 0) {
    passLogs.push(makePassLog(filePath, 1, "No internal repository links were found in this document, so no local link validation was required."));
  }

  return warnings;
}

function checkTables(filePath, lines, passLogs) {
  const diagnostics = [];
  let index = 0;
  let tableCount = 0;

  // This is the broad Markdown table quality check.
  // It runs independently from the required-structure table check so that:
  // - required configuration tables must appear in the right place, and
  // - any table anywhere in the file must still be well-formed Markdown.
  while (index < lines.length) {
    if (!lines[index].trim().startsWith("|")) {
      index += 1;
      continue;
    }

    const block = [];
    const lineNumber = index + 1;

    while (index < lines.length && lines[index].trim().startsWith("|")) {
      block.push(lines[index].trim());
      index += 1;
    }

    tableCount += 1;

    if (block.length < 2) {
      diagnostics.push(
        makeDiagnostic(
          filePath,
          lineNumber,
          "table.markdown_row_count",
          `The Markdown table starting at line ${lineNumber} must include a header row and a separator row, but only ${block.length} row(s) were found.`,
          "Add the missing header row or separator row so the table is complete."
        )
      );
      continue;
    }

    const widths = block.map(parseTableCells);
    const expectedColumnCount = widths[0].length;

    if (expectedColumnCount < 2) {
      diagnostics.push(
        makeDiagnostic(
          filePath,
          lineNumber,
          "table.markdown_column_count",
          `The Markdown table starting at line ${lineNumber} has only ${expectedColumnCount} column(s), but at least 2 columns are required for review.`,
          "Add enough pipe-separated columns for the table to contain at least two columns."
        )
      );
      continue;
    }

    const separatorCells = widths[1];
    if (separatorCells.length !== expectedColumnCount || separatorCells.some((cell) => !/^:?-{3,}:?$/.test(cell))) {
      diagnostics.push(
        makeDiagnostic(
          filePath,
          lineNumber + 1,
          "table.separator",
          `The table separator row at line ${lineNumber + 1} is not valid Markdown table syntax. The review found '${block[1]}' instead.`,
          "Use a separator row such as '| -------- | ------- |' so the table is recognized correctly."
        )
      );
    } else {
      passLogs.push(makePassLog(filePath, lineNumber + 1, `Markdown table ${tableCount} includes a valid separator row.`));
    }

    for (let offset = 0; offset < widths.length; offset += 1) {
      if (widths[offset].length !== expectedColumnCount) {
        diagnostics.push(
          makeDiagnostic(
            filePath,
            lineNumber + offset,
            "table.column_alignment",
            `The table row at line ${lineNumber + offset} has ${widths[offset].length} column(s), but the header row establishes ${expectedColumnCount} column(s). The review found '${block[offset]}' on this line.`,
            "Adjust this row so it uses the same number of columns as the table header."
          )
        );
      }
    }
  }

  if (tableCount === 0) {
    passLogs.push(makePassLog(filePath, 1, "No additional Markdown tables were found outside the required structure checks."));
  }

  return diagnostics;
}

function checkCodeFences(filePath, fenceIssues, passLogs) {
  // A stray or unclosed fence flips everything after it between prose and
  // code, which hides content from every other check.
  if (fenceIssues.length === 0) {
    passLogs.push(makePassLog(filePath, 1, "Every code fence in this document is properly opened and closed."));
    return [];
  }

  return fenceIssues.map((issue) =>
    issue.kind === "stray"
      ? makeDiagnostic(
          filePath,
          issue.line,
          "code.stray_fence",
          `This code fence does not belong to a code block: the fence with a language at line ${issue.nextFenceLine} would otherwise be read as the end of a block that started here.`,
          `Remove the stray fence at line ${issue.line}.`
        )
      : makeDiagnostic(
          filePath,
          issue.line,
          "code.unclosed_fence",
          "This code fence opens a code block that is never closed, so the rest of the document would be read as code.",
          "Add a closing fence after the code block, or remove this fence if it is stray."
        )
  );
}

function checkCaptionsAndNotes(filePath, lines, codeBlocks, passLogs) {
  const diagnostics = [];
  const nextContent = (index) => {
    for (let offset = index; offset < lines.length; offset += 1) {
      if (lines[offset].trim()) {
        return { text: lines[offset].trim(), line: offset + 1 };
      }
    }
    return null;
  };

  // Every code block and image is followed by an italic caption so readers
  // know what it shows without running the code or zooming the screenshot.
  // Code block lines are blank here, so back-to-back blocks share a caption.
  for (const block of codeBlocks) {
    const caption = nextContent(block.end);
    if (caption && /^\*Code block shows .+\*$/.test(caption.text)) {
      passLogs.push(makePassLog(filePath, caption.line, "The code block is followed by a 'Code block shows' caption."));
      continue;
    }
    diagnostics.push(
      makeDiagnostic(
        filePath,
        block.start,
        "caption.code_block",
        `The code block starting here must be followed by an italic caption beginning '*Code block shows', but the review found ${caption ? `'${caption.text}'` : "the end of the document"} instead.`,
        "Add a line such as '*Code block shows <what the code does>*' directly after the code block."
      )
    );
  }

  for (const [index, line] of lines.entries()) {
    const text = line.trim();

    if (/^(<img\b|!\[)/.test(text)) {
      const caption = nextContent(index + 1);
      if (caption && /^\*Screenshot shows .+\*$/.test(caption.text)) {
        passLogs.push(makePassLog(filePath, caption.line, "The image is followed by a 'Screenshot shows' caption."));
      } else {
        diagnostics.push(
          makeDiagnostic(
            filePath,
            index + 1,
            "caption.screenshot",
            `This image must be followed by an italic caption beginning '*Screenshot shows', but the review found ${caption ? `'${caption.text}'` : "the end of the document"} instead.`,
            "Add a line such as '*Screenshot shows <what the image shows>*' directly after the image."
          )
        );
      }
      continue;
    }

    // Notes are block quotes that start with 'Note:'. Only the first line of
    // a block quote is checked so a note may continue over several lines.
    const startsQuote = text.startsWith(">") && !(lines[index - 1] ?? "").trim().startsWith(">");
    if ((startsQuote && !/^> Note: \S/.test(text)) || /^(\*\*|_)?Note\b/i.test(text)) {
      diagnostics.push(
        makeDiagnostic(
          filePath,
          index + 1,
          "note.format",
          `Notes must be written as a block quote starting '> Note: ', but the review found '${text}'.`,
          "Rewrite this line as '> Note: <note text>'."
        )
      );
    }
  }

  return diagnostics;
}

function parseTableCells(line) {
  // Table parsing is intentionally simple because the supported playbook tables
  // are expected to be plain Markdown tables without advanced escaping rules.
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function splitMarkdownLinesIgnoringCodeBlocks(raw) {
  const lines = raw.split(/\r?\n/);
  const sanitizedLines = [];
  const codeBlocks = [];
  const fenceIssues = [];
  let open = null;

  // Code block content is blanked so that other checks ignore it, while the
  // block positions are kept for the caption check.
  //
  // Following CommonMark, only a bare fence closes a block; a fence with a
  // language such as '``` swift' can only open one. Seeing such a fence inside
  // a block therefore means the fence that opened the block was stray. The
  // stray fence is reported, the lines it swallowed are restored as prose, and
  // the language fence opens the real block.
  for (const [index, line] of lines.entries()) {
    const fence = line.match(/^\s*(`{3,})\s*(.*)$/);

    if (!open) {
      sanitizedLines.push(fence ? "" : line);
      if (fence) {
        open = { start: index, ticks: fence[1].length };
      }
      continue;
    }

    sanitizedLines.push("");
    if (!fence) {
      continue;
    }

    if (fence[2] === "" && fence[1].length >= open.ticks) {
      codeBlocks.push({ start: open.start + 1, end: index + 1 });
      open = null;
      continue;
    }

    fenceIssues.push({ line: open.start + 1, kind: "stray", nextFenceLine: index + 1 });
    for (let restore = open.start + 1; restore < index; restore += 1) {
      sanitizedLines[restore] = lines[restore];
    }
    open = { start: index, ticks: fence[1].length };
  }

  if (open) {
    fenceIssues.push({ line: open.start + 1, kind: "unclosed" });
    for (let restore = open.start + 1; restore < lines.length; restore += 1) {
      sanitizedLines[restore] = lines[restore];
    }
  }

  return { lines: sanitizedLines, codeBlocks, fenceIssues };
}

function walkMarkdownFiles(rootDirectory) {
  // When stdin is not provided, the validator reviews every Markdown file under
  // the playbooks directory so local full-repository checks remain simple.
  if (!fs.existsSync(rootDirectory)) {
    return [];
  }

  const results = [];
  const entries = fs.readdirSync(rootDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootDirectory, entry.name);

    if (entry.isDirectory()) {
      results.push(...walkMarkdownFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }

  return results;
}

function readPathsFromStdin() {
  // Stdin mode supports pull-request workflows that want to validate only the
  // files changed in a proposal rather than rechecking the entire directory.
  return new Promise((resolve) => {
    let buffer = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      buffer += chunk;
    });
    process.stdin.on("end", () => {
      resolve(
        buffer
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
      );
    });
  });
}

function makeDiagnostic(file, line, rule, message, howToFix = "") {
  // Diagnostics represent blocking failures.
  return { file, line, rule, message, howToFix };
}

function makeWarning(file, line, rule, message, howToFix = "") {
  // Warnings represent advisory issues that should not fail the review.
  return { file, line, rule, message, howToFix };
}

function makePassLog(file, line, message) {
  // Pass logs represent successful checks and are emitted as plain logs.
  return { file, line, message };
}

function emitGitHubError({ file, line, rule, message }) {
  // GitHub error annotations are used for failures because they make the
  // workflow fail and point reviewers directly to the affected line.
  const escapedMessage = escapeWorkflowValue(`[${rule}] ${message}`);
  console.log(`::error file=${file},line=${line},title=Playbook validation::${escapedMessage}`);
}

function emitGitHubWarning({ file, line, rule, message }) {
  // GitHub warnings are used for advisory issues that deserve attention
  // without blocking the document from moving forward.
  const escapedMessage = escapeWorkflowValue(`[${rule}] ${message}`);
  console.log(`::warning file=${file},line=${line},title=Playbook validation::${escapedMessage}`);
}

function escapeWorkflowValue(value) {
  // Workflow annotation values must be escaped so special characters do not
  // corrupt the log output shown in GitHub Actions.
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

function escapeRegex(value) {
  // User-facing literal text is escaped before building regex patterns so the
  // validator treats template text as text, not as regex syntax.
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function visualizeWhitespace(line) {
  // Whitespace is visualized to make invisible formatting problems readable in
  // failure messages.
  return line.replace(/\t/g, "\\t").replace(/ /g, "·");
}

await main();
