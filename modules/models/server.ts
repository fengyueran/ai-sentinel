import path from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { defineServerModule } from "@aihot/backend/modules";
import { config, credential } from "@aihot/backend/config";
import { cached } from "@aihot/backend/lib/cache";
import { actorOf } from "@aihot/backend/admin/auth";
import { LEADERBOARD_PUBLIC_BOARDS, type LeaderboardBoardKey } from "@aihot/contracts/taxonomy";
import { CODEX_RESET_SCAN_MINUTES } from "@aihot/contracts/monitor";
import { applyPublicHeaders, sendJsonWithEtag, sendProblem } from "@aihot/api/http/respond";
import { siteHandler } from "@aihot/api/routes/site";
import { adminHandler } from "@aihot/api/routes/admin-auth";
import { q, body, param, orNotFound, page } from "@aihot/api/routes/admin";
import { sendFile } from "@aihot/api/routes/static";

import { loadBoard, loadModel, loadRulesData, loadSource, loadSources, NoLeaderboardRun } from "./backend/leaderboard/read.ts";
import { runLeaderboardRound } from "./backend/leaderboard/method/run.ts";
import { refreshLeaderboard } from "./backend/leaderboard/fetch/refresh.ts";
import {
  codexResetVersion,
  codexResetsRecent,
  codexResetsSnapshot,
  loadSiteCodexResetDay,
  loadSiteCodexResetPage,
} from "./backend/monitor/read.ts";
import { monitorTick } from "./backend/monitor/scan.ts";
import {
  listMonitorEvents,
  listMonitorPosts,
  relinkPost,
  resolveMonitorPost,
  reviewReceipt,
  setWithdrawn,
  updateMonitorEvent,
} from "./backend/admin/monitor.ts";

const LB_CACHE = "public, max-age=120, s-maxage=300, stale-while-revalidate=600";
const ASSETS_SOURCES = path.join(import.meta.dirname, "assets/leaderboard-sources");
const ASSETS_PROVIDERS = path.join(import.meta.dirname, "assets/model-providers");

const collecting = () => process.env.COLLECT_ENABLED === "true";

const codexVersion = cached(() => codexResetVersion(), { freshMs: 5_000, maxStaleMs: 5_000 });

