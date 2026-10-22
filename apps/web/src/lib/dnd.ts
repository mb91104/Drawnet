import type { SiteKind } from "@drawnet/schema";

export const DND_MIME = "application/x-drawnet";

export type DragPayload =
  | { type: "device"; modelId: string }
  | { type: "site"; siteKind: SiteKind };

export function encodePayload(payload: DragPayload): string {
  return JSON.stringify(payload);
}

export function decodePayload(raw: string): DragPayload | null {
  try {
    const value = JSON.parse(raw) as Partial<DragPayload>;
    if (value.type === "device" && typeof value.modelId === "string") {
      return { type: "device", modelId: value.modelId };
    }
    if (value.type === "site" && typeof value.siteKind === "string") {
      return { type: "site", siteKind: value.siteKind as SiteKind };
    }
    return null;
  } catch {
    return null;
  }
}
