import { useEffect, useRef, useState } from 'react';
import { callApi } from '../../shared/api';
import type { AccessCode, Organization } from '../types';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AddIcon from '@mui/icons-material/Add';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import BlockIcon from '@mui/icons-material/Block';
import HistoryIcon from '@mui/icons-material/History';

interface AccessDrawerProps {
  jwt: string;
  org: Organization | null;
  open: boolean;
  onClose: () => void;
  onArchived: () => void;
  focusRotate?: boolean;
  focusArchive?: boolean;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      size="small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard unavailable — nothing to fall back to safely
        }
      }}
    >
      <ContentCopyIcon fontSize="small" color={copied ? 'success' : 'action'} />
    </IconButton>
  );
}

export default function AccessDrawer({ jwt, org, open, onClose, onArchived, focusRotate, focusArchive }: AccessDrawerProps) {
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<{ code: string; password: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const codeFieldRef = useRef<HTMLInputElement>(null);

  const orgId = org?.id || '';

  async function loadCodes() {
    if (!orgId) return;
    setCodesLoading(true);
    try {
      const res = await callApi<{ codes: AccessCode[] }>(`admin-orgs?action=codes&org_id=${encodeURIComponent(orgId)}`, {
        adminJwt: jwt,
      });
      setCodes(res.codes || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCodesLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !orgId) return;
    setNewCode('');
    setNewPassword('');
    setShowPassword(false);
    setRevealedPassword(null);
    setError('');
    setMessage('');
    loadCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orgId]);

  useEffect(() => {
    if (open && focusRotate) {
      setTimeout(() => codeFieldRef.current?.focus(), 150);
    }
  }, [open, focusRotate]);

  const activeCode = codes.find((c) => c.active) || null;
  const history = codes.filter((c) => c.id !== activeCode?.id);

  useEffect(() => {
    if (open && focusArchive && !codesLoading && activeCode) {
      setArchiveConfirmOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, focusArchive, codesLoading, activeCode?.id]);

  async function handleCreate() {
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      await callApi<{ code: AccessCode }>('admin-orgs?action=create-code', {
        method: 'POST',
        adminJwt: jwt,
        body: { org_id: orgId, code: newCode, password: newPassword },
      });
      setRevealedPassword({ code: newCode.trim().toUpperCase(), password: newPassword });
      setMessage('Access code created.');
      setNewCode('');
      setNewPassword('');
      loadCodes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmRotate() {
    setRotateConfirmOpen(false);
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      await callApi<{ code: AccessCode }>('admin-orgs?action=rotate-code', {
        method: 'POST',
        adminJwt: jwt,
        body: { org_id: orgId, code: newCode, password: newPassword },
      });
      setRevealedPassword({ code: newCode.trim().toUpperCase(), password: newPassword });
      setMessage('Credentials rotated. The previous code no longer works.');
      setNewCode('');
      setNewPassword('');
      loadCodes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmArchive() {
    if (!activeCode) return;
    setArchiving(true);
    setError('');
    try {
      await callApi('admin-orgs?action=revoke-code', { method: 'POST', adminJwt: jwt, body: { id: activeCode.id } });
      setArchiveConfirmOpen(false);
      onArchived();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setArchiving(false);
    }
  }

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: { xs: '100vw', sm: 420 }, p: { xs: 2, sm: 2.5 }, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Stack direction="row" alignItems="flex-start" sx={{ mb: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700} noWrap>
              {org?.name || 'Access'}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {org?.slug}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {codesLoading ? (
            <Stack spacing={1.5}>
              <Skeleton variant="rounded" height={90} />
              <Skeleton variant="rounded" height={140} />
            </Stack>
          ) : (
            <>
              {activeCode && (
                <>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Current access
                  </Typography>
                  <Stack spacing={1} sx={{ mb: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" color="text.secondary" sx={{ width: 90 }}>
                        Username
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
                        {activeCode.code}
                      </Typography>
                      <CopyButton value={activeCode.code} />
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" color="text.secondary" sx={{ width: 90 }}>
                        Password
                      </Typography>
                      {revealedPassword && revealedPassword.code === activeCode.code ? (
                        <>
                          <Typography variant="body2" fontWeight={600} sx={{ flex: 1, fontFamily: 'monospace' }}>
                            {showPassword ? revealedPassword.password : '••••••••'}
                          </Typography>
                          <IconButton size="small" onClick={() => setShowPassword((v) => !v)}>
                            {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </IconButton>
                          <CopyButton value={revealedPassword.password} />
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                          Not retrievable — rotate to set a new one
                        </Typography>
                      )}
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" color="text.secondary" sx={{ width: 90 }}>
                        Status
                      </Typography>
                      <Chip size="small" label="Active" color="success" variant="outlined" />
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" color="text.secondary" sx={{ width: 90 }}>
                        Created
                      </Typography>
                      <Typography variant="body2">{new Date(activeCode.created_at).toLocaleString()}</Typography>
                    </Stack>
                  </Stack>
                  <Divider sx={{ mb: 2 }} />
                </>
              )}

              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                {activeCode ? 'Rotate credentials' : 'Create access code'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {activeCode
                  ? 'Set a new code and password. The current one stops working immediately.'
                  : 'Set the login this organization will use.'}
              </Typography>
              <Stack spacing={1.5} sx={{ mb: 2 }}>
                <TextField
                  inputRef={codeFieldRef}
                  label="Code"
                  placeholder="ACME-DEV"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  size="small"
                  fullWidth
                />
                <Box>
                  <Button
                    variant="contained"
                    disableElevation
                    size="small"
                    disabled={submitting || !newCode.trim() || !newPassword.trim()}
                    startIcon={
                      submitting ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : activeCode ? (
                        <AutorenewIcon fontSize="small" />
                      ) : (
                        <AddIcon fontSize="small" />
                      )
                    }
                    onClick={() => (activeCode ? setRotateConfirmOpen(true) : handleCreate())}
                  >
                    {activeCode ? 'Rotate credentials' : 'Create access code'}
                  </Button>
                </Box>
              </Stack>

              {(error || message) && (
                <Alert severity={error ? 'error' : 'success'} sx={{ mb: 2 }}>
                  {error || message}
                </Alert>
              )}

              {activeCode && (
                <>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="subtitle2" fontWeight={700} color="error" sx={{ mb: 1 }}>
                    Revoke access
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Revokes this code and archives the organization (Plan stop). All of its PDFs and share links stop working
                    immediately.
                  </Typography>
                  <Button
                    variant="outlined"
                    disableElevation
                    color="error"
                    size="small"
                    startIcon={<BlockIcon fontSize="small" />}
                    onClick={() => setArchiveConfirmOpen(true)}
                  >
                    Revoke access &amp; archive
                  </Button>
                </>
              )}

              {history.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <HistoryIcon fontSize="small" color="action" />
                    <Typography variant="subtitle2" fontWeight={700}>
                      History
                    </Typography>
                  </Stack>
                  <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {history.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>{c.code}</TableCell>
                            <TableCell>
                              <Chip size="small" label="Revoked" color="default" variant="outlined" />
                            </TableCell>
                            <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </>
          )}
        </Box>
      </Box>

      <Dialog open={rotateConfirmOpen} onClose={() => setRotateConfirmOpen(false)}>
        <DialogTitle>Rotate credentials?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The current code for {org?.name} stops working immediately and any signed-in sessions for this organization will be
            ended. Share the new code and password with them directly.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" disableElevation color="inherit" onClick={() => setRotateConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="outlined" disableElevation color="primary" onClick={confirmRotate}>
            Rotate
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={archiveConfirmOpen} onClose={() => (archiving ? undefined : setArchiveConfirmOpen(false))}>
        <DialogTitle>Revoke access &amp; archive {org?.name}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This immediately revokes the access code, ends any signed-in sessions, and moves the organization to Archived (Plan
            stop). All of its PDFs and share links stop working. This can only be undone by creating a new access code.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" disableElevation color="inherit" onClick={() => setArchiveConfirmOpen(false)} disabled={archiving}>
            Cancel
          </Button>
          <Button
            variant="outlined"
            disableElevation
            color="error"
            onClick={confirmArchive}
            disabled={archiving}
            startIcon={archiving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Revoke &amp; archive
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}
