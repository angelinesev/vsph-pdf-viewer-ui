import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import BlockIcon from '@mui/icons-material/Block';

interface OrgActionsMenuProps {
  orgName: string;
  onManageAccess: () => void;
  onChangePlan: () => void;
  onRotate: () => void;
  onArchive: () => void;
}

export default function OrgActionsMenu({ orgName, onManageAccess, onChangePlan, onRotate, onArchive }: OrgActionsMenuProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  function pick(action: () => void) {
    setAnchorEl(null);
    action();
  }

  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ px: 2, py: 1, maxWidth: 240 }} noWrap>
          {orgName}
        </Typography>
        <Divider />
        <MenuItem onClick={() => pick(onManageAccess)}>
          <ListItemIcon>
            <VpnKeyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Manage access</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => pick(onChangePlan)}>
          <ListItemIcon>
            <WorkspacePremiumIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Change plan</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => pick(onRotate)}>
          <ListItemIcon>
            <AutorenewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Rotate credentials</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => pick(onArchive)} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <BlockIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Archive organization</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
