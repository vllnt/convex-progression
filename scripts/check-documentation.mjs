// Agent-first documentation contract shared by every @vllnt package.
// `node scripts/check-documentation.mjs` checks the repository (it runs in
// `pnpm lint`); check-pack.mjs runs `checkDocumentation` on the installed
// tarball and type-checks the returned examples against the built package.
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import ts from "typescript";

/** README `##` sections, in this order, in every @vllnt package. */
export const SECTIONS = [
  "For coding agents",
  "When to use",
  "Install",
  "Quick start",
  "API",
  "Common tasks",
  "Errors and fixes",
  "Limits and gotchas",
  "Compatibility",
  "Testing",
  "Security",
  "Related packages",
  "Contributing",
  "Links",
  "License",
];
const FIRST_LINES = 40;
const OSS = "https://oss.vllnt.com";

/**
 * @typedef {{ code: string, lang: string, line: number }} Block
 * @typedef {{ lang: string, line: number, lines: string[] }} OpenBlock
 * @typedef {{ body: string, line: number, name: string }} Section
 * @typedef {{ name: string, target: ts.Symbol }} Export
 * @typedef {{ checker: ts.TypeChecker, entry: string, symbols: Export[] }} Entry
 * @typedef {{ headings: Set<string>, table: string }} Documented
 * @typedef {{ code: string, path: string }} Example
 * @typedef {string | { url?: unknown }} Repository
 * @typedef {{ author?: { url?: unknown }, bugs?: { url?: unknown }, description?: unknown, exports: Record<string, unknown>, files?: unknown, funding?: unknown, homepage?: unknown, keywords?: unknown, license?: unknown, name: string, repository?: Repository }} Metadata
 */

/** @param {string} name package name without the scope */
export const footer = (name) =>
  `---\n\nPart of [vllnt open source](${OSS}) · [Package page](${OSS}/packages/${name}) · [vllnt.com](https://vllnt.com) · Built by [bntvllnt](https://bntvllnt.com)\n`;

/** @param {string} name package name without the scope */
export const ecosystem = (name) =>
  [
    "## Ecosystem\n",
    `- [Package page](${OSS}/packages/${name})`,
    `- [Release feed](${OSS}/packages/${name}/rss.xml)`,
    `- [All @vllnt packages](${OSS}/llms.txt)`,
    "- [Search vllnt packages and docs](https://index.vllnt.com)",
    "- [vllnt](https://vllnt.com/llms.txt)",
    "- [Author](https://bntvllnt.com)\n",
  ].join("\n");

/**
 * Body of the README `## Links` section.
 * @param {string} name package name without the scope
 * @param {string} repository GitHub repository URL without `.git`
 */
export const links = (name, repository) =>
  [
    `- Docs and changelog: [oss.vllnt.com/packages/${name}](${OSS}/packages/${name}) · [release feed](${OSS}/packages/${name}/rss.xml)`,
    `- All @vllnt packages: [oss.vllnt.com](${OSS}) · [search packages and docs on index.vllnt.com](https://index.vllnt.com)`,
    `- Source and issues: [GitHub](${repository}) · [issues](${repository}/issues) · [npm](https://www.npmjs.com/package/@vllnt/${name})`,
    "- Questions and updates: [Discord](https://bntvllnt.com/discord) · [X @bntvllnt](https://x.com/bntvllnt)",
    "- Company and author: [vllnt.com](https://vllnt.com) · [bntvllnt.com](https://bntvllnt.com) · [GitHub @bntvllnt](https://github.com/bntvllnt) · [LinkedIn](https://linkedin.com/in/bntvllnt)",
    "- Sponsor: [GitHub Sponsors](https://github.com/sponsors/bntvllnt)",
  ].join("\n");

/** GitHub heading anchor. @param {string} heading */
export const slug = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s_-]/gu, "")
    .replaceAll(/\s/gu, "-");

/** Heading anchors, skipping `#` lines in code blocks. @param {string} text @returns {Set<string>} */
function anchors(text) {
  /** @type {Map<string, number>} */
  const seen = new Map();
  const headings = linesOutsideCode(text).flatMap(
    ({ content }) => /^#{1,6}\s+(.+)$/u.exec(content)?.slice(1) ?? [],
  );
  return new Set(
    headings.map((heading) => {
      const base = slug(heading);
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      return count === 0 ? base : `${base}-${String(count)}`;
    }),
  );
}

