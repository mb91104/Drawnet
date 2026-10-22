import { produce, type Draft } from "immer";
import { create } from "zustand";
import {
  SITE_KIND_LABEL,
  createEmptyProject,
  createScene,
  newId,
  type DeviceNode,
  type Link,
  type NetNode,
  type Port,
  type PortRef,
  type Position,
  type Project,
  type Scene,
  type SiteKind,
  type SiteNode,
} from "@drawnet/schema";
import { deviceModelById, freshPortsFor } from "@drawnet/models";
import { canConnect } from "@drawnet/engine";

const HISTORY_LIMIT = 80;

export interface ProjectStore {
  project: Project;
  scenePath: string[];
  selectedNodeIds: string[];
  selectedLinkId: string | null;
  past: Project[];
  future: Project[];

  load: (project: Project) => void;
  reset: () => void;
  renameProject: (name: string) => void;

  addDevice: (modelId: string, position: Position) => string | null;
  addSite: (siteKind: SiteKind, position: Position) => string | null;
  moveNode: (nodeId: string, position: Position) => void;
  renameNode: (nodeId: string, name: string) => void;
  setNodeNotes: (nodeId: string, notes: string) => void;
  setSiteKind: (nodeId: string, siteKind: SiteKind) => void;
  updateConfig: (nodeId: string, key: string, value: string | number | boolean) => void;
  updatePort: (nodeId: string, portId: string, patch: Partial<Port>) => void;
  deleteNodes: (nodeIds: string[]) => void;

  addLink: (a: PortRef, b: PortRef) => { ok: true } | { ok: false; reason: string };
  updateLink: (linkId: string, patch: { cableId?: string; status?: "up" | "down" }) => void;
  deleteLink: (linkId: string) => void;

  select: (nodeIds: string[], linkId?: string | null) => void;
  enterSite: (nodeId: string) => void;
  goToScene: (index: number) => void;

  undo: () => void;
  redo: () => void;
}

/** Resolve the scene currently shown on the canvas, falling back towards the
 *  root when an undo removed a scene from the navigation path. */
export function currentScene(state: { project: Project; scenePath: string[] }): Scene {
  for (let i = state.scenePath.length - 1; i >= 0; i -= 1) {
    const id = state.scenePath[i];
    const scene = id ? state.project.scenes[id] : undefined;
    if (scene) return scene;
  }
  const root = state.project.scenes[state.project.rootSceneId];
  if (!root) throw new Error("Project has no root scene");
  return root;
}

export function selectedNode(state: ProjectStore): NetNode | null {
  const id = state.selectedNodeIds[0];
  if (!id) return null;
  return currentScene(state).nodes[id] ?? null;
}

