
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UiSettingsState {
  autoClickOnHover: boolean;
  autoScrollOnHover: boolean;
  isReferralModalOpen: boolean;
  setAutoClickOnHover: (value: boolean) => void;
  setAutoScrollOnHover: (value: boolean) => void;
  setReferralModalOpen: (value: boolean) => void;
}

export const useUiSettingsStore = create(
  persist<UiSettingsState>(
    (set) => ({
      autoClickOnHover: true,
      autoScrollOnHover: true,
      isReferralModalOpen: false,
      setAutoClickOnHover: (value) => set({ autoClickOnHover: value }),
      setAutoScrollOnHover: (value) => set({ autoScrollOnHover: value }),
      setReferralModalOpen: (value) => set({ isReferralModalOpen: value }),
    }),
    {
      name: 'paradigm-ui-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);