/** Fenced code blocks with 1-based start lines. @param {string} text */
export function codeBlocks(text) {
  /** @type {{ blocks: Block[], open: OpenBlock | undefined }} */
  const start = { blocks: [], open: undefined };
  const state = text.split("\n").reduce((current, line, index) => {
    if (!line.startsWith("```")) {
      current.open?.lines.push(line);
      return current;
    }
    if (current.open === undefined) {
      const open = { lang: line.slice(3).trim(), line: index + 1, lines: [] };
      return { ...current, open };
    }
    const { lang, line: at, lines } = current.open;
    const block = { code: lines.join("\n"), lang, line: at };
    return { blocks: [...current.blocks, block], open: undefined };
  }, start);
  assert.equal(state.open, undefined, "unclosed code block");
  return state.blocks;
}

/** Lines outside code blocks with 1-based line numbers. @param {string} text */
function linesOutsideCode(text) {
  const inCode = new Set(
    codeBlocks(text).flatMap(({ code, line }) =>
      Array.from(
        { length: code.split("\n").length + 2 },
        (_, offset) => line + offset,
      ),
    ),
  );
  return text
    .split("\n")
    .map((content, index) => ({ content, line: index + 1 }))
    .filter(({ line }) => !inCode.has(line));
}

/** `##` sections outside code blocks. @param {string} text @returns {Section[]} */
function sections(text) {
  const lines = text.split("\n");
  const heads = linesOutsideCode(text).filter(({ content }) =>
    content.startsWith("## "),
  );
  return heads.map((head, index) => ({
    body: lines
      .slice(head.line, (heads[index + 1]?.line ?? lines.length + 1) - 1)
      .join("\n"),
    line: head.line,
    name: head.content.slice(3).trim(),
  }));
}

/** @param {string} directory */
const filesUnder = (directory) =>
  readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));

/** @param {Section[]} parts @param {string} name */
function section(parts, name) {
  const found = parts.find((part) => part.name === name);
  assert.ok(found, `README has no section ${name}`);
  return found;
}

/** Title, fixed sections in order, no empty section, short agent note. @param {string} readme @param {string} packageName */
function checkStructure(readme, packageName) {
  assert.ok(
    readme.startsWith(`# ${packageName}\n\n`),
    "README starts with # <package name> and one sentence",
  );
  const intro = readme.split("\n\n")[1] ?? "";
  const stops = intro.match(/[!.?](?=\s|$)/gu) ?? [];
  assert.ok(stops.length === 1 && /[!.?]$/u.test(intro), "title: one sentence");
  const parts = sections(readme);
  assert.deepEqual(
    parts.map(({ name }) => name),
    SECTIONS,
    "README ## sections must be SECTIONS, in order",
  );
  parts.forEach((part) => {
    assert.ok(
      part.body.trim().length > 0,
      `section ${part.name} is empty; say in one line why it does not apply`,
    );
  });
  const note = section(parts, "For coding agents").body.trim();
  assert.ok(note.split("\n").length <= 3, "For coding agents: 3 lines at most");
  return parts;
}

