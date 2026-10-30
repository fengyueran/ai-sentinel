import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "@aihot/backend/db";
import type { DirectoryCategoryCount, DirectoryEntry, DirectoryResponse, DirectoryTopPortal } from "../contracts.ts";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const SOURCES_MD = path.join(ROOT, "docs/sources-archive/ai-sources.md");
const REGISTRY_JSON = path.join(ROOT, "docs/sources-archive/ai-source-registry.json");

interface RegistryEvidence {
  title?: string;
  url?: string;
}

interface RegistryRecord {
  id: string;
  homepage?: string | null;
  attention_review?: {
    evidence?: RegistryEvidence[];
  };
}

interface ParsedArchive {
  totalRecords: number;
  topMeta: Map<number, { value: string; limitation: string; url: string }>;
  rawEntries: Array<{
    id: string;
    rank: number;
    name: string;
    url: string | null;
    domain: string | null;
    category: string;
    stars: number;
    advice: string;
  }>;
}

let parsedCache: ParsedArchive | null = null;

function cleanText(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

function domainOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function extractUrl(nameCol: string, evCol: string, reg?: RegistryRecord): string | null {
  const linkMatch = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/.exec(nameCol);
  if (linkMatch?.[2]) return linkMatch[2];
  if (reg?.homepage && /^https?:\/\//.test(reg.homepage)) return reg.homepage;
  const auditLink = /\[审读入口\]\((https?:\/\/[^)]+)\)/.exec(evCol);
  if (auditLink?.[1]) return auditLink[1];
  for (const ev of reg?.attention_review?.evidence ?? []) {
    const titleLink = ev.title ? /\[[^\]]+\]\((https?:\/\/[^)]+)\)/.exec(ev.title) : null;
    if (titleLink?.[1]) return titleLink[1];
  }
  for (const ev of reg?.attention_review?.evidence ?? []) {
    if (
      ev.url &&
      /^https?:\/\//.test(ev.url) &&
      !ev.url.includes("google.com/search") &&
      !ev.url.includes("douyin.com/video/")
    ) {
      try {
        const u = new URL(ev.url);
        if (u.hostname === "x.com" || u.hostname === "twitter.com") {
          const parts = u.pathname.split("/").filter(Boolean);
          if (parts[0]) return `https://x.com/${parts[0]}`;
        }
        return u.origin;
      } catch {
        // ignore invalid URL
      }
    }
  }
  return null;
}

function parseArchive(): ParsedArchive {
  if (parsedCache) return parsedCache;
  if (!existsSync(SOURCES_MD)) {
    parsedCache = { totalRecords: 0, topMeta: new Map(), rawEntries: [] };
    return parsedCache;
  }

  const md = readFileSync(SOURCES_MD, "utf8");
  const regMap = new Map<string, RegistryRecord>();
  let totalRecords = 1042;

  if (existsSync(REGISTRY_JSON)) {
    try {
      const reg = JSON.parse(readFileSync(REGISTRY_JSON, "utf8")) as {
        statistics?: { total_records?: number };
        entries?: RegistryRecord[];
      };
      if (reg.statistics?.total_records) totalRecords = reg.statistics.total_records;
      for (const e of reg.entries ?? []) regMap.set(e.id, e);
    } catch {
      // fallback to markdown only
    }
  }

  const topMeta = new Map<number, { value: string; limitation: string; url: string }>();
  const topRegex = /^\|\s*(\d+)\s*\|\s*\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*\|\s*★+\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/gm;
  for (const m of md.matchAll(topRegex)) {
    const rank = Number(m[1]);
    if (rank >= 1 && rank <= 10) {
      topMeta.set(rank, {
        url: m[3]!.trim(),
        value: cleanText(m[4]!),
        limitation: cleanText(m[5]!),
      });
    }
  }

  const rawEntries: ParsedArchive["rawEntries"] = [];
  const rowRegex = /^\|\s*<a id="([^"]+)"><\/a>(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/gm;
  for (const m of md.matchAll(rowRegex)) {
    const id = m[1]!.trim();
    const rank = Number(m[2]);
    const nameCol = m[3]!.trim();
    const category = cleanText(m[4]!);
    const starCol = m[5]!.trim();
    const stars = starCol.includes("★") ? (starCol.match(/★/g) || []).length : 0;
    const advice = cleanText(m[6]!);
    const evCol = m[7]!.trim();

    const nameMatch = /\[([^\]]+)\]\(https?:\/\/[^)]+\)/.exec(nameCol);
    const name = cleanText(nameMatch ? nameMatch[1]! : nameCol);
    const url = extractUrl(nameCol, evCol, regMap.get(id));

    rawEntries.push({
      id,
      rank,
      name,
      url,
      domain: domainOf(url),
      category,
      stars,
      advice,
    });
  }

  parsedCache = { totalRecords, topMeta, rawEntries };
  return parsedCache;
}

