import type { SiteKind } from "@drawnet/schema";

export interface SiteTemplate {
  kind: SiteKind;
  icon: string;
  label: string;
  blurb: string;
}

export const SITE_TEMPLATES: SiteTemplate[] = [
  {
    kind: "building",
    icon: "🏢",
    label: "Building",
    blurb: "Premises with floors, closets and drops",
  },
  {
    kind: "pop",
    icon: "🏙️",
    label: "ISP POP",
    blurb: "Carrier point of presence / hand-off",
  },
  {
    kind: "cabinet",
    icon: "📦",
    label: "Street cabinet",
    blurb: "Outdoor DSL or fiber cabinet",
  },
  {
    kind: "tower",
    icon: "🗼",
    label: "Wireless tower",
    blurb: "Macro-cell site or point-to-point hop",
  },
  {
    kind: "datacenter",
    icon: "🏬",
    label: "Data center",
    blurb: "Racks, core switches, servers",
  },
];

export const SITE_ICON: Record<SiteKind, string> = {
  building: "🏢",
  pop: "🏙️",
  cabinet: "📦",
  tower: "🗼",
  datacenter: "🏬",
};

export const MEDIUM_COLOR: Record<string, string> = {
  rj45: "#4cc9f0",
  fiber: "#ffb703",
  coax: "#c77dff",
  wireless: "#5eead4",
  serial: "#f472b6",
};
