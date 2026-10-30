import type { FastifyInstance } from "fastify";
import { defineServerModule } from "@aihot/backend/modules";
import { cachedByKey } from "@aihot/backend/lib/cache";
import { sendJsonWithEtag } from "@aihot/api/http/respond";
import { siteHandler } from "@aihot/api/routes/site";
import { loadDirectory, saveStarOverride } from "./backend/read.ts";
import type { DirectoryUpdateStarRequest, DirectoryUpdateStarResponse } from "./contracts.ts";

const DIR_CACHE = "public, max-age=30, s-maxage=60, stale-while-revalidate=120";
let cacheVersion = 0;
const cachedDirectory = cachedByKey(
  (v: string) => v,
  () => loadDirectory(),
  { freshMs: 30_000, maxStaleMs: 120_000, maxKeys: 5 },
);

export default defineServerModule({
  name: "directory",
  http(app: FastifyInstance) {
    app.get(
      "/api/site/directory",
      siteHandler(async (req, reply) => {
        const data = await cachedDirectory(String(cacheVersion));
        return sendJsonWithEtag(req, reply, data, { etagPrefix: `dir-v${cacheVersion}`, cacheControl: DIR_CACHE });
      }),
    );

    app.post(
      "/api/site/directory/stars",
      siteHandler(async (req, reply) => {
        const body = (req.body ?? {}) as DirectoryUpdateStarRequest;
        if (!body.id || typeof body.stars !== "number") {
          return reply.status(400).send({ ok: false, error: "Missing id or stars" });
        }
        const stars = Math.max(0, Math.min(5, Math.round(body.stars)));
        await saveStarOverride(body.id, stars);
        cacheVersion++;
        return reply.send({ ok: true, id: body.id, stars } satisfies DirectoryUpdateStarResponse);
      }),
    );
  },
});
