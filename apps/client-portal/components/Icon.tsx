import type { SvgIconComponent } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import BarChartIcon from '@mui/icons-material/BarChart';
import CheckIcon from '@mui/icons-material/Check';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CodeIcon from '@mui/icons-material/Code';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DescriptionIcon from '@mui/icons-material/Description';
import FolderIcon from '@mui/icons-material/Folder';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import IosShareIcon from '@mui/icons-material/IosShare';
import LinkIcon from '@mui/icons-material/Link';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

const ICONS: Record<string, SvgIconComponent> = {
  add: AddIcon,
  auto_stories: AutoStoriesIcon,
  bar_chart: BarChartIcon,
  check: CheckIcon,
  chevron_left: ChevronLeftIcon,
  chevron_right: ChevronRightIcon,
  close: CloseIcon,
  cloud_upload: CloudUploadIcon,
  code: CodeIcon,
  content_copy: ContentCopyIcon,
  delete: DeleteOutlineIcon,
  description: DescriptionIcon,
  folder: FolderIcon,
  info: InfoOutlinedIcon,
  insert_drive_file: InsertDriveFileIcon,
  ios_share: IosShareIcon,
  link: LinkIcon,
  mail: MailOutlineIcon,
  more_vert: MoreVertIcon,
  search: SearchIcon,
  settings: SettingsIcon,
  visibility: VisibilityIcon,
  visibility_off: VisibilityOffIcon,
};

interface IconProps {
  name: string;
  fontSize?: 'inherit' | 'small' | 'medium' | 'large';
  className?: string;
}

export default function Icon({ name, fontSize = 'small', className }: IconProps) {
  const Component = ICONS[name];
  if (!Component) return null;
  return <Component fontSize={fontSize} className={className} aria-hidden="true" />;
}
