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
  assert.match(html, /<title>咱來學台語｜互動式台語教材<\/title>/i);
  assert.match(html, /一句一句，/);
  assert.match(html, /講出台語/);
  assert.match(html, /先聽，再開喙講/);
  assert.match(html, /隨堂小練習/);
  assert.match(html, /生活語句，隨時揣/);
  assert.match(html, /四階段，練好台語/);
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

  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /\.mobile-nav/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});
