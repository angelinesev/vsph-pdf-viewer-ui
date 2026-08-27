import { useEffect, useRef, useState } from 'react';
import { embedSnippet } from '../utils';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import InputBase from '@mui/material/InputBase';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import LinkIcon from '@mui/icons-material/Link';
import CodeIcon from '@mui/icons-material/Code';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import FacebookIcon from '@mui/icons-material/Facebook';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

interface ShareResultProps {
  vanityUrl: string;
  tokenUrl: string;
}

export default function ShareResult({ vanityUrl, tokenUrl }: ShareResultProps) {
  const pretty = vanityUrl || tokenUrl;
  const embed = embedSnippet(pretty);
  const [copied, setCopied] = useState<'link' | 'embed' | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  function copy(value: string, field: 'link' | 'embed') {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(field);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopied(null), 2000);
      })
      .catch(() => {});
  }

  const shareText = 'Check out this flipbook';
  const encodedUrl = encodeURIComponent(pretty);
  const mailHref = `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodedUrl}`;
  const linkedinHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${pretty}`)}`;

  return (
    <Stack spacing={2.5}>
      <Box>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.75 }}>
          <LinkIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={700}>
            Link
          </Typography>
        </Stack>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{ bgcolor: 'primary.light', borderRadius: 999, px: 2, py: 1 }}
        >
          <InputBase
            readOnly
            value={pretty}
            sx={{ flex: 1, minWidth: 0, color: 'primary.main', fontWeight: 500 }}
          />
          <Divider orientation="vertical" flexItem sx={{ borderColor: 'primary.main', opacity: 0.25 }} />
          <Button
            disableElevation
            onClick={() => copy(pretty, 'link')}
            startIcon={copied === 'link' ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
            sx={{ flexShrink: 0, color: copied === 'link' ? 'success.main' : 'primary.main' }}
          >
            {copied === 'link' ? 'Copied' : 'Copy link'}
          </Button>
        </Stack>
      </Box>

      <Box>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.75 }}>
          <CodeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={700}>
            Embed
          </Typography>
        </Stack>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{ bgcolor: 'background.default', borderRadius: 2, px: 2, py: 1.25 }}
        >
          <Box
            component="code"
            sx={{
              flex: 1,
              minWidth: 0,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '0.78rem',
              lineHeight: 1.5,
              color: 'text.primary',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {embed}
          </Box>
          <IconButton
            aria-label="Copy embed code"
            title="Copy embed code"
            size="small"
            onClick={() => copy(embed, 'embed')}
            sx={{ color: copied === 'embed' ? 'success.main' : 'text.secondary' }}
          >
            {copied === 'embed' ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
          </IconButton>
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>
          Share to
        </Typography>
        <Stack direction="row" spacing={1}>
          <IconButton
            component="a"
            href={mailHref}
            title="Email"
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2.5,
              color: 'text.secondary',
              '&:hover': { bgcolor: 'primary.main', color: '#fff', borderColor: 'transparent' },
            }}
          >
            <MailOutlineIcon fontSize="small" />
          </IconButton>
          <IconButton
            component="a"
            href={linkedinHref}
            target="_blank"
            rel="noopener noreferrer"
            title="LinkedIn"
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2.5,
              color: 'text.secondary',
              '&:hover': { bgcolor: '#0a66c2', color: '#fff', borderColor: 'transparent' },
            }}
          >
            <LinkedInIcon fontSize="small" />
          </IconButton>
          <IconButton
            component="a"
            href={facebookHref}
            target="_blank"
            rel="noopener noreferrer"
            title="Facebook"
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2.5,
              color: 'text.secondary',
              '&:hover': { bgcolor: '#1877f2', color: '#fff', borderColor: 'transparent' },
            }}
          >
            <FacebookIcon fontSize="small" />
          </IconButton>
          <IconButton
            component="a"
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            title="WhatsApp"
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2.5,
              color: 'text.secondary',
              '&:hover': { bgcolor: '#25d366', color: '#fff', borderColor: 'transparent' },
            }}
          >
            <WhatsAppIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
    </Stack>
  );
}
