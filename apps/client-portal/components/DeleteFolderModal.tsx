import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import type { Project } from '../types';

interface DeleteFolderModalProps {
  project: Project;
  deleting?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function DeleteFolderModal({ project, deleting, onClose, onConfirm }: DeleteFolderModalProps) {
  const count = project.brochure_count || 0;
  const brochureLabel = count === 1 ? 'brochure' : 'brochures';

  return (
    <Dialog open onClose={deleting ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Delete folder?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Delete <strong>{project.name}</strong>? This will permanently delete all <strong>{count}</strong>{' '}
          {brochureLabel} inside this folder, including PDF files and share links. This cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="outlined" color="inherit" onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button variant="outlined" color="error" onClick={() => onConfirm()} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete folder'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
