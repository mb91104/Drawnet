import { useEffect, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "./canvas/Canvas";
import { HelpDialog } from "./components/HelpDialog";
import { Inspector } from "./components/Inspector";
import { Palette } from "./components/Palette";
import { ProjectsDialog } from "./components/ProjectsDialog";
import { StatusBar } from "./components/StatusBar";
import { Toasts } from "./components/Toasts";
import { Toolbar } from "./components/Toolbar";
import { createStarterProject } from "./lib/starter";
import { lastProjectId, loadProject, saveProject } from "./persistence/db";
import { useProjectStore } from "./store/projectStore";
import { useUiStore } from "./store/uiStore";

const AUTOSAVE_DELAY = 550;

export function App() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const id = lastProjectId();
      const stored = id ? await loadProject(id) : null;
      if (cancelled) return;

      const project = stored ?? createStarterProject();
      useProjectStore.getState().load(project);
      useUiStore.getState().setSaveState("saved");
      if (!stored) await saveProject(project);
      if (!cancelled) setHydrated(true);
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let timer = 0;

    const unsubscribe = useProjectStore.subscribe((state, previous) => {
      if (state.project === previous.project) return;
      const ui = useUiStore.getState();
      ui.setSaveState("dirty");
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const current = useProjectStore.getState().project;
        ui.setSaveState("saving");
        void saveProject(current).then(
          () => useUiStore.getState().setSaveState("saved"),
          () => useUiStore.getState().notify("Autosave failed — export a copy to be safe.", "error"),
        );
      }, AUTOSAVE_DELAY);
    });

    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [hydrated]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing) return;

      if (event.key === "?" || event.key === "F1") {
        event.preventDefault();
        useUiStore.getState().setHelpOpen(true);
        return;
      }

      const store = useProjectStore.getState();
      const mod = event.ctrlKey || event.metaKey;

      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        store.redo();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (store.selectedLinkId) store.deleteLink(store.selectedLinkId);
        else if (store.selectedNodeIds.length) store.deleteNodes(store.selectedNodeIds);
        return;
      }
      if (event.key === "Escape") {
        store.select([], null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!hydrated) {
    return (
      <div className="boot">
        <div className="brand-mark" style={{ width: 44, height: 44 }}>
          <span style={{ fontSize: 18, color: "var(--accent)" }}>◈</span>
        </div>
        <div>
          <div className="boot-title">Drawnet</div>
          <div className="boot-sub">Opening your local workspace…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Toolbar />
      <div className="workspace">
        <Palette />
        <ReactFlowProvider>
          <Canvas />
        </ReactFlowProvider>
        <Inspector />
      </div>
      <StatusBar />
      <ProjectsDialog />
      <HelpDialog />
      <Toasts />
    </div>
  );
}
