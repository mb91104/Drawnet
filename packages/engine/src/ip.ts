/**
 * Small, dependency-free IPv4 helpers used by the reachability engine.
 * Addresses are represented internally as unsigned 32-bit integers.
 */

export const DEFAULT_MASK = "255.255.255.0";

export function ipv4ToInt(input: string): number | null {
  const value = input.trim();
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    result = (result * 256 + octet) >>> 0;
  }
  return result >>> 0;
}

export function intToIpv4(value: number): string {
  const n = value >>> 0;
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

/** Number of leading one-bits, or null for a non-contiguous mask. */
export function maskToPrefix(mask: string): number | null {
  const value = ipv4ToInt(mask);
  if (value === null) return null;
  let seenZero = false;
  let prefix = 0;
  for (let bit = 31; bit >= 0; bit -= 1) {
    const set = ((value >>> bit) & 1) === 1;
    if (set && seenZero) return null;
    if (set) prefix += 1;
    else seenZero = true;
  }
  return prefix;
}

export function prefixToMask(prefix: number): string {
  const safe = Math.max(0, Math.min(32, Math.round(prefix)));
  const value = safe === 0 ? 0 : (0xffffffff << (32 - safe)) >>> 0;
  return intToIpv4(value);
}

/** Normalise a mask that may have been written as `/24` or `24`. */
export function normalizeMask(mask: string | undefined): string | null {
  const raw = (mask ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("/")) {
    const prefix = Number(raw.slice(1));
    return Number.isInteger(prefix) && prefix >= 0 && prefix <= 32 ? prefixToMask(prefix) : null;
  }
  if (/^\d{1,2}$/.test(raw)) {
    const prefix = Number(raw);
    return prefix >= 0 && prefix <= 32 ? prefixToMask(prefix) : null;
  }
  return ipv4ToInt(raw) !== null && maskToPrefix(raw) !== null ? raw : null;
}

export interface Network {
  ip: number;
  mask: number;
  network: number;
  broadcast: number;
  prefix: number;
}

export function networkOf(ip: string, mask: string): Network | null {
  const addr = ipv4ToInt(ip);
  const maskValue = ipv4ToInt(normalizeMask(mask) ?? "");
  const prefix = maskToPrefix(mask ?? "");
  if (addr === null || maskValue === null || prefix === null) return null;
  const network = (addr & maskValue) >>> 0;
  const broadcast = (network | (~maskValue >>> 0)) >>> 0;
  return { ip: addr, mask: maskValue, network, broadcast, prefix };
}

export function sameSubnet(aIp: string, aMask: string, bIp: string, bMask?: string): boolean {
  const a = networkOf(aIp, aMask);
  const b = networkOf(bIp, bMask ?? aMask);
  if (!a || !b) return false;
  return a.network === b.network && a.prefix === b.prefix;
}

export function isUsableHost(ip: string, mask: string): boolean {
  const net = networkOf(ip, mask);
  if (!net) return false;
  if (net.prefix >= 31) return true;
  return net.ip !== net.network && net.ip !== net.broadcast;
}

export function normalizeIp(input: string | undefined): string | null {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return null;
  return ipv4ToInt(trimmed) === null ? null : trimmed;
}

/** True when the text looks like an address the user could still be typing. */
export function isBlankOrDhcp(value: string | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "" || v === "dhcp" || v === "auto";
}

export function ipInNetwork(ip: string, network: number, mask: number): boolean {
  const addr = ipv4ToInt(ip);
  if (addr === null) return false;
  return ((addr & mask) >>> 0) === (network >>> 0);
}

export function cidr(ip: string, mask: string): string {
  const net = networkOf(ip, mask);
  return net ? `${intToIpv4(net.network)}/${net.prefix}` : `${ip}/${mask}`;
}
