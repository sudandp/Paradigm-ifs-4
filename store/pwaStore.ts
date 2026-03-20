import { create } from 'zustand';

interface PWAState {
    deferredPrompt: any;
    isInstallable: boolean;
    setDeferredPrompt: (prompt: any) => void;
    clearDeferredPrompt: () => void;
}

export const usePWAStore = create<PWAState>((set) => ({
    deferredPrompt: null,
    isInstallable: false,
    setDeferredPrompt: (prompt: any) => set({ deferredPrompt: prompt, isInstallable: !!prompt }),
    clearDeferredPrompt: () => set({ deferredPrompt: null, isInstallable: false }),
}));
