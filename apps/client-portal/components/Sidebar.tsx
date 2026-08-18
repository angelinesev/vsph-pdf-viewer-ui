import Icon from './Icon';

export type SidebarView = 'folders' | 'analytics' | 'settings';

interface SidebarProps {
  active: SidebarView;
  onNavigate: (view: SidebarView) => void;
}

const ICONS: Record<SidebarView, string> = {
  folders: 'folder',
  analytics: 'bar_chart',
  settings: 'settings',
};

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  function item(view: SidebarView, label: string) {
    return (
      <button
        type="button"
        className={`sidebar-item${active === view ? ' active' : ''}`}
        onClick={() => onNavigate(view)}
      >
        <Icon name={ICONS[view]} />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <nav className="sidebar">
      <div className="sidebar-group">
        {item('folders', 'Folders')}
        {item('analytics', 'Analytics')}
      </div>
      <div className="sidebar-group">{item('settings', 'Settings')}</div>
    </nav>
  );
}
