import { useRef, useState } from 'react';
import { callApi, quotaSuffix } from '../../shared/api';
import type { ReplacePrepared } from '../types';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Zoom from '@mui/material/Zoom';
import CloseIcon from '@mui/icons-material/Close';
import ChangeCircleIcon from '@mui/icons-material/ChangeCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'application/pdf');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Storage upload failed (network error)'));
    xhr.send(file);
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Phase = 'idle' | 'uploading' | 'done';

interface ReplaceFileFormProps {
  token: string;
  brochureId: string;
  title: string;
  onClose: () => void;
  onDone: () => void;
}

export default function ReplaceFileForm({ token, brochureId, title, onClose, onDone }: ReplaceFileFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickFile(candidate: File | null | undefined) {
    setFile(candidate && candidate.type === 'application/pdf' ? candidate : null);
  }

  async function handleReplace() {
    setError('');
    if (!file) return;
    setPhase('uploading');
    setProgress(0);
    try {
      const prepared = await callApi<ReplacePrepared>('replace-prepare', {
        method: 'POST',
        token,
        body: { brochure_id: brochureId, filename: file.name, size_bytes: file.size },
      });

      await putWithProgress(prepared.upload.signedUrl, file, setProgress);

      await callApi('replace-complete', {
        method: 'POST',
        token,
        body: {
          brochure_id: brochureId,
          storage_path: prepared.storage_path,
          filename: file.name,
          size_bytes: file.size,
        },
      });

      setPhase('done');
      await wait(700);

      onDone();
    } catch (err: any) {
      setError(err.message + quotaSuffix(err.data));
      setPhase('idle');
    }
  }

  const locked = phase !== 'idle';

  return (
    <Dialog open onClose={locked ? undefined : onClose} fullWidth maxWidth="xs">
      {phase === 'idle' && (
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box component="span">Replace file</Box>
          <IconButton aria-label="Close" title="Close" size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
      )}

      {phase === 'uploading' && (
        <DialogContent sx={{ textAlign: 'center', py: 5 }}>
          <ChangeCircleIcon color="primary" sx={{ fontSize: 52 }} />
          <Typography sx={{ mt: 1.5, mb: 2 }} fontWeight={500}>
            Replacing your file…
          </Typography>
          <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 999 }} />
        </DialogContent>
      )}

      {phase === 'done' && (
        <DialogContent sx={{ textAlign: 'center', py: 5 }}>
          <Zoom in>
            <CheckCircleIcon color="success" sx={{ fontSize: 56 }} />
          </Zoom>
          <Typography sx={{ mt: 1.5 }} fontWeight={500}>
            File replaced
          </Typography>
        </DialogContent>
      )}

      {phase === 'idle' && (
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Choose a new PDF to replace <strong>&quot;{title}&quot;</strong>. The title, tags, and share links stay
              the same — only the file content changes.
            </Typography>
            <Box
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files[0]);
              }}
              sx={{
                p: 3,
                border: '2px dashed',
                borderColor: dragOver ? 'primary.main' : 'divider',
                borderRadius: 2,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: dragOver ? 'primary.light' : '#fafbfc',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <Typography variant="body2">
                <strong>Choose a PDF</strong> or drag it here
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Max size follows your plan
              </Typography>
            </Box>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              hidden
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            {file && (
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 0 }} noWrap>
                  {file.name}
                </Typography>
                <IconButton
                  aria-label="Remove file"
                  title="Remove file"
                  size="small"
                  onClick={() => {
                    pickFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
            )}
            <Button variant="contained" disableElevation disabled={!file} onClick={handleReplace}>
              Replace file
            </Button>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
      )}
    </Dialog>
  );
}
