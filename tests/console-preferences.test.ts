import { describe, expect, test } from "bun:test";
import { getPageAutoSaveScope } from "../ui/src/lib/console-preferences";

describe("getPageAutoSaveScope", () => {
  test("returns runtime-only autosave for scan, dry run, and move pages", () => {
    expect(getPageAutoSaveScope("scan")).toEqual({
      runtime: true,
      prompts: false,
      categories: false,
    });
    expect(getPageAutoSaveScope("dry-run")).toEqual({
      runtime: true,
      prompts: false,
      categories: false,
    });
    expect(getPageAutoSaveScope("move")).toEqual({
      runtime: true,
      prompts: false,
      categories: false,
    });
  });

  test("returns the broader autosave scopes for folder and classification pages", () => {
    expect(getPageAutoSaveScope("folders")).toEqual({
      runtime: true,
      prompts: true,
      categories: true,
    });
    expect(getPageAutoSaveScope("classify")).toEqual({
      runtime: true,
      prompts: true,
      categories: false,
    });
  });

  test("disables autosave on the logs page", () => {
    expect(getPageAutoSaveScope("logs")).toEqual({
      runtime: false,
      prompts: false,
      categories: false,
    });
  });
});
