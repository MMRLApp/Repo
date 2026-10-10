#!/usr/bin/env node
/**
 * generate-modules-json.mjs
 * ---------------------------------------------------------------------------
 * Calls the MMRL Platform API (see openapi.json) and adapts its response into
 * the flat "modules.json" repo format that MMRL/Magisk module managers expect
 * (id, name, version, versionCode, permissions, track, versions[], ...).
 *
 * Each module's full `description` is saved to modules/<id>/README.md and the
 * raw link to that file is used for the `readme` prop.
 *
 * Required env vars:
 *   MMRL_API_BASE_URL   e.g. https://mmrl.dergoogler.com/api
 *   MMRL_API_KEY        API key with "read" scope (sent as X-API-Key header)
 *   MMRL_RAW_BASE_URL   raw base of the repo + branch the output is pushed to,
 *                        e.g. https://raw.githubusercontent.com/<owner>/<repo>/main
 *
 * Optional env vars:
 *   MMRL_OUTPUT_PATH    where to write the result (default: ./modules.json)
 *   MMRL_META_PATH      path to the repo-level static metadata JSON
 *                        (default: ./repo.meta.json)
 *   MMRL_CONCURRENCY    how many modules to fetch in parallel (default: 8)
 *
 * Usage (run from the repo root so modules/<id>/README.md lands in the repo):
 *   MMRL_API_BASE_URL=https://example.com/api \
 *   MMRL_API_KEY=xxxx \
 *   MMRL_RAW_BASE_URL=https://raw.githubusercontent.com/you/repo/main \
 *   node scripts/generate-modules-json.mjs
 * ---------------------------------------------------------------------------
 * NOTE ON FIELD MAPPING
 * The public API's ModuleResponseSchema / ReleaseResponseSchema do not carry
 * every field the legacy modules.json format has (versionCode, permissions,
 * "features" as capability flags, "stars", "note", etc. are not part of the
 * API response). Those fields are marked below with a comment; adjust the
 * mapping functions once you know exactly which of your real API fields
 * should feed them (or extend the API to return them).
 * ---------------------------------------------------------------------------
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const API_BASE_URL = requireEnv("MMRL_API_BASE_URL");
const API_KEY = requireEnv("MMRL_API_KEY");
// Base for raw links, e.g. https://raw.githubusercontent.com/<owner>/<repo>/<branch>
const RAW_BASE_URL = requireEnv("MMRL_RAW_BASE_URL").replace(/\/$/, "");
const OUTPUT_PATH = process.env.MMRL_OUTPUT_PATH || "./modules.json";
const MODULES_PATH = "modules";
const META_PATH = process.env.MMRL_META_PATH || "./repo.meta.json";
const CONCURRENCY = Number(process.env.MMRL_CONCURRENCY || 8);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

/** Thin fetch wrapper: adds the API key header, retries transient failures. */
async function apiGet(path, { retries = 3 } = {}) {
  const url = `${API_BASE_URL.replace(/\/$/, "")}${path}`;
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "X-API-Key": API_KEY,
          Accept: "application/json",
        },
      });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") || 2);
        await sleep(retryAfter * 1000);
        continue;
      }
      if (!res.ok) {
        throw new Error(`GET ${path} -> ${res.status} ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(500 * attempt);
    }
  }
  throw lastErr;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs `worker` over `items` with at most `limit` in flight at once. */
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

/** Converts an ISO date-time string to a Unix epoch in seconds (float, matching the sample file). */
function toEpochSeconds(isoString) {
  if (!isoString) return 0;
  return new Date(isoString).getTime() / 1000;
}

/**
 * The legacy format wants a numeric `versionCode` per release. The API's
 * ReleaseResponseSchema doesn't expose one, so this pulls the first run of
 * digits out of the version string (e.g. "v1.6.1" -> 161, "2.1.1 (7790)" ->
 * 7790, preferring a trailing "(NNNN)" build number when present) and falls
 * back to a monotonically increasing counter so ordering stays stable.
 * Replace this with real versionCode data as soon as your API exposes it.
 */
function deriveVersionCode(version, fallbackIndex) {
  const buildNumberMatch = version.match(/\((\d+)\)/);
  if (buildNumberMatch) return Number(buildNumberMatch[1]);

  const digitsOnly = version.replace(/[^\d]/g, "");
  if (digitsOnly) return Number(digitsOnly.slice(0, 9)); // guard against absurdly long numbers

  return fallbackIndex;
}

/** size may come back as a string ("1.2 MB") or numeric bytes depending on your API; normalize to bytes where possible. */
function normalizeSize(size) {
  if (size == null) return undefined;
  if (typeof size === "number") return size;
  const numeric = Number(size);
  return Number.isFinite(numeric) ? numeric : undefined;
}

/** Only allow ids that can't escape modules/ (no slashes, no ".."). */
function assertSafeId(id) {
  if (!/^[A-Za-z0-9._-]+$/.test(id) || id === "." || id === "..") {
    throw new Error(`Unsafe module id "${id}"`);
  }
}

/**
 * Saves module.description to modules/<id>/README.md and returns the raw URL,
 * or undefined if the module has no description.
 */
async function writeModuleReadme(module) {
  const description = module.description?.trim();
  if (!description) return undefined;

  assertSafeId(module.id);
  const dir = join(MODULES_PATH, module.id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "README.md"), description + "\n", "utf8");

  return `${RAW_BASE_URL}/${MODULES_PATH}/${encodeURIComponent(module.id)}/README.md`;
}

/** Maps one release (ReleaseResponseSchema) to the legacy `versions[]` entry shape. */
function adaptRelease(release, fallbackIndex) {
  return {
    timestamp: toEpochSeconds(release.createdAt),
    version: release.version,
    versionCode: deriveVersionCode(release.version, fallbackIndex),
    zipUrl: release.downloadUrl,
    changelog: release.changelog || "",
    size: normalizeSize(release.size),
  };
}

/** Maps one module + its releases (ModuleResponseSchema + ReleaseResponseSchema[]) to a legacy module entry. */
function adaptModule(module, releases, readmeUrl) {
  const sortedReleases = [...releases].sort(
    (a, b) => toEpochSeconds(a.createdAt) - toEpochSeconds(b.createdAt)
  );
  const latest =
    sortedReleases.find((r) => r.isLatest) ??
    sortedReleases[sortedReleases.length - 1];

  const versions = sortedReleases.map((release, index) =>
    adaptRelease(release, index + 1)
  );

  const adapted = {
    id: module.moduleId ?? module.id,
    name: module.name,
    version: latest?.version ?? "unknown",
    versionCode: latest
      ? deriveVersionCode(latest.version, versions.length)
      : 0,
    author: module.author,
    // The full text now lives in the README, so keep description short here.
    description:
      module.shortDescription || module.description?.split("\n")[0] || "",
    readme: readmeUrl,
    support: module.communityUrl || undefined,
    // `donate`, `note` have no API equivalent yet — omit rather than fabricate.
    license: module.license || undefined,
    categories: module.category ? [module.category] : undefined,
    verified: Boolean(module.isFeatured || module.isRecommended),
    added: sortedReleases[0] ? toEpochSeconds(sortedReleases[0].createdAt) : 0,
    timestamp: toEpochSeconds(module.lastUpdated),
    size: latest ? normalizeSize(latest.size) : undefined,
    // `permissions` / `features` (post_fs_data, service, action, zygisk, ...) are
    // build-time capability flags the API doesn't currently expose per module.
    // Left empty rather than guessed — fill in once your backend returns them.
    permissions: [],
    features: {},
    stars: module.ratingCount ?? module.downloads ?? undefined,
    track: {
      type: "ONLINE_JSON",
      added: sortedReleases[0] ? toEpochSeconds(sortedReleases[0].createdAt) : null,
      source: module.sourceUrl || "",
      antifeatures: module.isOpenSource ? null : ["ClosedSource"],
      build_metadata: null,
    },
    versions,
  };

  // Drop undefined keys so the output stays clean (matches the style of the sample file).
  for (const key of Object.keys(adapted)) {
    if (adapted[key] === undefined) delete adapted[key];
  }
  return adapted;
}

async function fetchAllModuleSummaries() {
  const { modules } = await apiGet(`/modules`);
  return modules;
}

async function fetchModuleWithReleases(id) {
  const [{ module }, { releases }] = await Promise.all([
    apiGet(`/modules/${encodeURIComponent(id)}`),
    apiGet(`/modules/${encodeURIComponent(id)}/releases?includeAssets=false`),
  ]);
  return { module, releases };
}

async function loadRepoMeta() {
  const raw = await readFile(META_PATH, "utf8");
  return JSON.parse(raw);
}

async function loadPreviousVersion() {
  try {
    const raw = await readFile(OUTPUT_PATH, "utf8");
    const previous = JSON.parse(raw);
    return previous?.metadata?.version ?? 0;
  } catch {
    return 0;
  }
}

async function main() {
  console.log(`Fetching module list from ${API_BASE_URL} ...`);
  const summaries = await fetchAllModuleSummaries();
  console.log(`Found ${summaries.length} modules. Fetching details + releases ...`);

  const detailed = await mapWithConcurrency(summaries, CONCURRENCY, async (summary) => {
    try {
      const { module, releases } = await fetchModuleWithReleases(summary.id);
      const readmeUrl = await writeModuleReadme(module);
      return adaptModule(module, releases, readmeUrl);
    } catch (err) {
      console.error(`  ! Skipping module "${summary.id}": ${err.message}`);
      return null;
    }
  });

  const modules = detailed.filter(Boolean).sort((a, b) => a.id.localeCompare(b.id));

  const repoMeta = await loadRepoMeta();
  const previousVersion = await loadPreviousVersion();

  const output = {
    ...repoMeta,
    metadata: {
      version: 1,
      timestamp: Date.now() / 1000,
    },
    modules,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true }).catch(() => {});
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf8");

  console.log(`Wrote ${modules.length} modules to ${OUTPUT_PATH} (repo version ${output.metadata.version}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
