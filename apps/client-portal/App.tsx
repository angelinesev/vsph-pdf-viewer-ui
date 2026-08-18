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

const TOKEN_KEY = 'brochure_dev_token';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
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

  function handleLogin(newToken: string) {
    setToken(newToken);
    localStorage.setItem(TOKEN_KEY, newToken);
    setLoggedIn(true);
    setCurrentProject(null);
    setView('folders');
    refreshQuota(newToken).catch((err) => setLoginError(err.message));
  }

  function handleLogout() {
    setToken('');
    localStorage.removeItem(TOKEN_KEY);
    setLoggedIn(false);
    setHeaderSub('Projects & brochures');
    setQuota(null);
    setOrgAnalytics(null);
    setCurrentProject(null);
  }

  if (!loggedIn) {
    return (
      <div>
        <LoginPanel onLogin={handleLogin} />
        {loginError && <p className="err" style={{ textAlign: 'center' }}>{loginError}</p>}
      </div>
    );
  }

  return (
    <>
      <TopBar headerSub={headerSub} planName={quota?.plan.name || ''} />

      <div className="app-shell">
        <Sidebar
          active={view}
          onNavigate={(v) => {
            if (v === 'folders' && view === 'folders') setCurrentProject(null);
            setView(v);
          }}
        />

        <div className="wrap">
          <main className="app-main">
            {view === 'folders' && (
              <>
                {!currentProject && (
                  <ProjectsView
                    token={token}
                    quota={quota}
                    orgAnalytics={orgAnalytics}
                    orgAnalyticsError={orgAnalyticsError}
                    onOpenProject={setCurrentProject}
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

            {view === 'analytics' && (
              <OrgAnalyticsView orgAnalytics={orgAnalytics} orgAnalyticsError={orgAnalyticsError} />
            )}

            {view === 'settings' && (
              <SettingsView orgName={headerSub} planName={quota?.plan.name || ''} onLogout={handleLogout} />
            )}
          </main>
        </div>
      </div>
    </>
  );
}
