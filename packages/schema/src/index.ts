import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Media & cabling                                                     */
/* ------------------------------------------------------------------ */

export const MEDIA = ["rj45", "fiber", "coax", "wireless", "serial"] as const;
export type Medium = (typeof MEDIA)[number];

export const mediumSchema = z.enum(MEDIA);

export const MEDIUM_LABEL: Record<Medium, string> = {
  rj45: "Copper (RJ45)",
  fiber: "Fiber",
  coax: "Coaxial",
  wireless: "Wireless",
  serial: "Serial",
};

export interface CableOption {
  id: string;
  label: string;
  medium: Medium;
}

export const CABLES: CableOption[] = [
  { id: "cat5e", label: "Cat 5e", medium: "rj45" },
  { id: "cat6", label: "Cat 6", medium: "rj45" },
  { id: "cat6a", label: "Cat 6a", medium: "rj45" },
  { id: "fiber-sm", label: "Fiber — single mode", medium: "fiber" },
  { id: "fiber-mm", label: "Fiber — multi mode", medium: "fiber" },
  { id: "coax-rg6", label: "Coax RG-6", medium: "coax" },
  { id: "serial-dce", label: "Serial DCE", medium: "serial" },
  { id: "wireless", label: "Wireless association", medium: "wireless" },
];

export function cableById(id: string): CableOption | undefined {
  return CABLES.find((c) => c.id === id);
}

export function cablesForMedium(medium: Medium): CableOption[] {
  return CABLES.filter((c) => c.medium === medium);
}

export function defaultCableForMedium(medium: Medium): CableOption | undefined {
  return cablesForMedium(medium)[0];
}

/* ------------------------------------------------------------------ */
/* Ports, nodes, links                                                 */
/* ------------------------------------------------------------------ */

export const portSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  medium: mediumSchema,
  status: z.enum(["up", "down"]).default("up"),
  ip: z.string().default(""),
  mask: z.string().default(""),
});
export type Port = z.infer<typeof portSchema>;

export const configValueSchema = z.union([z.string(), z.number(), z.boolean()]);
export type ConfigValue = z.infer<typeof configValueSchema>;
export const configSchema = z.record(z.string(), configValueSchema);
export type NodeConfig = z.infer<typeof configSchema>;

export const positionSchema = z.object({ x: z.number(), y: z.number() });
export type Position = z.infer<typeof positionSchema>;

export const DEVICE_CATEGORIES = ["end", "network", "wireless", "infrastructure"] as const;
export type DeviceCategory = (typeof DEVICE_CATEGORIES)[number];

export const SITE_KINDS = ["building", "cabinet", "pop", "tower", "datacenter"] as const;
export type SiteKind = (typeof SITE_KINDS)[number];

export const SITE_KIND_LABEL: Record<SiteKind, string> = {
  building: "Building",
  cabinet: "Street cabinet",
  pop: "ISP point of presence",
  tower: "Wireless tower",
  datacenter: "Data center",
};

export const deviceNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("device"),
  name: z.string(),
  modelId: z.string(),
  position: positionSchema,
  interfaces: z.array(portSchema),
  config: configSchema,
  notes: z.string().default(""),
});
export type DeviceNode = z.infer<typeof deviceNodeSchema>;

/**
 * Maps a site's boundary (demarcation) port to a port inside the site's child
 * scene. Without this map a cable that enters a site has nowhere to go, so the
 * simulator reports the boundary port instead of silently guessing.
 */
export const boundaryLinkSchema = z.object({ nodeId: z.string(), portId: z.string() });
export const boundaryLinksSchema = z.record(z.string(), boundaryLinkSchema);
export type BoundaryLinks = z.infer<typeof boundaryLinksSchema>;

export const siteNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("site"),
  name: z.string(),
  siteKind: z.enum(SITE_KINDS).default("building"),
  position: positionSchema,
  boundaryPorts: z.array(portSchema),
  /** boundary port id → interior port */
  boundaryLinks: boundaryLinksSchema.default({}),
  childSceneId: z.string().nullable().default(null),
  notes: z.string().default(""),
});
export type SiteNode = z.infer<typeof siteNodeSchema>;

