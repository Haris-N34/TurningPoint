import { describe, expect, it } from "vitest";
import { publicSlugFor, slugify } from "@/lib/challenge/challenge";

// QA night (E1.6): public links for employers with accented or non-Latin names.
describe("QA: public link slugs", () => {
  it("folds accents instead of splitting words", () => {
    expect(slugify("Café Québec Énergie")).toBe("cafe-quebec-energie");
    expect(slugify("Société Générale")).toBe("societe-generale");
  });
  it("never starts with a hyphen when the name has no Latin letters", () => {
    const slug = publicSlugFor("ch_x", "東京エネルギー", "研修生");
    expect(slug).not.toMatch(/^-/);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});