/** 2-4 "Use it when" bullets, then 1-3 "Do not use it" bullets naming the alternative. @param {Section[]} parts */
function checkWhenToUse(parts) {
  const bullets = section(parts, "When to use")
    .body.replaceAll(/\n {2,}/gu, " ")
    .split("\n")
    .filter((line) => line.startsWith("- "));
  const use = bullets.filter((line) => line.startsWith("- Use it when "));
  const avoid = bullets.filter((line) =>
    line.startsWith("- Do not use it when "),
  );
  assert.ok(use.length >= 2 && use.length <= 4, "2 to 4 'Use it when' bullets");
  assert.ok(
    avoid.length > 0 && avoid.length <= 3,
    "1 to 3 'Do not use it when'",
  );
  assert.deepEqual(bullets, [...use, ...avoid], "'Use it when' bullets first");
  avoid.forEach((line) => {
    assert.match(line, /`[^`]+`/u, "'Do not use it' names the better choice");
  });
}

/** Install and first example near the top; badges below Quick start. @param {string} readme @param {string} packageName */
function checkTop(readme, packageName) {
  const lines = readme.split("\n");
  const name = packageName.replaceAll(/[$()*+./?[\\\]^{|}]/gu, String.raw`\$&`);
  const pattern = new RegExp(String.raw`\b(?:add|install)\s+${name}\b`, "u");
  const install = lines.findIndex((line) => pattern.test(line));
  assert.ok(
    install !== -1 && install < FIRST_LINES,
    `install command within the first ${String(FIRST_LINES)} lines`,
  );
  const quick = section(sections(readme), "Quick start").line;
  const example = codeBlocks(readme).find((block) => block.line > quick);
  assert.ok(
    example && example.line <= FIRST_LINES,
    `Quick start example within the first ${String(FIRST_LINES)} lines`,
  );
  lines.forEach((line, index) => {
    if (/img\.shields\.io|badge\.svg/u.test(line))
      assert.ok(index + 1 > quick, "badges go below Quick start");
  });
}

/**
 * Every block tagged, no `...` gaps; `ts` examples start with a path comment.
 * README `ts` blocks are all examples; a docs/ `ts` block is an example when
 * it starts with `// <path>.ts` (the others are signatures).
 * @param {Record<string, string>} texts
 * @returns {Example[]}
 */
function checkCode(texts) {
  return Object.entries(texts).flatMap(([file, text]) =>
    codeBlocks(text).flatMap((block) => {
      const where = `${file}:${String(block.line)}`;
      assert.ok(block.lang, `${where}: code block has no language tag`);
      if (block.lang !== "ts") return [];
      const gap = /^\s*(?:\/\/\s*)?(?:\.\.\.|…)\s*$/mu;
      assert.doesNotMatch(block.code, gap, `${where} has a ... gap`);
      const path = /^\/\/ (\S+\.m?ts)\n/u.exec(block.code)?.[1];
      if (file !== "README.md" && path === undefined) return [];
      assert.ok(path, `${where} must start with a // <path>.ts comment`);
      return [{ code: block.code, path }];
    }),
  );
}

/**
 * Relative links and their anchors resolve inside the package; external links
 * are well-formed https URLs (they are not fetched).
 * @param {string} root @param {Record<string, string>} texts
 */
function checkLinks(root, texts) {
  Object.entries(texts).forEach(([file, text]) => {
    const targets = [...text.matchAll(/\]\(([^)\s]+)\)/gu)].map((match) =>
      String(match[1]),
    );
    targets.forEach((link) => {
      if (/^[a-z]+:/u.test(link)) {
        assert.ok(URL.canParse(link), `${file}: ${link} is not a valid URL`);
        assert.equal(new URL(link).protocol, "https:", `${file}: ${link}`);
        return;
      }
      const [target = "", anchor] = link.split("#");
      const here = join(root, file);
      const resolved = target ? join(dirname(here), target) : here;
      assert.ok(existsSync(resolved), `${file}: ${link} does not resolve`);
      if (anchor !== undefined) {
        const found = anchors(readFileSync(resolved, "utf8")).has(anchor);
        assert.ok(found, `${file}: ${link} has no such anchor`);
      }
    });
  });
}

/**
 * The file declaring an entry point: the built `.d.ts` when present (an
 * installed package or a built checkout), otherwise its `src/` source.
 * @param {string} root @param {unknown} target
 */
function entryFile(root, target) {
  const types =
    typeof target === "object" && target !== null && "types" in target
      ? target.types
      : target;
  assert.ok(typeof types === "string", "export without a types path");
  const built = join(root, types);
  if (existsSync(built)) return built;
  const source = types
    .replace(/^\.\/dist\//u, "./src/")
    .replace(/\.d\.ts$/u, ".ts");
  assert.ok(existsSync(join(root, source)), `no file declares ${types}`);
  return join(root, source);
}

/** Public exports of each entry point. @param {string} root @param {Metadata} metadata @returns {Entry[]} */
function exportsOf(root, metadata) {
  const keys = Object.keys(metadata.exports).filter(
    (key) => key !== "./package.json" && !key.endsWith(".js"),
  );
  const files = keys.map((key) => entryFile(root, metadata.exports[key]));
  const program = ts.createProgram(files, {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    types: [],
  });
  const checker = program.getTypeChecker();
  return keys.map((entry, index) => {
    const source = program.getSourceFile(String(files[index]));
    assert.ok(source, `cannot read ${entry}`);
    const module = checker.getSymbolAtLocation(source);
    assert.ok(module, `cannot resolve ${entry}`);
    const symbols = checker.getExportsOfModule(module).map((symbol) => ({
      name: symbol.name,
      target:
        symbol.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(symbol)
          : symbol,
    }));
    assert.ok(symbols.length > 0, `${entry} exports nothing`);
    return { checker, entry, symbols };
  });
}

/** @param {ts.TypeChecker} checker @param {ts.Symbol} symbol */
const hasSummary = (checker, symbol) =>
  ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim()
    .length > 0;

/** Public methods of a class symbol. @param {ts.TypeChecker} checker @param {ts.Symbol} symbol */
const publicMethods = (checker, symbol) =>
  checker
    .getDeclaredTypeOfSymbol(symbol)
    .getProperties()
    .filter((member) => {
      const declaration = member.declarations?.[0];
      if (!(member.flags & ts.SymbolFlags.Method) || !declaration) return false;
      const hidden = ts.ModifierFlags.NonPublicAccessibilityModifier;
      return !(ts.getCombinedModifierFlags(declaration) & hidden);
    });

/** TSDoc summary, README API row and reference heading. @param {Documented} documented @param {Entry} entry @param {Export} item */
function checkExport({ headings, table }, { checker, entry }, item) {
  const label = item.name === "default" ? entry.slice(2) : item.name;
  const row = item.name === "default" ? "`default" : `\`${label}\``;
  assert.ok(hasSummary(checker, item.target), `${label} has no TSDoc summary`);
  assert.ok(table.includes(row), `README API table lacks ${label}`);
  assert.ok(headings.has(slug(label)), `docs/API.md lacks a ${label} heading`);
  if (!(item.target.flags & ts.SymbolFlags.Class)) return;
  publicMethods(checker, item.target).forEach((method) => {
    const { name } = method;
    assert.ok(hasSummary(checker, method), `${name} has no TSDoc summary`);
    assert.ok(table.includes(`\`${name}(`), `README API table lacks ${name}`);
    assert.ok(headings.has(slug(name)), `docs/API.md lacks a ${name} heading`);
  });
}

/** One main-entry `@see <package page>`, no more. @param {Entry[]} entries @param {string} page */
function checkSee(entries, page) {
  const main = entries.find(({ entry }) => entry === ".");
  assert.ok(main, "package has no main entry");
  const tags = main.symbols.flatMap(({ target }) =>
    target
      .getJsDocTags(main.checker)
      .filter(
        (tag) =>
          tag.name === "see" &&
          ts.displayPartsToString(tag.text).includes(page),
      ),
  );
  assert.equal(tags.length, 1, `the main entry needs one TSDoc @see ${page}`);
}

/**
 * Every error code the source throws is in the README errors table and the
 * reference, and the table lists no code the source does not throw.
 * @param {string} root @param {string} errors @param {string} reference
 */
function checkErrorCodes(root, errors, reference) {
  const throwing =
    /\b(?:fail|failFromShared)\(\s*"([A-Z][\dA-Z_]+)"|\bcode:\s*"([A-Z][\dA-Z_]+)"|\bError\(\s*"([A-Z][\dA-Z_]+):/gu;
  const codes = new Set(
    filesUnder(join(root, "src"))
      .filter(
        (file) =>
          file.endsWith(".ts") &&
          !file.includes("_generated") &&
          !/\.(?:test|spec)\.ts$/u.test(file),
      )
      .flatMap((file) =>
        [...readFileSync(file, "utf8").matchAll(throwing)].map((match) =>
          String(match[1] ?? match[2] ?? match[3]),
        ),
      ),
  );
  assert.ok(codes.size > 0, "found no error codes; update the pattern");
  codes.forEach((code) => {
    assert.ok(errors.includes(`\`${code}\``), `Errors and fixes lacks ${code}`);
    assert.ok(reference.includes(code), `docs/API.md lacks ${code}`);
  });
  const listed = errors
    .split("\n")
    .flatMap((line) => /^\| `([A-Z][\dA-Z_]+)`/u.exec(line)?.slice(1) ?? []);
  listed.forEach((code) => {
    assert.ok(codes.has(code), `Errors and fixes lists ${code}, never thrown`);
  });
}

/** Summary, when to use, links to the reference and errors, ecosystem block. @param {string} llms @param {string} name */
function checkLlms(llms, name) {
  assert.match(llms, /^> \S/mu, "llms.txt needs a > summary line");
  assert.ok(llms.includes("\n## When to use\n"), "llms.txt: ## When to use");
  assert.ok(llms.includes("](./docs/API.md)"), "llms.txt: link ./docs/API.md");
  const errors = "](./README.md#errors-and-fixes)";
  assert.ok(llms.includes(errors), "llms.txt: link the errors table");
  assert.ok(llms.endsWith(ecosystem(name)), "llms.txt: ends with Ecosystem");
  const index = llms.split(`${OSS}/llms.txt`).length - 1;
  assert.equal(index, 1, "llms.txt links the package index once");
}

/** Files the package ships, in a checkout or an installed package. @param {string} root @param {Metadata} metadata */
function shippedFiles(root, metadata) {
  const listed = Array.isArray(metadata.files) ? metadata.files : [];
  const paths = [
    "package.json",
    "README.md",
    "LICENSE",
    ...listed.filter(
      (entry) => typeof entry === "string" && !entry.startsWith("!"),
    ),
  ];
  return paths
    .map((path) => join(root, String(path)))
    .filter((path) => existsSync(path))
    .flatMap((path) =>
      statSync(path).isDirectory() ? filesUnder(path) : path,
    );
}

/** @vllnt names under "Related packages" link their package page; no retired vllnt domain anywhere. @param {string} root @param {Record<string, string>} texts @param {Metadata} metadata */
function checkBacklinks(root, texts, metadata) {
  Object.entries(texts).forEach(([file, text]) => {
    const related =
      sections(text).find((part) => part.name === "Related packages")?.body ??
      "";
    const names = related.matchAll(/\[`?@vllnt\/([\w-]+)`?\]\(([^)]+)\)/gu);
    [...names].forEach(([, other = "", url]) => {
      const page = `${OSS}/packages/${other}`;
      assert.equal(url, page, `${file}: link @vllnt/${other} to ${page}`);
    });
  });
  shippedFiles(root, metadata).forEach((file) => {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(
      text,
      /vllnt\.ai/iu,
      `${relative(root, file)} mentions the retired vllnt domain; use vllnt.com`,
    );
  });
}

/**
 * Docs cover every export of every entry point; the main entry links its page.
 * @param {string} root @param {Metadata} metadata @param {Documented} documented
 */
function checkApi(root, metadata, documented) {
  const entries = exportsOf(root, metadata);
  entries.forEach((entry) => {
    entry.symbols.forEach((item) => {
      checkExport(documented, entry, item);
    });
  });
  const name = metadata.name.split("/").at(-1) ?? metadata.name;
  checkSee(entries, `${OSS}/packages/${name}`);
}

/**
 * Search metadata: a description of 160 characters at most that does not
 * mention vllnt, 8 to 12 unique keywords, and the shared package links.
 * @param {Metadata} metadata
 */
function checkMetadata(metadata) {
  const { author, bugs, description, funding, homepage, keywords, license } =
    metadata;
  assert.ok(typeof description === "string", "package.json needs description");
  assert.ok(description.length <= 160, "description: 160 characters at most");
  assert.doesNotMatch(description, /vllnt/iu, "description: not 'for vllnt'");
  assert.ok(Array.isArray(keywords), "package.json needs keywords");
  const unique = new Set(keywords);
  assert.equal(unique.size, keywords.length, "keywords repeat");
  assert.ok(unique.size >= 8 && unique.size <= 12, "8 to 12 keywords");
  const name = metadata.name.split("/").at(-1) ?? metadata.name;
  assert.equal(homepage, `${OSS}/packages/${name}`, "homepage");
  assert.equal(author?.url, "https://bntvllnt.com", "author.url");
  assert.ok(typeof bugs?.url === "string", "package.json needs bugs");
  assert.ok(funding, "package.json needs funding");
  assert.ok(typeof license === "string", "package.json needs license");
}

/**
 * The package.json description opens the README and is the llms.txt summary;
 * the README Links section and footer match the shared blocks.
 * @param {Record<string, string>} texts @param {Section[]} parts @param {Metadata} metadata
 */
function checkIdentity(texts, parts, metadata) {
  const description = String(metadata.description);
  const readme = String(texts["README.md"]);
  const title = readme.indexOf("\n");
  const intro = readme
    .slice(title, readme.indexOf("\n## ", title))
    .replace(
      /!\[[^\]]*\]\(https:\/\/raw\.githubusercontent\.com\/vllnt\/[^)]+\/\.github\/assets\/thumbnail\.png\)/g,
      "",
    )
    .trim();
  const sentence = intro.replaceAll(/\s*\n\s*/gu, " ");
  assert.equal(sentence, description, "README intro: package.json description");
  const summary = String(texts["llms.txt"]).split("\n");
  assert.ok(summary.includes(`> ${description}`), "llms.txt: > <description>");
  const { repository } = metadata;
  const source = typeof repository === "object" ? repository.url : repository;
  assert.ok(typeof source === "string", "package.json needs repository.url");
  const url = source.replace(/^git\+/u, "").replace(/\.git$/u, "");
  const name = metadata.name.split("/").at(-1) ?? metadata.name;
  const body = section(parts, "Links").body.trim();
  assert.equal(body, links(name, url), "README Links: the shared block");
  assert.ok(readme.endsWith(footer(name)), "README ends with the vllnt footer");
}

/**
 * Shipped docs keyed by package-relative path.
 * @param {string} root @param {Metadata} metadata
 * @returns {Record<string, string>}
 */
function readTexts(root, metadata) {
  /** @type {unknown[]} */
  const listed = Array.isArray(metadata.files) ? metadata.files : [];
  const references = listed
    .map(String)
    .filter((entry) => entry.startsWith("docs/"));
  const files = ["README.md", "llms.txt", "CHANGELOG.md", ...references];
  return Object.fromEntries(
    files.map((file) => [file, readFileSync(join(root, file), "utf8")]),
  );
}

/**
 * Checks README.md, llms.txt, CHANGELOG.md, docs/ and package.json of a
 * checkout or an installed package, and returns the `ts` examples for the
 * caller to type-check against the built package.
 * @param {string} root package directory
 * @returns {Example[]}
 */
export function checkDocumentation(root) {
  /** @type {Metadata} */
  const metadata = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const name = metadata.name.split("/").at(-1) ?? metadata.name;
  checkMetadata(metadata);
  const texts = readTexts(root, metadata);
  const readme = String(texts["README.md"]);
  const reference = String(texts["docs/API.md"]);
  const parts = checkStructure(readme, metadata.name);
  checkWhenToUse(parts);
  checkIdentity(texts, parts, metadata);
  checkTop(readme, metadata.name);
  const examples = checkCode(texts);
  checkLinks(root, texts);
  checkApi(root, metadata, {
    headings: anchors(reference),
    table: section(parts, "API")
      .body.split("\n")
      .filter((line) => line.startsWith("|"))
      .join("\n"),
  });
  checkErrorCodes(root, section(parts, "Errors and fixes").body, reference);
  checkLlms(String(texts["llms.txt"]), name);
  checkBacklinks(root, texts, metadata);
  return examples;
}

/**
 * Writes stub host files and the examples under `consumer`, renaming repeated
 * paths, and returns the written paths.
 * @param {string} consumer @param {Record<string, string>} stubs @param {Example[]} examples
 */
export function writeHost(consumer, stubs, examples) {
  /** @type {string[]} */
  const seen = [];
  /** @type {string[]} */
  const written = [];
  const files = [
    ...Object.entries(stubs),
    ...examples.map(({ code, path }) => [path, code]),
  ];
  files.forEach(([path = "", code = ""]) => {
    const copies = seen.filter((file) => file === path).length;
    const target =
      copies === 0 ? path : path.replace(/\.(m?ts)$/u, `.${String(copies)}.$1`);
    seen.push(path);
    written.push(target);
    mkdirSync(dirname(join(consumer, target)), { recursive: true });
    writeFileSync(join(consumer, target), code);
  });
  return written;
}

/**
 * Component mount names used by the examples' `convex.config.ts` blocks.
 * @param {string} root @param {Example[]} examples
 */
function mountsOf(root, examples) {
  const config = join(root, "src/component/convex.config.ts");
  const definition = /defineComponent\(\s*"([^"]+)"/u;
  const component = definition.exec(readFileSync(config, "utf8"))?.[1];
  assert.ok(component, "cannot read the component name");
  const use = /app\.use\(\s*\w+\s*(?:,\s*\{\s*name:\s*"([^"]+)"\s*\})?\s*\)/gu;
  const names = examples
    .filter(({ path }) => path.endsWith("convex.config.ts"))
    .flatMap(({ code }) => [...code.matchAll(use)])
    .map((match) => match[1] ?? component);
  return [...new Set(names)];
}

/** Example modules that define functions, as `api` keys. @param {Example[]} examples */
const modulesOf = (examples) =>
  [...new Set(examples.map(({ path }) => path))]
    .filter(
      (path) =>
        path.startsWith("convex/") &&
        !/convex\.config|\.test\.|_generated|schema/u.test(path),
    )
    .map((path) => path.slice("convex/".length, -".ts".length));

/** Function builders typed by `convex/schema.ts`, as `convex codegen` writes them. */
const SERVER = [
  `import { internalMutationGeneric, internalQueryGeneric, mutationGeneric, queryGeneric, type DataModelFromSchemaDefinition, type MutationBuilder, type QueryBuilder } from "convex/server";`,
  `import type schema from "../schema.js";`,
  `type DataModel = DataModelFromSchemaDefinition<typeof schema>;`,
  `export const mutation = mutationGeneric as MutationBuilder<DataModel, "public">;`,
  `export const internalMutation = internalMutationGeneric as MutationBuilder<DataModel, "internal">;`,
  `export const query = queryGeneric as QueryBuilder<DataModel, "public">;`,
  `export const internalQuery = internalQueryGeneric as QueryBuilder<DataModel, "internal">;`,
].join("\n");
const EMPTY_SCHEMA = `import { defineSchema } from "convex/server";\nexport default defineSchema({});\n`;

/**
 * Stub `convex/_generated` files typed from the examples, as `convex codegen`
 * would write them: `api` and `internal` from the example modules,
 * `components` from their mounts, and builders typed by `convex/schema.ts`
 * (an empty schema when no example defines one).
 * @param {string} root @param {Example[]} examples
 * @returns {Record<string, string>}
 */
export function convexHost(root, examples) {
  /** @type {{ name: string }} */
  const { name } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const modules = modulesOf(examples);
  const fields = modules.map(
    (module, index) => `"${module}": typeof m${String(index)};`,
  );
  const mounts = mountsOf(root, examples).map(
    (mount) => `"${mount}": ComponentApi;`,
  );
  const api = [
    `import type { ComponentApi } from "${name}/_generated/component.js";`,
    `import { anyApi, componentsGeneric, type ApiFromModules, type FilterApi, type FunctionReference } from "convex/server";`,
    ...modules.map(
      (module, index) =>
        `import type * as m${String(index)} from "../${module}.js";`,
    ),
    `type FullApi = ApiFromModules<{ ${fields.join(" ")} }>;`,
    `export const api = anyApi as unknown as FilterApi<FullApi, FunctionReference<any, "public">>;`,
    `export const internal = anyApi as unknown as FilterApi<FullApi, FunctionReference<any, "internal">>;`,
    `export const components = componentsGeneric() as unknown as { ${mounts.join(" ")} };`,
  ];
  const schema = examples.some(({ path }) => path === "convex/schema.ts")
    ? {}
    : { "convex/schema.ts": EMPTY_SCHEMA };
  return {
    "convex/_generated/api.ts": `${api.join("\n")}\n`,
    "convex/_generated/server.ts": `${SERVER}\n`,
    ...schema,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const examples = checkDocumentation(process.cwd());
  console.info(
    `PASS: documentation contract (${String(examples.length)} examples; check-pack.mjs type-checks them against the built package)`,
  );
}
