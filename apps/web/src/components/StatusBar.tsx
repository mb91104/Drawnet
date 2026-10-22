import { sceneStats } from "@drawnet/schema";
import { auditScene } from "@drawnet/engine";
import { currentScene, useProjectStore } from "../store/projectStore";
import { useUiStore } from "../store/uiStore";

export function StatusBar() {
  const scene = useProjectStore(currentScene);
  const saveState = useUiStore((s) => s.saveState);
  const stats = sceneStats(scene);
  const issues = auditScene(scene);
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.length - errors;

  return (
    <footer className="statusbar">
      <span className="status-hint">
        <kbd>LMB</kbd> select
      </span>
      <span className="status-hint">
        <kbd>MMB</kbd> pan
      </span>
      <span className="status-hint">
        <kbd>Home</kbd> frame all
      </span>
      <span className="status-hint">
        <kbd>Del</kbd> remove
      </span>

      <span className="spacer" />

      <span>
        <b>{scene.kind === "macro" ? "Macro" : "Micro"}</b> · {scene.name}
      </span>
      <span>{stats.devices} devices</span>
      <span>{stats.sites} sites</span>
      <span>{stats.links} cables</span>
      <span className={`status-chip ${errors ? "err" : warnings ? "warn" : "ok"}`}>
        {errors ? `${errors} error${errors === 1 ? "" : "s"}` : null}
        {!errors && warnings ? `${warnings} warning${warnings === 1 ? "" : "s"}` : null}
        {!issues.length ? "Audit clean" : null}
      </span>
      <span className="status-version">
        {saveState === "saved" ? "Local · saved" : "Editing…"} · Drawnet 0.1
      </span>
    </footer>
  );
}
