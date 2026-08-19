interface SettingsViewProps {
  orgName: string;
  planName: string;
  onLogout: () => void;
}

export default function SettingsView({ orgName, planName, onLogout }: SettingsViewProps) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Settings</h2>
      </div>
      <p className="muted">Account details for this organization.</p>
      <div className="row" style={{ marginTop: '0.5rem' }}>
        <div>
          <label>Organization</label>
          <input readOnly value={orgName} />
        </div>
        <div>
          <label>Plan</label>
          <input readOnly value={planName} />
        </div>
      </div>
      <button className="danger" type="button" onClick={onLogout} style={{ marginTop: '1.5rem' }}>
        Sign out
      </button>
    </div>
  );
}
