require("dotenv").config();

const GITHUB_API_URL = "https://api.github.com/search/repositories";

/**
 * Parse command line arguments like:
 * --from=2025-01-01 --to=2025-12-31 --limit=10
 */
function parseArgs(argv) {
  const args = {};

  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;

    const [key, value] = arg.slice(2).split("=");

    if (value === undefined) {
      args[key] = true;
    } else {
      args[key] = value;
    }
  }

  return args;
}

/**
 * Validate YYYY-MM-DD
 */
function isValidDateString(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

  const date = new Date(dateStr);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(dateStr);
}

/**
 * Build the GitHub search query.
 * Examples:
 * created:2025-01-01..2025-12-31
 * stars:>1
 */
function buildSearchQuery(from, to) {
  if (from && !isValidDateString(from)) {
    throw new Error(`Invalid --from date: ${from}. Use YYYY-MM-DD`);
  }

  if (to && !isValidDateString(to)) {
    throw new Error(`Invalid --to date: ${to}. Use YYYY-MM-DD`);
  }

  let createdQualifier = "";

  if (from && to) {
    createdQualifier = `created:${from}..${to}`;
  } else if (from) {
    createdQualifier = `created:>=${from}`;
  } else if (to) {
    createdQualifier = `created:<=${to}`;
  }

  const parts = [
    "stars:>1",
    "is:public",
  ];

  if (createdQualifier) {
    parts.push(createdQualifier);
  }

  return parts.join(" ");
}

/**
 * Fetch most starred repos from GitHub search API.
 */
async function fetchMostStarredRepos({ from, to, limit }) {
  const query = buildSearchQuery(from, to);

  const params = new URLSearchParams({
    q: query,
    sort: "stars",
    order: "desc",
    per_page: String(limit),
    page: "1",
  });

  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2026-03-10",
    "User-Agent": "github-stars-cli",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(`${GITHUB_API_URL}?${params.toString()}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText}\n${errorText}`
    );
  }

  const data = await response.json();

  if (!data.items || !Array.isArray(data.items)) {
    throw new Error("Unexpected API response format.");
  }

  return data.items;
}

/**
 * Print results nicely in terminal.
 */
function printRepos(repos) {
  if (repos.length === 0) {
    console.log("No repositories found for that date range.");
    return;
  }

  repos.forEach((repo, index) => {
    console.log(`${index + 1}. ${repo.full_name}`);
    console.log(`   Stars: ${repo.stargazers_count}`);
    console.log(`   Created: ${repo.created_at}`);
    console.log(`   URL: ${repo.html_url}`);
    console.log(`   Description: ${repo.description ?? "No description"}`);
    console.log("");
  });
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));

    const from = args.from || null;
    const to = args.to || null;
    const limit = args.limit ? Number(args.limit) : 10;

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("--limit must be an integer between 1 and 100");
    }

    const repos = await fetchMostStarredRepos({ from, to, limit });
    printRepos(repos);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();