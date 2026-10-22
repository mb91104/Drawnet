import { useMemo, useState } from "react";
import { CATEGORY_LABEL, modelsByCategory } from "@drawnet/models";
import type { SiteKind } from "@drawnet/schema";
import { SITE_TEMPLATES } from "../lib/catalog";
import { DND_MIME, encodePayload, type DragPayload } from "../lib/dnd";
import { currentScene, useProjectStore } from "../store/projectStore";
import { CubeIcon, SearchIcon } from "./icons";

function nextPosition(): { x: number; y: number } {
  const scene = currentScene(useProjectStore.getState());
  const nodes = Object.values(scene.nodes);
  if (nodes.length === 0) return { x: 80, y: 140 };
  const maxX = Math.max(...nodes.map((n) => n.position.x));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  return { x: maxX + 230, y: minY };
}

export function Palette() {
  const addDevice = useProjectStore((s) => s.addDevice);
  const addSite = useProjectStore((s) => s.addSite);
  const select = useProjectStore((s) => s.select);

  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const groups = useMemo(() => {
    return modelsByCategory()
      .map((group) => ({
        ...group,
        models: group.models.filter(
          (model) =>
            !needle ||
            model.label.toLowerCase().includes(needle) ||
            model.blurb.toLowerCase().includes(needle) ||
            CATEGORY_LABEL[group.category].toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.models.length > 0);
  }, [needle]);

  const sites = useMemo(
    () =>
      SITE_TEMPLATES.filter(
        (template) =>
          !needle ||
          template.label.toLowerCase().includes(needle) ||
          template.blurb.toLowerCase().includes(needle),
      ),
    [needle],
  );

  const total = groups.reduce((sum, group) => sum + group.models.length, 0) + sites.length;

  const placeDevice = (modelId: string) => {
    const id = addDevice(modelId, nextPosition());
    if (id) select([id]);
  };

  const placeSite = (siteKind: SiteKind) => {
    const id = addSite(siteKind, nextPosition());
    if (id) select([id]);
  };

  const dragStart = (event: React.DragEvent, payload: DragPayload) => {
    event.dataTransfer.setData(DND_MIME, encodePayload(payload));
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <aside className="palette">
      <div className="panel-head">
        <span className="panel-head-title">
          <CubeIcon size={13} />
          Add
        </span>
        <span className="panel-head-count">{total} items</span>
      </div>

      <div className="palette-search">
        <SearchIcon size={12} />
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search objects…"
          aria-label="Search devices and sites"
          spellCheck={false}
        />
      </div>

      {groups.map((group) => (
        <div className="palette-group" key={group.category}>
          <div className="panel-title">
            <span>{CATEGORY_LABEL[group.category]}</span>
            <span>{group.models.length}</span>
          </div>
          {group.models.map((model) => (
            <button
              key={model.id}
              type="button"
              className="palette-item"
              draggable
              onDragStart={(event) => dragStart(event, { type: "device", modelId: model.id })}
              onClick={() => placeDevice(model.id)}
              title={`${model.blurb}\n\nDrag onto the viewport, or click to add.`}
            >
              <span className="palette-icon">{model.icon}</span>
              <span className="palette-copy">
                <span className="palette-name">{model.label}</span>
                <span className="palette-blurb">{model.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      ))}

      {sites.length > 0 ? (
        <div className="palette-group">
          <div className="panel-title">
            <span>Sites</span>
            <span>{sites.length}</span>
          </div>
          {sites.map((template) => (
            <button
              key={template.kind}
              type="button"
              className="palette-item"
              draggable
              onDragStart={(event) => dragStart(event, { type: "site", siteKind: template.kind })}
              onClick={() => placeSite(template.kind)}
              title={`${template.blurb}\n\nDrag onto the viewport, or click to add.`}
            >
              <span className="palette-icon">{template.icon}</span>
              <span className="palette-copy">
                <span className="palette-name">{template.label}</span>
                <span className="palette-blurb">{template.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {total === 0 ? (
        <div className="palette-empty">
          Nothing matches “{query.trim()}”. Try a device, medium or site name.
        </div>
      ) : null}

      <div className="palette-hint">
        <b>Wire:</b> drag from one port dot to another. Media must match.
        <br />
        <b>Drill down:</b> double-click a site.
        <br />
        <kbd>Del</kbd> remove · <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo
      </div>
    </aside>
  );
}
