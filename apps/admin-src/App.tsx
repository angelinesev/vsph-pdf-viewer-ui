import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { callApi } from '../shared/api';
import type { Organization, Plan } from './types';
import TopBar from './components/TopBar';
import LoginPanel from './components/LoginPanel';
import StatsOverview from './components/StatsOverview';
import PlansGrid from './components/PlansGrid';
import OrganizationsPanel from './components/OrganizationsPanel';
import AccessCodePanel from './components/AccessCodePanel';
import AnalyticsPanel from './components/AnalyticsPanel';
import Sidebar, { type SidebarView } from './components/Sidebar';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';

const SESSION_KEY = 'brochure_admin_jwt';

export default function App() {
  const supabase = useMemo(() => {
    const cfg = window.BROCHURE_SAAS;
    return createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  }, []);

  const [jwt, setJwt] = useState(() => localStorage.getItem(SESSION_KEY) || '');
  const [loggedIn, setLoggedIn] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [archivedOrgs, setArchivedOrgs] = useState<Organization[]>([]);
  const [orgTab, setOrgTab] = useState<'active' | 'archived'>('active');
  const [codeOrgId, setCodeOrgId] = useState('');
  const [scrollSignal, setScrollSignal] = useState(0);
  const [analyticsVersion, setAnalyticsVersion] = useState(0);
  const [adminError, setAdminError] = useState('');
  const [view, setView] = useState<SidebarView>('overview');

  async function refresh(activeJwt: string) {
    setAdminError('');
    const planRes = await callApi<{ plans: Plan[] }>('admin-plans', { adminJwt: activeJwt });
    setPlans(planRes.plans || []);

    const [orgRes, allRes] = await Promise.all([
      callApi<{ organizations: Organization[] }>('admin-orgs?action=list', { adminJwt: activeJwt }),
      callApi<{ organizations: Organization[] }>('admin-orgs?action=list&include_archived=1', { adminJwt: activeJwt }),
    ]);
    const activeOrgs = orgRes.organizations || [];
    setOrgs(activeOrgs);
    setArchivedOrgs((allRes.organizations || []).filter((o) => o.status !== 'active'));
    setCodeOrgId((prev) => (prev && activeOrgs.some((o) => o.id === prev) ? prev : activeOrgs[0]?.id || ''));
    setAnalyticsVersion((v) => v + 1);
  }

  useEffect(() => {
    if (!jwt) return;
    callApi('admin-me', { adminJwt: jwt })
      .then(() => {
        setLoggedIn(true);
        return refresh(jwt);
      })
      .catch(() => {
        setJwt('');
        localStorage.removeItem(SESSION_KEY);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLogin(newJwt: string) {
    setJwt(newJwt);
    localStorage.setItem(SESSION_KEY, newJwt);
    setLoggedIn(true);
    setView('overview');
    refresh(newJwt).catch((err) => setAdminError(err.message));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setJwt('');
    localStorage.removeItem(SESSION_KEY);
    setLoggedIn(false);
  }

  function handleManageCode(orgId: string) {
    setCodeOrgId(orgId);
    setScrollSignal((v) => v + 1);
  }

  function handleRevoked() {
    setOrgTab('archived');
    refresh(jwt).catch((err) => setAdminError(err.message));
  }

  if (!loggedIn) {
    return <LoginPanel supabase={supabase} onLogin={handleLogin} />;
  }

  return (
    <>
      <TopBar loggedIn={loggedIn} onLogout={handleLogout} />

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
        <Sidebar active={view} onNavigate={setView} />

        <Box sx={{ flex: 1, minWidth: 0, maxWidth: 1100, mx: 'auto' }}>
          {view === 'overview' && (
            <>
              <StatsOverview orgs={orgs} plan={plans[0]} />
              <PlansGrid plans={plans} />
            </>
          )}

          {view === 'organizations' && (
            <>
              <OrganizationsPanel
                jwt={jwt}
                orgs={orgs}
                archivedOrgs={archivedOrgs}
                orgTab={orgTab}
                onTabChange={setOrgTab}
                onManageCode={handleManageCode}
                onRefresh={() => refresh(jwt).catch((err) => setAdminError(err.message))}
              />
              {codeOrgId && (
                <AccessCodePanel
                  jwt={jwt}
                  orgs={orgs}
                  selectedOrgId={codeOrgId}
                  onSelectOrg={setCodeOrgId}
                  onRevoked={handleRevoked}
                  scrollSignal={scrollSignal}
                />
              )}
            </>
          )}

          {view === 'analytics' && <AnalyticsPanel jwt={jwt} version={analyticsVersion} />}

          {adminError && <Alert severity="error" sx={{ mt: 2 }}>{adminError}</Alert>}
        </Box>
      </Box>
    </>
  );
}
