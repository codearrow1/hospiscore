import { describe, it, expect } from "vitest";
import { safeNext } from "./safeNext";

describe("safeNext", () => {
  it("accepts internal paths", () => {
    expect(safeNext("/properties/abc/dashboard")).toBe("/properties/abc/dashboard");
  });

  it("rejects absolute URLs and protocol-relative paths", () => {
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("http://evil.example/x")).toBeNull();
  });

  it("rejects backslash tricks and empty input", () => {
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext("")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});