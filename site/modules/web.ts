// What the site's modules add to the web pages (site/modules/index.ts).
import type { WebModule } from "@aihot/web/modules";
import models from "@aihot/models/web";
import directory from "../../modules/directory/web.tsx";

export const WEB_MODULES: readonly WebModule[] = [models, directory];
