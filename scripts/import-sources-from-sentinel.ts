import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const ARCHIVE_DIR = path.join(ROOT_DIR, "docs/sources-archive");

interface SeedSource {
  id: string;
  name: string;
  kind: "rss" | "web_list" | "json_list" | "x_search" | "mp_account" | "external";
  config: Record<string, unknown>;
  tier: "T1" | "T2" | "T3";
  owner_entity_id: string | null;
  participation_mode: string;
  interval_minutes: number;
  tags: string[];
  site_fulltext: boolean;
  syndicate_fulltext: boolean;
  enabled: boolean;
}

const defaultSources = (
  JSON.parse(
    readFileSync(path.join(ROOT_DIR, "industry/sources.default.json"), "utf8"),
  ) as { sources: SeedSource[] }
).sources;

const catalog = JSON.parse(
  readFileSync(path.join(ARCHIVE_DIR, "source-catalog.json"), "utf8"),
) as Array<{
  catalog_id: string;
  name: string;
  homepage: string;
  feed_url: string | null;
  recommendation: "focus" | "on_demand" | "skip";
  category: string;
  reason?: string;
}>;

const authorFeeds = (
  JSON.parse(
    readFileSync(path.join(ARCHIVE_DIR, "author_feeds.json"), "utf8"),
  ) as {
    feeds: Array<{
      id: string;
      name: string;
      url: string;
      channel: string;
      enabled: boolean;
    }>;
  }
).feeds;

const existingUrls = new Set<string>();
const combinedSources: SeedSource[] = [];

// Helper to sanitize ID
function toSourceId(prefix: string, raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${prefix}-${slug}`;
}

// 1. Add default demo sources from AIHOT
for (const s of defaultSources) {
  const url = s.config.feedUrl as string;
  if (url) existingUrls.add(url);
  combinedSources.push({
    ...s,
    enabled: true,
  });
}

// 2. Add curated Author Feeds from Sentinel
for (const af of authorFeeds) {
  if (!af.url || !af.url.startsWith("http") || af.url.includes("localhost")) continue;
  if (existingUrls.has(af.url)) continue;
  existingUrls.add(af.url);

  combinedSources.push({
    id: toSourceId("rss", af.name || af.id),
    name: af.name,
    kind: "rss",
    config: {
      feedUrl: af.url,
      _aihot: { initialBackfillLimit: 8 },
    },
    tier: "T2",
    owner_entity_id: null,
    participation_mode: "editorial",
    interval_minutes: 180,
    tags: ["个人", "深度实践"],
    site_fulltext: false,
    syndicate_fulltext: false,
    enabled: false,
  });
}

// 3. Add Catalog items
for (const c of catalog) {
  if (!c.feed_url || !c.feed_url.startsWith("http")) continue;
  if (existingUrls.has(c.feed_url)) continue;
  existingUrls.add(c.feed_url);

  const isOfficial = [
    "openai",
    "google",
    "anthropic",
    "model-platforms",
    "open-models",
  ].includes(c.category);

  const isFocus = c.recommendation === "focus";
  const tier: "T1" | "T2" = isFocus && isOfficial ? "T1" : "T2";

  const tags: string[] = [];
  if (isOfficial) tags.push("官方");
  if (c.category === "dev-tools") tags.push("工程与工具");
  if (c.category === "authors") tags.push("个人");
  if (c.category === "research") tags.push("研究");
  if (c.category === "industry") tags.push("行业动态");
  if (tags.length === 0) tags.push("精选");

  combinedSources.push({
    id: toSourceId("rss", c.catalog_id || c.name),
    name: c.name,
    kind: "rss",
    config: {
      feedUrl: c.feed_url,
      _aihot: { initialBackfillLimit: 8 },
    },
    tier,
    owner_entity_id: null,
    participation_mode: "editorial",
    interval_minutes: tier === "T1" ? 120 : 180,
    tags,
    site_fulltext: false,
    syndicate_fulltext: false,
    // All newly imported sources disabled by default for smooth cold-start
    enabled: false,
  });
}

const outputPath = path.join(ROOT_DIR, "industry/sources.json");
writeFileSync(
  outputPath,
  JSON.stringify(
    {
      $comment:
        "AI Sentinel 精选信源库（融合原项目 1,042 项来源库与 AIHOT 官方示范源）。enabled=true 为核心首批抓取源，enabled=false 可在后台一键启用。",
      sources: combinedSources,
    },
    null,
    2,
  ),
  "utf8",
);

const enabledCount = combinedSources.filter((s) => s.enabled).length;
console.log(`Successfully generated ${combinedSources.length} sources.`);
console.log(`- Enabled (Active on day 1): ${enabledCount}`);
console.log(`- Seeded & Ready in Admin: ${combinedSources.length - enabledCount}`);
