import { useState, useEffect, useCallback } from 'react';
import type { AppView } from '../types/auth';
import { authService } from '../services/authService';

function getViewFromHash(): AppView {
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (hash === 'login') return 'login';
  if (hash === 'loading') return 'loading';
  if (hash === 'workspace') {
    // Client-side guard: if unauthenticated, redirect to login
    return authService.isAuthenticated() ? 'workspace' : 'login';
  }
  return 'landing';
}

export function useNavigation() {
  const [currentView, setCurrentView] = useState<AppView>(() => getViewFromHash());

  const navigateTo = useCallback((view: AppView) => {
    let targetView = view;
    if (view === 'workspace' && !authService.isAuthenticated()) {
      targetView = 'login';
    }

    setCurrentView(targetView);
    if (window.location.hash.replace(/^#\/?/, '') !== targetView) {
      window.location.hash = targetView === 'landing' ? '' : targetView;
    }
    // Scroll to top upon view change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const nextView = getViewFromHash();
      setCurrentView(nextView);
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  return {
    currentView,
    navigateTo,
  };
}
