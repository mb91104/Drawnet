import { create } from "zustand";

export type SaveState = "saved" | "saving" | "dirty";
export type ToastTone = "info" | "success" | "error";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface UiState {
  saveState: SaveState;
  toasts: Toast[];
  projectsOpen: boolean;
  helpOpen: boolean;
  setSaveState: (state: SaveState) => void;
  notify: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: number) => void;
  setProjectsOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
}

let toastId = 0;

export const useUiStore = create<UiState>()((set) => ({
  saveState: "saved",
  toasts: [],
  projectsOpen: false,
  helpOpen: false,

  setSaveState: (saveState) => set({ saveState }),

  notify: (message, tone = "info") => {
    toastId += 1;
    const id = toastId;
    set((state) => ({ toasts: [...state.toasts.slice(-2), { id, message, tone }] }));
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, 3600);
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  setProjectsOpen: (projectsOpen) => set({ projectsOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
}));
