import type { SVGProps } from "react";
import { defineWebModule } from "@aihot/web/modules";

const IconCompass = ({ size = 18, ...props }: SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <circle cx="12" cy="12" r="8.5" />
    <polygon points="15.5,8.5 13.5,13.5 8.5,15.5 10.5,10.5" />
  </svg>
);

export default defineWebModule({
  name: "directory",
  sidebar: {
    section: "内容",
    items: [
      { to: "/directory", label: "信源导航", icon: IconCompass },
    ],
  },
  tools: [
    { to: "/directory", label: "信源导航", icon: <IconCompass size={20} /> },
  ],
});
