import { useRef, useState } from 'react';
import { callApi } from '../../shared/api';
import type { LinkResult, UploadPrepared } from '../types';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Zoom from '@mui/material/Zoom';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
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

interface UploadFormProps {
  token: string;
  projectId: string;
  onClose: () => void;
  onUploaded: (link: LinkResult) => void;
  onDone: () => void;
}

export default function UploadForm({ token, projectId, onClose, onUploaded, onDone }: UploadFormProps) {
  const [title, setTitle] = useState('');
  const [viewType, setViewType] = useState<'brochure' | 'flyer'>('brochure');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickFile(candidate: File | null | undefined) {
    setFile(candidate && candidate.type === 'application/pdf' ? candidate : null);
  }

  async function handleUpload() {
    setError('');
    if (!file) return;
    setPhase('uploading');
    setProgress(0);
    try {
      const finalTitle = title.trim() || file.name;
      const prepared = await callApi<UploadPrepared>('upload-prepare', {
        method: 'POST',
        token,
        body: {
          filename: file.name,
          title: finalTitle,
          view_type: viewType,
          size_bytes: file.size,
          project_id: projectId,
        },
      });

      await putWithProgress(prepared.upload.signedUrl, file, setProgress);

      await callApi('upload-complete', {
        method: 'POST',
        token,
        body: {
          brochure_id: prepared.brochure_id,
          project_id: prepared.project_id,
          storage_path: prepared.storage_path,
          filename: file.name,
          title: finalTitle,
          slug: prepared.slug,
          view_type: prepared.view_type,
          size_bytes: file.size,
        },
      });

      const link = await callApi<LinkResult>('links-create', {
        method: 'POST',
        token,
        body: { brochure_id: prepared.brochure_id, view_type: prepared.view_type },
      });

      setPhase('done');
      await wait(700);

      onUploaded(link);
      onDone();
      setFile(null);
      setTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      const suffix = err.data?.limit != null ? ` (${err.data.used}/${err.data.limit})` : '';
      setError(err.message + suffix);
      setPhase('idle');
    }
  }

  const locked = phase !== 'idle';

  return (
    <Dialog open onClose={locked ? undefined : onClose} fullWidth maxWidth="xs">
      {phase === 'idle' && (
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box component="span">Upload PDF</Box>
          <IconButton aria-label="Close" title="Close" size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
      )}

      {phase === 'uploading' && (
        <DialogContent sx={{ textAlign: 'center', py: 5 }}>
          <CloudUploadIcon color="primary" sx={{ fontSize: 52 }} />
          <Typography sx={{ mt: 1.5, mb: 2 }} fontWeight={500}>
            Uploading your file…
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
            Upload complete
          </Typography>
        </DialogContent>
      )}

      {phase === 'idle' && (
        <DialogContent>
          <Stack spacing={2}>
            <TextField
              label="Title"
              placeholder="Tower A brochure"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
            />
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75 }}>
                Document type
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={viewType}
                onChange={(_e, v) => v && setViewType(v)}
                size="small"
              >
                <ToggleButton value="brochure" sx={{ borderRadius: 999, px: 2 }}>
                  Brochure
                </ToggleButton>
                <ToggleButton value="flyer" sx={{ borderRadius: 999, px: 2 }}>
                  Flyer
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
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
              <Typography variant="body2" color="text.secondary">
                {file.name}
              </Typography>
            )}
            <Button variant="contained" disableElevation disabled={!file} onClick={handleUpload}>
              Upload file
            </Button>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
      )}
    </Dialog>
  );
}
