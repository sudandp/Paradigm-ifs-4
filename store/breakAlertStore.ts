// store/breakAlertStore.ts
// Controls the in-app break alert modal shown when the break timer fires.
import { create } from 'zustand';

interface BreakAlertState {
    showModal: boolean;
    elapsedMinutes: number; // how long user has been on break (for display)
    /** Show the alert modal */
    triggerAlert: (elapsedMinutes: number) => void;
    /** Dismiss the modal (called after user acts) */
    dismissAlert: () => void;
}

export const useBreakAlertStore = create<BreakAlertState>((set) => ({
    showModal: false,
    elapsedMinutes: 0,

    triggerAlert: (elapsedMinutes) =>
        set({ showModal: true, elapsedMinutes }),

    dismissAlert: () =>
        set({ showModal: false, elapsedMinutes: 0 }),
}));
