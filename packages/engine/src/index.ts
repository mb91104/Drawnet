import {
  cableById,
  defaultCableForMedium,
  nodePorts,
  samePort,
  type Link,
  type Medium,
  type NetNode,
  type Port,
  type PortRef,
  type Scene,
} from "@drawnet/schema";
import { ipv4ToInt, networkOf, normalizeIp } from "./ip";

export * from "./ip";
export * from "./topology";
export * from "./trace";

/**
 * The engine is deliberately free of React and DOM dependencies so the same
 * code can run in a Web Worker (and later on a server). Milestone 1 ships the
 * link/medium layer; the L2/L3 trace kernel builds on top of it.
 */

export interface Issue {
  id: string;
  severity: "error" | "warning";
  message: string;
  nodeIds?: string[];
  linkId?: string;
}

export function findNode(scene: Scene, nodeId: string): NetNode | undefined {
  return scene.nodes[nodeId];
}

export function findPort(scene: Scene, ref: PortRef): Port | undefined {
  const node = scene.nodes[ref.nodeId];
  if (!node) return undefined;
  return nodePorts(node).find((p) => p.id === ref.portId);
}

/** A port can carry exactly one physical cable. */
export function linkOnPort(scene: Scene, ref: PortRef): Link | undefined {
  return Object.values(scene.links).find((l) => samePort(l.a, ref) || samePort(l.b, ref));
}

export function mediaCompatible(a: Medium, b: Medium): boolean {
  return a === b;
}

export interface ConnectCheck {
  ok: boolean;
  reason?: string;
  cableId?: string;
}

/** Full validation used both by the canvas and by imported projects. */
export function canConnect(scene: Scene, a: PortRef, b: PortRef): ConnectCheck {
  if (a.nodeId === b.nodeId) {
    return { ok: false, reason: "A cable needs two different devices." };
  }

  const nodeA = scene.nodes[a.nodeId];
  const nodeB = scene.nodes[b.nodeId];
  if (!nodeA || !nodeB) return { ok: false, reason: "Device no longer exists in this scene." };

  const portA = findPort(scene, a);
  const portB = findPort(scene, b);
  if (!portA || !portB) return { ok: false, reason: "That port no longer exists." };

  if (!mediaCompatible(portA.medium, portB.medium)) {
    return {
      ok: false,
      reason: `${portA.name} is ${portA.medium} but ${portB.name} is ${portB.medium} — the media must match.`,
    };
  }

  const existingA = linkOnPort(scene, a);
  const existingB = linkOnPort(scene, b);
  if (existingA || existingB) {
    return { ok: false, reason: "One of those ports already has a cable attached." };
  }

  const cable = defaultCableForMedium(portA.medium);
  if (!cable) return { ok: false, reason: `No cable type is defined for ${portA.medium}.` };

  return { ok: true, cableId: cable.id };
}

export function cableLabel(link: Link): string {
  return cableById(link.cableId)?.label ?? link.cableId;
}

export function linkMedium(link: Link): Medium | undefined {
  return cableById(link.cableId)?.medium;
}

export function endpointLabel(scene: Scene, ref: PortRef): string {
  const node = scene.nodes[ref.nodeId];
  const port = findPort(scene, ref);
  if (!node) return "missing device";
  return `${node.name} · ${port?.name ?? ref.portId}`;
}

/**
 * Structural audit of a single scene. This is the seed of the richer
 * troubleshooting engine: every finding carries the ids needed to highlight
 * the offending devices on the canvas.
 */
