import { defineModule } from "@aihot/contracts/modules";

export default defineModule({
  name: "directory",
  pages: [
    { path: "directory", file: "web/sources.tsx" },
  ],
  apiPaths: [
    /^\/api\/site\/directory(\/|$)/,
  ],
});
