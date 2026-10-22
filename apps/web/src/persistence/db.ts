import Dexie, { type Table } from "dexie";
import { projectSchema, type Project } from "@drawnet/schema";

export interface ProjectRecord {
  id: string;
  name: string;
  updatedAt: string;
  data: Project;
}

class DrawnetDb extends Dexie {
  projects!: Table<ProjectRecord, string>;

  constructor() {
    super("drawnet");
    this.version(1).stores({ projects: "id, name, updatedAt" });
  }
}

export const db = new DrawnetDb();

export const LAST_PROJECT_KEY = "drawnet:last-project";

export async function saveProject(project: Project): Promise<void> {
  await db.projects.put({
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    data: project,
  });
  localStorage.setItem(LAST_PROJECT_KEY, project.id);
}

export async function loadProject(id: string): Promise<Project | null> {
  const record = await db.projects.get(id);
  if (!record) return null;

  const parsed = projectSchema.safeParse(record.data);
  if (parsed.success) return parsed.data;

  // Repair projects written before site boundary mapping existed.
  for (const scene of Object.values(record.data.scenes ?? {})) {
    for (const node of Object.values(scene.nodes ?? {})) {
      if (node.kind === "site" && !node.boundaryLinks) node.boundaryLinks = {};
    }
  }
  const repaired = projectSchema.safeParse(record.data);
  return repaired.success ? repaired.data : null;
}

export async function listProjects(): Promise<ProjectRecord[]> {
  return db.projects.orderBy("updatedAt").reverse().toArray();
}

export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id);
  if (localStorage.getItem(LAST_PROJECT_KEY) === id) {
    localStorage.removeItem(LAST_PROJECT_KEY);
  }
}

export function lastProjectId(): string | null {
  return localStorage.getItem(LAST_PROJECT_KEY);
}
