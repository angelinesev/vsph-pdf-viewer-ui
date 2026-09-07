import { useCallback, useEffect, useState } from 'react';
import { callApi } from '../../shared/api';
import type { AnalyticsRange } from '../../shared/analytics';
import type { OrgAnalytics } from '../types';
import AnalyticsView from '../../shared/AnalyticsView';
import { exportAnalyticsPdf } from '../../shared/printAnalytics';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';

interface OrgAnalyticsViewProps {
  token: string;
  orgAnalyticsError: boolean;
}

export default function OrgAnalyticsView({ token, orgAnalyticsError }: OrgAnalyticsViewProps) {
  const [days, setDays] = useState<AnalyticsRange>(30);
  const [data, setData] = useState<OrgAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [exportError, setExportError] = useState('');

  const loadAnalytics = useCallback(async (range: AnalyticsRange) => {
    if (!token || orgAnalyticsError) return;
    setLoading(true);
    try {
      const res = await callApi<OrgAnalytics>(`analytics-org?days=${range}`, { token });
      setData(res);
      setFetchError(false);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [token, orgAnalyticsError]);

  useEffect(() => {
    loadAnalytics(days);
  }, [days, loadAnalytics]);

  function handleExport(opts: { days: number; countryFilter?: string | null }) {
    if (!data) return;
    setExportError('');
    const popupError = exportAnalyticsPdf(data, opts.days, opts);
    if (popupError) setExportError(popupError);
  }

  const errorMessage = orgAnalyticsError
    ? 'Run analytics migration to enable.'
    : fetchError
      ? 'Could not load analytics.'
      : undefined;

  return (
    <Box>
      <AnalyticsView
        data={data}
        loading={loading}
        error={errorMessage}
        days={days}
        onDaysChange={setDays}
        onExport={handleExport}
        exportDisabled={orgAnalyticsError}
      />
      {exportError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {exportError}
        </Alert>
      )}
    </Box>
  );
}
