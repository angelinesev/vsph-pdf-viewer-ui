import { useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { callApi } from '../../shared/api';
import type { Brochure, LinkResult } from '../types';
import Modal from './Modal';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import DialogContentText from '@mui/material/DialogContentText';
import DescriptionIcon from '@mui/icons-material/Description';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import IosShareIcon from '@mui/icons-material/IosShare';

interface BrochureListProps {
  token: string;
  projectId: string;
  searchTerm: string;
  onShare: (link: LinkResult) => void;
  onError: (message: string) => void;
  onDeleted: () => void;
}

export interface BrochureListHandle {
  refresh: () => void;
}

const BrochureList = forwardRef<BrochureListHandle, BrochureListProps>(function BrochureList(
  { token, projectId, searchTerm, onShare, onError, onDeleted },
  ref,
) {
  const [brochures, setBrochures] = useState<Brochure[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuBrochure, setMenuBrochure] = useState<Brochure | null>(null);

  async function refresh() {
    const list = await callApi<{ brochures: Brochure[] }>(`brochures-list?project_id=${encodeURIComponent(projectId)}`, {
      token,
    });
    setBrochures(list.brochures || []);
    setLoaded(true);
  }

  useImperativeHandle(ref, () => ({ refresh }));

  useEffect(() => {
    refresh().catch((err) => onError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    setPage(0);
  }, [searchTerm, projectId]);

  async function handleShare(id: string) {
    onError('');
    try {
      const link = await callApi<LinkResult>('links-create', { method: 'POST', token, body: { brochure_id: id } });
      onShare(link);
    } catch (err: any) {
      onError(err.message);
    }
  }

  async function handleOpen(id: string) {
    onError('');
    try {
      const link = await callApi<LinkResult>('links-create', { method: 'POST', token, body: { brochure_id: id } });
      const url = link.vanity_url || link.token_url || link.url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      onError(err.message);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    onError('');
    setDeleting(true);
    try {
      await callApi('brochures-delete', { method: 'POST', token, body: { brochure_id: pendingDelete.id } });
      await refresh();
      onDeleted();
      setPendingDelete(null);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const term = searchTerm.trim().toLowerCase();
  const visible = term
    ? brochures.filter((b) => (b.title || b.filename).toLowerCase().includes(term))
    : brochures;

  const pageItems =
    rowsPerPage > 0 ? visible.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) : visible;

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
        Brochures &amp; history
      </Typography>

      {loaded && brochures.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No brochures yet. Upload your first PDF.
        </Typography>
      )}
      {loaded && brochures.length > 0 && visible.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No flipbooks match &quot;{searchTerm}&quot;.
        </Typography>
      )}

      {!loaded && (
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
                <TableCell sx={{ width: 200, fontWeight: 700, textAlign: 'center' }}>
                  Date uploaded
                </TableCell>
                <TableCell width={52} />
              </TableRow>
            </TableHead>
            <TableBody>
              {[0, 1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Skeleton variant="rounded" width={48} height={48} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" width="40%" height={22} />
                        <Skeleton variant="rounded" width={70} height={20} sx={{ mt: 0.5, borderRadius: 999 }} />
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ width: 200, textAlign: 'center' }}>
                    <Skeleton variant="text" width="60%" sx={{ mx: 'auto' }} />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="circular" width={28} height={28} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {visible.length > 0 && (
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
                <TableCell sx={{ width: 200, fontWeight: 700, textAlign: 'center' }}>
                  Date uploaded
                </TableCell>
                <TableCell width={52} />
              </TableRow>
            </TableHead>
            <TableBody>
              {pageItems.map((b) => {
                const title = b.title || b.filename;
                return (
                  <TableRow key={b.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                        <Box
                          onClick={() => handleOpen(b.id)}
                          role="button"
                          tabIndex={0}
                          aria-label={`View ${title}`}
                          title={`View ${title}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') handleOpen(b.id);
                          }}
                          sx={{
                            position: 'relative',
                            width: 48,
                            height: 48,
                            flexShrink: 0,
                            borderRadius: 2,
                            cursor: 'pointer',
                            '&:hover .thumb-overlay': { opacity: 1 },
                          }}
                        >
                          <Box
                            sx={{
                              width: '100%',
                              height: '100%',
                              borderRadius: 2,
                              bgcolor: 'primary.light',
                              color: 'primary.main',
                              border: '1px solid',
                              borderColor: 'divider',
                              display: 'grid',
                              placeItems: 'center',
                            }}
                          >
                            {b.view_type === 'flyer' ? (
                              <InsertDriveFileIcon fontSize="small" />
                            ) : (
                              <DescriptionIcon fontSize="small" />
                            )}
                          </Box>
                          <Box
                            className="thumb-overlay"
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              borderRadius: 2,
                              bgcolor: 'rgba(17, 24, 39, 0.55)',
                              color: '#fff',
                              display: 'grid',
                              placeItems: 'center',
                              opacity: 0,
                              transition: 'opacity 0.15s',
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </Box>
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {title}
                          </Typography>
                          <Chip label={b.view_type} size="small" color="primary" variant="outlined" sx={{ mt: 0.5 }} />
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ width: 200, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(b.created_at).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        aria-label={`More options for ${title}`}
                        title="More options"
                        size="small"
                        onClick={(e) => {
                          setMenuAnchor(e.currentTarget);
                          setMenuBrochure(b);
                        }}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={visible.length}
            page={page}
            onPageChange={(_e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </TableContainer>
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ px: 2, py: 1, maxWidth: 240 }} noWrap>
          {menuBrochure ? menuBrochure.title || menuBrochure.filename : ''}
        </Typography>
        <Divider />
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            if (menuBrochure) setPendingDelete({ id: menuBrochure.id, title: menuBrochure.title || menuBrochure.filename });
          }}
        >
          <ListItemIcon>
            <DeleteOutlineIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>Move to trash</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            if (menuBrochure) handleShare(menuBrochure.id);
          }}
        >
          <ListItemIcon>
            <IosShareIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Share</ListItemText>
        </MenuItem>
      </Menu>

      {pendingDelete && (
        <Modal
          title="Delete brochure?"
          onClose={() => {
            if (!deleting) setPendingDelete(null);
          }}
        >
          <DialogContentText>
            Are you sure you want to delete <strong>&quot;{pendingDelete.title}&quot;</strong>? Share links will stop
            working and the file will be removed from storage.
          </DialogContentText>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2.5 }}>
            <Button variant="outlined" color="inherit" disabled={deleting} onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="outlined" color="error" disabled={deleting} onClick={confirmDelete}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </Box>
        </Modal>
      )}
    </Box>
  );
});

export default BrochureList;
