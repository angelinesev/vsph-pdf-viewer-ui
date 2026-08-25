import { useEffect, useState } from 'react';
import { callApi } from '../shared/api';
import type { OrgAnalytics, Project, Quota } from './types';
import TopBar from './components/TopBar';
import LoginPanel from './components/LoginPanel';
import ProjectsView from './components/ProjectsView';
import ProjectDetailView from './components/ProjectDetailView';
import Sidebar, { type SidebarView } from './components/Sidebar';
import OrgAnalyticsView from './components/OrgAnalyticsView';
import SettingsView from './components/SettingsView';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';

const TOKEN_KEY = 'brochure_dev_token';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '');
  const [loggedIn, setLoggedIn] = useState(false);
  const [headerSub, setHeaderSub] = useState('Projects & brochures');
  const [quota, setQuota] = useState<Quota | null>(null);
  const [orgAnalytics, setOrgAnalytics] = useState<OrgAnalytics | null>(null);
  const [orgAnalyticsError, setOrgAnalyticsError] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loginError, setLoginError] = useState('');
  const [view, setView] = useState<SidebarView>('folders');

  async function refreshQuota(activeToken: string) {
    const data = await callApi<Quota & { organization: { name: string }; plan: { name: string } }>('quota-status', {
      token: activeToken,
    });
    setQuota(data);
    setHeaderSub(data.organization.name);
    try {
      const analytics = await callApi<OrgAnalytics>('analytics-org', { token: activeToken });
      setOrgAnalytics(analytics);
      setOrgAnalyticsError(false);
    } catch {
      setOrgAnalyticsError(true);
    }
  }

  useEffect(() => {
    if (!token) return;
    setLoggedIn(true);
    refreshQuota(token).catch((err) => {
      setLoginError(err.message);
      handleLogout();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLogin(newToken: string, rememberMe: boolean) {
    setToken(newToken);
    if (rememberMe) {
      localStorage.setItem(TOKEN_KEY, newToken);
    } else {
      sessionStorage.setItem(TOKEN_KEY, newToken);
    }
    setLoggedIn(true);
    setCurrentProject(null);
    setView('folders');
    refreshQuota(newToken).catch((err) => setLoginError(err.message));
  }

  function handleLogout() {
    setToken('');
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    setLoggedIn(false);
    setHeaderSub('Projects & brochures');
    setQuota(null);
    setOrgAnalytics(null);
    setCurrentProject(null);
  }

  if (!loggedIn) {
    return (
      <Box>
        <LoginPanel onLogin={handleLogin} />
        {loginError && (
          <Alert severity="error" sx={{ maxWidth: 420, mx: 'auto', mt: -6 }}>
            {loginError}
          </Alert>
        )}
      </Box>
    );
  }

  return (
    <>
      <TopBar headerSub={headerSub} planName={quota?.plan.name || ''} />

      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 3,
          p: { xs: 2, sm: 2.5 },
          pb: { xs: 6, sm: 5 },
          minHeight: 'calc(100vh + 1px)',
        }}
      >
        <Sidebar
          active={view}
          onNavigate={(v) => {
            if (v === 'folders' && view === 'folders') setCurrentProject(null);
            setView(v);
          }}
        />

        <Box sx={{ flex: 1, minWidth: 0, maxWidth: 1000, mx: 'auto' }}>
          {view === 'folders' && (
            <>
              {!currentProject && (
                <ProjectsView
                  token={token}
                  quota={quota}
                  orgAnalytics={orgAnalytics}
                  orgAnalyticsError={orgAnalyticsError}
                  onOpenProject={setCurrentProject}
                  onQuotaChange={() => refreshQuota(token).catch((err) => setLoginError(err.message))}
                />
              )}

              {currentProject && (
                <ProjectDetailView
                  token={token}
                  project={currentProject}
                  quota={quota}
                  orgAnalytics={orgAnalytics}
                  orgAnalyticsError={orgAnalyticsError}
                  onQuotaChange={() => refreshQuota(token).catch((err) => setLoginError(err.message))}
                />
              )}
            </>
          )}

          {view === 'analytics' && <OrgAnalyticsView token={token} orgAnalyticsError={orgAnalyticsError} />}

          {view === 'settings' && (
            <SettingsView orgName={headerSub} planName={quota?.plan.name || ''} onLogout={handleLogout} />
          )}
        </Box>
      </Box>
    </>
  );
}
