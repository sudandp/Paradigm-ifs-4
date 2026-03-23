import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';

/**
 * useKeyboard Hook
 * 
 * Manages native keyboard events on Android/iOS. Provides:
 * - isKeyboardVisible: whether the soft keyboard is currently shown
 * - keyboardHeight: pixel height of the keyboard (for layout adjustments)
 * 
 * On web, returns safe defaults (keyboard not visible, height 0).
 */
export const useKeyboard = () => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Configure keyboard behavior for native
    Keyboard.setResizeMode({ mode: KeyboardResize.Body }).catch(() => {});
    Keyboard.setScroll({ isDisabled: false }).catch(() => {});

    const showListener = Keyboard.addListener('keyboardWillShow', (info) => {
      setIsKeyboardVisible(true);
      setKeyboardHeight(info.keyboardHeight);
    });

    const hideListener = Keyboard.addListener('keyboardWillHide', () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showListener.then(h => h.remove());
      hideListener.then(h => h.remove());
    };
  }, []);

  return { isKeyboardVisible, keyboardHeight };
};