function normName(name: string): string {
  return name.toLowerCase().replace(/[\s·/（）()&-]+/g, "");
}

export async function loadDirectory(): Promise<DirectoryResponse> {
  const { totalRecords, topMeta, rawEntries } = parseArchive();

  let starOverrides: Record<string, number> = {};
  try {
    const [row] = await sql<{ value: Record<string, number> }[]>`
      SELECT value FROM settings WHERE key = 'directory.stars'
    `;
    if (row?.value && typeof row.value === "object") {
      starOverrides = row.value;
    }
  } catch {
    // DB unavailable or settings table not queried
  }

  const dbByCatalogId = new Map<string, { enabled: boolean }>();
  const dbByName = new Map<string, { enabled: boolean }>();
  try {
    const rows = await sql<Array<{ id: string; name: string; enabled: boolean }>>`
      SELECT id, name, enabled FROM sources
    `;
    for (const r of rows) {
      const cid = r.id.replace(/^(rss|web|json|x|wechat)-/, "");
      dbByCatalogId.set(cid, { enabled: r.enabled });
      dbByName.set(normName(r.name), { enabled: r.enabled });
    }
  } catch {
    // DB unavailable or empty in standalone environments
  }

  const starCounts: Record<string, number> = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0, "0": 0 };
  const catMap = new Map<string, number>();
  let directUrlCount = 0;
  let collectedCount = 0;
  let enabledCount = 0;

  const entries: DirectoryEntry[] = [];
  for (const e of rawEntries) {
    const override = starOverrides[e.id] ?? (e.rank ? starOverrides[String(e.rank)] : undefined);
    const effectiveStars = typeof override === "number" ? Math.max(0, Math.min(5, Math.round(override))) : e.stars;
    // 两星及以下的源全部删除/不展示（保留 3★ 及以上高价值精选信源；降级为 ≤2 星亦视为移出导航）
    if (effectiveStars <= 2) continue;

    const dbMatch = dbByCatalogId.get(e.id) ?? dbByName.get(normName(e.name));
    const collected = Boolean(dbMatch);
    const enabled = Boolean(dbMatch?.enabled);

    if (e.url) directUrlCount++;
    if (collected) collectedCount++;
    if (enabled) enabledCount++;
    starCounts[String(effectiveStars)] = (starCounts[String(effectiveStars)] ?? 0) + 1;
    catMap.set(e.category, (catMap.get(e.category) ?? 0) + 1);

    entries.push({
      ...e,
      stars: effectiveStars,
      collected,
      enabled,
    });
  }

  const categories: DirectoryCategoryCount[] = [...catMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const topPortals: DirectoryTopPortal[] = entries
    .filter((e) => e.rank >= 1 && e.rank <= 10)
    .map((e) => {
      const meta = topMeta.get(e.rank);
      const url = e.url ?? meta?.url ?? "https://aihot.news/";
      return {
        rank: e.rank,
        id: e.id,
        name: e.name,
        url,
        domain: domainOf(url) ?? "",
        category: e.category,
        stars: e.stars,
        value: meta?.value ?? e.advice,
        limitation: meta?.limitation ?? "",
        collected: e.collected,
        enabled: e.enabled,
      };
    });

  return {
    totalRecords: entries.length,
    ratedCount: entries.length,
    directUrlCount,
    collectedCount,
    enabledCount,
    starCounts,
    categories,
    topPortals,
    entries,
  };
}

export async function saveStarOverride(id: string, stars: number): Promise<void> {
  const cleanStars = Math.max(0, Math.min(5, Math.round(stars)));
  try {
    await sql`
      INSERT INTO settings (key, value, updated_by)
      VALUES ('directory.stars', ${sql.json({ [id]: cleanStars })}, 'directory')
      ON CONFLICT (key) DO UPDATE
      SET value = settings.value || EXCLUDED.value, updated_at = now()
    `;
  } catch (err) {
    console.warn("Failed to persist star override to DB settings:", err);
  }
}
