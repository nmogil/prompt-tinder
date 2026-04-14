/// <reference types="vite/client" />
import { describe, test, expect } from "vitest";
import { GOLDEN_FIXTURES } from "../lib/__tests__/optimizerFixtures";
import { validateOptimizerOutput } from "../lib/optimizerValidation";

describe("Golden fixtures pass validation", () => {
  for (const fixture of GOLDEN_FIXTURES) {
    test(`${fixture.name}: reference output passes all validation checks`, () => {
      const result = validateOptimizerOutput(
        JSON.stringify(fixture.referenceOutput),
        fixture.input,
      );
      expect(result.ok).toBe(true);
    });
  }
});
