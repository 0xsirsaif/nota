import { useEffect, useState } from 'react';
import { platform } from '@tauri-apps/plugin-os';

export function useMobile() {
  const [isMobile, setIsMobile] = useState(false);
  const [platformName, setPlatformName] = useState<string>('');

  useEffect(() => {
    const checkMobile = async () => {
      try {
        const currentPlatform = await platform();
        setPlatformName(currentPlatform);
        setIsMobile(['android', 'ios'].includes(currentPlatform));
      } catch (e) {
        // Fallback: check user agent if Tauri plugin fails (e.g., web environment)
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent);
        setIsMobile(isMobileDevice);
        setPlatformName(isMobileDevice ? 'web-mobile' : 'web');
      }
    };

    checkMobile();
  }, []);

  return { isMobile, platform: platformName };
}

// Use CSS env() for safe area insets instead of plugin
export function useSafeAreaInsets() {
  // On mobile, CSS env(safe-area-inset-*) handles this automatically
  // This hook is kept for compatibility but returns 0
  // Use CSS classes like .safe-area-top instead
  return { top: 0, bottom: 0, left: 0, right: 0 };
}
