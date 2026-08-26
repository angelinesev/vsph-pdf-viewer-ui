import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import BarChartIcon from '@mui/icons-material/BarChart';
import type { SvgIconComponent } from '@mui/icons-material';

export type SidebarView = 'overview' | 'organizations' | 'analytics';

interface SidebarProps {
  active: SidebarView;
  onNavigate: (view: SidebarView) => void;
}

const ICONS: Record<SidebarView, SvgIconComponent> = {
  overview: DashboardIcon,
  organizations: CorporateFareIcon,
  analytics: BarChartIcon,
};

const LABELS: Record<SidebarView, string> = {
  overview: 'Overview',
  organizations: 'Organizations',
  analytics: 'Analytics',
};

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  function item(view: SidebarView) {
    const IconComponent = ICONS[view];
    const isActive = active === view;
    return (
      <ButtonBase
        key={view}
        onClick={() => onNavigate(view)}
        sx={{
          flexDirection: 'column',
          gap: 0.5,
          width: '100%',
          py: 1.35,
          px: 1,
          borderRadius: 2,
          color: isActive ? 'primary.main' : 'text.secondary',
          bgcolor: isActive ? 'primary.light' : 'transparent',
          '&:hover': { bgcolor: isActive ? 'primary.light' : 'action.hover' },
        }}
      >
        <IconComponent fontSize="small" />
        <Typography variant="caption" fontWeight={600}>
          {LABELS[view]}
        </Typography>
      </ButtonBase>
    );
  }

  return (
    <Box
      component="nav"
      sx={{
        width: 80,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        minHeight: 'calc(100vh - 6rem - 2rem)',
        p: 1,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        position: 'sticky',
        top: '6rem',
        alignSelf: 'flex-start',
        '@media (max-width: 768px)': {
          position: 'fixed',
          top: 'auto',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 20,
          width: '100%',
          minHeight: 'auto',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 1,
          borderRadius: 0,
          borderTop: '1px solid',
          borderBottom: 0,
          borderLeft: 0,
          borderRight: 0,
        },
      }}
    >
      <Stack spacing={0.5} sx={{ '@media (max-width: 768px)': { flexDirection: 'row' } }}>
        {(['overview', 'organizations', 'analytics'] as SidebarView[]).map(item)}
      </Stack>
    </Box>
  );
}
