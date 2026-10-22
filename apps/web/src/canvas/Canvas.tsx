import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  SITE_KIND_LABEL,
  cableById,
  sceneStats,
  type Link,
  type NetNode,
  type PortRef,
  type Project,
} from "@drawnet/schema";
import { deviceModelById } from "@drawnet/models";
import { canConnect } from "@drawnet/engine";
import { currentScene, useProjectStore } from "../store/projectStore";
import { useUiStore } from "../store/uiStore";
import { MEDIUM_COLOR, SITE_ICON } from "../lib/catalog";
import { DND_MIME, decodePayload } from "../lib/dnd";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { LayersIcon } from "../components/icons";
import { nodeTypes } from "./nodeTypes";
import {
  inHandle,
  outHandle,
  parseHandle,
  type AnyFlowNode,
  type LinkFlowEdge,
} from "./types";

function toFlowNode(node: NetNode, project: Project): AnyFlowNode {
  if (node.kind === "device") {
    const model = deviceModelById(node.modelId);
    return {
      id: node.id,
      type: "device",
      position: node.position,
      data: {
        node,
        icon: model?.icon ?? "❔",
        label: model?.label ?? node.modelId,
        width: model?.width ?? 196,
      },
    };
  }

  const child = node.childSceneId ? project.scenes[node.childSceneId] : undefined;
  const stats = child ? sceneStats(child) : { devices: 0, sites: 0, links: 0 };
  return {
    id: node.id,
    type: "site",
    position: node.position,
    data: {
      node,
      icon: SITE_ICON[node.siteKind],
      label: SITE_KIND_LABEL[node.siteKind],
      childDevices: stats.devices + stats.sites,
      childLinks: stats.links,
    },
  };
}

function toFlowEdge(link: Link): LinkFlowEdge {
  const cable = cableById(link.cableId);
  const medium = cable?.medium ?? "rj45";
  const down = link.status === "down";

  return {
    id: link.id,
    type: "smoothstep",
    source: link.a.nodeId,
    sourceHandle: outHandle(link.a.portId),
    target: link.b.nodeId,
    targetHandle: inHandle(link.b.portId),
    data: { link, cableLabel: cable?.label ?? link.cableId },
    animated: !down && medium === "wireless",
    style: {
      stroke: down ? "#46536d" : (MEDIUM_COLOR[medium] ?? "#4cc9f0"),
      strokeDasharray: medium === "wireless" ? "6 5" : undefined,
      opacity: down ? 0.55 : 1,
    },
  };
}

function AxisGizmo() {
  return (
    <div className="axis-gizmo" aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" fill="rgba(17,17,17,0.38)" stroke="#4a4a4a" strokeWidth="0.8" />
        <g className="axis-x" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <line x1="32" y1="32" x2="12" y2="49" />
          <circle cx="12" cy="49" r="4.2" fill="currentColor" stroke="none" />
          <text x="8" y="54" fontSize="7" fill="currentColor" stroke="none" fontFamily="Inter, sans-serif">
            X
          </text>
        </g>
        <g className="axis-y" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <line x1="32" y1="32" x2="52" y2="49" />
          <circle cx="52" cy="49" r="4.2" fill="currentColor" stroke="none" />
          <text x="55" y="54" fontSize="7" fill="currentColor" stroke="none" fontFamily="Inter, sans-serif">
            Y
          </text>
        </g>
        <g className="axis-z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <line x1="32" y1="32" x2="32" y2="7" />
          <circle cx="32" cy="7" r="4.2" fill="currentColor" stroke="none" />
          <text x="35" y="9" fontSize="7" fill="currentColor" stroke="none" fontFamily="Inter, sans-serif">
            Z
          </text>
        </g>
        <circle cx="32" cy="32" r="2.2" fill="#d8d8d8" />
      </svg>
    </div>
  );
}

