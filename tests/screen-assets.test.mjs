import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("reader body lines stay inside the reading panel", async () => {
  const svg = await readFile(new URL("public/screens/reader.svg", projectRoot), "utf8");
  const bodyLines = [...svg.matchAll(/<text\s+([^>]+)>([^<]+)<\/text>/g)]
    .map((match) => {
      const attributes = match[1];
      const x = Number(attributes.match(/\bx="([\d.]+)"/)?.[1]);
      const y = Number(attributes.match(/\by="([\d.]+)"/)?.[1]);
      const fontSize = Number(attributes.match(/\bfont-size="([\d.]+)"/)?.[1]);
      return { text: match[2], x, y, fontSize };
    })
    .filter((line) => line.y >= 287 && line.y <= 1100);

  assert.ok(bodyLines.length > 0, "expected reader body lines in the SVG");
  for (const line of bodyLines) {
    const conservativeRightEdge = line.x + [...line.text].length * line.fontSize;
    assert.ok(
      conservativeRightEdge <= 644,
      `body line exceeds the panel: "${line.text}" reaches ${conservativeRightEdge}px`,
    );
  }
});

