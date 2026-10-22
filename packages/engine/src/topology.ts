import {
  cableById,
  samePort,
  type Link,
  type NetNode,
  type Port,
  type PortRef,
  type Project,
  type Scene,
} from "@drawnet/schema";

/** A port identified across the whole project (node ids can repeat visually). */
export interface PortLoc {
  sceneId: string;
  nodeId: string;
  portId: string;
}

export interface LocatedPort extends PortLoc {
  node: NetNode;
  port: Port;
}

export interface ParentEdge {
  prev: string | null;
  via: "start" | "link" | "bridge" | "boundary";
  linkId?: string;
}

export interface DomainBlock {
  code:
    | "port-down"
    | "link-down"
    | "media-mismatch"
    | "wireless-association"
    | "unmapped-boundary"
    | "missing-scene";
  message: string;
  hint: string;
  sceneId: string;
  nodeIds: string[];
  linkId?: string;
}

export interface PathHop {
  sceneId: string;
  nodeId: string;
  name: string;
  modelId?: string;
  kind: "device" | "site";
  portName?: string;
  linkId?: string;
}

export interface BroadcastDomain {
  start: PortLoc;
  members: LocatedPort[];
  blocks: DomainBlock[];
  parents: Map<string, ParentEdge>;
  ports: Map<string, LocatedPort>;
  linkIds: Set<string>;
}

export const locKey = (loc: PortLoc): string => `${loc.sceneId}/${loc.nodeId}/${loc.portId}`;

export function sameLoc(a: PortLoc, b: PortLoc): boolean {
  return a.sceneId === b.sceneId && a.nodeId === b.nodeId && a.portId === b.portId;
}

export function nodePortsOf(node: NetNode): Port[] {
  return node.kind === "device" ? node.interfaces : node.boundaryPorts;
}

export function findPortInScene(project: Project, loc: PortLoc): LocatedPort | null {
  const scene = project.scenes[loc.sceneId];
  const node = scene?.nodes[loc.nodeId];
  if (!scene || !node) return null;
  const port = nodePortsOf(node).find((p) => p.id === loc.portId);
  if (!port) return null;
  return { ...loc, node, port };
}

export function findLinkAt(scene: Scene, ref: PortRef): Link | undefined {
  return Object.values(scene.links).find((l) => samePort(l.a, ref) || samePort(l.b, ref));
}

export function farRef(link: Link, from: PortRef): PortRef {
  return samePort(link.a, from) ? link.b : link.a;
}

const L2_MODELS = new Set(["switch8", "switch24", "ap", "patchpanel", "nap", "modem"]);

/** Devices that forward frames without inspecting IP addresses. */
export function isLayer2(node: NetNode): boolean {
  return node.kind === "device" && L2_MODELS.has(node.modelId);
}

export function isRouterLike(node: NetNode): boolean {
  return node.kind === "device" && (node.modelId === "router" || node.modelId === "firewall");
}

export function isEndDevice(node: NetNode): boolean {
  return node.kind === "device" && !isLayer2(node) && !isRouterLike(node);
}

export function boundaryTarget(project: Project, node: NetNode, portId: string): PortLoc | null {
  if (node.kind !== "site") return null;
  const mapped = node.boundaryLinks[portId];
  if (!mapped || !node.childSceneId) return null;
  if (!project.scenes[node.childSceneId]) return null;
  return { sceneId: node.childSceneId, nodeId: mapped.nodeId, portId: mapped.portId };
}

