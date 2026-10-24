// "https://www.GitHub.com/Owner/Repo.git/" and "https://github.com/owner/repo" are the same repo.
export function normalizeRepoUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "https://")
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");
}
