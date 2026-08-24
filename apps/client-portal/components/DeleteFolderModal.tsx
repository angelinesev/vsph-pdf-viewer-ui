import { useState } from 'react';
import type { Project } from '../types';
import Modal from './Modal';

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
    <Modal title="Delete folder?" onClose={onClose}>
      <p className="modal-body-text">
        Delete <strong>{project.name}</strong>? This will permanently delete all{' '}
        <strong>{count}</strong> {brochureLabel} inside this folder, including PDF files and share links.
        This cannot be undone.
      </p>
      <div className="modal-actions">
        <button type="button" className="secondary inline" onClick={onClose} disabled={deleting}>
          Cancel
        </button>
        <button type="button" className="danger inline" onClick={() => onConfirm()} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete folder'}
        </button>
      </div>
    </Modal>
  );
}
