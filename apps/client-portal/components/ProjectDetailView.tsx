import { useRef, useState } from 'react';
import type { LinkResult, OrgAnalytics, Project, Quota } from '../types';
import UploadForm from './UploadForm';
import ShareResult from './ShareResult';
import BrochureList, { type BrochureListHandle } from './BrochureList';
import StatsRow from './StatsRow';
import Modal from './Modal';
import Icon from './Icon';

interface ProjectDetailViewProps {
  token: string;
  project: Project;
  quota: Quota | null;
  orgAnalytics: OrgAnalytics | null;
  orgAnalyticsError: boolean;
  onQuotaChange: () => void;
}

export default function ProjectDetailView({
  token,
  project,
  quota,
  orgAnalytics,
  orgAnalyticsError,
  onQuotaChange,
}: ProjectDetailViewProps) {
  const [share, setShare] = useState<LinkResult | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const brochureListRef = useRef<BrochureListHandle>(null);

  function handleShare(link: LinkResult) {
    setError('');
    setShare(link);
  }

  return (
    <div>
      <div className="page-header">
        <Icon name="auto_stories" />
        <h2>Flipbooks</h2>
        <button type="button" className="upload-btn" onClick={() => setUploadOpen(true)}>
          <Icon name="add" />
          Upload
        </button>
      </div>

      <div className="search-bar">
        <Icon name="search" />
        <input
          placeholder="Search all flipbooks"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="filter-btn" aria-label="Filters" title="Filters">
          <Icon name="tune" />
        </button>
      </div>

      <StatsRow quota={quota} orgAnalytics={orgAnalytics} orgAnalyticsError={orgAnalyticsError} />

      <p className="err">{error}</p>
      {share && (
        <Modal title="Share link ready" onClose={() => setShare(null)}>
          <ShareResult vanityUrl={share.vanity_url || share.url || ''} tokenUrl={share.token_url || share.url || ''} />
        </Modal>
      )}

      <div className="panel">
        <BrochureList
          ref={brochureListRef}
          token={token}
          projectId={project.id}
          searchTerm={search}
          onShare={handleShare}
          onError={setError}
          onDeleted={() => {
            setShare(null);
            onQuotaChange();
          }}
        />
      </div>

      {uploadOpen && (
        <Modal title="Upload PDF" onClose={() => setUploadOpen(false)}>
          <UploadForm
            token={token}
            projectId={project.id}
            onUploaded={handleShare}
            onDone={() => {
              onQuotaChange();
              brochureListRef.current?.refresh();
              setUploadOpen(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