export const netNodeSchema = z.discriminatedUnion("kind", [deviceNodeSchema, siteNodeSchema]);
export type NetNode = z.infer<typeof netNodeSchema>;

export const portRefSchema = z.object({ nodeId: z.string(), portId: z.string() });
export type PortRef = z.infer<typeof portRefSchema>;

export const linkSchema = z.object({
  id: z.string().min(1),
  a: portRefSchema,
  b: portRefSchema,
  cableId: z.string(),
  status: z.enum(["up", "down"]).default("up"),
});
export type Link = z.infer<typeof linkSchema>;

/* ------------------------------------------------------------------ */
/* Scenes & project                                                    */
/* ------------------------------------------------------------------ */

export const sceneKindSchema = z.enum(["macro", "micro"]);

export const sceneSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  kind: sceneKindSchema.default("micro"),
  parentSiteId: z.string().nullable().default(null),
  nodes: z.record(z.string(), netNodeSchema),
  links: z.record(z.string(), linkSchema),
});
export type Scene = z.infer<typeof sceneSchema>;

export const SCHEMA_VERSION = 1;

export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  createdAt: z.string(),
  updatedAt: z.string(),
  rootSceneId: z.string(),
  scenes: z.record(z.string(), sceneSchema),
});
export type Project = z.infer<typeof projectSchema>;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function nodePorts(node: NetNode): Port[] {
  return node.kind === "device" ? node.interfaces : node.boundaryPorts;
}

export function nodeModelLabel(node: NetNode): string {
  if (node.kind === "site") return SITE_KIND_LABEL[node.siteKind];
  return node.modelId;
}

export function portKey(ref: PortRef): string {
  return `${ref.nodeId}:${ref.portId}`;
}

export function samePort(a: PortRef, b: PortRef): boolean {
  return a.nodeId === b.nodeId && a.portId === b.portId;
}

export function sceneList(project: Project): Scene[] {
  return Object.values(project.scenes);
}

export function childScene(project: Project, node: NetNode): Scene | undefined {
  if (node.kind !== "site" || !node.childSceneId) return undefined;
  return project.scenes[node.childSceneId];
}

export function newId(prefix = "id"): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export function createScene(args: {
  id?: string;
  name: string;
  kind: "macro" | "micro";
  parentSiteId?: string | null;
}): Scene {
  return {
    id: args.id ?? newId("scene"),
    name: args.name,
    kind: args.kind,
    parentSiteId: args.parentSiteId ?? null,
    nodes: {},
    links: {},
  };
}

export function createEmptyProject(name = "Untitled network"): Project {
  const root = createScene({ name: "Overview", kind: "macro" });
  const now = new Date().toISOString();
  return {
    id: newId("project"),
    name,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    rootSceneId: root.id,
    scenes: { [root.id]: root },
  };
}

/** Locate the scene that owns a node. Node ids are unique per project. */
export function sceneOfNode(project: Project, nodeId: string): Scene | undefined {
  for (const scene of Object.values(project.scenes)) {
    if (scene.nodes[nodeId]) return scene;
  }
  return undefined;
}

export interface ProjectDevice {
  sceneId: string;
  scene: Scene;
  node: DeviceNode;
}

/** Every device in the project, across every scene. Handy for trace pickers. */
export function projectDevices(project: Project): ProjectDevice[] {
  const out: ProjectDevice[] = [];
  for (const scene of Object.values(project.scenes)) {
    for (const node of Object.values(scene.nodes)) {
      if (node.kind === "device") out.push({ sceneId: scene.id, scene, node });
    }
  }
  return out;
}

/**
 * Parse untrusted JSON (a file, IndexedDB, a future API) into a Project.
 * Missing optional fields are filled by the schema defaults, which is also our
 * migration path for projects saved before those fields existed.
 */
export function parseProject(raw: unknown): Project {
  const project = projectSchema.parse(raw);
  if (!project.scenes[project.rootSceneId]) {
    throw new Error("Project root scene is missing");
  }
  return project;
}

export function sceneStats(scene: Scene): { devices: number; sites: number; links: number } {
  let devices = 0;
  let sites = 0;
  for (const node of Object.values(scene.nodes)) {
    if (node.kind === "device") devices += 1;
    else sites += 1;
  }
  return { devices, sites, links: Object.keys(scene.links).length };
}
