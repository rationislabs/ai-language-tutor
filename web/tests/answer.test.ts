import { describe, expect, it } from "vitest";
import { check, choices } from "../src/lib/answer";

describe("check", () => {
  it("right ignores case, spaces and end punctuation", () => {
    expect(check("Macska", " macska. ")).toBe("right");
  });
  it("accent-only differences are almost", () => {
    expect(check("ő", "o")).toBe("almost");
    expect(check("szép", "szep")).toBe("almost");
    expect(check("Straße", "strasse")).toBe("almost");
    expect(check("Mädchen", "madchen")).toBe("almost");
  });
  it("other differences are wrong, empty is wrong", () => {
    expect(check("macska", "kutya")).toBe("wrong");
    expect(check("macska", "  ")).toBe("wrong");
  });
});

describe("choices", () => {
  it("the answer plus three others, no duplicates", () => {
    const c = choices("Macska", ["kutya", "macska", "ház", "kutya", "fa", "ég"], () => 0.3);
    expect(c).toHaveLength(4);
    expect(c).toContain("macska");
    expect(new Set(c).size).toBe(4);
  });
  it("a small pool gives fewer choices", () => {
    expect(choices("a", ["a", "b"]).sort()).toEqual(["a", "b"]);
  });
});
