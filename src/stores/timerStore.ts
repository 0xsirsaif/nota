import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { TimerState, TimerStatus } from "@/types";

interface TimerStoreState {
  state: TimerState;
  elapsedSeconds: number;
  sessionId?: string;
  lastTick?: number;
  isRestoring: boolean;
  breakReminderEnabled: boolean;
  breakIntervalMinutes: number;
  lastBreakAt?: number;

  // Actions
  start: (sessionId: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  tick: () => void;
  reset: () => void;
  restore: () => Promise<void>;
  sendBreakReminder: () => void;
  toggleBreakReminder: (enabled: boolean) => void;
  setBreakInterval: (minutes: number) => void;
}

// Helper to convert error to string
const errorToString = (err: unknown): string => {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    // Tauri errors often have a message property
    const msg = (err as Record<string, unknown>).message;
    if (typeof msg === "string") return msg;
    return JSON.stringify(err);
  }
  return String(err);
};

// Sync timer state with backend
const syncTimerState = async (
  sessionId: string | undefined,
  state: TimerState,
  elapsedSeconds: number
) => {
  try {
    await invoke("update_timer_state", {
      sessionId,
      state,
      accumulatedSeconds: elapsedSeconds,
    });
  } catch (err) {
    console.error("Failed to sync timer state:", errorToString(err));
    throw err;
  }
};

export const useTimerStore = create<TimerStoreState>((set, get) => ({
  state: "idle",
  elapsedSeconds: 0,
  sessionId: undefined,
  lastTick: undefined,
  isRestoring: false,
  breakReminderEnabled: true,
  breakIntervalMinutes: 25, // Pomodoro style default
  lastBreakAt: undefined,

  start: async (sessionId) => {
    const now = Date.now();
    set({
      state: "running",
      sessionId,
      elapsedSeconds: 0,
      lastTick: now,
      lastBreakAt: now,
    });
    await syncTimerState(sessionId, "running", 0);
  },

  pause: async () => {
    const { sessionId, elapsedSeconds } = get();
    set({ state: "paused" });
    await syncTimerState(sessionId, "paused", elapsedSeconds);
  },

  resume: async () => {
    const { sessionId, elapsedSeconds } = get();
    set({
      state: "running",
      lastTick: Date.now(),
    });
    await syncTimerState(sessionId, "running", elapsedSeconds);
  },

  stop: async () => {
    const { sessionId, elapsedSeconds } = get();
    set({
      state: "idle",
      sessionId: undefined,
      lastTick: undefined,
      lastBreakAt: undefined,
    });
    await syncTimerState(sessionId, "idle", elapsedSeconds);
  },

  tick: () => {
    const { state, lastTick, breakReminderEnabled, breakIntervalMinutes, lastBreakAt, sessionId } = get();
    if (state !== "running" || !lastTick) return;

    const now = Date.now();
    const delta = Math.floor((now - lastTick) / 1000);

    if (delta >= 1) {
      const newElapsed = get().elapsedSeconds + delta;
      set({
        elapsedSeconds: newElapsed,
        lastTick: now,
      });

      // Check for break reminder
      if (breakReminderEnabled && lastBreakAt) {
        const minutesSinceBreak = (now - lastBreakAt) / (1000 * 60);
        if (minutesSinceBreak >= breakIntervalMinutes) {
          get().sendBreakReminder();
          set({ lastBreakAt: now });
        }
      }

      // Sync with backend every 10 seconds
      if (newElapsed % 10 === 0) {
        syncTimerState(sessionId, "running", newElapsed);
      }
    }
  },

  reset: () => {
    set({
      state: "idle",
      elapsedSeconds: 0,
      sessionId: undefined,
      lastTick: undefined,
      lastBreakAt: undefined,
    });
  },

  restore: async () => {
    set({ isRestoring: true });
    try {
      const status = await invoke<TimerStatus>("get_timer_state");

      if (status.session_id && status.is_active) {
        set({
          state: status.state,
          sessionId: status.session_id,
          elapsedSeconds: status.elapsed_seconds,
          lastTick: Date.now(),
          lastBreakAt: Date.now(),
        });
      }
    } catch (err) {
      console.error("Failed to restore timer state:", errorToString(err));
    } finally {
      set({ isRestoring: false });
    }
  },

  sendBreakReminder: async () => {
    try {
      await invoke("send_timer_notification", {
        title: "Time for a break!",
        body: "You've been focusing for 25 minutes. Take a short break to recharge.",
      });
    } catch (err) {
      console.error("Failed to send notification:", errorToString(err));
    }
  },

  toggleBreakReminder: (enabled) => {
    set({ breakReminderEnabled: enabled });
  },

  setBreakInterval: (minutes) => {
    set({ breakIntervalMinutes: minutes });
  },
}));
