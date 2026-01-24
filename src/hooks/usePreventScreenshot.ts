import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

export const usePreventScreenshot = () => {
  useEffect(() => {
    // Enable privacy screen on native platforms
    const enablePrivacyScreen = async () => {
      if (!Capacitor.isNativePlatform()) {
        return;
      }

      try {
        const { PrivacyScreen } = await import('@capacitor-community/privacy-screen');
        await PrivacyScreen.enable();
        console.log('Privacy screen enabled - screenshots prevented');
      } catch (error) {
        console.error('Failed to enable privacy screen:', error);
      }
    };

    enablePrivacyScreen();

    // Web browser: Detect screenshot attempts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Detect PrintScreen key
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        toast.error('Screenshots are not allowed in this app', {
          description: 'Please respect user privacy',
          duration: 3000,
        });
        return;
      }

      // Detect Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5 (Mac screenshot shortcuts)
      if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) {
        toast.error('Screenshots are not allowed in this app', {
          description: 'Please respect user privacy',
          duration: 3000,
        });
        return;
      }

      // Detect Ctrl+Shift+S (some screenshot tools)
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        toast.error('Screenshots are not allowed in this app', {
          description: 'Please respect user privacy',
          duration: 3000,
        });
        return;
      }

      // Detect Windows+Shift+S (Windows Snipping Tool)
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 's') {
        toast.error('Screenshots are not allowed in this app', {
          description: 'Please respect user privacy',
          duration: 3000,
        });
        return;
      }
    };

    // Detect when user switches away (might be taking screenshot)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User switched away - could be taking screenshot
        console.log('App hidden - possible screenshot attempt');
      }
    };

    // Prevent right-click context menu (prevents "Save Image As")
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG' || target.tagName === 'VIDEO') {
        e.preventDefault();
        toast.error('Saving media is not allowed', {
          duration: 2000,
        });
      }
    };

    // Add event listeners for web
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);

      // Disable privacy screen on native
      const disablePrivacyScreen = async () => {
        if (!Capacitor.isNativePlatform()) return;
        try {
          const { PrivacyScreen } = await import('@capacitor-community/privacy-screen');
          await PrivacyScreen.disable();
        } catch (error) {
          console.error('Failed to disable privacy screen:', error);
        }
      };
      disablePrivacyScreen();
    };
  }, []);
};
