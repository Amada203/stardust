import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createThemeCssApplier } from "./themeCss";
import clawdCss from "./clawdExperience.css?raw";
export type WorkbenchExperience = "current" | "clawd";
export const applyWorkbenchExperienceCss = createThemeCssApplier();
export function syncWorkbenchExperience(experience: WorkbenchExperience) {
  document.documentElement.dataset.workbenchExperience = experience;
  applyWorkbenchExperienceCss(experience === "clawd" ? clawdCss : undefined);
}
export const useWorkbenchExperience = create<{
  experience: WorkbenchExperience;
  setExperience: (experience: WorkbenchExperience) => void;
}>()(
  persist(
    (set) => ({
      experience: "current",
      setExperience: (experience) => set({ experience }),
    }),
    {
      name: "t3code:workbench-experience:v1",
      partialize: ({ experience }) => ({ experience }),
      merge: (stored, current) => ({
        ...current,
        experience:
          (stored as { experience?: unknown } | null)?.experience === "clawd" ? "clawd" : "current",
      }),
    },
  ),
);
