import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageSkeleton } from "@/components/ui/skeleton";

describe("P.1 loading skeleton", () => {
  it("is announced as busy with a text label and shows placeholder blocks", () => {
    const html = renderToStaticMarkup(createElement(PageSkeleton, { label: "Loading your card" }));
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading your card");
    expect(html.match(/data-skeleton-block/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
