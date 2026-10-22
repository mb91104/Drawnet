import {
  sceneOfNode,
  type DeviceNode,
  type NetNode,
  type Port,
  type Project,
  type Scene,
} from "@drawnet/schema";
import {
  DEFAULT_MASK,
  intToIpv4,
  ipv4ToInt,
  isBlankOrDhcp,
  networkOf,
  normalizeIp,
  normalizeMask,
  sameSubnet,
} from "./ip";
import {
  broadcastDomain,
  firstIpPort,
  findLinkAt,
  isRouterLike,
  pathToMember,
  type BroadcastDomain,
  type DomainBlock,
  type PathHop,
  type PortLoc,
} from "./topology";

export interface TraceSource {
  nodeId: string;
  portId?: string;
}

export type TraceTarget =
  | { kind: "node"; nodeId: string; portId?: string }
  | { kind: "ip"; ip: string };

export interface TraceRequest {
  source: TraceSource;
  destination: TraceTarget;
}

export type TraceTone = "ok" | "warn" | "error" | "info";

export interface TraceStep {
  id: string;
  kind: "start" | "host" | "switch" | "router" | "firewall" | "ap" | "service" | "success" | "error";
  title: string;
  detail?: string;
  sceneId?: string;
  nodeId?: string;
  linkId?: string;
  tone: TraceTone;
}

export interface TraceFailure {
  code: string;
  message: string;
  hint: string;
  nodeIds: string[];
  sceneId?: string;
  linkId?: string;
  blocks: DomainBlock[];
}

export interface TraceResult {
  ok: boolean;
  source: { nodeId: string; name: string; sceneId: string; ip: string; mask: string; portId: string };
  destination: { name: string; ip: string; nodeId?: string; sceneId?: string };
  steps: TraceStep[];
  hops: PathHop[];
  nodeIds: string[];
  linkIds: string[];
  failure?: TraceFailure;
}

interface StaticRoute {
  network: number;
  mask: number;
  prefix: number;
  nextHop: string;
  raw: string;
}

interface RouteDecision {
  kind: "connected" | "static";
  egress: Port;
  nextHop: string;
  prefix: number;
  description: string;
}

const MAX_HOPS = 40;

function deviceInScene(project: Project, nodeId: string): { scene: Scene; node: DeviceNode } | null {
  const scene = sceneOfNode(project, nodeId);
  const node = scene?.nodes[nodeId];
  if (!scene || !node || node.kind !== "device") return null;
  return { scene, node };
}

function maskOf(port: Port): string {
  return normalizeMask(port.mask) ?? DEFAULT_MASK;
}

function pickLinkedPort(project: Project, scene: Scene, node: DeviceNode): Port | undefined {
  const linked = node.interfaces.find((port) => findLinkAt(scene, { nodeId: node.id, portId: port.id }));
  return linked ?? node.interfaces[0];
}

function allConfiguredIps(project: Project): Set<string> {
  const used = new Set<string>();
  for (const scene of Object.values(project.scenes)) {
    for (const node of Object.values(scene.nodes)) {
      const ports = node.kind === "device" ? node.interfaces : node.boundaryPorts;
      for (const port of ports) {
        const ip = normalizeIp(port.ip);
        if (ip) used.add(ip);
      }
    }
  }
  return used;
}

function pickLease(ip: string, mask: string, used: Set<string>): string | null {
  const net = networkOf(ip, mask);
  if (!net) return null;
  for (let host = 100; host < 254; host += 1) {
    const candidate = intToIpv4((net.network + host) >>> 0);
    if (!used.has(candidate)) return candidate;
  }
  for (let host = 10; host < 100; host += 1) {
    const candidate = intToIpv4((net.network + host) >>> 0);
    if (!used.has(candidate)) return candidate;
  }
  return null;
}

