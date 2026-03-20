import { create } from 'zustand';

interface LoadingScreenState {
    isFullScreenLoading: boolean;
    setFullScreenLoading: (loading: boolean) => void;
}

export const useLoadingScreenStore = create<LoadingScreenState>((set) => ({
    isFullScreenLoading: false,
    setFullScreenLoading: (loading: boolean) => set({ isFullScreenLoading: loading }),
}));