export default defineServerModule({
  name: "models",
  models: {
    monitor: { label: "Codex 重置公告识别", env: "MONITOR_MODEL", purposes: ["monitor.recognize", "monitor.context"] },
  },
  schedules: [
    {
      name: "leaderboard.round",
      cron: "5 2,8,14,20 * * *",
      missed: "once",
      run: () => (collecting() ? refreshLeaderboard() : runLeaderboardRound()),
    },
    {
      name: "monitor.tick",
      cron: `*/${CODEX_RESET_SCAN_MINUTES} * * * *`,
      run: () => monitorTick(),
      when: () => Boolean(collecting() && credential("collectors", "SOCIALDATA_API_KEY")),
    },
    {
      name: "monitor.lookback",
      cron: "40 4 * * *",
      run: () => monitorTick({ lookbackHours: 48 }),
      when: () => Boolean(collecting() && credential("collectors", "SOCIALDATA_API_KEY")),
    },
  ],
  http(app: FastifyInstance) {
    const lbGuarded = (fn: Parameters<typeof siteHandler>[0]) =>
      siteHandler(async (req, reply) => {
        try {
          return await fn(req, reply);
        } catch (error) {
          if (error instanceof NoLeaderboardRun) {
            return sendProblem(req, reply, { status: 503, code: "temporarily_unavailable", detail: "leaderboard not computed yet", retryAfter: 300 });
          }
          throw error;
        }
      });

    const notFound = (req: Parameters<typeof sendProblem>[0], reply: Parameters<typeof sendProblem>[1]) =>
      sendProblem(req, reply, { status: 404, code: "not_found", detail: "not found", cacheControl: "public, max-age=60" });

    // Leaderboard Public API
    app.get("/api/site/leaderboard/boards/:key", lbGuarded(async (req, reply) => {
      const key = (req.params as { key: string }).key;
      if (!(LEADERBOARD_PUBLIC_BOARDS as readonly string[]).includes(key)) return notFound(req, reply);
      const data = await loadBoard(key as LeaderboardBoardKey);
      if (!data) return notFound(req, reply);
      return sendJsonWithEtag(req, reply, data, { etagPrefix: `lb-${key}`, cacheControl: LB_CACHE });
    }));

    app.get("/api/site/leaderboard/models/:slug", lbGuarded(async (req, reply) => {
      const data = await loadModel((req.params as { slug: string }).slug);
      if (!data) return notFound(req, reply);
      return sendJsonWithEtag(req, reply, data, { etagPrefix: "lb-model", cacheControl: LB_CACHE });
    }));

    app.get("/api/site/leaderboard/sources", lbGuarded(async (req, reply) => {
      return sendJsonWithEtag(req, reply, await loadSources(), { etagPrefix: "lb-sources", cacheControl: LB_CACHE });
    }));

    app.get("/api/site/leaderboard/sources/:key", lbGuarded(async (req, reply) => {
      const data = await loadSource((req.params as { key: string }).key);
      if (!data) return notFound(req, reply);
      return sendJsonWithEtag(req, reply, data, { etagPrefix: "lb-source", cacheControl: LB_CACHE });
    }));

    app.get("/api/site/leaderboard/rules", lbGuarded(async (req, reply) => {
      return sendJsonWithEtag(req, reply, await loadRulesData(), { etagPrefix: "lb-rules", cacheControl: LB_CACHE });
    }));

    // Codex Reset Public API
    app.get("/api/site/codex-reset", siteHandler(async (req, reply) => {
      return sendJsonWithEtag(req, reply, await loadSiteCodexResetPage(), { etagPrefix: "codex-page", cacheControl: "public, max-age=30, s-maxage=30" });
    }));

    app.get("/api/site/codex-reset/days/:date", siteHandler(async (req, reply) => {
      const { date } = req.params as { date: string };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
        return sendProblem(req, reply, { status: 404, code: "not_found", detail: "date not found" });
      }
      return sendJsonWithEtag(req, reply, await loadSiteCodexResetDay(date), { etagPrefix: "codex-day", cacheControl: "no-store" });
    }));

    app.get("/api/site/codex-reset/version", siteHandler(async (req, reply) => {
      return sendJsonWithEtag(req, reply, await codexVersion.get(), { etagPrefix: "codex-version", cacheControl: "public, max-age=0, s-maxage=15" });
    }));

    app.get("/api/v1/codex-resets", async (req, reply) => {
      applyPublicHeaders(reply);
      reply.header("Link", `<${config.siteUrl}/api/v1/codex-resets/recent>; rel="alternate"; type="application/json"`);
      const data = await codexResetsSnapshot();
      return sendJsonWithEtag(req, reply, data, { etagPrefix: "v1-codex-resets", cacheControl: "public, max-age=60, s-maxage=60, stale-while-revalidate=60" });
    });

    app.get("/api/v1/codex-resets/recent", async (req, reply) => {
      applyPublicHeaders(reply);
      const data = await codexResetsRecent();
      return sendJsonWithEtag(req, reply, data, { etagPrefix: "v1-codex-resets-recent", cacheControl: "public, max-age=60, s-maxage=60, stale-while-revalidate=60" });
    });

    // Static Assets
    const sendSourceIcon = (req: FastifyRequest, reply: FastifyReply) => {
      const file = (req.params as { file: string }).file;
      if (!/^[a-z0-9-]+\.(svg|png)$/.test(file)) return reply.code(404).send();
      return sendFile(req, reply, path.join(ASSETS_SOURCES, file), { cacheControl: "public, max-age=604800" });
    };
    app.get("/leaderboard-sources/:file", sendSourceIcon);
    app.get("/assets/leaderboard-sources/:file", sendSourceIcon);

    const sendProviderIcon = (req: FastifyRequest, reply: FastifyReply) => {
      const file = (req.params as { file: string }).file;
      if (!/^[a-z0-9-]+\.(svg|png)$/.test(file)) return reply.code(404).send();
      return sendFile(req, reply, path.join(ASSETS_PROVIDERS, file), { cacheControl: "public, max-age=604800" });
    };
    app.get("/model-providers/:file", sendProviderIcon);
    app.get("/assets/model-providers/:file", sendProviderIcon);

    // Admin Monitor API
    app.get("/api/admin/monitor/events", adminHandler(async (req) => listMonitorEvents({ withdrawn: q(req).withdrawn === "1" })));
    app.get("/api/admin/monitor/posts", adminHandler(async (req) => listMonitorPosts({ filter: q(req).filter as never, page: page(req) })));
    app.patch("/api/admin/monitor/events/:id", adminHandler(async (req, reply, admin) => orNotFound(req, reply, await updateMonitorEvent(param(req, "id"), body(req) as never, actorOf(admin)))));
    app.post("/api/admin/monitor/events/:id/receipt-review", adminHandler(async (req, reply, admin) => orNotFound(req, reply, await reviewReceipt(param(req, "id"), body(req) as never, actorOf(admin)))));
    app.post("/api/admin/monitor/events/:id/withdrawn", adminHandler(async (req, reply, admin) => orNotFound(req, reply, await setWithdrawn(param(req, "id"), body(req) as never, actorOf(admin)))));
    app.post("/api/admin/monitor/relink", adminHandler(async (req, _reply, admin) => relinkPost(body(req) as never, actorOf(admin))));
    app.post("/api/admin/monitor/posts/:id/resolve", adminHandler(async (req, reply, admin) => orNotFound(req, reply, await resolveMonitorPost(param(req, "id"), body(req) as never, actorOf(admin)))));
  },
});
