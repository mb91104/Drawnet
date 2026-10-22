import { Fragment } from "react";
import { useProjectStore } from "../store/projectStore";

export function Breadcrumbs() {
  const project = useProjectStore((s) => s.project);
  const scenePath = useProjectStore((s) => s.scenePath);
  const goToScene = useProjectStore((s) => s.goToScene);

  const items = scenePath
    .map((id, index) => ({ id, index, scene: project.scenes[id] }))
    .filter((item) => Boolean(item.scene));

  if (items.length === 0) return null;

  return (
    <div className="breadcrumbs" aria-label="Scene path">
      {items.map((item, position) => (
        <Fragment key={item.id}>
          {position > 0 ? <span className="crumb-sep">›</span> : null}
          <button
            type="button"
            className={`crumb${position === items.length - 1 ? " current" : ""}`}
            onClick={() => goToScene(item.index)}
            title={item.scene?.kind === "macro" ? "Overview scene" : "Inside site"}
          >
            {item.scene?.name ?? "Scene"}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