function uniqueName(existing: string[], base: string): string {
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

function collectChildSceneIds(project: Project, sceneId: string, acc: Set<string>): void {
  const scene = project.scenes[sceneId];
  if (!scene) return;
  for (const node of Object.values(scene.nodes)) {
    if (node.kind === "site" && node.childSceneId && !acc.has(node.childSceneId)) {
      acc.add(node.childSceneId);
      collectChildSceneIds(project, node.childSceneId, acc);
    }
  }
}

const initial = createEmptyProject();

export const useProjectStore = create<ProjectStore>()((set, get) => {
  /** The scene being edited right now, as an immer draft. */
  const editScene = (draft: Draft<Project>): Draft<Scene> | undefined => {
    const sceneId = currentScene({
      project: draft as unknown as Project,
      scenePath: get().scenePath,
    }).id;
    return draft.scenes[sceneId];
  };

  const mutate = (recipe: (draft: Draft<Project>) => void, history = true): void => {
    const current = get().project;
    const next = produce(current, (draft) => {
      recipe(draft);
      draft.updatedAt = new Date().toISOString();
    });
    if (next === current) return;
    if (!history) {
      set({ project: next });
      return;
    }
    set((state) => ({
      project: next,
      past: [...state.past.slice(-(HISTORY_LIMIT - 1)), current],
      future: [],
    }));
  };

  return {
    project: initial,
    scenePath: [initial.rootSceneId],
    selectedNodeIds: [],
    selectedLinkId: null,
    past: [],
    future: [],

    load: (project) =>
      set({
        project,
        scenePath: [project.rootSceneId],
        selectedNodeIds: [],
        selectedLinkId: null,
        past: [],
        future: [],
      }),

    reset: () => {
      const project = createEmptyProject();
      set({
        project,
        scenePath: [project.rootSceneId],
        selectedNodeIds: [],
        selectedLinkId: null,
        past: [],
        future: [],
      });
    },

    renameProject: (name) =>
      mutate((draft) => {
        draft.name = name.trim() || "Untitled network";
      }),

    addDevice: (modelId, position) => {
      const model = deviceModelById(modelId);
      if (!model) return null;
      const id = newId("dev");
      mutate((draft) => {
        const scene = editScene(draft);
        if (!scene) return;
        const names = Object.values(scene.nodes).map((n) => n.name);
        const node: DeviceNode = {
          id,
          kind: "device",
          name: uniqueName(names, model.label),
          modelId,
          position: { x: Math.round(position.x), y: Math.round(position.y) },
          interfaces: freshPortsFor(modelId),
          config: {},
          notes: "",
        };
        scene.nodes[id] = node;
      });
      set({ selectedNodeIds: [id], selectedLinkId: null });
      return id;
    },

    addSite: (siteKind, position) => {
      const id = newId("site");
      const childSceneId = newId("scene");
      mutate((draft) => {
        const scene = editScene(draft);
        if (!scene) return;
        const names = Object.values(scene.nodes).map((n) => n.name);
        const node: SiteNode = {
          id,
          kind: "site",
          name: uniqueName(names, SITE_KIND_LABEL[siteKind]),
          siteKind,
          position: { x: Math.round(position.x), y: Math.round(position.y) },
          boundaryPorts: [
            { id: "p1", name: "Fiber uplink", medium: "fiber", status: "up", ip: "", mask: "" },
            { id: "p2", name: "Copper uplink", medium: "rj45", status: "up", ip: "", mask: "" },
            { id: "p3", name: "Drop out", medium: "rj45", status: "up", ip: "", mask: "" },
          ],
          boundaryLinks: {},
          childSceneId,
          notes: "",
        };
        scene.nodes[id] = node;
        draft.scenes[childSceneId] = createScene({
          id: childSceneId,
          name: node.name,
          kind: "micro",
          parentSiteId: id,
        });
      });
      set({ selectedNodeIds: [id], selectedLinkId: null });
      return id;
    },

    moveNode: (nodeId, position) =>
      mutate((draft) => {
        const node = editScene(draft)?.nodes[nodeId];
        if (!node) return;
        node.position = { x: Math.round(position.x), y: Math.round(position.y) };
      }),

    renameNode: (nodeId, name) =>
      mutate((draft) => {
        const node = editScene(draft)?.nodes[nodeId];
        if (!node || !name.trim()) return;
        node.name = name.trim();
        if (node.kind === "site" && node.childSceneId) {
          const child = draft.scenes[node.childSceneId];
          if (child) child.name = node.name;
        }
      }),

    setNodeNotes: (nodeId, notes) =>
      mutate((draft) => {
        const node = editScene(draft)?.nodes[nodeId];
        if (!node) return;
        node.notes = notes;
      }),

    setSiteKind: (nodeId, siteKind) =>
      mutate((draft) => {
        const node = editScene(draft)?.nodes[nodeId];
        if (!node || node.kind !== "site") return;
        node.siteKind = siteKind;
      }),

    updateConfig: (nodeId, key, value) =>
      mutate((draft) => {
        const node = editScene(draft)?.nodes[nodeId];
        if (!node || node.kind !== "device") return;
        node.config[key] = value;
      }),

    updatePort: (nodeId, portId, patch) =>
      mutate((draft) => {
        const node = editScene(draft)?.nodes[nodeId];
        if (!node) return;
        const ports: Port[] = node.kind === "device" ? node.interfaces : node.boundaryPorts;
        const port = ports.find((p) => p.id === portId);
        if (!port) return;
        Object.assign(port, patch);
      }),

    deleteNodes: (nodeIds) => {
      const ids = new Set(nodeIds);
      if (ids.size === 0) return;
      mutate((draft) => {
        const scene = editScene(draft);
        if (!scene) return;

        const doomedScenes = new Set<string>();
        for (const id of ids) {
          const node = scene.nodes[id];
          if (node?.kind === "site" && node.childSceneId && !doomedScenes.has(node.childSceneId)) {
            doomedScenes.add(node.childSceneId);
            collectChildSceneIds(draft as unknown as Project, node.childSceneId, doomedScenes);
          }
          delete scene.nodes[id];
        }

        for (const [linkId, link] of Object.entries(scene.links)) {
          if (ids.has(link.a.nodeId) || ids.has(link.b.nodeId)) delete scene.links[linkId];
        }

        for (const sceneId of doomedScenes) delete draft.scenes[sceneId];
      });

      const project = get().project;
      const remaining = get().scenePath.filter((id) => Boolean(project.scenes[id]));
      set({
        selectedNodeIds: [],
        selectedLinkId: null,
        scenePath: remaining.length ? remaining : [project.rootSceneId],
      });
    },

    addLink: (a, b) => {
      const scene = currentScene(get());
      const check = canConnect(scene, a, b);
      if (!check.ok || !check.cableId) {
        return { ok: false, reason: check.reason ?? "Those ports cannot be connected." };
      }
      const cableId = check.cableId;
      const id = newId("link");
      mutate((draft) => {
        const target = editScene(draft);
        if (!target) return;
        const link: Link = { id, a, b, cableId, status: "up" };
        target.links[id] = link;
      });
      set({ selectedLinkId: id, selectedNodeIds: [] });
      return { ok: true };
    },

    updateLink: (linkId, patch) =>
      mutate((draft) => {
        const link = editScene(draft)?.links[linkId];
        if (!link) return;
        Object.assign(link, patch);
      }),

    deleteLink: (linkId) => {
      mutate((draft) => {
        const scene = editScene(draft);
        if (scene) delete scene.links[linkId];
      });
      set({ selectedLinkId: null });
    },

    select: (nodeIds, linkId = null) => set({ selectedNodeIds: nodeIds, selectedLinkId: linkId }),

    enterSite: (nodeId) => {
      const scene = currentScene(get());
      const node = scene.nodes[nodeId];
      if (!node || node.kind !== "site") return;

      const existing = node.childSceneId;
      const targetSceneId = existing ?? newId("scene");

      if (!existing) {
        mutate((draft) => {
          const site = editScene(draft)?.nodes[nodeId];
          if (!site || site.kind !== "site") return;
          site.childSceneId = targetSceneId;
          draft.scenes[targetSceneId] = createScene({
            id: targetSceneId,
            name: site.name,
            kind: "micro",
            parentSiteId: nodeId,
          });
        });
      }

      set((state) => ({
        scenePath: [...state.scenePath, targetSceneId],
        selectedNodeIds: [],
        selectedLinkId: null,
      }));
    },

    goToScene: (index) =>
      set((state) => ({
        scenePath: state.scenePath.slice(0, index + 1),
        selectedNodeIds: [],
        selectedLinkId: null,
      })),

    undo: () => {
      const state = get();
      const previous = state.past[state.past.length - 1];
      if (!previous) return;
      set({
        project: previous,
        past: state.past.slice(0, -1),
        future: [state.project, ...state.future].slice(0, HISTORY_LIMIT),
        selectedNodeIds: [],
        selectedLinkId: null,
      });
    },

    redo: () => {
      const state = get();
      const next = state.future[0];
      if (!next) return;
      set({
        project: next,
        past: [...state.past, state.project].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        selectedNodeIds: [],
        selectedLinkId: null,
      });
    },
  };
});

export const canUndo = (state: ProjectStore): boolean => state.past.length > 0;
export const canRedo = (state: ProjectStore): boolean => state.future.length > 0;
