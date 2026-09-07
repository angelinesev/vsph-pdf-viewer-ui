import { useEffect, useState } from 'react';
import type { Organization } from '../types';
import { brochureLimitLabel, formatBytes, pct, storageLimitOf } from '../utils';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CreateOrgModal from './CreateOrgModal';
import AccessDrawer from './AccessDrawer';

interface OrganizationsPanelProps {
  jwt: string;
  orgs: Organization[];
  archivedOrgs: Organization[];
  orgTab: 'active' | 'archived';
  onTabChange: (tab: 'active' | 'archived') => void;
  onRefresh: () => void;
  loading?: boolean;
}

function UsageBar({ used, limit, valueLabel, capLabel }: { used: number; limit: number | null; valueLabel: string; capLabel: string }) {
  const value = pct(used, limit);
  const color: 'primary' | 'warning' | 'error' = limit == null ? 'primary' : value >= 95 ? 'error' : value >= 80 ? 'warning' : 'primary';
  return (
    <Box sx={{ minWidth: 140 }}>
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        {valueLabel} <Typography component="span" variant="body2" color="text.secondary">/ {capLabel}</Typography>
      </Typography>
      <LinearProgress
        variant="determinate"
        value={value}
        color={color}
        sx={{ height: 5, borderRadius: 999, bgcolor: 'action.hover' }}
      />
    </Box>
  );
}

function statusChip(status: string) {
  return status === 'active' ? (
    <Chip size="small" label="Active" color="success" variant="outlined" />
  ) : (
    <Chip size="small" label="Archived" color="warning" variant="outlined" />
  );
}

export default function OrganizationsPanel({
  jwt,
  orgs,
  archivedOrgs,
  orgTab,
  onTabChange,
  onRefresh,
  loading,
}: OrganizationsPanelProps) {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerOrgId, setDrawerOrgId] = useState<string | null>(null);
  const [drawerFocus, setDrawerFocus] = useState<'rotate' | 'archive' | null>(null);
  const [reactivateOrgId, setReactivateOrgId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const archived = orgTab === 'archived';
  const list = archived ? archivedOrgs : orgs;
  const q = search.trim().toLowerCase();
  const filtered = q ? list.filter((o) => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q)) : list;
  const pageItems = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  useEffect(() => {
    setPage(0);
  }, [search, orgTab]);

  const drawerOrg = [...orgs, ...archivedOrgs].find((o) => o.id === drawerOrgId) || null;
  const reactivateOrg = archivedOrgs.find((o) => o.id === reactivateOrgId) || null;

  function handleArchived() {
    onTabChange('archived');
    onRefresh();
  }

  function openDrawer(orgId: string, focus: 'rotate' | 'archive' | null) {
    setDrawerOrgId(orgId);
    setDrawerFocus(focus);
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
        <Box sx={{ mr: 'auto' }}>
          <Typography variant="h6" fontWeight={700}>
            Organizations
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage client organizations, plans, and access.
          </Typography>
        </Box>
        <ToggleButtonGroup exclusive size="small" value={orgTab} onChange={(_e, v) => v && onTabChange(v)}>
          <ToggleButton value="active" sx={{ px: 2 }}>
            Active
          </ToggleButton>
          <ToggleButton value="archived" sx={{ px: 2 }}>
            {archivedOrgs.length ? `Archived (${archivedOrgs.length})` : 'Archived'}
          </ToggleButton>
        </ToggleButtonGroup>
        <Button variant="contained" disableElevation startIcon={<AddIcon fontSize="small" />} onClick={() => setCreateOpen(true)}>
          Add organization
        </Button>
      </Stack>

      <div className="search-bar">
        <SearchIcon fontSize="small" />
        <input
          placeholder="Search organizations"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, width: 44 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Organization</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Plan</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Brochures</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Storage</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading &&
              [0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton variant="text" width="60%" />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="text" width="40%" height={22} />
                    <Skeleton variant="text" width="25%" />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="text" width="60%" />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="rounded" width={140} height={30} />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="rounded" width={140} height={30} />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="rounded" width={70} height={24} sx={{ borderRadius: 999 }} />
                  </TableCell>
                  <TableCell align="right">
                    <Skeleton variant="circular" width={28} height={28} sx={{ ml: 'auto' }} />
                  </TableCell>
                </TableRow>
              ))}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                  {q ? 'No organizations match your search.' : archived ? 'No archived organizations.' : 'No active organizations yet.'}
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              pageItems.map((o, i) => {
                const planName = o.plans?.name || o.plan_id;
                const brochureLimit = o.plans?.features?.unlimited_brochures || o.plans?.monthly_brochure_limit == null
                  ? null
                  : Number(o.plans.monthly_brochure_limit);
                const active = o.active_brochures ?? o.usage_this_month ?? 0;
                const storage = o.storage_used_bytes || 0;
                const storageCap = storageLimitOf(o.plans);
                return (
                  <TableRow key={o.id} hover>
                    <TableCell sx={{ color: 'text.secondary' }}>{page * rowsPerPage + i + 1}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {o.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {o.slug}
                      </Typography>
                    </TableCell>
                    <TableCell>{planName}</TableCell>
                    <TableCell>
                      <UsageBar used={active} limit={brochureLimit} valueLabel={String(active)} capLabel={brochureLimitLabel(o.plans)} />
                    </TableCell>
                    <TableCell>
                      <UsageBar used={storage} limit={storageCap} valueLabel={formatBytes(storage)} capLabel={formatBytes(storageCap)} />
                    </TableCell>
                    <TableCell>{statusChip(o.status)}</TableCell>
                    <TableCell align="right">
                      {archived ? (
                        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="flex-end">
                          <Typography variant="body2" color="text.secondary">
                            PDFs locked
                          </Typography>
                          <Button
                            variant="outlined"
                            color="inherit"
                            size="small"
                            startIcon={<RestartAltIcon fontSize="small" />}
                            onClick={() => setReactivateOrgId(o.id)}
                          >
                            Reactivate
                          </Button>
                        </Stack>
                      ) : (
                        <Button
                          variant="outlined"
                          color="inherit"
                          size="small"
                          startIcon={<VpnKeyIcon fontSize="small" />}
                          onClick={() => openDrawer(o.id, null)}
                        >
                          Manage access
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
        {!loading && filtered.length > 0 && (
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={(_e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        )}
      </TableContainer>

      <CreateOrgModal jwt={jwt} open={createOpen} onClose={() => setCreateOpen(false)} onCreated={onRefresh} existingOrgs={[...orgs, ...archivedOrgs]} />

      <AccessDrawer
        jwt={jwt}
        org={drawerOrg}
        open={!!drawerOrgId}
        onClose={() => {
          setDrawerOrgId(null);
          setDrawerFocus(null);
        }}
        onArchived={handleArchived}
        focusRotate={drawerFocus === 'rotate'}
        focusArchive={drawerFocus === 'archive'}
      />

      <Dialog open={!!reactivateOrgId} onClose={() => setReactivateOrgId(null)}>
        <DialogTitle>Reactivate {reactivateOrg?.name}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This restores the organization to Active and unlocks its PDFs and share links. It won't have a working access
            code yet — create one from Manage access afterward.
          </DialogContentText>
          <Alert severity="info" sx={{ mt: 2 }}>
            Reactivation isn't wired up on the server yet — ask your developer to enable the <code>reactivate</code> action
            before this button will work.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" disableElevation color="inherit" onClick={() => setReactivateOrgId(null)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
