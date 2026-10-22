import {
  CABLES,
  MEDIA,
  MEDIUM_LABEL,
  SITE_KINDS,
  SITE_KIND_LABEL,
  sceneStats,
  type DeviceNode,
  type Link,
  type SiteNode,
} from "@drawnet/schema";
import { deviceModelById } from "@drawnet/models";
import { auditScene, endpointLabel, findPort } from "@drawnet/engine";
import { currentScene, selectedNode, useProjectStore } from "../store/projectStore";
import { MEDIUM_COLOR, SITE_ICON } from "../lib/catalog";
import { SelectField, TextField } from "./fields";

export function Inspector() {
  const scene = useProjectStore(currentScene);
  const node = useProjectStore(selectedNode);
  const selectedCount = useProjectStore((s) => s.selectedNodeIds.length);
  const selectedLinkId = useProjectStore((s) => s.selectedLinkId);
  const link = selectedLinkId ? scene.links[selectedLinkId] : undefined;

  if (selectedCount > 1) return <MultiSelection count={selectedCount} />;
  if (link) return <LinkInspector link={link} sceneId={scene.id} />;
  if (node) {
    return node.kind === "device" ? (
      <DeviceInspector node={node} />
    ) : (
      <SiteInspector node={node} />
    );
  }
  return <ProjectInspector />;
}

function MultiSelection({ count }: { count: number }) {
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const deleteNodes = useProjectStore((s) => s.deleteNodes);

  return (
    <aside className="inspector">
      <div className="insp-head">
        <div className="insp-icon">🗂️</div>
        <div>
          <div className="insp-title">{count} items selected</div>
          <div className="insp-sub">Shift-click to extend the selection</div>
        </div>
      </div>
      <button type="button" className="btn danger ghost-border" onClick={() => deleteNodes(selectedNodeIds)}>
        Delete selection
      </button>
    </aside>
  );
}

