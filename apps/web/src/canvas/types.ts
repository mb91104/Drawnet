import type { Edge, Node } from "@xyflow/react";
import type { DeviceNode, Link, SiteNode } from "@drawnet/schema";

export type DeviceFlowNode = Node<
  {
    node: DeviceNode;
    icon: string;
    label: string;
    width: number;
  },
  "device"
>;

export type SiteFlowNode = Node<
  {
    node: SiteNode;
    icon: string;
    label: string;
    childDevices: number;
    childLinks: number;
  },
  "site"
>;

export type AnyFlowNode = DeviceFlowNode | SiteFlowNode;

export type LinkFlowEdge = Edge<
  {
    link: Link;
    cableLabel: string;
  },
  "smoothstep"
>;

export const outHandle = (portId: string): string => `port-${portId}-out`;
export const inHandle = (portId: string): string => `port-${portId}-in`;

export function parseHandle(handleId: string | null | undefined): { portId: string; side: "in" | "out" } | null {
  if (!handleId) return null;
  const match = /^port-(.+)-(in|out)$/.exec(handleId);
  if (!match || !match[1] || !match[2]) return null;
  return { portId: match[1], side: match[2] as "in" | "out" };
}
