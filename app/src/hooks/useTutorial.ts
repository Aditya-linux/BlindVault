"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  defaultTutorialState,
  loadTutorialState,
  saveTutorialState,
  TUTORIAL_STEPS,
  type TutorialState,
} from "@/lib/tutorial";

type Store = TutorialState & { open: boolean; hydrated: boolean };

type Listener = () => void;
const listeners = new Set<Listener>();

let store: Store = {
  ...defaultTutorialState(),
  open: false,
  hydrated: false,
};

function getSnapshot(): Store {
  return store;
}

function getServerSnapshot(): Store {
  return {
    ...defaultTutorialState(),
    open: false,
    hydrated: false,
  };
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(patch: Partial<Store>): void {
  store = { ...store, ...patch };
  saveTutorialState({
    completed: store.completed,
    stepIndex: store.stepIndex,
    resumed: store.resumed,
  });
  listeners.forEach((l) => l());
}

function hydrateOnce(): void {
  if (store.hydrated) return;
  const s = loadTutorialState();
  store = {
    ...s,
    open: !s.completed,
    hydrated: true,
  };
  listeners.forEach((l) => l());
}

export function useTutorial() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [, bump] = useState(0);

  useEffect(() => {
    hydrateOnce();
    bump((n) => n + 1);
  }, []);

  const step = TUTORIAL_STEPS[state.stepIndex] ?? TUTORIAL_STEPS[0]!;
  const isLast = state.stepIndex >= TUTORIAL_STEPS.length - 1;
  const progressLabel = `${state.stepIndex + 1} / ${TUTORIAL_STEPS.length}`;

  const start = useCallback(() => {
    emit({ completed: false, stepIndex: 0, resumed: true, open: true });
  }, []);

  const dismiss = useCallback(() => {
    emit({ completed: true, resumed: false, open: false });
  }, []);

  const closePanel = useCallback(() => {
    emit({ open: false });
  }, []);

  const reopen = useCallback(() => {
    emit({ open: true });
  }, []);

  const goTo = useCallback((index: number) => {
    const clamped = Math.min(Math.max(0, index), TUTORIAL_STEPS.length - 1);
    emit({ stepIndex: clamped, completed: false, open: true });
  }, []);

  const next = useCallback(() => {
    if (store.stepIndex >= TUTORIAL_STEPS.length - 1) {
      emit({
        completed: true,
        stepIndex: TUTORIAL_STEPS.length - 1,
        open: false,
      });
      return null as string | null;
    }
    const nextIndex = store.stepIndex + 1;
    emit({ stepIndex: nextIndex, completed: false, open: true });
    return TUTORIAL_STEPS[nextIndex]?.href ?? null;
  }, []);

  const back = useCallback(() => {
    if (store.stepIndex <= 0) return;
    emit({ stepIndex: store.stepIndex - 1, completed: false, open: true });
  }, []);

  return {
    hydrated: state.hydrated,
    open: state.open,
    state: {
      completed: state.completed,
      stepIndex: state.stepIndex,
      resumed: state.resumed,
    },
    step,
    isLast,
    progressLabel,
    start,
    dismiss,
    closePanel,
    reopen,
    goTo,
    next,
    back,
  };
}
