import { useEffect } from 'react';
import { useTurnkey } from '@turnkey/react-native-wallet-kit';
import { setRefreshSessionFn } from '@/constants/turnkey';

/**
 * SessionManager component
 * Handles automatic session refresh to keep users logged in
 * until they explicitly log out
 */
export function SessionManager() {
  const { refreshSession, authState, getSession } = useTurnkey();

  useEffect(() => {
    // Set the refresh function for the callback to use
    const refreshFn = async () => {
      try {
        console.log('[SessionManager] Refreshing session...');
        await refreshSession({
          expirationSeconds: 86400, // 24 hours
        });
        console.log('[SessionManager] Session refreshed for 24 hours');
      } catch (error) {
        console.error('[SessionManager] Failed to refresh session:', error);
        throw error;
      }
    };

    setRefreshSessionFn(refreshFn);
    console.log('[SessionManager] Auto-refresh enabled');

    return () => {
      setRefreshSessionFn(async () => {});
      console.log('[SessionManager] Auto-refresh disabled');
    };
  }, [refreshSession]);

  // Periodically check session status and refresh if needed
  useEffect(() => {
    if (authState !== 'authenticated') {
      return;
    }

    const checkSession = async () => {
      try {
        const session = await getSession();
        if (session && session.expiry) {
          const expiryTime = session.expiry * 1000; // Convert to milliseconds
          const now = Date.now();
          const timeUntilExpiry = expiryTime - now;
          
          // If less than 1 hour until expiry, refresh the session
          if (timeUntilExpiry < 3600000) { // 1 hour in ms
            console.log('[SessionManager] Session expiring soon, refreshing...');
            await refreshSession({
              expirationSeconds: 86400, // 24 hours
            });
            console.log('[SessionManager] Session refreshed proactively');
          } else {
            console.log('[SessionManager] Session still valid for', Math.floor(timeUntilExpiry / 1000 / 60), 'minutes');
          }
        }
      } catch (error) {
        console.error('[SessionManager] Error checking session:', error);
      }
    };

    // Check session status every 30 minutes
    const interval = setInterval(checkSession, 30 * 60 * 1000);
    
    // Check immediately on mount
    checkSession();

    return () => clearInterval(interval);
  }, [authState, refreshSession, getSession]);

  return null; // This is a utility component, no UI
}
