import type { DeviceCategory, Medium, Port } from "@drawnet/schema";

export type ConfigFieldType = "text" | "select" | "number" | "textarea";

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  placeholder?: string;
  options?: string[];
  help?: string;
}

export interface DeviceModel {
  id: string;
  label: string;
  category: DeviceCategory;
  icon: string;
  blurb: string;
  /** Ports created with a new device of this model. */
  ports: () => Port[];
  /** Editable, non-interface settings shown in the inspector. */
  configFields?: ConfigField[];
  /** Preferred width on the canvas, in px. */
  width?: number;
}

export const CATEGORY_LABEL: Record<DeviceCategory, string> = {
  end: "End devices",
  network: "Network devices",
  wireless: "Wireless",
  infrastructure: "Infrastructure",
};

export const CATEGORY_ORDER: DeviceCategory[] = ["end", "network", "wireless", "infrastructure"];

let counter = 0;

function port(name: string, medium: Medium, id?: string): Port {
  counter += 1;
  return {
    id: id ?? `p${counter}`,
    name,
    medium,
    status: "up",
    ip: "",
    mask: "",
  };
}

function numbered(count: number, medium: Medium = "rj45", prefix = "Port"): Port[] {
  return Array.from({ length: count }, (_, i) => port(`${prefix} ${i + 1}`, medium, `p${i + 1}`));
}

const END_CONFIG: ConfigField[] = [
  { key: "gateway", label: "Default gateway", type: "text", placeholder: "192.168.1.1" },
  { key: "dns", label: "DNS server", type: "text", placeholder: "192.168.1.1" },
];

const WIFI_CONFIG: ConfigField[] = [
  ...END_CONFIG,
  { key: "ssid", label: "SSID", type: "text", placeholder: "Drawnet" },
  { key: "security", label: "Wi-Fi security", type: "select", options: ["open", "wpa2", "wpa3"] },
];

