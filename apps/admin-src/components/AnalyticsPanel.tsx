import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { callApi } from '../../shared/api';
import type { AnalyticsRange } from '../../shared/analytics';
import { exportAnalyticsPdf } from '../../shared/printAnalytics';
import AnalyticsView from '../../shared/AnalyticsView';
import AnalyticsOverview from './AnalyticsOverview';
import type { AnalyticsOverview as AnalyticsOverviewData, OrgAnalyticsDetail } from '../types';

interface AnalyticsPanelProps {
  jwt: string;
  version: number;
}

export default function AnalyticsPanel({ jwt, version }: AnalyticsPanelProps) {
  const [days, setDays] = useState<AnalyticsRange>(30);
  const [data, setData] = useState<AnalyticsOverviewData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailOrgId, setDetailOrgId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrgAnalyticsDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [orgSearch, setOrgSearch] = useState('');

  const loadOverview = useCallback(
    async (range: AnalyticsRange) => {
      setLoading(true);
      setError('');
      try {
        const res = await callApi<AnalyticsOverviewData>(`admin-analytics?days=${range}`, { adminJwt: jwt });
        setData(res);
      } catch (err: any) {
        setError(err.message || 'Analytics unavailable until migration 005 is applied.');
      } finally {
        setLoading(false);
      }
    },
    [jwt],
  );

  useEffect(() => {
    loadOverview(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, days]);

  useEffect(() => {
    if (!detailOrgId) {
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setError('');
    callApi<{ detail: OrgAnalyticsDetail; window_days?: number }>(
      `admin-analytics?org_id=${encodeURIComponent(detailOrgId)}&days=${days}`,
      { adminJwt: jwt },
    )
      .then((res) => {
        if (cancelled) return;
        if (!res.detail) {
          setDetail(null);
          return;
        }
        setDetail({ ...res.detail, window_days: res.window_days || res.detail.window_days || days });
      })
      .catch((err: any) => {
        if (cancelled) return;
        setDetail(null);
        setError(err.message || 'Could not load organization analytics');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailOrgId, days, jwt]);

  async function exportOrg(orgId: string, opts: { days: number; countryFilter?: string | null }) {
    setError('');
    try {
      const res = await callApi<{ detail: OrgAnalyticsDetail; window_days?: number }>(
        `admin-analytics?org_id=${encodeURIComponent(orgId)}&days=${opts.days}`,
        { adminJwt: jwt },
      );
      if (!res.detail) throw new Error('No analytics for this organization');
      const popupError = exportAnalyticsPdf(res.detail, res.window_days || opts.days, opts);
      if (popupError) setError(popupError);
    } catch (err: any) {
      setError(err.message || 'Could not export analytics');
    }
  }

  function openOrgDetail(orgId: string) {
    setDetailOrgId(orgId);
  }

  function backToPlatform() {
    setDetailOrgId(null);
    setDetail(null);
  }

  if (detailOrgId) {
    const orgName = detail?.organization?.name || detailOrgId;
    return (
      <>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <AnalyticsView
          title={orgName}
          subtitle={`Last ${detail?.window_days || days} days · ${detail?.organization?.slug || detailOrgId}`}
          data={detail}
          loading={detailLoading}
          days={days}
          onDaysChange={setDays}
          onExport={(opts) => exportOrg(detailOrgId, opts)}
          leadingActions={
            <Button
              variant="outlined"
              disableElevation
              color="inherit"
              startIcon={<ArrowBackIcon fontSize="small" />}
              onClick={backToPlatform}
            >
              Back to platform
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <AnalyticsOverview
        data={data}
        loading={loading}
        days={days}
        onDaysChange={setDays}
        orgSearch={orgSearch}
        onOrgSearchChange={setOrgSearch}
        onOpenOrg={openOrgDetail}
        onExportOrg={(orgId) => exportOrg(orgId, { days })}
      />
    </>
  );
}
