import { useEffect } from "react";
import { useUiStore } from "../store/uiStore";

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "LMB", action: "Select object or cable" },
  { keys: "Shift + LMB", action: "Extend selection" },
  { keys: "MMB / drag pane", action: "Pan the viewport" },
  { keys: "Scroll", action: "Zoom viewport" },
  { keys: "Home", action: "Frame all objects" },
  { keys: "+ / −", action: "Zoom in / out" },
  { keys: "Del", action: "Delete selection" },
  { keys: "Esc", action: "Clear selection" },
  { keys: "Ctrl + Z", action: "Undo" },
  { keys: "Ctrl + Shift + Z", action: "Redo" },
  { keys: "Ctrl + S", action: "Save project" },
  { keys: "Ctrl + O", action: "Open projects" },
  { keys: "Double-click", action: "Enter a site" },
];

export function HelpDialog() {
  const open = useUiStore((s) => s.helpOpen);
  const setOpen = useUiStore((s) => s.setHelpOpen);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>Keyboard map</h2>
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>

        <div className="modal-body">
          <div className="help-grid">
            {SHORTCUTS.map((shortcut) => (
              <div className="help-row" key={shortcut.keys}>
                <span>{shortcut.action}</span>
                <kbd>{shortcut.keys}</kbd>
              </div>
            ))}
          </div>

          <div className="hint" style={{ margin: "12px 0 0" }}>
            <b>Viewport:</b> this is a 3D-style network space rendered in a flat schematic —
            objects, cables and sites behave like a scene. Drag from the Add shelf or press an item
            to place it at the object origin.
          </div>
        </div>

        <div className="modal-foot">
          <span className="status-version" style={{ marginRight: "auto", alignSelf: "center" }}>
            Drawnet 0.1 · Blender-inspired UI
          </span>
          <button type="button" className="btn primary" onClick={() => setOpen(false)}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
