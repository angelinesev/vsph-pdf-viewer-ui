import { useEffect, useState } from 'react';
import type { Organization } from '../types';
import { brochureLimitLabel, formatBytes, storageLimitOf } from '../utils';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
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
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import CreateOrgModal from './CreateOrgModal';
import AccessDrawer from './AccessDrawer';
import PlanDetailsModal from './PlanDetailsModal';
import OrgActionsMenu from './OrgActionsMenu';

interface OrganizationsPanelProps {
  jwt: string;
  orgs: Organization[];
  archivedOrgs: Organization[];
  orgTab: 'active' | 'archived';
  onTabChange: (tab: 'active' | 'archived') => void;
  onRefresh: () => void;
  loading?: boolean;
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
  const [planOrgId, setPlanOrgId] = useState<string | null>(null);
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
  const planOrg = [...orgs, ...archivedOrgs].find((o) => o.id === planOrgId) || null;

  function handleArchived() {
    onTabChange('archived');
    onRefresh();
  }

  function openDrawer(orgId: string, focus: 'rotate' | 'archive' | null) {
    setDrawerOrgId(orgId);
    setDrawerFocus(focus);
  }

  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
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

      <TextField
        size="small"
        placeholder="Search organizations…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2, maxWidth: 320 }}
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          },
        }}
      />

      <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
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
                    <Skeleton variant="text" width="40%" height={22} />
                    <Skeleton variant="text" width="25%" />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="text" width="60%" />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="text" width="50%" />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="text" width="60%" />
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
                <TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                  {q ? 'No organizations match your search.' : archived ? 'No archived organizations.' : 'No active organizations yet.'}
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              pageItems.map((o) => {
                const planName = o.plans?.name || o.plan_id;
                const limit = brochureLimitLabel(o.plans);
                const active = o.active_brochures ?? o.usage_this_month ?? 0;
                const storage = formatBytes(o.storage_used_bytes || 0);
                const storageCap = formatBytes(storageLimitOf(o.plans));
                return (
                  <TableRow key={o.id} hover>
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
                      {active} / {limit}
                    </TableCell>
                    <TableCell>
                      {storage} / {storageCap}
                    </TableCell>
                    <TableCell>{statusChip(o.status)}</TableCell>
                    <TableCell align="right">
                      {archived ? (
                        <Typography variant="body2" color="text.secondary">
                          PDFs locked
                        </Typography>
                      ) : (
                        <OrgActionsMenu
                          orgName={o.name}
                          onManageAccess={() => openDrawer(o.id, null)}
                          onChangePlan={() => setPlanOrgId(o.id)}
                          onRotate={() => openDrawer(o.id, 'rotate')}
                          onArchive={() => openDrawer(o.id, 'archive')}
                        />
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

      <PlanDetailsModal open={!!planOrgId} onClose={() => setPlanOrgId(null)} org={planOrg} />
    </Paper>
  );
}
