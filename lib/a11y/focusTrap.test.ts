import { describe, expect, it } from "vitest";
import { nextFocus } from "./focusTrap";

const els = ["a", "b", "c"].map((id) => ({ id }) as unknown as HTMLElement);

describe("focus trap order", () => {
  it("wraps forward from the last and backward from the first", () => {
    expect(nextFocus(els, els[2], false)).toBe(els[0]);
    expect(nextFocus(els, els[0], true)).toBe(els[2]);
  });
  it("lets the browser move focus inside the dialog", () => {
    expect(nextFocus(els, els[0], false)).toBeUndefined();
    expect(nextFocus(els, els[2], true)).toBeUndefined();
  });
  it("pulls focus from outside back in", () => {
    expect(nextFocus(els, null, false)).toBe(els[0]);
    expect(nextFocus(els, null, true)).toBe(els[2]);
  });
  it("does nothing with no focusable element", () => {
    expect(nextFocus([], null, false)).toBeUndefined();
  });
});
