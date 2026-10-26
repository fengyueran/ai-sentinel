import { defineModule } from "@aihot/contracts/modules";

export default defineModule({
  name: "models",
  pages: [
    { path: "codex-reset", file: "routes/codex-reset.tsx" },
    { path: "codex-reset/history/:date", file: "routes/codex-reset.tsx", id: "codex-reset-day" },
    {
      layout: "routes/leaderboard-boards.tsx",
      pages: [
        { path: "leaderboard", file: "routes/leaderboard.tsx", id: "leaderboard" },
        { path: "leaderboard/category/:key", file: "routes/leaderboard.tsx", id: "leaderboard-category" },
      ],
    },
    { path: "leaderboard/sources", file: "routes/leaderboard-sources.tsx" },
    { path: "leaderboard/sources/:key", file: "routes/leaderboard-source.tsx" },
    { path: "leaderboard/rules", file: "routes/leaderboard-rules.tsx" },
    { path: "leaderboard/:slug", file: "routes/leaderboard-model.tsx" },
  ],
  adminPages: [
    { path: "admin/monitor", file: "routes/admin/monitor.tsx" },
  ],
  apiPaths: [
    /^\/api\/site\/leaderboard\//,
    /^\/api\/site\/codex-reset(\/|$)/,
    /^\/api\/admin\/monitor(\/|$)/,
    /^\/api\/v1\/codex-resets(\/|$)/,
    /^\/leaderboard-sources\//,
    /^\/assets\/leaderboard-sources\//,
    /^\/model-providers\//,
  ],
});
