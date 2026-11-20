import { create } from "zustand";

type TeeAuth = {
  token: string | null;
  expiresAt: number | null;
};

type SessionState = TeeAuth & {
  soundOn: boolean;
  reducedMotion: boolean;
  setTee: (t: TeeAuth) => void;
  clearTee: () => void;
  toggleSound: () => void;
  toggleReducedMotion: () => void;
};

export const useSession = create<SessionState>((set) => ({
  token: null,
  expiresAt: null,
  soundOn: true,
  reducedMotion: false,
  setTee: (t) => set(t),
  clearTee: () => set({ token: null, expiresAt: null }),
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
  toggleReducedMotion: () =>
    set((s) => ({ reducedMotion: !s.reducedMotion })),
}));
