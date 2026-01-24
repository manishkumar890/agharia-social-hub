import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export const usePreventScreenshot = () => {
  useEffect(() => {
    const enablePrivacyScreen = async () => {
      // Only run on native platforms (iOS/Android)
      if (!Capacitor.isNativePlatform()) {
        return;
      }

      try {
        // Dynamically import to avoid issues on web
        const { PrivacyScreen } = await import('@capacitor-community/privacy-screen');
        
        // Enable privacy screen - prevents screenshots and screen recording
        await PrivacyScreen.enable();
        
        console.log('Privacy screen enabled - screenshots prevented');
      } catch (error) {
        console.error('Failed to enable privacy screen:', error);
      }
    };

    enablePrivacyScreen();

    // Cleanup on unmount
    return () => {
      const disablePrivacyScreen = async () => {
        if (!Capacitor.isNativePlatform()) {
          return;
        }

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
