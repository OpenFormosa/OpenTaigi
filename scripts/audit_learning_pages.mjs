import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const dataRoot = path.join(projectRoot, "public", "data");

const [curriculum, htmlCurriculum, vocabulary, sentenceOne, sentenceTwo] =
  await Promise.all([
    readFile(path.join(dataRoot, "curriculum.json"), "utf8").then(JSON.parse),
    readFile(path.join(dataRoot, "html-curriculum.json"), "utf8").then(
      JSON.parse,
    ),
    readFile(path.join(dataRoot, "vocabulary.json"), "utf8").then(JSON.parse),
    readFile(path.join(dataRoot, "3-1.csv"), "utf8"),
    readFile(path.join(dataRoot, "3-2.csv"), "utf8"),
  ]);

const vocabularyPages = new Set(
  vocabulary.map((entry) => `${entry.bookId}-${entry.page}`),
);

function sentencePages(text) {
  return new Set(
    text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .slice(1)
      .filter(Boolean)
      .map((line) => Number(line.split(",", 1)[0]))
      .filter(Number.isFinite),
  );
}

const sentencePageSets = {
  "sentences-1": sentencePages(sentenceOne),
  "sentences-2": sentencePages(sentenceTwo),
};

function hasSentenceLesson(bookId, pageNumber) {
  const source = sentencePageSets[bookId];
  if (!source) return false;
  const logicalPages =
    pageNumber === 3
      ? [3]
      : pageNumber >= 4
        ? [pageNumber * 2 - 4, pageNumber * 2 - 3]
        : [];
  return logicalPages.some((page) => source.has(page));
}

function rendererFor(bookId, pageNumber) {
  if (pageNumber === 1) return "cover";
  if (bookId === "pronunciation" && pageNumber === 4) {
    return "pronunciation-reference";
  }
  if (
    bookId === "pronunciation" &&
    pageNumber >= 3 &&
    pageNumber <= 19
  ) {
    return "pronunciation-structured";
  }
  if (vocabularyPages.has(`${bookId}-${pageNumber}`)) return "vocabulary";
  if (hasSentenceLesson(bookId, pageNumber)) return "sentences";
  if (bookId.startsWith("articles-")) return "article";
  return "narrative";
}

async function fileExists(filename) {
  try {
    await access(filename);
    return true;
  } catch {
    return false;
  }
}

const rows = [];
for (const book of curriculum.books) {
  const htmlBook = htmlCurriculum.books.find((item) => item.id === book.id);
  for (const page of book.pages) {
    const htmlPage = htmlBook?.pages.find(
      (item) => item.number === page.number,
    );
    const renderer = rendererFor(book.id, page.number);
    const blocks =
      htmlPage?.columns.flatMap((column) => column.blocks) ?? [];
    const shortBlocks = blocks.filter(
      (block) => block.text.trim().length <= 4,
    ).length;
    const headings = blocks.filter(
      (block) => block.role === "heading",
    ).length;
    const warnings = [];
    const errors = [];
    const imagePath = path.join(
      projectRoot,
      "public",
      page.image.replace(/^\.\//, ""),
    );

    if (!(await fileExists(imagePath))) errors.push("missing-page-image");
    if (!htmlPage) errors.push("missing-html-page");
    if (page.hotspots.some((hotspot) => !hotspot.available)) {
      errors.push("unavailable-audio");
    }
    if (
      page.number > 1 &&
      !htmlPage?.text.trim() &&
      ["article", "narrative"].includes(renderer)
    ) {
      warnings.push("empty-html-text");
    }
    if (/[▲◆◇]/.test(htmlPage?.text ?? "")) {
      warnings.push("pdf-marker-sanitized");
    }
    if (
      shortBlocks >= 12 &&
      headings >= 8 &&
      ["article", "narrative"].includes(renderer)
    ) {
      errors.push("table-like-page-uses-generic-renderer");
    }
    if (page.hotspots.length >= 80) {
      warnings.push("dense-audio-page");
    }

    rows.push({
      bookId: book.id,
      page: page.number,
      renderer,
      blocks: blocks.length,
      hotspots: page.hotspots.length,
      warnings,
      errors,
    });
  }
}

const rendererCounts = Object.fromEntries(
  [...new Set(rows.map((row) => row.renderer))]
    .sort()
    .map((renderer) => [
      renderer,
      rows.filter((row) => row.renderer === renderer).length,
    ]),
);
const warnings = rows.flatMap((row) =>
  row.warnings.map((warning) => ({ ...row, warning })),
);
const errors = rows.flatMap((row) =>
  row.errors.map((error) => ({ ...row, error })),
);
const result = {
  pages: rows.length,
  books: curriculum.books.length,
  rendererCounts,
  warnings: warnings.length,
  errors: errors.length,
  rows,
};

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  console.log(
    `OpenTaigi page audit: ${result.pages} pages / ${result.books} books`,
  );
  for (const [renderer, count] of Object.entries(rendererCounts)) {
    console.log(`${renderer.padEnd(28)} ${String(count).padStart(3)}`);
  }
  console.log(`warnings ${warnings.length} / errors ${errors.length}`);
  for (const row of rows) {
    const notes = [...row.errors, ...row.warnings];
    console.log(
      `${row.errors.length ? "FAIL" : "PASS"} ${row.bookId.padEnd(16)} p.${String(row.page).padStart(2, "0")} ${row.renderer.padEnd(28)} audio=${String(row.hotspots).padStart(3)}${notes.length ? ` ${notes.join(",")}` : ""}`,
    );
  }
}

if (errors.length) process.exitCode = 1;
