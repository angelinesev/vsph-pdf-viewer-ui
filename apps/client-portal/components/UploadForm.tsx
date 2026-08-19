import { useRef, useState } from 'react';
import { callApi } from '../../shared/api';
import type { LinkResult, UploadPrepared } from '../types';
import { useLockBodyScroll } from '../utils';
import Icon from './Icon';

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
  useLockBodyScroll();

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
    <div className="modal-backdrop" onClick={locked ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {phase === 'idle' && (
          <div className="modal-head">
            <h2>Upload PDF</h2>
            <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
        )}

        {phase === 'uploading' && (
          <div className="upload-progress-body">
            <span className="upload-progress-icon">
              <Icon name="cloud_upload" />
            </span>
            <p>Uploading your file…</p>
            <div className="upload-progress-bar">
              <div className="upload-progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="upload-progress-body">
            <span className="upload-done-icon">
              <Icon name="check" />
            </span>
            <p>Upload complete</p>
          </div>
        )}

        {phase === 'idle' && (
          <div>
            <label>Title</label>
            <input placeholder="Tower A brochure" value={title} onChange={(e) => setTitle(e.target.value)} />
            <label>Document type</label>
            <div className="radio-pills">
              <label>
                <input
                  type="radio"
                  name="viewType"
                  value="brochure"
                  checked={viewType === 'brochure'}
                  onChange={() => setViewType('brochure')}
                />{' '}
                Brochure
              </label>
              <label>
                <input
                  type="radio"
                  name="viewType"
                  value="flyer"
                  checked={viewType === 'flyer'}
                  onChange={() => setViewType('flyer')}
                />{' '}
                Flyer
              </label>
            </div>
            <div
              className={`dropzone${dragOver ? ' dragover' : ''}`}
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
            >
              <p>
                <strong>Choose a PDF</strong> or drag it here
              </p>
              <p className="muted">Max size follows your plan</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              hidden
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <p className="muted">{file ? file.name : ''}</p>
            <button type="button" disabled={!file} onClick={handleUpload}>
              Upload file
            </button>
            <p className="err">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
