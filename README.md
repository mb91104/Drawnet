# Drawnet

A two-level network simulator and builder — like a minimal Packet Tracer with a
Blender-inspired dark interface. Design a district at the **macro** level, then
step inside a site and wire devices at the **micro** level.

## Features

- **Macro building** — lay out buildings, cabinets, towers, data centers and
  ISP points of presence on a city-scale canvas.
- **Micro building** — drill into a site and place PCs, laptops, phones,
  switches, routers, access points, servers, patch panels and more.
- **Cabling rules** — drag between port dots; media must match (RJ45, fiber,
  coax, wireless, serial) and each port takes one cable.
- **Troubleshooting** — live audit flags isolated devices, unmapped boundary
  ports, duplicate IPs, unreachable gateways and media mismatches.
- **Local-first persistence** — projects autosave to IndexedDB. Import/export
  as `.drawnet.json`.
- **3D-style viewport** — beveled object cards, grid floor, axis gizmo and an
  outliner-style Add shelf.

## Stack

React 18 · TypeScript · Vite · React Flow (`@xyflow/react`) · Zustand ·
Dexie · Zod · npm workspaces

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

| Command | Description |
| --- | --- |
| `npm run dev` | Start the web app in dev mode |
| `npm run build` | Typecheck and build the web app |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | Typecheck every workspace |
| `npm test` | Run engine tests |

## Layout

```
apps/web            React client — canvas, palette, inspector, persistence
packages/schema     Zod schemas and shared model helpers
packages/models     Device catalogue and port templates
packages/engine     Connectivity, audit, IP and trace logic
```

## Keyboard

| Keys | Action |
| --- | --- |
| `Del` | Delete selection |
| `Esc` | Clear selection |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo |
| `Ctrl+S` | Save now |
| `Ctrl+O` | Open projects |
| `Home` | Frame all objects |
| `+` / `−` | Zoom in / out |
| `?` / `F1` | Shortcut map |
| Double-click a site | Step inside it |

## Notes

- All data stays in your browser; there is no server or account.
- The viewport is a flat schematic with 3D-styled presentation, not a true
  perspective renderer.
- `npm run build` may still surface pre-existing strict-mode type errors in
  `packages/engine`; the client itself bundles cleanly with `npx vite build`.
