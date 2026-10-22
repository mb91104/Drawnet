import { useEffect, useRef, useState } from "react";
import { createEmptyProject } from "@drawnet/schema";
import { saveProject } from "../persistence/db";
import { useProjectStore } from "../store/projectStore";
import { useUiStore } from "../store/uiStore";
import { downloadProject, readProjectFile } from "../lib/files";
import {
  ChevronDownIcon,
  DownloadIcon,
  FolderIcon,
  KeyboardIcon,
  MarkIcon,
  PlusIcon,
  RedoIcon,
  SaveIcon,
  TrashIcon,
  UndoIcon,
  UploadIcon,
} from "./icons";

type MenuKey = "file" | "edit" | "view" | "help" | null;

function ProjectTitle() {
  const name = useProjectStore((s) => s.project.name);
  const renameProject = useProjectStore((s) => s.renameProject);
  const [draft, setDraft] = useState(name);

  useEffect(() => setDraft(name), [name]);

  return (
    <input
      className="project-name"
      value={draft}
      aria-label="Project name"
      spellCheck={false}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft.trim() !== name) renameProject(draft);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(name);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function ViewCommand(command: "fit" | "zoomIn" | "zoomOut") {
  window.dispatchEvent(new CustomEvent("drawnet:view", { detail: command }));
}

export function Toolbar() {
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const load = useProjectStore((s) => s.load);
  const project = useProjectStore((s) => s.project);
  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const selectedLinkId = useProjectStore((s) => s.selectedLinkId);
  const deleteNodes = useProjectStore((s) => s.deleteNodes);
  const deleteLink = useProjectStore((s) => s.deleteLink);

  const saveState = useUiStore((s) => s.saveState);
  const setSaveState = useUiStore((s) => s.setSaveState);
  const notify = useUiStore((s) => s.notify);
  const setProjectsOpen = useUiStore((s) => s.setProjectsOpen);
  const setHelpOpen = useUiStore((s) => s.setHelpOpen);

  const fileInput = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const [menu, setMenu] = useState<MenuKey>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) setMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const startNew = () => {
    const fresh = createEmptyProject("Untitled network");
    load(fresh);
    void saveProject(fresh);
    setSaveState("saved");
    notify("New network created. The previous one is still in Projects.", "success");
  };

  const saveNow = async () => {
    setSaveState("saving");
    await saveProject(useProjectStore.getState().project);
    setSaveState("saved");
    notify("Saved to this browser.", "success");
  };

  const importFile = async (file: File) => {
    try {
      const imported = await readProjectFile(file);
      load(imported);
      await saveProject(imported);
      setSaveState("saved");
      notify(`Imported “${imported.name}”.`, "success");
    } catch (error) {
      console.error(error);
      notify("That file is not a valid Drawnet project.", "error");
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void saveNow();
      } else if (key === "o") {
        event.preventDefault();
        setProjectsOpen(true);
      } else if (key === "n") {
        event.preventDefault();
        if (window.confirm("Start a new network? The current project stays in Projects.")) startNew();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const hasSelection = selectedNodeIds.length > 0 || Boolean(selectedLinkId);
  const removeSelection = () => {
    if (selectedLinkId) deleteLink(selectedLinkId);
    else deleteNodes(selectedNodeIds);
  };

  const pickMenu = (key: Exclude<MenuKey, null>) => setMenu((open) => (open === key ? null : key));
  const act = (run: () => void) => {
    setMenu(null);
    run();
  };

  return (
    <header className="topbar" ref={barRef}>
      <div className="topbar-brand">
        <span className="brand-mark">
          <MarkIcon size={16} />
        </span>
        <span className="brand-copy">
          <span className="brand-name">
            Drawn<span>et</span>
          </span>
          <span className="brand-sub">Network Builder</span>
        </span>
      </div>

      <nav className="menu-bar" aria-label="Main menu">
        <div className="menu-wrap">
          <button
            type="button"
            className={`top-menu${menu === "file" ? " open" : ""}`}
            onClick={() => pickMenu("file")}
            aria-expanded={menu === "file"}
          >
            File
            <ChevronDownIcon size={10} />
          </button>
          {menu === "file" ? (
            <div className="menu-drop" role="menu">
              <button type="button" className="menu-item" onClick={() => act(startNew)}>
                <PlusIcon />
                New network
                <span className="menu-key">Ctrl N</span>
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => act(() => setProjectsOpen(true))}
              >
                <FolderIcon />
                Open projects…
                <span className="menu-key">Ctrl O</span>
              </button>
              <div className="menu-sep" />
              <button type="button" className="menu-item" onClick={() => act(() => void saveNow())}>
                <SaveIcon />
                Save now
                <span className="menu-key">Ctrl S</span>
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => act(() => downloadProject(project))}
              >
                <DownloadIcon />
                Export project
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => act(() => fileInput.current?.click())}
              >
                <UploadIcon />
                Import project
              </button>
              <div className="menu-sep" />
              <button
                type="button"
                className="menu-item danger"
                disabled={!hasSelection}
                onClick={() => act(removeSelection)}
              >
                <TrashIcon />
                Delete selection
                <span className="menu-key">Del</span>
              </button>
            </div>
          ) : null}
        </div>

        <div className="menu-wrap">
          <button
            type="button"
            className={`top-menu${menu === "edit" ? " open" : ""}`}
            onClick={() => pickMenu("edit")}
            aria-expanded={menu === "edit"}
          >
            Edit
            <ChevronDownIcon size={10} />
          </button>
          {menu === "edit" ? (
            <div className="menu-drop" role="menu">
              <button type="button" className="menu-item" disabled={!canUndo} onClick={() => act(undo)}>
                <UndoIcon />
                Undo
                <span className="menu-key">Ctrl Z</span>
              </button>
              <button type="button" className="menu-item" disabled={!canRedo} onClick={() => act(redo)}>
                <RedoIcon />
                Redo
                <span className="menu-key">Ctrl ⇧ Z</span>
              </button>
              <div className="menu-sep" />
              <button
                type="button"
                className="menu-item danger"
                disabled={!hasSelection}
                onClick={() => act(removeSelection)}
              >
                <TrashIcon />
                Delete selection
                <span className="menu-key">Del</span>
              </button>
            </div>
          ) : null}
        </div>

        <div className="menu-wrap">
          <button
            type="button"
            className={`top-menu${menu === "view" ? " open" : ""}`}
            onClick={() => pickMenu("view")}
            aria-expanded={menu === "view"}
          >
            View
            <ChevronDownIcon size={10} />
          </button>
          {menu === "view" ? (
            <div className="menu-drop" role="menu">
              <button type="button" className="menu-item" onClick={() => act(() => ViewCommand("fit"))}>
                Frame all
                <span className="menu-key">Home</span>
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => act(() => ViewCommand("zoomIn"))}
              >
                Zoom in
                <span className="menu-key">+</span>
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => act(() => ViewCommand("zoomOut"))}
              >
                Zoom out
                <span className="menu-key">−</span>
              </button>
            </div>
          ) : null}
        </div>

        <div className="menu-wrap">
          <button
            type="button"
            className={`top-menu${menu === "help" ? " open" : ""}`}
            onClick={() => pickMenu("help")}
            aria-expanded={menu === "help"}
          >
            Help
            <ChevronDownIcon size={10} />
          </button>
          {menu === "help" ? (
            <div className="menu-drop" role="menu">
              <button
                type="button"
                className="menu-item"
                onClick={() => act(() => setHelpOpen(true))}
              >
                <KeyboardIcon />
                Keyboard shortcuts
                <span className="menu-key">?</span>
              </button>
              <div className="menu-sep" />
              <div className="menu-label">Drawnet 0.1 · local-first</div>
            </div>
          ) : null}
        </div>
      </nav>

      <div className="topbar-divider" />
      <ProjectTitle />
      <span className={`save-state ${saveState}`}>
        <span className="dot" />
        {saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved" : "Saved"}
      </span>

      <div className="topbar-spacer" />

      <div className="tool-group">
        <button
          type="button"
          className="btn"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          className="btn"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <RedoIcon />
        </button>
      </div>

      <div className="tool-group">
        <button type="button" className="btn" onClick={() => void saveNow()} title="Save now (Ctrl+S)">
          <SaveIcon />
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => downloadProject(project)}
          title="Export as .drawnet.json"
        >
          <DownloadIcon />
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => fileInput.current?.click()}
          title="Import a .drawnet.json file"
        >
          <UploadIcon />
        </button>
      </div>

      <button
        type="button"
        className="btn danger ghost-border"
        disabled={!hasSelection}
        title="Delete selection (Del)"
        onClick={removeSelection}
      >
        <TrashIcon />
      </button>

      <input
        ref={fileInput}
        type="file"
        accept=".json,.drawnet,application/json"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importFile(file);
          event.target.value = "";
        }}
      />
    </header>
  );
}
