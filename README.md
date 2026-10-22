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

## Deploying to Vercel

The repo ships with a root [`vercel.json`](./vercel.json) that builds the
workspace and serves the Vite output:

| Setting | Value |
| --- | --- |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `apps/web/dist` |
| Framework | Vite |
| Node.js | 22 (`.nvmrc`) |

### Option 1 — Git integration (recommended)

1. Push the repository to GitHub (already at `mb91104/Drawnet`).
2. In Vercel, choose **Add New → Project** and import the repository.
3. Leave **Root Directory** at the repository root. Vercel reads
   `vercel.json`, so the build and output settings are already correct.
4. Click **Deploy**. Every push to the production branch redeploys; other
   branches get preview URLs.

No environment variables are required.

### Option 2 — Vercel CLI

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production deployment
```

Run these from the repository root so the root `vercel.json` is used.

### Notes

- `apps/web/dist` is generated at build time and is git-ignored.
- The app is fully static; there are no serverless functions, databases, or
  secrets. User projects live in the visitor's own browser.
- If you instead set the Vercel **Root Directory** to `apps/web`, override the
  install command with `cd ../.. && npm ci`, the build command with
  `cd ../.. && npm run build`, and the output directory with `dist`.

## Notes

- All data stays in your browser; there is no server or account.
- The viewport is a flat schematic with 3D-styled presentation, not a true
  perspective renderer.
