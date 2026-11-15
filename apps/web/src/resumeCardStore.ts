import { create } from "zustand";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ResumeRequest } from "./resumeCard";

interface ResumeCardState {
  selected: Record<string, ResumeRequest>;
  hidden: Record<string, string>;
  hiddenUntil: Record<string, number>;
  open: (request: ResumeRequest) => void;
  hide: (request: ResumeRequest, until?: number) => void;
}
export const useResumeCardStore = create<ResumeCardState>((set) => ({
  selected: {},
  hidden: {},
  hiddenUntil: {},
  open: (request) =>
    set((state) => ({ selected: { ...state.selected, [scopedThreadKey(request.ref)]: request } })),
  hide: (request, until) =>
    set((state) => {
      const selected = { ...state.selected };
      const threadKey = scopedThreadKey(request.ref);
      if (selected[threadKey]?.key === request.key && selected[threadKey]?.token === request.token)
        delete selected[threadKey];
      const hiddenUntil = { ...state.hiddenUntil };
      if (until === undefined) delete hiddenUntil[request.key];
      else hiddenUntil[request.key] = until;
      return { selected, hiddenUntil, hidden: { ...state.hidden, [request.key]: request.token } };
    }),
}));
