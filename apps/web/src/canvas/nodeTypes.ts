import type { NodeTypes } from "@xyflow/react";
import { DeviceNodeView } from "./DeviceNode";
import { SiteNodeView } from "./SiteNode";

/** React Flow resolves custom renderers from this map. */
export const nodeTypes = {
  device: DeviceNodeView,
  site: SiteNodeView,
} as unknown as NodeTypes;