export const DEVICE_MODELS: DeviceModel[] = [
  {
    id: "pc",
    label: "Desktop PC",
    category: "end",
    icon: "🖥️",
    blurb: "Wired workstation. Buys you an Ethernet port and a Wi-Fi adapter.",
    ports: () => [
      port("Ethernet 0", "rj45", "eth0"),
      port("Wi-Fi", "wireless", "wlan0"),
    ],
    configFields: WIFI_CONFIG,
  },
  {
    id: "laptop",
    label: "Laptop",
    category: "end",
    icon: "💻",
    blurb: "Portable workstation, wired or wireless.",
    ports: () => [
      port("Ethernet 0", "rj45", "eth0"),
      port("Wi-Fi", "wireless", "wlan0"),
    ],
    configFields: WIFI_CONFIG,
  },
  {
    id: "phone",
    label: "Phone",
    category: "end",
    icon: "📱",
    blurb: "Wireless-only client. Needs an access point to reach the LAN.",
    ports: () => [port("Wi-Fi", "wireless", "wlan0")],
    configFields: WIFI_CONFIG,
  },
  {
    id: "tablet",
    label: "Tablet",
    category: "end",
    icon: "📟",
    blurb: "Wireless-only client for coverage testing.",
    ports: () => [port("Wi-Fi", "wireless", "wlan0")],
    configFields: WIFI_CONFIG,
  },
  {
    id: "printer",
    label: "Printer",
    category: "end",
    icon: "🖨️",
    blurb: "Network printer, usually a static address on the LAN.",
    ports: () => [port("Ethernet 0", "rj45", "eth0")],
    configFields: END_CONFIG,
  },
  {
    id: "server",
    label: "Server",
    category: "end",
    icon: "🗄️",
    blurb: "Multi-homed host running services (DNS, DHCP, web).",
    ports: () => [
      port("Ethernet 0", "rj45", "eth0"),
      port("Ethernet 1", "rj45", "eth1"),
    ],
    configFields: [...END_CONFIG, { key: "services", label: "Services", type: "text", placeholder: "dns, dhcp, http" }],
  },
  {
    id: "switch8",
    label: "Switch — 8 port",
    category: "network",
    icon: "🔀",
    blurb: "Layer 2 switch. Learns MAC addresses and splits collision domains.",
    ports: () => numbered(8),
    configFields: [
      { key: "mode", label: "Uplink mode", type: "select", options: ["access", "trunk"] },
      { key: "mgmtVlan", label: "Management VLAN", type: "number", placeholder: "1" },
    ],
    width: 232,
  },
  {
    id: "switch24",
    label: "Switch — 24 port",
    category: "network",
    icon: "🔀",
    blurb: "Denser access switch for a floor or wiring closet.",
    ports: () => numbered(24),
    configFields: [
      { key: "mode", label: "Uplink mode", type: "select", options: ["access", "trunk"] },
      { key: "mgmtVlan", label: "Management VLAN", type: "number", placeholder: "1" },
    ],
    width: 232,
  },
  {
    id: "router",
    label: "Router",
    category: "network",
    icon: "🌐",
    blurb: "Layer 3 device. Moves traffic between subnets.",
    ports: () => [
      port("Gigabit 0/0", "rj45", "g0"),
      port("Gigabit 0/1", "rj45", "g1"),
      port("Gigabit 0/2", "rj45", "g2"),
      port("Gigabit 0/3", "rj45", "g3"),
    ],
    configFields: [
      { key: "routing", label: "Routing", type: "select", options: ["static", "rip", "ospf"] },
      { key: "dns", label: "DNS relay", type: "text", placeholder: "8.8.8.8" },
      {
        key: "routes",
        label: "Static routes",
        type: "textarea",
        placeholder: "0.0.0.0/0 via 203.0.113.1",
        help: "One route per line: <network>/<prefix> via <next-hop>",
      },
    ],
  },
  {
    id: "firewall",
    label: "Firewall",
    category: "network",
    icon: "🛡️",
    blurb: "Filters traffic between zones and can NAT the LAN.",
    ports: () => [
      port("WAN", "rj45", "wan"),
      port("LAN", "rj45", "lan"),
      port("DMZ", "rj45", "dmz"),
    ],
    configFields: [
      { key: "policy", label: "Default policy", type: "select", options: ["deny", "allow"] },
      { key: "nat", label: "NAT enabled", type: "select", options: ["yes", "no"] },
      {
        key: "routes",
        label: "Static routes",
        type: "textarea",
        placeholder: "0.0.0.0/0 via 203.0.113.1",
        help: "One route per line: <network>/<prefix> via <next-hop>",
      },
    ],
  },
  {
    id: "ap",
    label: "Access point",
    category: "wireless",
    icon: "📡",
    blurb: "Bridges wireless clients onto the wired LAN.",
    ports: () => [
      port("Uplink", "rj45", "eth0"),
      port("Radio", "wireless", "wlan0"),
    ],
    configFields: [
      { key: "ssid", label: "SSID", type: "text", placeholder: "Drawnet" },
      { key: "channel", label: "Channel", type: "number", placeholder: "6" },
      { key: "security", label: "Security", type: "select", options: ["open", "wpa2", "wpa3"] },
    ],
  },
  {
    id: "modem",
    label: "Modem / ONT",
    category: "infrastructure",
    icon: "🛰️",
    blurb: "Demarcation point between the ISP access network and the premises.",
    ports: () => [
      port("WAN", "fiber", "wan"),
      port("LAN", "rj45", "lan"),
    ],
    configFields: [{ key: "provider", label: "Provider", type: "text", placeholder: "City Fiber" }],
  },
  {
    id: "nap",
    label: "NAP box",
    category: "infrastructure",
    icon: "🧰",
    blurb: "Network access point: the junction where a drop is spliced.",
    ports: () => numbered(4, "rj45"),
    configFields: [{ key: "address", label: "Street address", type: "text" }],
  },
  {
    id: "patchpanel",
    label: "Patch panel",
    category: "infrastructure",
    icon: "🎛️",
    blurb: "Passive port fan-out inside a wiring closet.",
    ports: () => numbered(8),
    width: 232,
  },
];

export const deviceModelById = (id: string): DeviceModel | undefined =>
  DEVICE_MODELS.find((m) => m.id === id);

export function modelsByCategory(): { category: DeviceCategory; models: DeviceModel[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    models: DEVICE_MODELS.filter((m) => m.category === category),
  }));
}

export function freshPortsFor(modelId: string): Port[] {
  return deviceModelById(modelId)?.ports() ?? [];
}