function DeviceInspector({ node }: { node: DeviceNode }) {
  const model = deviceModelById(node.modelId);
  const renameNode = useProjectStore((s) => s.renameNode);
  const setNodeNotes = useProjectStore((s) => s.setNodeNotes);
  const updateConfig = useProjectStore((s) => s.updateConfig);
  const updatePort = useProjectStore((s) => s.updatePort);
  const deleteNodes = useProjectStore((s) => s.deleteNodes);

  return (
    <aside className="inspector">
      <div className="insp-head">
        <div className="insp-icon">{model?.icon ?? "❔"}</div>
        <div>
          <div className="insp-title">{node.name}</div>
          <div className="insp-sub">
            {model?.label ?? node.modelId} · {node.interfaces.length} ports
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-label">Identity</div>
        <div className="field">
          <label htmlFor="node-name">Name</label>
          <TextField
            value={node.name}
            onCommit={(value) => renameNode(node.id, value)}
            placeholder="Device name"
          />
        </div>
        <div className="field">
          <label htmlFor="node-notes">Notes</label>
          <TextField
            value={node.notes}
            onCommit={(value) => setNodeNotes(node.id, value)}
            placeholder="Location, role, owner…"
          />
        </div>
      </div>

      <div className="section">
        <div className="section-label">
          <span>Interfaces</span>
          <span>{node.interfaces.length}</span>
        </div>
        <div className="port-table">
          <div className="port-row header">
            <span />
            <span>Port</span>
            <span>Address</span>
          </div>
          {node.interfaces.map((port) => (
            <div className="port-row" key={port.id}>
              <button
                type="button"
                className="port-toggle"
                title={port.status === "up" ? "Administratively down" : "Bring up"}
                onClick={() =>
                  updatePort(node.id, port.id, { status: port.status === "up" ? "down" : "up" })
                }
              >
                <span
                  className={`led ${port.status === "down" ? "" : port.medium === "wireless" ? "wireless" : "up"}`}
                />
              </button>
              <span className="port-label" title={`${port.name} · ${port.medium}`}>
                {port.name}
                <span className="medium-tag">{port.medium}</span>
              </span>
              <TextField
                value={port.ip}
                mono
                ariaLabel={`${port.name} address`}
                placeholder="dhcp"
                onCommit={(value) => updatePort(node.id, port.id, { ip: value })}
              />
            </div>
          ))}
        </div>
      </div>

      {model?.configFields?.length ? (
        <div className="section">
          <div className="section-label">Settings</div>
          {model.configFields.map((field) => {
            const raw = node.config[field.key];
            const value = raw === undefined ? "" : String(raw);
            return (
              <div className="field" key={field.key}>
                <label>{field.label}</label>
                {field.type === "select" && field.options ? (
                  <SelectField
                    value={value}
                    options={field.options.map((option) => ({ value: option, label: option }))}
                    onChange={(next) => updateConfig(node.id, field.key, next)}
                  />
                ) : (
                  <TextField
                    value={value}
                    placeholder={field.placeholder}
                    onCommit={(next) => updateConfig(node.id, field.key, next)}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      <button
        type="button"
        className="btn danger ghost-border"
        onClick={() => deleteNodes([node.id])}
      >
        Delete device
      </button>
    </aside>
  );
}

function SiteInspector({ node }: { node: SiteNode }) {
  const project = useProjectStore((s) => s.project);
  const renameNode = useProjectStore((s) => s.renameNode);
  const setNodeNotes = useProjectStore((s) => s.setNodeNotes);
  const setSiteKind = useProjectStore((s) => s.setSiteKind);
  const enterSite = useProjectStore((s) => s.enterSite);
  const deleteNodes = useProjectStore((s) => s.deleteNodes);

  const child = node.childSceneId ? project.scenes[node.childSceneId] : undefined;
  const stats = child ? sceneStats(child) : { devices: 0, sites: 0, links: 0 };

  return (
    <aside className="inspector">
      <div className="insp-head">
        <div className="insp-icon">{SITE_ICON[node.siteKind]}</div>
        <div>
          <div className="insp-title">{node.name}</div>
          <div className="insp-sub">
            {SITE_KIND_LABEL[node.siteKind]} · {stats.devices} devices inside
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-label">Identity</div>
        <div className="field">
          <label>Name</label>
          <TextField value={node.name} onCommit={(value) => renameNode(node.id, value)} />
        </div>
        <div className="field">
          <label>Site type</label>
          <SelectField
            value={node.siteKind}
            options={SITE_KINDS.map((kind) => ({ value: kind, label: SITE_KIND_LABEL[kind] }))}
            onChange={(value) => setSiteKind(node.id, value as SiteNode["siteKind"])}
          />
        </div>
        <div className="field">
          <label>Notes</label>
          <TextField
            value={node.notes}
            placeholder="Address, floors, access notes…"
            onCommit={(value) => setNodeNotes(node.id, value)}
          />
        </div>
      </div>

      <div className="section">
        <div className="section-label">
          <span>Demarcation ports</span>
          <span>{node.boundaryPorts.length}</span>
        </div>
        <div className="port-table">
          {node.boundaryPorts.map((port) => (
            <div className="port-row" key={port.id}>
              <span
                className={`led ${port.status === "down" ? "" : port.medium === "wireless" ? "wireless" : "up"}`}
              />
              <span className="port-label">
                {port.name}
                <span className="medium-tag">{port.medium}</span>
              </span>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted-2)" }}>
                {port.id}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="inline-actions">
        <button type="button" className="btn primary" onClick={() => enterSite(node.id)}>
          Open site →
        </button>
        <button
          type="button"
          className="btn danger ghost-border"
          onClick={() => deleteNodes([node.id])}
        >
          Delete
        </button>
      </div>
    </aside>
  );
}

function LinkInspector({ link, sceneId }: { link: Link; sceneId: string }) {
  const project = useProjectStore((s) => s.project);
  const scene = project.scenes[sceneId];
  const updateLink = useProjectStore((s) => s.updateLink);
  const deleteLink = useProjectStore((s) => s.deleteLink);

  if (!scene) return null;

  const portMedium = findPort(scene, link.a)?.medium;
  const options = portMedium ? CABLES.filter((cable) => cable.medium === portMedium) : CABLES;

  return (
    <aside className="inspector">
      <div className="insp-head">
        <div className="insp-icon">🔗</div>
        <div>
          <div className="insp-title">Cable</div>
          <div className="insp-sub">
            {portMedium ? MEDIUM_LABEL[portMedium] : "Unknown media"} ·{" "}
            {link.status === "up" ? "link up" : "link down"}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-label">Endpoints</div>
        <div className="kv">
          <span>A</span>
          <span>{endpointLabel(scene, link.a)}</span>
        </div>
        <div className="kv">
          <span>B</span>
          <span>{endpointLabel(scene, link.b)}</span>
        </div>
      </div>

      <div className="section">
        <div className="section-label">Cable</div>
        <div className="field">
          <label>Type</label>
          <select
            className="select"
            value={link.cableId}
            onChange={(event) => updateLink(link.id, { cableId: event.target.value })}
          >
            {MEDIA.map((medium) => {
              const group = options.filter((cable) => cable.medium === medium);
              if (group.length === 0) return null;
              return (
                <optgroup key={medium} label={MEDIUM_LABEL[medium]}>
                  {group.map((cable) => (
                    <option key={cable.id} value={cable.id}>
                      {cable.label}
                    </option>
                  ))}
                </optgroup>
              );
            })}
            {options.every((cable) => cable.id !== link.cableId) ? (
              <option value={link.cableId}>{link.cableId}</option>
            ) : null}
          </select>
        </div>
        <div className="field">
          <label>State</label>
          <SelectField
            value={link.status}
            options={[
              { value: "up", label: "Up" },
              { value: "down", label: "Down (shut)" },
            ]}
            onChange={(value) => updateLink(link.id, { status: value as "up" | "down" })}
          />
        </div>
      </div>

      <button type="button" className="btn danger ghost-border" onClick={() => deleteLink(link.id)}>
        Remove cable
      </button>
    </aside>
  );
}

function ProjectInspector() {
  const project = useProjectStore((s) => s.project);
  const scene = useProjectStore(currentScene);
  const select = useProjectStore((s) => s.select);
  const issues = auditScene(scene);
  const stats = sceneStats(scene);

  return (
    <aside className="inspector">
      <div className="insp-head">
        <div className="insp-icon">🗺️</div>
        <div>
          <div className="insp-title">{project.name}</div>
          <div className="insp-sub">Stored locally in this browser</div>
        </div>
      </div>

      <div className="section">
        <div className="section-label">Current scene</div>
        <div className="kv">
          <span>Name</span>
          <span>{scene.name}</span>
        </div>
        <div className="kv">
          <span>Kind</span>
          <span>{scene.kind === "macro" ? "Macro (wide area)" : "Micro (internal)"}</span>
        </div>
        <div className="kv">
          <span>Devices</span>
          <span>{stats.devices}</span>
        </div>
        <div className="kv">
          <span>Sites</span>
          <span>{stats.sites}</span>
        </div>
        <div className="kv">
          <span>Cables</span>
          <span>{stats.links}</span>
        </div>
      </div>

      <div className="section">
        <div className="section-label">
          <span>Audit</span>
          <span>{issues.length}</span>
        </div>
        {issues.length === 0 ? (
          <div className="hint">No structural problems found in this scene.</div>
        ) : (
          <div className="issue-list">
            {issues.slice(0, 8).map((issue) => (
              <button
                key={issue.id}
                type="button"
                className={`issue ${issue.severity}`}
                onClick={() => {
                  if (issue.linkId) select([], issue.linkId);
                  else if (issue.nodeIds?.length) select(issue.nodeIds);
                }}
              >
                <span>{issue.severity === "error" ? "⛔" : "⚠️"}</span>
                <span>{issue.message}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-label">Media</div>
        <div className="legend">
          {MEDIA.map((medium) => (
            <span key={medium}>
              <i style={{ background: MEDIUM_COLOR[medium] }} />
              {medium}
            </span>
          ))}
        </div>
      </div>

      <div className="hint">
        <b>Tip:</b> drag from a port dot to wire two devices. A port accepts exactly one cable, and
        both ends must use the same medium — fiber will not terminate on an RJ45 port.
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            className="btn ghost-border"
            onClick={() => {
              const firstNode = Object.values(scene.nodes)[0];
              if (firstNode) select([firstNode.id]);
            }}
          >
            Select first device
          </button>
        </div>
      </div>
    </aside>
  );
}