export function auditScene(scene: Scene): Issue[] {
  const issues: Issue[] = [];
  const usedPorts = new Map<string, string>();

  for (const link of Object.values(scene.links)) {
    const nodeA = scene.nodes[link.a.nodeId];
    const nodeB = scene.nodes[link.b.nodeId];

    if (!nodeA || !nodeB) {
      issues.push({
        id: `dangling-${link.id}`,
        severity: "error",
        message: "A cable points at a device that no longer exists.",
        linkId: link.id,
      });
      continue;
    }

    const portA = findPort(scene, link.a);
    const portB = findPort(scene, link.b);
    if (!portA || !portB) {
      issues.push({
        id: `missing-port-${link.id}`,
        severity: "error",
        message: "A cable points at a port that no longer exists.",
        linkId: link.id,
      });
      continue;
    }

    if (!mediaCompatible(portA.medium, portB.medium)) {
      issues.push({
        id: `media-${link.id}`,
        severity: "error",
        message: `${portA.name} (${portA.medium}) is cabled to ${portB.name} (${portB.medium}).`,
        linkId: link.id,
        nodeIds: [nodeA.id, nodeB.id],
      });
    }

    const declared = cableById(link.cableId);
    if (declared && declared.medium !== portA.medium) {
      issues.push({
        id: `cable-${link.id}`,
        severity: "error",
        message: `${declared.label} cannot terminate on a ${portA.medium} port.`,
        linkId: link.id,
        nodeIds: [nodeA.id, nodeB.id],
      });
    }

    for (const ref of [link.a, link.b]) {
      const key = `${ref.nodeId}:${ref.portId}`;
      const previous = usedPorts.get(key);
      if (previous && previous !== link.id) {
        issues.push({
          id: `double-${link.id}-${key}`,
          severity: "error",
          message: "Two cables are plugged into the same port.",
          linkId: link.id,
          nodeIds: [ref.nodeId],
        });
      }
      usedPorts.set(key, link.id);
    }

    if (portA.status === "down" || portB.status === "down") {
      issues.push({
        id: `down-${link.id}`,
        severity: "warning",
        message: "A cable is attached to a port that is administratively down.",
        linkId: link.id,
        nodeIds: [nodeA.id, nodeB.id],
      });
    }
  }

  for (const node of Object.values(scene.nodes)) {
    const connected = Object.values(scene.links).some(
      (l) => l.a.nodeId === node.id || l.b.nodeId === node.id,
    );
    if (!connected) {
      issues.push({
        id: `isolated-${node.id}`,
        severity: "warning",
        message: `${node.name} is not connected to anything.`,
        nodeIds: [node.id],
      });
    }

    if (node.kind === "site") {
      for (const port of node.boundaryPorts) {
        const wired = linkOnPort(scene, { nodeId: node.id, portId: port.id });
        if (wired && !node.boundaryLinks[port.id]) {
          issues.push({
            id: `unmapped-${node.id}-${port.id}`,
            severity: "warning",
            message: `${node.name} · ${port.name} is cabled but has no interior mapping.`,
            nodeIds: [node.id],
            linkId: wired.id,
          });
        }
      }
    }
  }

  // Duplicate addresses are a classic cause of "it works, then it doesn't".
  const addresses = new Map<string, { nodeId: string; label: string }[]>();
  for (const node of Object.values(scene.nodes)) {
    for (const port of nodePorts(node)) {
      const ip = normalizeIp(port.ip);
      if (!ip) continue;
      const list = addresses.get(ip) ?? [];
      list.push({ nodeId: node.id, label: `${node.name} · ${port.name}` });
      addresses.set(ip, list);
    }
  }
  for (const [ip, owners] of addresses) {
    if (owners.length < 2) continue;
    issues.push({
      id: `duplicate-ip-${ip}`,
      severity: "error",
      message: `${ip} is assigned to ${owners.map((owner) => owner.label).join(" and ")}.`,
      nodeIds: [...new Set(owners.map((owner) => owner.nodeId))],
    });
  }

  // A gateway that is not in any of the device's own subnets can never answer.
  for (const node of Object.values(scene.nodes)) {
    if (node.kind !== "device") continue;
    const gateway = normalizeIp(String(node.config.gateway ?? ""));
    if (!gateway) continue;
    const networks = node.interfaces
      .map((port) => {
        const ip = normalizeIp(port.ip);
        return ip ? networkOf(ip, port.mask) : null;
      })
      .filter((net): net is NonNullable<typeof net> => Boolean(net));
    if (networks.length === 0) continue;
    const gatewayInt = normalizeIp(gateway) ? ipv4ToInt(gateway) : null;
    if (gatewayInt === null) continue;
    const reachable = networks.some((net) => ((gatewayInt & net.mask) >>> 0) === net.network);
    if (!reachable) {
      issues.push({
        id: `gateway-${node.id}`,
        severity: "warning",
        message: `${node.name}'s default gateway ${gateway} is outside its configured subnet.`,
        nodeIds: [node.id],
      });
    }
  }

  return issues;
}
