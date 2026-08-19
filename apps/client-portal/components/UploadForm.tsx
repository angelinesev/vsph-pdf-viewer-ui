import { useRef, useState } from 'react';
import { callApi } from '../../shared/api';
import type { LinkResult, UploadPrepared } from '../types';

interface UploadFormProps {
  token: string;
  projectId: string;
  onUploaded: (link: LinkResult) => void;
  onDone: () => void;
}

export default function UploadForm({ token, projectId, onUploaded, onDone }: UploadFormProps) {
  const [title, setTitle] = useState('');
  const [viewType, setViewType] = useState<'brochure' | 'flyer'>('brochure');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickFile(candidate: File | null | undefined) {
    setFile(candidate && candidate.type === 'application/pdf' ? candidate : null);
  }

  async function handleUpload() {
    setError('');
    if (!file) return;
    setUploading(true);
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

      const put = await fetch(prepared.upload.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      });
      if (!put.ok) throw new Error(`Storage upload failed (${put.status})`);

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

      onUploaded(link);
      onDone();
      setFile(null);
      setTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      const suffix = err.data?.limit != null ? ` (${err.data.used}/${err.data.limit})` : '';
      setError(err.message + suffix);
    } finally {
      setUploading(false);
    }
  }

  return (
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
      <button type="button" disabled={!file || uploading} onClick={handleUpload}>
        {uploading ? 'Uploading…' : 'Upload & create share link'}
      </button>
      <p className="err">{error}</p>
    </div>
  );
}
