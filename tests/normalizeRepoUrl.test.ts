import { expect, test } from "bun:test";
import { normalizeRepoUrl } from "../src/utils/normalizeRepoUrl";

test("case, www, .git and trailing slash all collapse to one key", () => {
  const key = "https://github.com/owner/repo";
  for (const url of [
    "https://github.com/owner/repo",
    "https://GitHub.com/Owner/Repo",
    "https://www.github.com/owner/repo/",
    "https://github.com/owner/repo.git",
    "  https://github.com/owner/repo.git/  ",
  ]) {
    expect(normalizeRepoUrl(url)).toBe(key);
  }
});
