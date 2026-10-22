import { useCallback, useEffect, useState } from "react";
import { createEmptyProject } from "@drawnet/schema";
import { deleteProject, listProjects, loadProject, saveProject, type ProjectRecord } from "../persistence/db";
import { useProjectStore } from "../store/projectStore";
import { useUiStore } from "../store/uiStore";
import { createStarterProject } from "../lib/starter";
import { PlusIcon, TrashIcon } from "./icons";

export function ProjectsDialog() {
  const open = useUiStore((s) => s.projectsOpen);
  const setOpen = useUiStore((s) => s.setProjectsOpen);
  const notify = useUiStore((s) => s.notify);
  const load = useProjectStore((s) => s.load);
  const currentId = useProjectStore((s) => s.project.id);

  const [rows, setRows] = useState<ProjectRecord[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setRows(await listProjects());
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const openProject = async (id: string) => {
    const project = await loadProject(id);
    if (!project) {
      notify("That project could not be read.", "error");
      return;
    }
    load(project);
    setOpen(false);
    notify(`Opened “${project.name}”.`, "success");
  };

  const removeProject = async (record: ProjectRecord) => {
    const ok = window.confirm(`Delete “${record.name}” from this browser? This cannot be undone.`);
    if (!ok) return;
    await deleteProject(record.id);
    await refresh();
    notify("Project deleted.", "info");
  };

  const newProject = async (kind: "blank" | "demo") => {
    setBusy(true);
    const project = kind === "demo" ? createStarterProject() : createEmptyProject("Untitled network");
    await saveProject(project);
    load(project);
    await refresh();
    setBusy(false);
    setOpen(false);
    notify(kind === "demo" ? "Demo network loaded." : "New network created.", "success");
  };

  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>Projects on this device</h2>
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>

        <div className="modal-body">
          {rows.length === 0 ? (
            <div className="hint">Nothing saved yet. Your first network will appear here.</div>
          ) : (
            rows.map((row) => (
              <div key={row.id} className={`project-row${row.id === currentId ? " current" : ""}`}>
                <div className="grow">
                  <div className="pname">{row.name}</div>
                  <div className="pmeta">
                    {new Date(row.updatedAt).toLocaleString()} · {Object.keys(row.data.scenes).length}{" "}
                    scenes{row.id === currentId ? " · open now" : ""}
                  </div>
                </div>
                <button type="button" className="btn ghost-border" onClick={() => void openProject(row.id)}>
                  Open
                </button>
                <button
                  type="button"
                  className="btn danger"
                  title="Delete from this browser"
                  onClick={() => void removeProject(row)}
                >
                  <TrashIcon />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn ghost-border" disabled={busy} onClick={() => void newProject("demo")}>
            Load demo network
          </button>
          <button type="button" className="btn primary" disabled={busy} onClick={() => void newProject("blank")}>
            <PlusIcon />
            New empty network
          </button>
        </div>
      </div>
    </div>
  );
}