export function Canvas() {
  const project = useProjectStore((s) => s.project);
  const scene = useProjectStore(currentScene);
  const addDevice = useProjectStore((s) => s.addDevice);
  const addSite = useProjectStore((s) => s.addSite);
  const addLink = useProjectStore((s) => s.addLink);
  const moveNode = useProjectStore((s) => s.moveNode);
  const select = useProjectStore((s) => s.select);
  const setScenePath = useProjectStore((s) => s.goToScene);
  const selectedLinkId = useProjectStore((s) => s.selectedLinkId);
  const enterSite = useProjectStore((s) => s.enterSite);
  const notify = useUiStore((s) => s.notify);
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();

  useEffect(() => {
    const frameAll = () => void fitView({ padding: 0.22, duration: 260 });

    const onView = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      if (action === "fit") frameAll();
      else if (action === "zoomIn") void zoomIn({ duration: 140 });
      else if (action === "zoomOut") void zoomOut({ duration: 140 });
    };

    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === "Home") {
        event.preventDefault();
        frameAll();
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        void zoomIn({ duration: 140 });
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        void zoomOut({ duration: 140 });
      }
    };

    window.addEventListener("drawnet:view", onView);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("drawnet:view", onView);
      window.removeEventListener("keydown", onKey);
    };
  }, [fitView, zoomIn, zoomOut]);

  const flowNodes = useMemo(
    () => Object.values(scene.nodes).map((node) => toFlowNode(node, project)),
    [scene, project],
  );
  const flowEdges = useMemo(
    () =>
      Object.values(scene.links).map((link) => {
        const edge = toFlowEdge(link);
        edge.selected = link.id === selectedLinkId;
        return edge;
      }),
    [scene, selectedLinkId],
  );

  const [nodes, setNodes] = useState<AnyFlowNode[]>(flowNodes);

  useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fitView({ padding: 0.22, duration: 240 });
    }, 70);
    return () => window.clearTimeout(timer);
  }, [scene.id, fitView]);

  const onNodesChange = useCallback((changes: NodeChange<AnyFlowNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const markSelected = useCallback((nodeId: string) => {
    setNodes((current) => current.map((node) => ({ ...node, selected: node.id === nodeId })));
  }, []);

  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      moveNode(node.id, node.position);
    },
    [moveNode],
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const state = useProjectStore.getState();
    const ids = params.nodes.map((node) => node.id);
    const linkId = params.edges[0]?.id ?? null;
    const sameNodes =
      ids.length === state.selectedNodeIds.length &&
      ids.every((id, index) => id === state.selectedNodeIds[index]);
    if (!sameNodes || linkId !== state.selectedLinkId) {
      state.select(ids, linkId);
    }
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      const from = parseHandle(connection.sourceHandle);
      const to = parseHandle(connection.targetHandle);
      if (!from || !to) return;

      let left: PortRef;
      let right: PortRef;
      if (from.side === "in") {
        left = { nodeId: connection.target, portId: from.portId };
        right = { nodeId: connection.source, portId: to.portId };
      } else {
        left = { nodeId: connection.source, portId: from.portId };
        right = { nodeId: connection.target, portId: to.portId };
      }

      const result = addLink(left, right);
      if (!result.ok) notify(result.reason, "error");
    },
    [addLink, notify],
  );

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    const from = parseHandle(connection.sourceHandle);
    const to = parseHandle(connection.targetHandle);
    if (!from || !to) return false;
    return canConnect(
      currentScene(useProjectStore.getState()),
      { nodeId: connection.source, portId: from.portId },
      { nodeId: connection.target, portId: to.portId },
    ).ok;
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const payload = decodePayload(event.dataTransfer.getData(DND_MIME));
      if (!payload) return;

      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const position = { x: point.x - 90, y: point.y - 24 };

      let createdId: string | null = null;
      if (payload.type === "device") createdId = addDevice(payload.modelId, position);
      else createdId = addSite(payload.siteKind, position);

      if (createdId) markSelected(createdId);
    },
    [addDevice, addSite, markSelected, screenToFlowPosition],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const state = useProjectStore.getState();
      const actual = currentScene(state).nodes[node.id];
      if (actual?.kind === "site") enterSite(actual.id);
    },
    [enterSite],
  );

  const stats = sceneStats(scene);

  return (
    <div className="canvas-wrap" onDrop={onDrop} onDragOver={onDragOver}>
      <div className="viewport-head">
        <span className="viewport-icon">
          <LayersIcon size={12} />
        </span>
        <div className="viewport-head-left">
          <Breadcrumbs />
        </div>
        <div className="viewport-head-right">
          <div className="canvas-badge">
            <span className="scene-kind">{scene.kind}</span>
            <span>
              <b>{stats.devices}</b> devices · <b>{stats.sites}</b> sites · <b>{stats.links}</b>{" "}
              cables
            </span>
          </div>
        </div>
      </div>

      <div className="flow-shell">
        <ReactFlow<AnyFlowNode, LinkFlowEdge>
          nodes={nodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          onNodeDoubleClick={onNodeDoubleClick}
          onConnect={onConnect}
          onConnectEnd={(_event, state) => {
            if (state.isValid === false) {
              notify(
                "Those ports can't be cabled — the media must match and each port takes one cable.",
                "error",
              );
            }
          }}
          onSelectionChange={onSelectionChange}
          onEdgeClick={(event, edge) => {
            event.stopPropagation();
            select([], edge.id);
          }}
          onPaneClick={() => select([], null)}
          isValidConnection={isValidConnection}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={null}
          zoomOnDoubleClick={false}
          snapToGrid
          snapGrid={[10, 10]}
          minZoom={0.2}
          maxZoom={2.5}
          fitView
          fitViewOptions={{ padding: 0.22 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Lines} gap={26} size={1} color="#353535" />
          <Controls showInteractive={false} position="bottom-left" />
          <MiniMap
            pannable
            zoomable
            position="bottom-right"
            nodeStrokeWidth={1}
            nodeColor={(node) => (node.type === "site" ? "#9b7bd4" : "#e87d0d")}
            maskColor="rgba(14, 14, 14, 0.7)"
            style={{ width: 162, height: 104 }}
          />
        </ReactFlow>

        <AxisGizmo />

        {nodes.length === 0 ? (
          <div className="empty-canvas">
            <div className="empty-card">
              <strong>{scene.name} is empty</strong>
              Drag a device or a site from the Add shelf into the viewport. Wire two ports together
              by dragging from a port dot. Double-click a site to step inside it.
              <div style={{ marginTop: 10 }}>
                <button type="button" className="btn ghost-border" onClick={() => setScenePath(0)}>
                  Back to overview
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
