import { useEffect, useRef, useState } from 'react';
import { embedSnippet } from '../utils';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import InputBase from '@mui/material/InputBase';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
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

type Tab = 'link' | 'embed';

export default function ShareResult({ vanityUrl, tokenUrl }: ShareResultProps) {
  const pretty = vanityUrl || tokenUrl;
  const embed = embedSnippet(pretty);
  const [tab, setTab] = useState<Tab>('link');
  const [copied, setCopied] = useState<Tab | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  function copy(value: string, field: Tab) {
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
      <ToggleButtonGroup
        exclusive
        fullWidth
        value={tab}
        onChange={(_e, v) => v && setTab(v)}
        size="small"
        aria-label="Share format"
      >
        <ToggleButton value="link" sx={{ borderRadius: 999, fontWeight: 600 }}>
          Direct Link
        </ToggleButton>
        <ToggleButton value="embed" sx={{ borderRadius: 999, fontWeight: 600 }}>
          Embed Code
        </ToggleButton>
      </ToggleButtonGroup>

      {tab === 'link' ? (
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Direct Link
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Share this URL via chat, email, or social media for direct viewing.
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            spacing={1}
            sx={{
              bgcolor: 'background.default',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              p: 1,
            }}
          >
            <InputBase
              readOnly
              value={pretty}
              onFocus={(e) => e.target.select()}
              aria-label="Direct link URL"
              sx={{
                flex: 1,
                minWidth: 0,
                px: 1,
                py: 0.5,
                fontWeight: 500,
                fontSize: '0.875rem',
                '&.Mui-focused': { outline: '2px solid', outlineColor: 'primary.main', borderRadius: 1 },
              }}
            />
            <Button
              disableElevation
              variant={copied === 'link' ? 'outlined' : 'contained'}
              color={copied === 'link' ? 'success' : 'primary'}
              onClick={() => copy(pretty, 'link')}
              startIcon={copied === 'link' ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
              sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              {copied === 'link' ? 'Copied!' : 'Copy Link'}
            </Button>
          </Stack>
        </Box>
      ) : (
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Embed on Website
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Copy this HTML code snippet to display the document directly inside your website or blog.
          </Typography>
          <Box
            component="code"
            sx={{
              display: 'block',
              bgcolor: 'background.default',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              p: 1.5,
              mb: 1,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '0.78rem',
              lineHeight: 1.5,
              color: 'text.primary',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              maxHeight: 160,
              overflow: 'auto',
            }}
          >
            {embed}
          </Box>
          <Button
            fullWidth
            disableElevation
            variant={copied === 'embed' ? 'outlined' : 'contained'}
            color={copied === 'embed' ? 'success' : 'primary'}
            onClick={() => copy(embed, 'embed')}
            startIcon={copied === 'embed' ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
          >
            {copied === 'embed' ? 'Copied!' : 'Copy Code'}
          </Button>
        </Box>
      )}

      <Box>
        <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1 }}>
          Or share directly via:
        </Typography>
        <Stack direction="row" spacing={1}>
          <IconButton
            component="a"
            href={mailHref}
            title="Email"
            aria-label="Share via email"
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2.5,
              color: 'text.secondary',
              '&:hover': { bgcolor: 'primary.main', color: '#fff', borderColor: 'transparent' },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
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
            aria-label="Share via LinkedIn"
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2.5,
              color: 'text.secondary',
              '&:hover': { bgcolor: '#0a66c2', color: '#fff', borderColor: 'transparent' },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
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
            aria-label="Share via Facebook"
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2.5,
              color: 'text.secondary',
              '&:hover': { bgcolor: '#1877f2', color: '#fff', borderColor: 'transparent' },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
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
            aria-label="Share via WhatsApp"
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2.5,
              color: 'text.secondary',
              '&:hover': { bgcolor: '#25d366', color: '#fff', borderColor: 'transparent' },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
            }}
          >
            <WhatsAppIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
    </Stack>
  );
}
