
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UiSettingsState {
  autoClickOnHover: boolean;
  autoScrollOnHover: boolean;
  isReferralModalOpen: boolean;
  sidebarStyle: 'modern' | 'classic';
  setAutoClickOnHover: (value: boolean) => void;
  setAutoScrollOnHover: (value: boolean) => void;
  setReferralModalOpen: (value: boolean) => void;
  setSidebarStyle: (style: 'modern' | 'classic') => void;
}

export const useUiSettingsStore = create(
  persist<UiSettingsState>(
    (set) => ({
      autoClickOnHover: true,
      autoScrollOnHover: false,
      isReferralModalOpen: false,
      sidebarStyle: 'modern',
      setAutoClickOnHover: (value) => set({ autoClickOnHover: value }),
      setAutoScrollOnHover: (value) => set({ autoScrollOnHover: value }),
      setReferralModalOpen: (value) => set({ isReferralModalOpen: value }),
      setSidebarStyle: (style) => set({ sidebarStyle: style }),
    }),
    {
      name: 'paradigm-ui-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);