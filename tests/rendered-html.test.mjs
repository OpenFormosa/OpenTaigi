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

test("server-renders the complete Taigi learning experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>咱來學台語｜八冊完整互動教材<\/title>/i);
  assert.match(html, /一頁一頁，/);
  assert.match(html, /八冊，攏佇遮/);
  assert.match(html, /原書的所在，就是互動的所在/);
  assert.match(html, /原頁精讀/);
  assert.match(html, /語詞卡/);
  assert.match(html, /217/);
  assert.match(html, /4,349/);
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

test("includes responsive, accessible interaction styles", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.reader-page-canvas/);
  assert.match(css, /\.audio-hotspot/);
  assert.match(
    css,
    /\.brand small\s*\{[^}]*font-family: var\(--latin-serif\)[^}]*letter-spacing: normal/s,
  );
  assert.match(css, /--latin-serif: "Times New Roman"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});

test("ships every PDF spread and its interactive audio map", async () => {
  const curriculum = JSON.parse(
    await readFile(
      new URL("../public/data/curriculum.json", import.meta.url),
      "utf8",
    ),
  );
  const vocabulary = JSON.parse(
    await readFile(
      new URL("../public/data/vocabulary.json", import.meta.url),
      "utf8",
    ),
  );

  assert.equal(curriculum.books.length, 8);
  assert.equal(curriculum.stats.pages, 217);
  assert.equal(curriculum.stats.audioFiles, 4349);
  assert.ok(curriculum.stats.hotspots > 4300);
  assert.ok(vocabulary.length > 800);

  const pages = curriculum.books.flatMap((book) => book.pages);
  assert.equal(pages.length, 217);
  assert.ok(pages.every((page) => page.image.endsWith(".webp")));
  assert.ok(
    pages
      .flatMap((page) => page.hotspots)
      .every((hotspot) => hotspot.x >= 0 && hotspot.y >= 0),
  );

  const firstPageImage = new URL(
    `../public/${pages[0].image.replace(/^\.\//, "")}`,
    import.meta.url,
  );
  assert.ok((await readFile(firstPageImage)).length > 10_000);
});
