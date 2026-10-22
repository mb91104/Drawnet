import { describe, expect, it } from "vitest";
import {
  createScene,
  type DeviceNode,
  type Link,
  type Medium,
  type Scene,
} from "@drawnet/schema";
import { auditScene, canConnect } from "./index";

function device(id: string, interfaces: { id: string; medium: Medium }[]): DeviceNode {
  return {
    id,
    kind: "device",
    name: id,
    modelId: "pc",
    position: { x: 0, y: 0 },
    config: {},
    notes: "",
    interfaces: interfaces.map((p) => ({
      id: p.id,
      name: p.id,
      medium: p.medium,
      status: "up",
      ip: "",
      mask: "",
    })),
  };
}

function sceneWith(...nodes: DeviceNode[]): Scene {
  const scene = createScene({ name: "test", kind: "micro" });
  for (const node of nodes) scene.nodes[node.id] = node;
  return scene;
}

describe("canConnect", () => {
  it("accepts matching media and picks a default cable", () => {
    const scene = sceneWith(device("a", [{ id: "eth0", medium: "rj45" }]), device("b", [{ id: "eth0", medium: "rj45" }]));
    const result = canConnect(scene, { nodeId: "a", portId: "eth0" }, { nodeId: "b", portId: "eth0" });
    expect(result.ok).toBe(true);
    expect(result.cableId).toBe("cat5e");
  });

  it("rejects copper terminated on fiber", () => {
    const scene = sceneWith(device("a", [{ id: "eth0", medium: "rj45" }]), device("b", [{ id: "wan", medium: "fiber" }]));
    const result = canConnect(scene, { nodeId: "a", portId: "eth0" }, { nodeId: "b", portId: "wan" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/media must match/);
  });

  it("rejects a second cable on an occupied port", () => {
    const scene = sceneWith(
      device("a", [{ id: "eth0", medium: "rj45" }]),
      device("b", [{ id: "eth0", medium: "rj45" }]),
      device("c", [{ id: "eth0", medium: "rj45" }]),
    );
    scene.links.l1 = {
      id: "l1",
      a: { nodeId: "a", portId: "eth0" },
      b: { nodeId: "b", portId: "eth0" },
      cableId: "cat6",
      status: "up",
    };
    const result = canConnect(scene, { nodeId: "a", portId: "eth0" }, { nodeId: "c", portId: "eth0" });
    expect(result.ok).toBe(false);
  });

  it("rejects connecting a device to itself", () => {
    const scene = sceneWith(device("a", [{ id: "eth0", medium: "rj45" }, { id: "eth1", medium: "rj45" }]));
    const result = canConnect(scene, { nodeId: "a", portId: "eth0" }, { nodeId: "a", portId: "eth1" });
    expect(result.ok).toBe(false);
  });
});

describe("auditScene", () => {
  it("flags a cable whose medium does not suit the ports", () => {
    const scene = sceneWith(device("a", [{ id: "eth0", medium: "rj45" }]), device("b", [{ id: "wan", medium: "fiber" }]));
    const link: Link = {
      id: "l1",
      a: { nodeId: "a", portId: "eth0" },
      b: { nodeId: "b", portId: "wan" },
      cableId: "cat6",
      status: "up",
    };
    scene.links.l1 = link;
    const issues = auditScene(scene);
    expect(issues.some((i) => i.id === "media-l1")).toBe(true);
  });

  it("flags isolated devices", () => {
    const scene = sceneWith(device("a", [{ id: "eth0", medium: "rj45" }]));
    const issues = auditScene(scene);
    expect(issues.some((i) => i.id === "isolated-a")).toBe(true);
  });

  it("is quiet about a healthy link", () => {
    const scene = sceneWith(device("a", [{ id: "eth0", medium: "rj45" }]), device("b", [{ id: "eth0", medium: "rj45" }]));
    scene.links.l1 = {
      id: "l1",
      a: { nodeId: "a", portId: "eth0" },
      b: { nodeId: "b", portId: "eth0" },
      cableId: "cat6",
      status: "up",
    };
    expect(auditScene(scene)).toHaveLength(0);
  });
});
