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

  return (
    <div className="wrap">
      <TopBar loggedIn={loggedIn} onLogout={handleLogout} />

      {!loggedIn && <LoginPanel supabase={supabase} onLogin={handleLogin} />}

      {loggedIn && (
        <div>
          <StatsOverview orgs={orgs} plan={plans[0]} />
          <PlansGrid plans={plans} />
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
          <AnalyticsPanel jwt={jwt} version={analyticsVersion} />
          <p className="err">{adminError}</p>
        </div>
      )}
    </div>
  );
}