function parseStaticRoutes(node: DeviceNode): StaticRoute[] {
  const raw = String(node.config.routes ?? "");
  const routes: StaticRoute[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^(\S+?)(?:\s+via\s+(\S+))?$/i.exec(trimmed);
    if (!match) continue;
    let target = match[1] ?? "";
    const nextHop = normalizeIp(match[2]);
    if (!nextHop) continue;
    if (target.toLowerCase() === "default") target = "0.0.0.0/0";
    let network: number | null = null;
    let mask: string | null = null;
    if (target.includes("/")) {
      const [ipPart, prefixPart] = target.split("/");
      const prefix = Number(prefixPart);
      if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) continue;
      const ipInt = ipv4ToInt(ipPart ?? "");
      if (ipInt === null) continue;
      mask = intToIpv4(prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0);
      network = (ipInt & (ipv4ToInt(mask) ?? 0)) >>> 0;
    } else {
      const ipInt = ipv4ToInt(target);
      if (ipInt === null) continue;
      mask = DEFAULT_MASK;
      network = (ipInt & (ipv4ToInt(mask) ?? 0)) >>> 0;
    }
    const net = networkOf(intToIpv4(network ?? 0), mask ?? DEFAULT_MASK);
    if (!net) continue;
    routes.push({
      network: net.network,
      mask: net.mask,
      prefix: net.prefix,
      nextHop,
      raw: trimmed,
    });
  }
  return routes;
}

function routeLookup(node: DeviceNode, destIp: string): RouteDecision | { kind: "none"; reason: string } {
  const dest = ipv4ToInt(destIp);
  if (dest === null) return { kind: "none", reason: "Destination is not a valid IPv4 address." };

  const connected: (RouteDecision & { network: number; mask: number })[] = [];
  for (const port of node.interfaces) {
    const ip = normalizeIp(port.ip);
    if (!ip) continue;
    const net = networkOf(ip, maskOf(port));
    if (!net) continue;
    connected.push({
      kind: "connected",
      egress: port,
      nextHop: destIp,
      prefix: net.prefix,
      network: net.network,
      mask: net.mask,
      description: `${intToIpv4(net.network)}/${net.prefix} is directly connected on ${port.name}`,
    });
  }

  const direct = connected
    .filter((route) => ((dest & route.mask) >>> 0) === route.network)
    .sort((a, b) => b.prefix - a.prefix)[0];
  if (direct) return direct;

  const candidates = parseStaticRoutes(node)
    .filter((route) => ((dest & route.mask) >>> 0) === route.network)
    .sort((a, b) => b.prefix - a.prefix);

  for (const route of candidates) {
    const nextHop = ipv4ToInt(route.nextHop);
    if (nextHop === null) continue;
    const egress = connected.find((iface) => ((nextHop & iface.mask) >>> 0) === iface.network);
    if (!egress) continue;
    return {
      kind: "static",
      egress: egress.egress,
      nextHop: route.nextHop,
      prefix: route.prefix,
      description: `${route.raw} → next hop ${route.nextHop} on ${egress.egress.name}`,
    };
  }

  return {
    kind: "none",
    reason: `${node.name} has no route to ${destIp}. Add a static route or a default route.`,
  };
}

function domainFailure(
  domain: BroadcastDomain,
  code: string,
  message: string,
  hint: string,
  nodeIds: string[],
  sceneId?: string,
): TraceFailure {
  const block = domain.blocks[0];
  const combinedHint = block ? `${block.hint} (${block.message})` : hint;
  return {
    code: block?.code ?? code,
    message: block?.message ?? message,
    hint: combinedHint,
    nodeIds: block?.nodeIds ?? nodeIds,
    sceneId: block?.sceneId ?? sceneId,
    linkId: block?.linkId,
    blocks: domain.blocks,
  };
}

