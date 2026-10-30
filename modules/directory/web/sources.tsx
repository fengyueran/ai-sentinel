import { useEffect, useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import { SITE } from "@aihot/site";
import { edgeTtl, loadOr404 } from "@aihot/web/lib/api.server";
import { pageMeta } from "@aihot/web/lib/seo";
import { copyText } from "@aihot/web/lib/clipboard";
import { readJson, writeRaw } from "@aihot/web/lib/local-state";
import {
  IconArrowUpRight,
  IconBookmark,
  IconCheck,
  IconClose,
  IconCopy,
  IconSearch,
} from "@aihot/web/components/icons";
import { PhoneBar } from "@aihot/web/components/shell/PhoneBar";
import type { Screen } from "@aihot/web/components/shell/screens";
import type { DirectoryEntry, DirectoryResponse, DirectoryTopPortal } from "../contracts.ts";

export const handle: Screen = { tab: "me", name: "信源导航" };

const PINNED_STORAGE_KEY = "aihot-pinned-directory-sources-v1";
const STARS_STORAGE_KEY = "aihot-custom-directory-stars-v1";
const PAGE_STEP = 48;

export async function loader({ request }: { request: Request }) {
  return loadOr404<DirectoryResponse>("/api/site/directory", { signal: request.signal });
}

export function meta() {
  return pageMeta({
    title: "信源导航",
    description: `${SITE.name} 精选 AI 信源导航：收录 800+ 个已评级 AI 网站、官方博客、独立作者、评测平台与工具，一键直达原站。`,
    path: "/directory",
  });
}

export function headers() {
  return edgeTtl(300);
}

function renderStars(stars: number) {
  if (stars <= 0) return "0★";
  return "★".repeat(Math.max(1, Math.min(5, stars)));
}

function starBadgeClass(stars: number): string {
  if (stars >= 5) return "bg-amber-soft text-amber-ink border-amber/30";
  if (stars === 4) return "bg-accent-soft text-accent-ink border-accent/25";
  if (stars === 3) return "bg-well text-ink-2 border-line";
  if (stars > 0) return "bg-well text-ink-3 border-line";
  return "bg-bg-sunk text-ink-4 border-dashed border-line";
}

const STAR_OPTIONS: Array<{ stars: number; label: string; badge: string }> = [
  { stars: 5, label: "5★ 核心入口", badge: "★★★★★" },
  { stars: 4, label: "4★ 高价值补充", badge: "★★★★" },
  { stars: 3, label: "3★ 深度参考", badge: "★★★" },
  { stars: 2, label: "2★ 移出导航（≤2星删除）", badge: "★★" },
  { stars: 1, label: "1★ 移出导航（≤2星删除）", badge: "★" },
  { stars: 0, label: "0★ 移出导航（删除）", badge: "0★" },
];

function StarPicker({
  stars,
  onChange,
}: {
  stars: number;
  onChange: (newStars: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="点击手动调整星级（0~5 星）"
        aria-label="调整星级"
        aria-haspopup="true"
        aria-expanded={open}
        className={`group/star inline-flex items-center gap-1 rounded-mark border px-1.5 py-0.5 text-[10.5px] font-medium leading-none transition-all hover:border-accent hover:text-accent focus:outline-none ${starBadgeClass(
          stars,
        )}`}
      >
        <span>{renderStars(stars)}</span>
        <span className="text-[9px] opacity-60 transition-transform group-hover/star:translate-y-px">▾</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div
            role="menu"
            className="absolute left-0 top-full z-50 mt-1 min-w-[155px] overflow-hidden rounded-tile border border-line bg-raised py-1 shadow-[var(--shadow-pop)] anim-drop-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2.5 py-1 text-[11px] font-semibold text-ink-4 border-b border-line-soft">
              调整星级（0~5 星）
            </div>
            {STAR_OPTIONS.map((opt) => (
              <button
                key={opt.stars}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(opt.stars);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-bg-sunk ${
                  stars === opt.stars ? "font-bold text-accent bg-accent-softer" : "text-ink-2"
                }`}
              >
                <span>{opt.label}</span>
                <span className="mono text-[10.5px] text-ink-4">{opt.badge}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TopPortalCard({
  portal,
  pinned,
  onTogglePin,
  onUpdateStars,
}: {
  portal: DirectoryTopPortal;
  pinned: boolean;
  onTogglePin: (id: string) => void;
  onUpdateStars: (id: string, stars: number) => void;
}) {
  return (
    <li className="card card-hover group relative flex h-full flex-col p-4 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="mono inline-flex h-5 items-center rounded-mark bg-hot-soft px-1.5 text-[11.5px] font-bold text-hot">
            #{portal.rank}
          </span>
          <StarPicker stars={portal.stars} onChange={(s) => onUpdateStars(portal.id, s)} />
          <span className="truncate text-[11.5px] text-ink-4">{portal.category}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {portal.enabled && (
            <span className="inline-flex items-center rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-medium text-ok-ink">
              采集中
            </span>
          )}
          <button
            type="button"
            onClick={() => onTogglePin(portal.id)}
            title={pinned ? "取消常用置顶" : "置顶到常用直达"}
            aria-label={pinned ? `取消置顶 ${portal.name}` : `置顶 ${portal.name}`}
            className={`inline-flex size-7 items-center justify-center rounded-control transition-colors ${
              pinned ? "text-accent hover:bg-bg-sunk" : "text-ink-4 hover:bg-bg-sunk hover:text-ink-2"
            }`}
          >
            <IconBookmark size={15} filled={pinned} />
          </button>
        </div>
      </div>

      <a
        href={portal.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2.5 flex flex-1 flex-col focus:outline-none"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[15.5px] font-bold leading-snug text-ink transition-colors group-hover:text-accent">
            {portal.name}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-ink-4 group-hover:text-accent">
            <span className="mono max-w-[140px] truncate">{portal.domain}</span>
            <IconArrowUpRight
              size={13}
              className="transition-transform group-hover:-translate-y-px group-hover:translate-x-px"
            />
          </span>
        </div>
        <p className="mt-2 line-clamp-3 flex-1 text-[12.5px] leading-[1.65] text-ink-2">{portal.value}</p>
        {portal.limitation && (
          <p className="mt-2 border-t border-line-soft pt-2 line-clamp-2 text-[11.5px] leading-[1.55] text-ink-4">
            边界：{portal.limitation}
          </p>
        )}
      </a>
    </li>
  );
}

function SourceEntryCard({
  entry,
  pinned,
  onTogglePin,
  onUpdateStars,
}: {
  entry: DirectoryEntry;
  pinned: boolean;
  onTogglePin: (id: string) => void;
  onUpdateStars: (id: string, stars: number) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await copyText(entry.name);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard failure
    }
  };

  const header = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="mono text-[11.5px] font-medium text-ink-4">#{entry.rank}</span>
        <StarPicker stars={entry.stars} onChange={(s) => onUpdateStars(entry.id, s)} />
        <span className="truncate rounded-mark bg-well px-1.5 py-0.5 text-[11px] text-ink-3">{entry.category}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {entry.enabled ? (
          <span className="inline-flex items-center rounded-full bg-ok-soft px-2 py-0.5 text-[10.5px] font-medium text-ok-ink">
            采集中
          </span>
        ) : entry.collected ? (
          <span className="inline-flex items-center rounded-full bg-well px-2 py-0.5 text-[10.5px] text-ink-4">
            已建源
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => onTogglePin(entry.id)}
          title={pinned ? "取消常用置顶" : "置顶到常用直达"}
          aria-label={pinned ? `取消置顶 ${entry.name}` : `置顶 ${entry.name}`}
          className={`inline-flex size-7 items-center justify-center rounded-control transition-colors ${
            pinned ? "text-accent hover:bg-bg-sunk" : "text-ink-4 hover:bg-bg-sunk hover:text-ink-2"
          }`}
        >
          <IconBookmark size={14} filled={pinned} />
        </button>
      </div>
    </div>
  );

  if (entry.url) {
    return (
      <li className="card card-hover group flex h-full flex-col p-4 transition-colors">
        {header}
        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2.5 flex flex-1 flex-col focus:outline-none"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 break-words text-[15px] font-bold leading-snug text-ink transition-colors group-hover:text-accent">
              {entry.name}
            </span>
          </div>
          <p className="mt-1.5 line-clamp-3 flex-1 text-[12.5px] leading-[1.65] text-ink-3">{entry.advice}</p>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-line-soft pt-2.5 text-[11.5px] text-ink-4">
            <span className="mono min-w-0 truncate">{entry.domain ?? "直达链接"}</span>
            <span className="inline-flex shrink-0 items-center gap-1 font-medium text-ink-3 group-hover:text-accent">
              访问网站
              <IconArrowUpRight
                size={13}
                className="transition-transform group-hover:-translate-y-px group-hover:translate-x-px"
              />
            </span>
          </div>
        </a>
      </li>
    );
  }

  return (
    <li className="card flex h-full flex-col p-4">
      {header}
      <div className="mt-2.5 flex flex-1 flex-col">
        <span className="break-words text-[15px] font-bold leading-snug text-ink">{entry.name}</span>
        <p className="mt-1.5 line-clamp-3 flex-1 text-[12.5px] leading-[1.65] text-ink-3">{entry.advice}</p>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line-soft pt-2.5 text-[11.5px] text-ink-4">
          <span>无独立网页（公众号/多平台）</span>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-[11.5px] font-medium text-ink-3 transition-colors hover:bg-bg-sunk hover:text-ink"
          >
            {copied ? (
              <>
                <IconCheck size={13} className="text-ok" /> 已复制名称
              </>
            ) : (
              <>
                <IconCopy size={13} /> 复制名称
              </>
            )}
          </button>
        </div>
      </div>
    </li>
  );
}

export default function SourcesDirectoryPage() {
  const {
    directUrlCount,
    enabledCount,
    categories,
    topPortals,
    entries,
  } = useLoaderData<typeof loader>();

  const [query, setQuery] = useState("");
  const [starFilter, setStarFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [onlyDirectUrl, setOnlyDirectUrl] = useState<boolean>(false);
  const [onlyEnabled, setOnlyEnabled] = useState<boolean>(false);
  const [showTopPortals, setShowTopPortals] = useState<boolean>(true);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_STEP);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [starOverrides, setStarOverrides] = useState<Record<string, number>>({});

  useEffect(() => {
    const savedPinned = readJson(PINNED_STORAGE_KEY, "local");
    if (Array.isArray(savedPinned)) {
      setPinnedIds(savedPinned.filter((x): x is string => typeof x === "string"));
    }
    const savedStars = readJson(STARS_STORAGE_KEY, "local");
    if (savedStars && typeof savedStars === "object") {
      setStarOverrides(savedStars as Record<string, number>);
    }
  }, []);

  const handleUpdateStars = async (id: string, stars: number) => {
    // 1. Optimistic update
    setStarOverrides((prev) => {
      const next = { ...prev, [id]: stars };
      writeRaw(STARS_STORAGE_KEY, JSON.stringify(next), "local");
      return next;
    });

    // 2. Persist to server API
    try {
      await fetch("/api/site/directory/stars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stars }),
      });
    } catch {
      // Background network error ignored; local state already updated
    }
  };

  const togglePin = (id: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev];
      writeRaw(PINNED_STORAGE_KEY, JSON.stringify(next), "local");
      return next;
    });
  };

  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);

  const allEntries = useMemo(() => {
    return entries
      .map((e) => {
        const override = starOverrides[e.id];
        if (typeof override === "number") {
          return { ...e, stars: override };
        }
        return e;
      })
      .filter((e) => e.stars > 2);
  }, [entries, starOverrides]);

  const effectiveStarCounts = useMemo(() => {
    const counts: Record<string, number> = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0, "0": 0 };
    for (const e of allEntries) {
      counts[String(e.stars)] = (counts[String(e.stars)] ?? 0) + 1;
    }
    return counts;
  }, [allEntries]);

  const effectiveTopPortals = useMemo(() => {
    return topPortals
      .map((p) => {
        const override = starOverrides[p.id];
        if (typeof override === "number") {
          return { ...p, stars: override };
        }
        return p;
      })
      .filter((p) => p.stars > 2);
  }, [topPortals, starOverrides]);

  const entryById = useMemo(() => new Map(allEntries.map((e) => [e.id, e])), [allEntries]);
  const pinnedEntries = useMemo(
    () => pinnedIds.map((id) => entryById.get(id)).filter((e): e is DirectoryEntry => Boolean(e)),
    [pinnedIds, entryById],
  );

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allEntries.filter((e) => {
      if (onlyDirectUrl && !e.url) return false;
      if (onlyEnabled && !e.enabled) return false;
      if (starFilter === "5" && e.stars !== 5) return false;
      if (starFilter === "4" && e.stars !== 4) return false;
      if (starFilter === "3" && e.stars !== 3) return false;
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (q) {
        const hay = `${e.name} ${e.domain ?? ""} ${e.category} ${e.advice}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allEntries, onlyDirectUrl, onlyEnabled, starFilter, categoryFilter, query]);

  const shownEntries = useMemo(
    () => filteredEntries.slice(0, visibleCount),
    [filteredEntries, visibleCount],
  );

  const isFiltering = query.trim() !== "" || starFilter !== "all" || categoryFilter !== "all" || onlyEnabled || onlyDirectUrl;

  return (
    <div className="mx-auto max-w-[var(--page-max-wide)] pb-12">
      <PhoneBar back={{ to: "/more", label: "我的" }} title="信源导航" />

      <header className="pb-4 pt-2 lg:pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 data-page-title="" className="text-[24px] font-semibold leading-[1.3] text-ink">
              信源导航
            </h1>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-3">
              收录并评级的 AI 网站、官方一手博客、独立作者、评测平台与实战工具，点击卡片直接跳往对应网站；支持点击星标调整评分。
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-line pb-4">
          <span className="flex items-baseline gap-1.5">
            <span className="mono text-[22px] font-semibold text-ink">{allEntries.length}</span>
            <span className="text-[12px] text-ink-4">精选信源（3★及以上）</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="mono text-[22px] font-semibold text-accent-ink">{directUrlCount}</span>
            <span className="text-[12px] text-ink-4">可直达网站</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="mono text-[22px] font-semibold text-amber-ink">{effectiveStarCounts["5"] ?? 0}</span>
            <span className="text-[12px] text-ink-4">5★ 核心入口</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="mono text-[22px] font-semibold text-accent-ink">{effectiveStarCounts["4"] ?? 0}</span>
            <span className="text-[12px] text-ink-4">4★ 高价值补充</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="mono text-[22px] font-semibold text-ink-2">{effectiveStarCounts["3"] ?? 0}</span>
            <span className="text-[12px] text-ink-4">3★ 深度参考</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="mono text-[22px] font-semibold text-ok-ink">{enabledCount}</span>
            <span className="text-[12px] text-ink-4">站内自动采集中</span>
          </span>
        </div>
      </header>

      {/* 1. 读者自己在浏览器里置顶的常用网站 */}
      {pinnedEntries.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[16px] font-bold text-ink">我的常用置顶</h2>
              <span className="mono text-[12px] text-ink-4">{pinnedEntries.length}</span>
            </div>
            <span className="text-[12px] text-ink-4">保存在当前浏览器，点卡片右上角书签即可增删</span>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedEntries.map((entry) => (
              <SourceEntryCard
                key={`pin-${entry.id}`}
                entry={entry}
                pinned={true}
                onTogglePin={togglePin}
                onUpdateStars={handleUpdateStars}
              />
            ))}
          </ul>
        </section>
      )}

      {/* 2. 个人优先关注的 10 个核心入口（5★） */}
      {!isFiltering && effectiveTopPortals.length > 0 && (
        <section className="mb-9">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h2 className="text-[17px] font-bold text-ink">优先关注的 10 个核心入口</h2>
              <span className="inline-flex items-center rounded-mark bg-amber-soft px-1.5 py-0.5 text-[11px] font-medium text-amber-ink">
                ★★★★★ 精选组合
              </span>
              <span className="text-[12.5px] text-ink-4">
                覆盖中文快讯、深度精讲、英文扫描、模型评测与 AI 协作方法
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowTopPortals((v) => !v)}
              className="text-[12.5px] text-ink-3 transition-colors hover:text-accent"
            >
              {showTopPortals ? "收起" : "展开 Top 10"}
            </button>
          </div>
          {showTopPortals && (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
              {effectiveTopPortals.map((portal) => (
                <TopPortalCard
                  key={portal.id}
                  portal={portal}
                  pinned={pinnedSet.has(portal.id)}
                  onTogglePin={togglePin}
                  onUpdateStars={handleUpdateStars}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 3. 搜索与多维筛选栏 */}
      <section aria-label="信源筛选与全量列表">
        <div className="card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-4">
                <IconSearch size={16} />
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setVisibleCount(PAGE_STEP);
                }}
                placeholder="搜网站名称、域名或用法关键词（如 OpenAI、Claude、Agent、周刊、评测、播客）…"
                aria-label="搜索信源"
                className="h-10 w-full rounded-control border border-line bg-bg pl-9 pr-9 text-[14px] text-ink placeholder:text-ink-4 focus:border-accent focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setVisibleCount(PAGE_STEP);
                  }}
                  aria-label="清空搜索"
                  className="absolute inset-y-0 right-2.5 flex items-center text-ink-4 hover:text-ink"
                >
                  <IconClose size={15} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setOnlyDirectUrl((v) => !v);
                  setVisibleCount(PAGE_STEP);
                }}
                className={`inline-flex h-9 items-center gap-1.5 rounded-control border px-3 text-[12.5px] font-medium transition-colors ${
                  onlyDirectUrl
                    ? "border-accent/40 bg-accent-soft text-accent-ink"
                    : "border-line bg-surface text-ink-3 hover:border-line-strong"
                }`}
              >
                <span>仅看可直达网站</span>
                <span className="mono text-[11.5px] opacity-80">{directUrlCount}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOnlyEnabled((v) => !v);
                  setVisibleCount(PAGE_STEP);
                }}
                className={`inline-flex h-9 items-center gap-1.5 rounded-control border px-3 text-[12.5px] font-medium transition-colors ${
                  onlyEnabled
                    ? "border-ok/40 bg-ok-soft text-ok-ink"
                    : "border-line bg-surface text-ink-3 hover:border-line-strong"
                }`}
              >
                <span>站内采集中</span>
                <span className="mono text-[11.5px] opacity-80">{enabledCount}</span>
              </button>
            </div>
          </div>

          {/* 星级筛选 */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line-soft pt-3">
            <span className="mr-1 text-[12px] text-ink-4">优先级：</span>
            {[
              { key: "all", label: "全部精选", count: allEntries.length },
              { key: "5", label: "★★★★★ 核心入口", count: effectiveStarCounts["5"] ?? 0 },
              { key: "4", label: "★★★★ 高价值补充", count: effectiveStarCounts["4"] ?? 0 },
              { key: "3", label: "★★★ 深度参考", count: effectiveStarCounts["3"] ?? 0 },
            ].map((item) => {
              const active = starFilter === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setStarFilter(item.key);
                    setVisibleCount(PAGE_STEP);
                  }}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition-colors ${
                    active
                      ? "border-accent bg-accent text-accent-contrast font-medium"
                      : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={`mono text-[11px] ${active ? "text-accent-contrast/90" : "text-ink-4"}`}>
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 分类筛选 */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[12px] text-ink-4">分　类：</span>
            <button
              type="button"
              onClick={() => {
                setCategoryFilter("all");
                setVisibleCount(PAGE_STEP);
              }}
              className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px] transition-colors ${
                categoryFilter === "all"
                  ? "border-accent bg-accent text-accent-contrast font-medium"
                  : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink"
              }`}
            >
              全部类别
            </button>
            {categories.map((cat) => {
              const active = categoryFilter === cat.name;
              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(cat.name);
                    setVisibleCount(PAGE_STEP);
                  }}
                  className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px] transition-colors ${
                    active
                      ? "border-accent bg-accent text-accent-contrast font-medium"
                      : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink"
                  }`}
                >
                  <span>{cat.name}</span>
                  <span className={`mono text-[11px] ${active ? "text-accent-contrast/90" : "text-ink-4"}`}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 结果统计与重置 */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 px-0.5">
          <div className="text-[13px] text-ink-3">
            当前匹配 <span className="mono font-semibold text-ink">{filteredEntries.length}</span> 个信源
            {onlyDirectUrl ? (
              <span className="text-ink-4">（已过滤无独立网页的条目）</span>
            ) : (
              <span className="text-ink-4">（全量已评级信源，共 {allEntries.length} 项）</span>
            )}
          </div>
          {isFiltering && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStarFilter("all");
                setCategoryFilter("all");
                setOnlyDirectUrl(false);
                setOnlyEnabled(false);
                setVisibleCount(PAGE_STEP);
              }}
              className="text-[12.5px] font-medium text-accent hover:underline"
            >
              重置筛选条件
            </button>
          )}
        </div>

        {/* 卡片网格 */}
        {shownEntries.length === 0 ? (
          <div className="card mt-4 p-10 text-center">
            <p className="text-[14px] text-ink-3">没有找到匹配的信源</p>
          </div>
        ) : (
          <>
            <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shownEntries.map((entry) => (
                <SourceEntryCard
                  key={entry.id}
                  entry={entry}
                  pinned={pinnedSet.has(entry.id)}
                  onTogglePin={togglePin}
                  onUpdateStars={handleUpdateStars}
                />
              ))}
            </ul>

            {filteredEntries.length > visibleCount && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_STEP)}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-6 text-[13.5px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-accent"
                >
                  <span>加载更多信源</span>
                  <span className="mono text-[12px] text-ink-4">
                    （已显示 {shownEntries.length} / {filteredEntries.length}）
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