function wirelessBlock(a: LocatedPort, b: LocatedPort, link: Link): DomainBlock | null {
  const apSide = a.node.kind === "device" && a.node.modelId === "ap" ? a : b.node.kind === "device" && b.node.modelId === "ap" ? b : null;
  const clientSide = apSide === a ? b : a;

  if (!apSide) {
    return {
      code: "wireless-association",
      message: "A wireless cable does not terminate on an access point.",
      hint: "Associate wireless clients with an access point's radio port.",
      sceneId: a.sceneId,
      nodeIds: [a.nodeId, b.nodeId],
      linkId: link.id,
    };
  }

  if (
    apSide.node.kind !== "device" ||
    clientSide.node.kind !== "device" ||
    clientSide.node.modelId === "ap"
  ) {
    return {
      code: "wireless-association",
      message: "Two access points cannot be joined by a client association.",
      hint: "Use a wired or point-to-point link between access points.",
      sceneId: a.sceneId,
      nodeIds: [a.nodeId, b.nodeId],
      linkId: link.id,
    };
  }

  const apConfig = apSide.node.config;
  const clientConfig = clientSide.node.config;
  const apSsid = String(apConfig.ssid ?? "").trim();
  const clientSsid = String(clientConfig.ssid ?? "").trim();
  const apSecurity = String(apConfig.security ?? "").trim();
  const clientSecurity = String(clientConfig.security ?? "").trim();

  if (clientSsid && apSsid && clientSsid !== apSsid) {
    return {
      code: "wireless-association",
      message: `“${clientSide.node.name}” is configured for SSID “${clientSsid}” but the AP broadcasts “${apSsid}”.`,
      hint: "Match the SSID on both devices, or change the access point's SSID.",
      sceneId: a.sceneId,
      nodeIds: [a.nodeId, b.nodeId],
      linkId: link.id,
    };
  }

  if (clientSecurity && apSecurity && clientSecurity !== apSecurity) {
    return {
      code: "wireless-association",
      message: `Security mismatch: client uses ${clientSecurity}, AP requires ${apSecurity}.`,
      hint: "Set the same security mode on the client and the access point.",
      sceneId: a.sceneId,
      nodeIds: [a.nodeId, b.nodeId],
      linkId: link.id,
    };
  }

  return null;
}

function portBlock(loc: LocatedPort, message: string): DomainBlock {
  return {
    code: "port-down",
    message,
    hint: "Bring the port back up in the inspector, or move the cable to an active port.",
    sceneId: loc.sceneId,
    nodeIds: [loc.nodeId],
  };
}

/**
 * Walk everything that shares a single broadcast domain with `start`.
 *
 * The walk crosses cables, bridges through switches/APs/patch panels, and
 * follows site boundary mappings into child scenes. It stops at IP-capable
 * devices (hosts, routers, firewalls) and reports them as members, so the L3
 * layer can decide what happens next.
 */
