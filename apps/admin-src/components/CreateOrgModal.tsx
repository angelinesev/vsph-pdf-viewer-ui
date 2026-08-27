import { useEffect, useState } from 'react';
import { callApi } from '../../shared/api';
import type { Organization } from '../types';
import { slugify } from '../utils';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';

interface CreateOrgModalProps {
  jwt: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  existingOrgs: Organization[];
}

export default function CreateOrgModal({ jwt, open, onClose, onCreated, existingOrgs }: CreateOrgModalProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setSlug('');
      setSlugTouched(false);
      setError('');
      setCreating(false);
    }
  }, [open]);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function handleSlugChange(value: string) {
    setSlugTouched(true);
    setSlug(value);
  }

  const trimmedName = name.trim();
  const finalSlug = slug.trim() || slugify(name);
  const nameTaken = existingOrgs.some((o) => o.name.trim().toLowerCase() === trimmedName.toLowerCase());
  const slugTaken = existingOrgs.some((o) => o.slug.trim().toLowerCase() === finalSlug.toLowerCase());
  const duplicateError = trimmedName && (nameTaken || slugTaken) ? (nameTaken ? 'An organization with this name already exists.' : 'This slug is already in use.') : '';

  async function handleCreate() {
    if (!trimmedName || duplicateError) return;
    setError('');
    setCreating(true);
    try {
      await callApi('admin-orgs?action=create', {
        method: 'POST',
        adminJwt: jwt,
        body: { name: trimmedName, slug: finalSlug || undefined },
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onClose={creating ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Add organization</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            label="Organization name"
            placeholder="Ayala Land Estate"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            autoFocus
            fullWidth
          />
          <TextField
            label="Slug (for links)"
            placeholder="ale"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            helperText="Auto-suggested from the name — edit if you'd like a different link."
            fullWidth
          />
          {duplicateError && <Alert severity="warning">{duplicateError}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="outlined" disableElevation color="inherit" onClick={onClose} disabled={creating}>
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disableElevation
          disabled={creating || !trimmedName || !!duplicateError}
          startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <AddIcon fontSize="small" />}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