export function traceConnectivity(project: Project, request: TraceRequest): TraceResult {
  const steps: TraceStep[] = [];
  const hops: PathHop[] = [];
  const nodeIds = new Set<string>();
  const linkIds = new Set<string>();
  const usedIps = allConfiguredIps(project);

  let stepId = 0;
  const push = (step: Omit<TraceStep, "id">): void => {
    stepId += 1;
    steps.push({ ...step, id: `step-${stepId}` });
  };

  const addHops = (path: PathHop[]): void => {
    for (const hop of path) {
      const last = hops[hops.length - 1];
      if (last && last.nodeId === hop.nodeId && last.sceneId === hop.sceneId) {
        last.portName = hop.portName;
        if (hop.linkId) last.linkId = hop.linkId;
        continue;
      }
      hops.push(hop);
      nodeIds.add(hop.nodeId);
      if (hop.linkId) linkIds.add(hop.linkId);
    }
  };

  const sourceScene = sceneOfNode(project, request.source.nodeId);
  const sourceNode = sourceScene?.nodes[request.source.nodeId];
  if (!sourceScene || !sourceNode || sourceNode.kind !== "device") {
    return failedTrace("missing-source", "The source device does not exist.", "Pick a device in the current project.");
  }

  const sourcePort =
    (request.source.portId
      ? sourceNode.interfaces.find((port) => port.id === request.source.portId)
      : undefined) ?? pickLinkedPort(project, sourceScene, sourceNode);

  if (!sourcePort) {
    return failedTrace("no-source-port", `${sourceNode.name} has no interfaces.`, "Add an interface or pick another source.");
  }

  nodeIds.add(sourceNode.id);
  const sourceLoc: PortLoc = { sceneId: sourceScene.id, nodeId: sourceNode.id, portId: sourcePort.id };

  // --- Source address ---------------------------------------------------
  let sourceIp = normalizeIp(sourcePort.ip);
  let sourceMask = maskOf(sourcePort);
  let sourceBlurb = "";

  if (!sourceIp || isBlankOrDhcp(sourcePort.ip)) {
    const domain = broadcastDomain(project, sourceLoc);
    const dhcp = domain.members.find(
      (member) =>
        member.node.kind === "device" &&
        String(member.node.config.services ?? "").toLowerCase().includes("dhcp") &&
        normalizeIp(member.port.ip),
    );
    if (!dhcp || dhcp.node.kind !== "device") {
      return failedTrace(
        "no-ip",
        `${sourceNode.name} has no IP address and no DHCP server was found.`,
        "Set a static address on the interface, or attach a server whose services include dhcp.",
        domain,
      );
    }
    const serverIp = normalizeIp(dhcp.port.ip);
    const serverMask = maskOf(dhcp.port);
    if (!serverIp) {
      return failedTrace("no-ip", "The DHCP server has no usable address.", "Give the DHCP server a static address.");
    }
    const lease = pickLease(serverIp, serverMask, usedIps);
    if (!lease) {
      return failedTrace("no-lease", "The DHCP pool is exhausted.", "Widen the subnet or free an address.", domain);
    }
    usedIps.add(lease);
    sourceIp = lease;
    sourceMask = serverMask;
    const gateway = normalizeIp(String(sourceNode.config.gateway ?? ""));
    sourceBlurb = gateway ? ` · gateway ${gateway}` : "";
    addHops(pathToMember(domain, dhcp));
    push({
      kind: "service",
      tone: "ok",
      title: `DHCP · ${lease}/${networkOf(lease, serverMask)?.prefix ?? 24}`,
      detail: `Leased by ${dhcp.node.name} (${serverIp})${sourceBlurb}`,
      sceneId: dhcp.sceneId,
      nodeId: dhcp.nodeId,
    });
  } else if (!normalizeMask(sourcePort.mask)) {
    push({
      kind: "host",
      tone: "warn",
      title: `${sourceNode.name} has no subnet mask`,
      detail: `Assuming ${DEFAULT_MASK} (/24). Set the mask in the interface table for accuracy.`,
      sceneId: sourceScene.id,
      nodeId: sourceNode.id,
    });
  }

  sourceIp = normalizeIp(sourceIp);
  if (!sourceIp) {
    return failedTrace("no-ip", `${sourceNode.name} does not have a valid IPv4 address.`, "Use dotted-quad notation, e.g. 192.168.1.10.");
  }

  const sourceNetwork = networkOf(sourceIp, sourceMask);
  push({
    kind: "start",
    tone: "info",
    title: `${sourceNode.name} · ${sourceIp}${sourceNetwork ? `/${sourceNetwork.prefix}` : ""}`,
    detail: `Source interface ${sourcePort.name}${sourcePort.mask ? "" : " (mask assumed /24)"}`,
    sceneId: sourceScene.id,
    nodeId: sourceNode.id,
  });

  // --- Destination address ---------------------------------------------
  let destIp: string | null = null;
  let destName = "destination";
  let destNodeId: string | undefined;
  let destSceneId: string | undefined;

  if (request.destination.kind === "ip") {
    destIp = normalizeIp(request.destination.ip);
    destName = request.destination.ip;
    if (!destIp) {
      return failedTrace("bad-destination", "The destination is not a valid IPv4 address.", "Use dotted-quad notation, e.g. 10.0.0.53.");
    }
  } else {
    const dest = deviceInScene(project, request.destination.nodeId);
    if (!dest) {
      return failedTrace("missing-destination", "The destination device does not exist.", "Pick another destination.");
    }
    const port =
      (request.destination.portId
        ? dest.node.interfaces.find((candidate) => candidate.id === request.destination.portId)
        : undefined) ??
      firstIpPort(dest.node) ??
      pickLinkedPort(project, dest.scene, dest.node);
    if (!port) {
      return failedTrace("bad-destination", `${dest.node.name} has no interfaces.`, "Pick another destination.");
    }
    destIp = normalizeIp(port.ip);
    destName = dest.node.name;
    destNodeId = dest.node.id;
    destSceneId = dest.scene.id;
    nodeIds.add(dest.node.id);

    if (!destIp || isBlankOrDhcp(port.ip)) {
      const domain = broadcastDomain(project, { sceneId: dest.scene.id, nodeId: dest.node.id, portId: port.id });
      const dhcp = domain.members.find(
        (member) =>
          member.node.kind === "device" &&
          String(member.node.config.services ?? "").toLowerCase().includes("dhcp") &&
          normalizeIp(member.port.ip),
      );
      if (dhcp && dhcp.node.kind === "device") {
        const serverIp = normalizeIp(dhcp.port.ip);
        if (serverIp) {
          const lease = pickLease(serverIp, maskOf(dhcp.port), usedIps);
          if (lease) {
            usedIps.add(lease);
            destIp = lease;
            push({
              kind: "service",
              tone: "ok",
              title: `DHCP · ${lease}`,
              detail: `Destination ${dest.node.name} receives its address from ${dhcp.node.name}.`,
              sceneId: dhcp.sceneId,
              nodeId: dhcp.nodeId,
            });
          }
        }
      }
    }
  }

  if (!destIp) {
    return failedTrace(
      "no-destination-ip",
      `${destName} has no IP address.`,
      "Set a static address or connect it to a DHCP server.",
    );
  }

  const destination = { name: destName, ip: destIp, nodeId: destNodeId, sceneId: destSceneId };

  if (destIp === sourceIp) {
    push({ kind: "success", tone: "ok", title: "Source and destination are the same address", detail: `${destIp} is local.` });
    return {
      ok: true,
      source: { nodeId: sourceNode.id, name: sourceNode.name, sceneId: sourceScene.id, ip: sourceIp, mask: sourceMask, portId: sourcePort.id },
      destination,
      steps,
      hops,
      nodeIds: [...nodeIds],
      linkIds: [...linkIds],
    };
  }

  // --- Walk the network -------------------------------------------------
  let currentNode = sourceNode;
  let currentSceneId = sourceScene.id;
  let currentPort = sourcePort;
  let currentIp = sourceIp;
  let currentMask = sourceMask;
  let incoming: Port | null = null;
  const seenRouters = new Set<string>();

  for (let hopIndex = 0; hopIndex < MAX_HOPS; hopIndex += 1) {
    const domain = broadcastDomain(project, {
      sceneId: currentSceneId,
      nodeId: currentNode.id,
      portId: currentPort.id,
    });
    for (const id of domain.linkIds) linkIds.add(id);

    const localDestination = domain.members.find((member) => normalizeIp(member.port.ip) === destIp);
    if (localDestination) {
      addHops(pathToMember(domain, localDestination));
      push({
        kind: "success",
        tone: "ok",
        title: `Delivered to ${localDestination.node.name}`,
        detail: `${destIp} answered in the same broadcast domain as ${currentNode.name}.`,
        sceneId: localDestination.sceneId,
        nodeId: localDestination.nodeId,
      });
      return successTrace();
    }

    // Is the destination one of this device's own addresses?
    const ownIp = currentNode.interfaces.find((port) => normalizeIp(port.ip) === destIp);
    if (ownIp) {
      push({
        kind: "success",
        tone: "ok",
        title: `${currentNode.name} owns ${destIp}`,
        detail: `Reached locally on ${ownIp.name}.`,
        sceneId: currentSceneId,
        nodeId: currentNode.id,
      });
      return successTrace();
    }

    const currentNetwork = networkOf(currentIp, currentMask);
    const destInSubnet = currentNetwork
      ? ((ipv4ToInt(destIp) ?? 0) & currentNetwork.mask) >>> 0 === currentNetwork.network
      : false;

    // --- End host: default gateway -------------------------------------
    if (!isRouterLike(currentNode)) {
      if (destInSubnet) {
        return failedTrace(
          "arp-timeout",
          `No device in this segment owns ${destIp}.`,
          "Check the destination address, the subnet mask, and that the host is connected to the same switch/AP.",
          domain,
          [currentNode.id],
          currentSceneId,
        );
      }

      const gateway = normalizeIp(String(currentNode.config.gateway ?? ""));
      if (!gateway) {
        return failedTrace(
          "no-gateway",
          `${currentNode.name} has no default gateway.`,
          `Set the default gateway to an address in ${currentNetwork ? `${intToIpv4(currentNetwork.network)}/${currentNetwork.prefix}` : "this subnet"}.`,
          domain,
          [currentNode.id],
          currentSceneId,
        );
      }
      if (currentNetwork) {
        const gatewayInt = ipv4ToInt(gateway);
        if (gatewayInt === null || ((gatewayInt & currentNetwork.mask) >>> 0) !== currentNetwork.network) {
          return failedTrace(
            "gateway-off-subnet",
            `Default gateway ${gateway} is outside ${currentNode.name}'s subnet.`,
            "The gateway must share the interface's subnet — check the IP, mask, and gateway together.",
            domain,
            [currentNode.id],
            currentSceneId,
          );
        }
      }

      const gatewayMember = domain.members.find((member) => normalizeIp(member.port.ip) === gateway);
      if (!gatewayMember || gatewayMember.node.kind !== "device") {
        return failedTrace(
          "gateway-unreachable",
          `Gateway ${gateway} did not answer on ${currentNode.name}'s segment.`,
          "Make sure the gateway router interface is cabled into the same switch/AP and is up.",
          domain,
          [currentNode.id],
          currentSceneId,
        );
      }

      addHops(pathToMember(domain, gatewayMember));
      push({
        kind: "router",
        tone: "info",
        title: `Gateway ${gateway} · ${gatewayMember.node.name}`,
        detail: `Frame handed to ${gatewayMember.port.name}; destination ${destIp} is off-subnet.`,
        sceneId: gatewayMember.sceneId,
        nodeId: gatewayMember.nodeId,
      });
      incoming = gatewayMember.port;
      currentNode = gatewayMember.node;
      currentSceneId = gatewayMember.sceneId;
      currentPort = gatewayMember.port;
      currentIp = normalizeIp(gatewayMember.port.ip) ?? gateway;
      currentMask = maskOf(gatewayMember.port);
      continue;
    }

    // --- Router: route lookup ------------------------------------------
    const routerKey = `${currentNode.id}:${destIp}`;
    if (seenRouters.has(routerKey)) {
      return failedTrace(
        "routing-loop",
        `Traffic is looping at ${currentNode.name}.`,
        "Check static routes for a next-hop that points back down the same path.",
        domain,
        [currentNode.id],
        currentSceneId,
      );
    }
    seenRouters.add(routerKey);

    const decision = routeLookup(currentNode, destIp);
    if (decision.kind === "none") {
      return failedTrace("no-route", decision.reason, "Add a static route (e.g. 0.0.0.0/0 via <next-hop>) or connect the destination subnet.", domain, [currentNode.id], currentSceneId);
    }

    // Firewall policy is intentionally simple and explainable: a default-deny
    // firewall drops transit traffic between its interfaces.
    if (currentNode.modelId === "firewall") {
      const policy = String(currentNode.config.policy ?? "allow").toLowerCase();
      const nat = String(currentNode.config.nat ?? "").toLowerCase() === "yes";
      if (policy === "deny") {
        return failedTrace(
          "firewall-deny",
          `${currentNode.name} default policy is deny.`,
          `Transit from ${incoming?.name ?? "the ingress interface"} to ${decision.egress.name} is blocked. Allow the flow or change the default policy.`,
          domain,
          [currentNode.id],
          currentSceneId,
        );
      }
      if (nat && /wan/i.test(decision.egress.name)) {
        push({
          kind: "service",
          tone: "info",
          title: `NAT · ${currentNode.name}`,
          detail: `Source ${sourceIp} is translated to ${normalizeIp(decision.egress.ip) ?? "the WAN address"} leaving ${decision.egress.name}.`,
          sceneId: currentSceneId,
          nodeId: currentNode.id,
        });
      }
    }

    push({
      kind: currentNode.modelId === "firewall" ? "firewall" : "router",
      tone: "info",
      title: `${currentNode.name} → ${destIp}`,
      detail: `${decision.description}${decision.kind === "static" ? ` (matched /${decision.prefix})` : ""}`,
      sceneId: currentSceneId,
      nodeId: currentNode.id,
    });

    const egressPort = decision.egress;
    const egressIp = normalizeIp(egressPort.ip);
    if (!egressIp) {
      return failedTrace(
        "egress-no-ip",
        `${currentNode.name} · ${egressPort.name} has no IP address.`,
        "Give the router interface an address in the destination's subnet.",
        domain,
        [currentNode.id],
        currentSceneId,
      );
    }

    const egressDomain = broadcastDomain(project, {
      sceneId: currentSceneId,
      nodeId: currentNode.id,
      portId: egressPort.id,
    });
    for (const id of egressDomain.linkIds) linkIds.add(id);

    const nextHop = decision.nextHop;
    const nextHopMember = egressDomain.members.find((member) => normalizeIp(member.port.ip) === nextHop);
    if (!nextHopMember || nextHopMember.node.kind !== "device") {
      return failedTrace(
        "next-hop-unreachable",
        `${currentNode.name} cannot reach next hop ${nextHop} from ${egressPort.name}.`,
        "Check the next-hop address, the cable, and the subnet on the egress interface.",
        egressDomain,
        [currentNode.id],
        currentSceneId,
      );
    }

    if (nextHopMember.node.id === currentNode.id) {
      // Loopback / self-referencing next hop.
      return failedTrace(
        "next-hop-self",
        `${currentNode.name} routes ${destIp} back to itself.`,
        "Point the route at the neighbouring router, not at this router's own address.",
        egressDomain,
        [currentNode.id],
        currentSceneId,
      );
    }

    addHops(pathToMember(egressDomain, nextHopMember));
    incoming = nextHopMember.port;
    currentNode = nextHopMember.node;
    currentSceneId = nextHopMember.sceneId;
    currentPort = nextHopMember.port;
    currentIp = normalizeIp(nextHopMember.port.ip) ?? nextHop;
    currentMask = maskOf(nextHopMember.port);
  }

  return failedTrace("too-many-hops", "The trace exceeded its hop limit.", "Look for a routing loop or a chain of more than 40 devices.");

  function successTrace(): TraceResult {
    return {
      ok: true,
      source: {
        nodeId: sourceNode.id,
        name: sourceNode.name,
        sceneId: sourceScene.id,
        ip: sourceIp ?? "",
        mask: sourceMask,
        portId: sourcePort.id,
      },
      destination,
      steps,
      hops,
      nodeIds: [...nodeIds],
      linkIds: [...linkIds],
    };
  }

  function failedTrace(
    code: string,
    message: string,
    hint: string,
    domain?: BroadcastDomain,
    extraNodeIds: string[] = [],
    sceneId?: string,
  ): TraceResult {
    const failure: TraceFailure = domain
      ? domainFailure(domain, code, message, hint, extraNodeIds, sceneId)
      : { code, message, hint, nodeIds: extraNodeIds, sceneId, blocks: [] };
    push({
      kind: "error",
      tone: "error",
      title: message,
      detail: failure.hint,
      sceneId: failure.sceneId,
      nodeId: failure.nodeIds[0],
      linkId: failure.linkId,
    });
    for (const nodeId of failure.nodeIds) nodeIds.add(nodeId);
    if (failure.linkId) linkIds.add(failure.linkId);
    return {
      ok: false,
      source: {
        nodeId: sourceNode.id,
        name: sourceNode.name,
        sceneId: sourceScene.id,
        ip: sourceIp ?? "",
        mask: sourceMask,
        portId: sourcePort.id,
      },
      destination,
      steps,
      hops,
      nodeIds: [...nodeIds],
      linkIds: [...linkIds],
      failure,
    };
  }
}

export function traceSummary(result: TraceResult): string {
  if (result.ok) {
    return `${result.source.name} → ${result.destination.name} (${result.destination.ip}) is reachable in ${result.hops.length} hops.`;
  }
  return result.failure?.message ?? "Destination unreachable.";
}
