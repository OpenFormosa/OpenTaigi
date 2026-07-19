import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the complete Taigi HTML learning experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>咱來學台語｜依程度學習的互動教材<\/title>/i,
  );
  assert.match(html, /聽一句、揣答案/);
  assert.match(html, /初學起步/);
  assert.match(html, /生活應用/);
  assert.match(html, /進階讀寫/);
  assert.match(html, /八冊完整教材/);
  assert.match(html, /全文閱讀/);
  assert.match(html, /語詞資料庫/);
  assert.match(html, /生活語句/);
  assert.match(html, /遊戲練功/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/);
});

test("ships both 420-sentence source volumes", async () => {
  const [volumeOne, volumeTwo] = await Promise.all([
    readFile(new URL("../public/data/3-1.csv", import.meta.url), "utf8"),
    readFile(new URL("../public/data/3-2.csv", import.meta.url), "utf8"),
  ]);

  assert.equal(volumeOne.trim().split(/\r?\n/).length, 421);
  assert.equal(volumeTwo.trim().split(/\r?\n/).length, 421);
  assert.match(volumeOne, /多謝你！,To-siā--lí!/);
  assert.match(volumeTwo, /這曷著講？,Tse a̍h-tio̍h kóng/);
});

test("includes OpenFormosa styling and responsive interaction", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.reading-flow/);
  assert.match(css, /\.mode-tabs\s*\{[^}]*repeat\(4,\s*1fr\)/s);
  assert.match(css, /\.layout-sheet/);
  assert.match(css, /\.layout-audio/);
  assert.match(css, /--paper:\s*#f2eadc/);
  assert.match(css, /--green:\s*#0b6b50/);
  assert.match(css, /background-size: 28px 28px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});

test("ships every PDF page as HTML text plus its audio map", async () => {
  const [curriculum, vocabulary, htmlCurriculum] = await Promise.all([
    readFile(
      new URL("../public/data/curriculum.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/vocabulary.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/html-curriculum.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ]);

  assert.equal(curriculum.books.length, 8);
  assert.equal(curriculum.stats.pages, 217);
  assert.equal(curriculum.stats.audioFiles, 4349);
  assert.ok(curriculum.stats.hotspots > 4300);
  assert.equal(vocabulary.length, 852);
  assert.equal(vocabulary[0].headword, "阿");
  assert.equal(vocabulary[0].romanization, "a");

  const pages = curriculum.books.flatMap((book) => book.pages);
  assert.equal(pages.length, 217);
  assert.ok(
    pages
      .flatMap((page) => page.hotspots)
      .every((hotspot) => hotspot.x >= 0 && hotspot.y >= 0),
  );

  assert.equal(htmlCurriculum.format, "html-text-layout-v1");
  assert.equal(htmlCurriculum.books.length, 8);
  assert.equal(htmlCurriculum.stats.pages, 217);
  assert.ok(htmlCurriculum.stats.lines > 12_000);
  assert.ok(htmlCurriculum.stats.characters > 180_000);
  assert.equal(htmlCurriculum.stats.vocabularyEntries, 852);
  assert.equal(
    htmlCurriculum.books.flatMap((book) => book.pages).length,
    217,
  );
  assert.match(htmlCurriculum.books[5].pages[4].text, /平溪放天燈/);
});

test("supports reflow, source layout, search, progress, and empty states", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("../app/TaigiApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(component, /opentaigi-last-place/);
  assert.match(component, /readerView/);
  assert.match(component, /reading-sheet/);
  assert.match(component, /lesson-word-list/);
  assert.match(component, /lesson-sentence-list/);
  assert.match(component, /lesson-audio-strip/);
  assert.match(component, /教學模式/);
  assert.match(component, /layout-sheet/);
  assert.match(component, /readerQuery/);
  assert.match(component, /showAudio/);
  assert.match(component, /empty-state/);
  assert.match(component, /audio-dock/);
  assert.match(component, /opentaigi-learner-level/);
  assert.match(component, /learnerLevels/);
  assert.match(component, /hintMode/);
  assert.match(component, /opentaigi-game-stats/);
  assert.match(component, /聽音揣意思/);
  assert.match(component, /語詞對對碰/);
  assert.match(component, /gameScorebar|game-scorebar/);
  assert.match(component, /初學起步/);
  assert.match(component, /生活應用/);
  assert.match(component, /進階讀寫/);
  assert.match(component, /pageNumber === 1[\s\S]*activePage\.image/);
  assert.doesNotMatch(component, /<img[\s\S]{0,120}activeHtmlPage\.text/);
  assert.match(css, /\.mode-tabs\s*\{[^}]*position: sticky/s);
  assert.match(css, /\.reading-sheet/);
  assert.match(css, /\.empty-state/);
  assert.match(css, /\.level-picker/);
  assert.match(css, /\.personal-route/);
  assert.match(css, /\.hint-controls/);
  assert.match(css, /\.game-console/);
  assert.match(css, /\.quiz-options/);
  assert.match(css, /@keyframes sound-pulse/);
});
