import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitSpicy,
  revealSpicy,
  redactSpicy,
  hasSpicy,
  processChapterContent,
  SPICY_REDACTED,
} from "./redact.ts";

// ---------- splitSpicy ----------

test("splitSpicy: no markers is a single plain segment", () => {
  assert.deepEqual(splitSpicy("just prose"), [{ spicy: false, text: "just prose" }]);
});

test("splitSpicy: empty string yields no segments", () => {
  assert.deepEqual(splitSpicy(""), []);
});

test("splitSpicy: one span splits into three segments", () => {
  assert.deepEqual(splitSpicy("a[[spicy]]b[[/spicy]]c"), [
    { spicy: false, text: "a" },
    { spicy: true, text: "b" },
    { spicy: false, text: "c" },
  ]);
});

test("splitSpicy: span at start of string has no leading plain segment", () => {
  assert.deepEqual(splitSpicy("[[spicy]]b[[/spicy]]c"), [
    { spicy: true, text: "b" },
    { spicy: false, text: "c" },
  ]);
});

test("splitSpicy: span at end of string has no trailing plain segment", () => {
  assert.deepEqual(splitSpicy("a[[spicy]]b[[/spicy]]"), [
    { spicy: false, text: "a" },
    { spicy: true, text: "b" },
  ]);
});

test("splitSpicy: multiple spans", () => {
  assert.deepEqual(splitSpicy("a[[spicy]]b[[/spicy]]c[[spicy]]d[[/spicy]]e"), [
    { spicy: false, text: "a" },
    { spicy: true, text: "b" },
    { spicy: false, text: "c" },
    { spicy: true, text: "d" },
    { spicy: false, text: "e" },
  ]);
});

test("splitSpicy: adjacent spans produce no empty plain segment between them", () => {
  assert.deepEqual(splitSpicy("[[spicy]]a[[/spicy]][[spicy]]b[[/spicy]]"), [
    { spicy: true, text: "a" },
    { spicy: true, text: "b" },
  ]);
});

test("splitSpicy: multi-paragraph span keeps its text exactly, untrimmed", () => {
  const md = "intro\n\n[[spicy]]\n\npara one\n\npara two\n\n[[/spicy]]\n\nouttro";
  assert.deepEqual(splitSpicy(md), [
    { spicy: false, text: "intro\n\n" },
    { spicy: true, text: "\n\npara one\n\npara two\n\n" },
    { spicy: false, text: "\n\nouttro" },
  ]);
});

test("splitSpicy: unclosed [[spicy]] is spicy to end of string", () => {
  assert.deepEqual(splitSpicy("a[[spicy]]b and on and on"), [
    { spicy: false, text: "a" },
    { spicy: true, text: "b and on and on" },
  ]);
});

test("splitSpicy: stray [[/spicy]] is removed from plain text", () => {
  assert.deepEqual(splitSpicy("a[[/spicy]]b"), [{ spicy: false, text: "ab" }]);
});

test("splitSpicy: concatenated segment text is the source minus its markers", () => {
  const md = "intro\n\n[[spicy]]hidden bit[[/spicy]]\n\nouttro";
  assert.equal(
    splitSpicy(md).map((s) => s.text).join(""),
    "intro\n\nhidden bit\n\nouttro"
  );
});

// ---------- revealSpicy ----------

test("revealSpicy: keeps balanced markers intact", () => {
  assert.equal(revealSpicy("a[[spicy]]b[[/spicy]]c"), "a[[spicy]]b[[/spicy]]c");
});

test("revealSpicy: leaves marker-free text alone", () => {
  assert.equal(revealSpicy("just prose"), "just prose");
});

test("revealSpicy: closes an unclosed marker rather than dropping it", () => {
  assert.equal(revealSpicy("a[[spicy]]b"), "a[[spicy]]b[[/spicy]]");
});

test("revealSpicy: strips a stray closing token", () => {
  assert.equal(revealSpicy("a[[/spicy]]b"), "ab");
});

test("revealSpicy: is idempotent", () => {
  const md = "a[[spicy]]b";
  assert.equal(revealSpicy(revealSpicy(md)), revealSpicy(md));
});

test("revealSpicy: splitSpicy sees the same spans before and after revealing", () => {
  const md = "a[[spicy]]b[[/spicy]]c[[spicy]]unclosed";
  assert.deepEqual(splitSpicy(revealSpicy(md)), splitSpicy(md));
});

// ---------- redactSpicy (unchanged behavior — regression guard) ----------

test("redactSpicy: replaces a span with the placeholder block", () => {
  const out = redactSpicy("a\n\n[[spicy]]secret[[/spicy]]\n\nb");
  assert.ok(out.includes(SPICY_REDACTED));
  assert.ok(out.includes("a"));
  assert.ok(out.includes("b"));
});

test("redactSpicy: unclosed marker redacts to end of string", () => {
  const out = redactSpicy("safe[[spicy]]secret trailing text");
  assert.ok(!out.includes("secret"));
  assert.ok(!out.includes("trailing text"));
  assert.ok(out.includes("safe"));
});

test("redactSpicy: adjacent spans collapse to a single placeholder", () => {
  const out = redactSpicy("[[spicy]]a[[/spicy]][[spicy]]b[[/spicy]]");
  const count = out.split(SPICY_REDACTED).length - 1;
  assert.equal(count, 1);
});

test("redactSpicy: NO LEAK — none of the inner text survives", () => {
  const md = [
    "public opening",
    "[[spicy]]", "clandestine", "", "compromising", "[[/spicy]]",
    "public closing",
  ].join("\n\n");
  const out = redactSpicy(md);
  for (const secret of ["clandestine", "compromising"]) {
    assert.ok(!out.includes(secret), `leaked: ${secret}`);
  }
  assert.ok(out.includes("public opening"));
  assert.ok(out.includes("public closing"));
});

// ---------- hasSpicy / processChapterContent ----------

test("hasSpicy: true only when an opening marker is present", () => {
  assert.equal(hasSpicy("a[[spicy]]b[[/spicy]]"), true);
  assert.equal(hasSpicy("plain"), false);
});

test("processChapterContent: reader WITH access keeps markers and text", () => {
  const out = processChapterContent("a[[spicy]]secret[[/spicy]]", true);
  assert.ok(out.includes("secret"));
  assert.ok(out.includes("[[spicy]]"));
});

test("processChapterContent: reader WITHOUT access gets no explicit text", () => {
  const out = processChapterContent("a[[spicy]]secret[[/spicy]]", false);
  assert.ok(!out.includes("secret"));
  assert.ok(out.includes(SPICY_REDACTED));
});
