interface TopBarProps {
  headerSub: string;
  planName: string;
}

export default function TopBar({ headerSub, planName }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">V</div>
        <div>
          <p className="brand-title">Client portal</p>
          <p className="brand-sub">{headerSub}</p>
        </div>
      </div>
      <div className="topbar-actions">
        <span className="badge">{planName}</span>
      </div>
    </header>
  );
}
