import type { SVGProps } from "react";
import { defineWebModule } from "@aihot/web/modules";

const Svg = ({ size = 18, ...props }: SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props} />
);
const IconChart = (p: SVGProps<SVGSVGElement> & { size?: number }) => (<Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>);
const IconHistory = (p: SVGProps<SVGSVGElement> & { size?: number }) => (<Svg {...p}><path d="M3.5 12a8.5 8.5 0 102.5-6" /><path d="M3.5 4v4h4" /><path d="M12 8v4l2.5 2" /></Svg>);

export default defineWebModule({
  name: "models",
  sidebar: {
    section: "模型",
    items: [
      { to: "/leaderboard", label: "模型榜", icon: IconChart },
      { to: "/codex-reset", label: "Tibo 重置监控", icon: IconHistory },
    ],
  },
  tabs: [
    { key: "leaderboard", to: "/leaderboard", label: "模型榜", icon: IconChart },
  ],
  admin: {
    content: [
      { to: "/admin/monitor", label: "重置监控" },
    ],
  },
});
