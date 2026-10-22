import { projectSchema, type Project } from "@drawnet/schema";

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "network"
  );
}

export function downloadProject(project: Project): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slug(project.name)}.drawnet.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readProjectFile(file: File): Promise<Project> {
  const text = await file.text();
  const raw: unknown = JSON.parse(text);
  const project = projectSchema.parse(raw);
  if (!project.scenes[project.rootSceneId]) {
    throw new Error("Project root scene is missing");
  }
  return project;
}
