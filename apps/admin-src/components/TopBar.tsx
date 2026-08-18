interface TopBarProps {
  loggedIn: boolean;
  onLogout: () => void;
}

export default function TopBar({ loggedIn, onLogout }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">V</div>
        <div>
          <p className="brand-title">Admin portals</p>
          <p className="brand-sub">Organizations &amp; access</p>
        </div>
      </div>
      <div className="topbar-actions">
        <span className="badge">Admin</span>
        {loggedIn && (
          <button className="secondary inline" type="button" onClick={onLogout}>
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}