export function broadcastDomain(project: Project, start: PortLoc): BroadcastDomain {
  const parents = new Map<string, ParentEdge>();
  const ports = new Map<string, LocatedPort>();
  const members = new Map<string, LocatedPort>();
  const blocks: DomainBlock[] = [];
  const linkIds = new Set<string>();
  const visited = new Set<string>();
  const queue: PortLoc[] = [start];

  parents.set(locKey(start), { prev: null, via: "start" });

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const key = locKey(current);
    if (visited.has(key)) continue;
    visited.add(key);

    const located = findPortInScene(project, current);
    if (!located) continue;
    ports.set(key, located);

    if (located.port.status === "down") {
      if (key === locKey(start)) blocks.push(portBlock(located, `${located.node.name} · ${located.port.name} is administratively down.`));
      continue;
    }

    if (located.node.kind === "site") {
      const childId = located.node.childSceneId;
      if (childId && !project.scenes[childId]) {
        blocks.push({
          code: "missing-scene",
          message: `${located.node.name} points at a scene that does not exist.`,
          hint: "Re-open the site to recreate its interior, or map the boundary port again.",
          sceneId: current.sceneId,
          nodeIds: [current.nodeId],
        });
      }
      const target = boundaryTarget(project, located.node, current.portId);
      if (target) {
        const targetKey = locKey(target);
        if (!parents.has(targetKey)) {
          parents.set(targetKey, { prev: key, via: "boundary" });
          queue.push(target);
        }
      } else if (childId) {
        blocks.push({
          code: "unmapped-boundary",
          message: `${located.node.name} · ${located.port.name} has no interior mapping.`,
          hint: "In the site inspector, map this demarcation port to a port inside the site.",
          sceneId: current.sceneId,
          nodeIds: [current.nodeId],
        });
      }
      // A site's shell does not bridge ports to each other; keep following the
      // physical cable so the outside half of the domain is discovered too.
    } else if (isLayer2(located.node)) {
      for (const sibling of nodePortsOf(located.node)) {
        if (sibling.id === current.portId) continue;
        const next: PortLoc = { ...current, portId: sibling.id };
        const nextKey = locKey(next);
        if (!parents.has(nextKey)) {
          parents.set(nextKey, { prev: key, via: "bridge" });
          queue.push(next);
        }
      }
    } else {
      members.set(key, located);
    }

    const scene = project.scenes[current.sceneId];
    if (!scene) continue;
    const link = findLinkAt(scene, { nodeId: current.nodeId, portId: current.portId });
    if (!link) continue;

    const medium = cableById(link.cableId)?.medium;
    const far = farRef(link, { nodeId: current.nodeId, portId: current.portId });
    const farLocated = findPortInScene(project, {
      sceneId: current.sceneId,
      nodeId: far.nodeId,
      portId: far.portId,
    });

    linkIds.add(link.id);

    if (!farLocated) {
      blocks.push({
        code: "media-mismatch",
        message: "A cable ends on a port that no longer exists.",
        hint: "Remove the cable and rewire it to an existing port.",
        sceneId: current.sceneId,
        nodeIds: [current.nodeId],
        linkId: link.id,
      });
      continue;
    }

    if (link.status === "down") {
      blocks.push({
        code: "link-down",
        message: `Cable between ${located.node.name} and ${farLocated.node.name} is shut down.`,
        hint: "Set the cable state to Up, or replace the link.",
        sceneId: current.sceneId,
        nodeIds: [current.nodeId, far.nodeId],
        linkId: link.id,
      });
      continue;
    }

    if (farLocated.port.status === "down") {
      blocks.push(portBlock(farLocated, `${farLocated.node.name} · ${farLocated.port.name} is administratively down.`));
      continue;
    }

    if (!medium || located.port.medium !== medium || farLocated.port.medium !== medium) {
      blocks.push({
        code: "media-mismatch",
        message: `${located.port.name} (${located.port.medium}) is cabled to ${farLocated.port.name} (${farLocated.port.medium}).`,
        hint: "Both ports and the cable must use the same medium.",
        sceneId: current.sceneId,
        nodeIds: [current.nodeId, far.nodeId],
        linkId: link.id,
      });
      continue;
    }

    if (medium === "wireless") {
      const block = wirelessBlock(located, farLocated, link);
      if (block) {
        blocks.push(block);
        continue;
      }
    }

    const farKey = locKey(farLocated);
    if (!parents.has(farKey)) {
      parents.set(farKey, { prev: key, via: "link", linkId: link.id });
      queue.push({ sceneId: farLocated.sceneId, nodeId: farLocated.nodeId, portId: farLocated.portId });
    }
  }

  return { start, members: [...members.values()], blocks, parents, ports, linkIds };
}

/** Rebuild the physical route from the domain start to a member port. */
export function pathToMember(domain: BroadcastDomain, target: PortLoc): PathHop[] {
  const chain: { located: LocatedPort; linkId?: string }[] = [];
  let cursor: string | null = locKey(target);
  const guard = new Set<string>();

  while (cursor) {
    if (guard.has(cursor)) break;
    guard.add(cursor);
    const located = domain.ports.get(cursor);
    if (located) chain.push({ located, linkId: domain.parents.get(cursor)?.linkId });
    const parent = domain.parents.get(cursor);
    cursor = parent?.prev ?? null;
  }

  chain.reverse();

  const hops: PathHop[] = [];
  for (const { located, linkId } of chain) {
    const previous = hops[hops.length - 1];
    if (previous && previous.nodeId === located.nodeId && previous.sceneId === located.sceneId) {
      previous.portName = located.port.name;
      if (linkId) previous.linkId = linkId;
      continue;
    }
    hops.push({
      sceneId: located.sceneId,
      nodeId: located.nodeId,
      name: located.node.name,
      modelId: located.node.kind === "device" ? located.node.modelId : undefined,
      kind: located.node.kind,
      portName: located.port.name,
      linkId,
    });
  }

  return hops;
}

/** Resolve a built-in port to the first port with a usable IP. */
export function firstIpPort(node: NetNode): Port | undefined {
  return nodePortsOf(node).find((port) => port.ip.trim() !== "" && port.ip.trim().toLowerCase() !== "dhcp");
}
