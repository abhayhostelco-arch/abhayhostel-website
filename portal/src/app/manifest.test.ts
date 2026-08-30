import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("portal manifest theme colors", () => {
  it("uses the dark installed-app splash and browser-chrome color", () => {
    expect(manifest()).toMatchObject({
      background_color: "#081f3d",
      theme_color: "#081f3d",
    });
  });
});
