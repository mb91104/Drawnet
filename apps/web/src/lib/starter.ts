import {
  createEmptyProject,
  createScene,
  newId,
  type DeviceNode,
  type Link,
  type PortRef,
  type Project,
  type Scene,
  type SiteKind,
  type SiteNode,
  type Position,
} from "@drawnet/schema";
import { freshPortsFor } from "@drawnet/models";

interface DeviceSpec {
  name: string;
  position: Position;
  ips?: Record<string, string>;
  config?: Record<string, string>;
  notes?: string;
}

function device(modelId: string, spec: DeviceSpec): DeviceNode {
  const ports = freshPortsFor(modelId).map((port) => {
    const ip = spec.ips?.[port.id];
    return ip ? { ...port, ip, mask: "255.255.255.0" } : port;
  });
  return {
    id: newId("dev"),
    kind: "device",
    name: spec.name,
    modelId,
    position: spec.position,
    interfaces: ports,
    config: spec.config ?? {},
    notes: spec.notes ?? "",
  };
}

function site(spec: {
  name: string;
  siteKind: SiteKind;
  position: Position;
  childSceneId: string;
  notes?: string;
}): SiteNode {
  return {
    id: newId("site"),
    kind: "site",
    name: spec.name,
    siteKind: spec.siteKind,
    position: spec.position,
    boundaryPorts: [
      { id: "p1", name: "Fiber uplink", medium: "fiber", status: "up", ip: "", mask: "" },
      { id: "p2", name: "Copper uplink", medium: "rj45", status: "up", ip: "", mask: "" },
      { id: "p3", name: "Drop out", medium: "rj45", status: "up", ip: "", mask: "" },
    ],
    boundaryLinks: {},
    childSceneId: spec.childSceneId,
    notes: spec.notes ?? "",
  };
}

function link(scene: Scene, a: PortRef, b: PortRef, cableId: string): void {
  const id = newId("link");
  const l: Link = { id, a, b, cableId, status: "up" };
  scene.links[id] = l;
}

/**
 * A small but complete demo: a city-level overview with two sites, and a
 * wired office inside one of them. Gives the canvas something real on first
 * run instead of an empty grid.
 */
export function createStarterProject(): Project {
  const project = createEmptyProject("Harbor District");
  const rootId = project.rootSceneId;
  const root = project.scenes[rootId];
  if (!root) return project;

  const hqScene = createScene({ name: "Harbor HQ", kind: "micro" });
  const popScene = createScene({ name: "ISP POP North", kind: "micro" });
  project.scenes[hqScene.id] = hqScene;
  project.scenes[popScene.id] = popScene;

  const hq = site({
    name: "Harbor HQ",
    siteKind: "building",
    position: { x: 120, y: 160 },
    childSceneId: hqScene.id,
    notes: "Three-storey office. Fiber enters at the basement demarc.",
  });
  hqScene.parentSiteId = hq.id;

  const pop = site({
    name: "ISP POP North",
    siteKind: "pop",
    position: { x: 560, y: 130 },
    childSceneId: popScene.id,
    notes: "Carrier hand-off for the district.",
  });
  popScene.parentSiteId = pop.id;

  const tower = site({
    name: "Rooftop relay",
    siteKind: "tower",
    position: { x: 340, y: 330 },
    childSceneId: createScene({ name: "Rooftop relay", kind: "micro" }).id,
  });
  const towerScene = project.scenes[tower.childSceneId ?? ""];
  if (towerScene) towerScene.parentSiteId = tower.id;

  root.nodes[hq.id] = hq;
  root.nodes[pop.id] = pop;
  root.nodes[tower.id] = tower;
  link(root, { nodeId: hq.id, portId: "p1" }, { nodeId: pop.id, portId: "p1" }, "fiber-sm");
  link(root, { nodeId: hq.id, portId: "p2" }, { nodeId: tower.id, portId: "p2" }, "cat6a");

  // --- Inside Harbor HQ -------------------------------------------------
  const sw = device("switch8", {
    name: "HQ access switch",
    position: { x: 300, y: 220 },
    config: { mode: "trunk", mgmtVlan: "10" },
    notes: "Wiring closet on level 1.",
  });
  const router = device("router", {
    name: "HQ edge router",
    position: { x: 620, y: 220 },
    ips: { g0: "192.168.10.1", g1: "10.20.0.1" },
    config: { routing: "static", dns: "10.20.0.53" },
  });
  const ap = device("ap", {
    name: "Lobby AP",
    position: { x: 300, y: 40 },
    config: { ssid: "Harbor-Staff", channel: "6", security: "wpa2" },
  });
  const pc1 = device("pc", {
    name: "Reception PC",
    position: { x: 20, y: 90 },
    ips: { eth0: "192.168.10.20" },
    config: { gateway: "192.168.10.1", dns: "10.20.0.53" },
  });
  const pc2 = device("pc", {
    name: "Finance PC",
    position: { x: 20, y: 300 },
    ips: { eth0: "192.168.10.21" },
    config: { gateway: "192.168.10.1", dns: "10.20.0.53" },
  });
  const printer = device("printer", {
    name: "Floor printer",
    position: { x: 620, y: 60 },
    ips: { eth0: "192.168.10.50" },
    config: { gateway: "192.168.10.1" },
  });

  for (const node of [sw, router, ap, pc1, pc2, printer]) hqScene.nodes[node.id] = node;

  link(hqScene, { nodeId: pc1.id, portId: "eth0" }, { nodeId: sw.id, portId: "p1" }, "cat6");
  link(hqScene, { nodeId: pc2.id, portId: "eth0" }, { nodeId: sw.id, portId: "p2" }, "cat6");
  link(hqScene, { nodeId: ap.id, portId: "eth0" }, { nodeId: sw.id, portId: "p3" }, "cat6");
  link(hqScene, { nodeId: sw.id, portId: "p8" }, { nodeId: router.id, portId: "g0" }, "cat6a");
  link(hqScene, { nodeId: printer.id, portId: "eth0" }, { nodeId: router.id, portId: "g1" }, "cat6");

  // --- Inside the ISP POP ----------------------------------------------
  const popRouter = device("router", {
    name: "POP border router",
    position: { x: 120, y: 140 },
    ips: { g0: "10.20.0.2", g1: "203.0.113.1" },
    config: { routing: "ospf" },
  });
  const popSwitch = device("switch24", {
    name: "POP distribution",
    position: { x: 420, y: 140 },
    config: { mode: "trunk", mgmtVlan: "1" },
  });
  const dns = device("server", {
    name: "Recursive DNS",
    position: { x: 420, y: 60 },
    ips: { eth0: "10.20.0.53" },
    config: { gateway: "10.20.0.2", services: "dns, ntp" },
    notes: "Authoritative for harbor.internal.",
  });
  const modem = device("modem", {
    name: "Carrier ONT",
    position: { x: 120, y: 20 },
    config: { provider: "City Fiber" },
  });

  for (const node of [popRouter, popSwitch, dns, modem]) popScene.nodes[node.id] = node;
  link(popScene, { nodeId: popRouter.id, portId: "g0" }, { nodeId: popSwitch.id, portId: "p1" }, "cat6a");
  link(popScene, { nodeId: dns.id, portId: "eth0" }, { nodeId: popSwitch.id, portId: "p2" }, "cat6");
  link(popScene, { nodeId: modem.id, portId: "lan" }, { nodeId: popRouter.id, portId: "g1" }, "cat6a");

  return project;
}
