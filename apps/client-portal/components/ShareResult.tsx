import { useEffect, useRef, useState } from 'react';
import { embedSnippet } from '../utils';
import Icon from './Icon';

interface ShareResultProps {
  vanityUrl: string;
  tokenUrl: string;
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM8.34 18.34H5.67V9.75h2.67v8.59zM7 8.6c-.86 0-1.56-.7-1.56-1.56S6.14 5.48 7 5.48s1.56.7 1.56 1.56S7.86 8.6 7 8.6zm11.34 9.74h-2.67v-4.5c0-1.16-.42-1.95-1.45-1.95-.79 0-1.26.53-1.47 1.05-.08.18-.09.43-.09.68v4.72H9.99s.04-7.66 0-8.59h2.67v1.22c.36-.55 1-1.34 2.42-1.34 1.77 0 3.1 1.15 3.1 3.63v5.08z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.83 14.02c-.24.68-1.4 1.32-1.93 1.4-.5.08-1.13.11-1.82-.12-.42-.14-.96-.32-1.65-.62-2.9-1.25-4.79-4.17-4.93-4.36-.14-.19-1.18-1.56-1.18-2.98 0-1.41.74-2.11 1-2.4.26-.29.57-.36.76-.36h.55c.18 0 .41-.04.63.48.24.55.81 1.9.88 2.04.07.14.11.31.02.5-.09.19-.14.31-.28.47-.14.16-.29.36-.42.48-.14.14-.28.28-.12.55.16.28.7 1.16 1.51 1.88 1.04.93 1.91 1.22 2.19 1.36.28.14.44.12.6-.07.16-.19.68-.79.86-1.06.18-.28.36-.23.6-.14.24.09 1.55.73 1.81.86.26.14.44.19.5.3.06.11.06.65-.18 1.33z" />
    </svg>
  );
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
    <div className="share-result">
      <div className="share-field">
        <label>
          <Icon name="link" /> Link
        </label>
        <div className="link-pill">
          <input readOnly value={pretty} />
          <span className="link-pill-divider" aria-hidden="true" />
          <button
            type="button"
            className={`link-pill-copy${copied === 'link' ? ' copied' : ''}`}
            onClick={() => copy(pretty, 'link')}
          >
            <Icon name={copied === 'link' ? 'check' : 'content_copy'} />
            {copied === 'link' ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>

      <div className="share-field">
        <label>
          <Icon name="code" /> Embed
        </label>
        <div className="embed-box">
          <code className="embed-code">{embed}</code>
          <button
            type="button"
            className={`embed-copy-btn${copied === 'embed' ? ' copied' : ''}`}
            aria-label="Copy embed code"
            title="Copy embed code"
            onClick={() => copy(embed, 'embed')}
          >
            <Icon name={copied === 'embed' ? 'check' : 'content_copy'} />
          </button>
        </div>
      </div>

      <div className="share-field">
        <label>Share to</label>
        <div className="social-row">
          <a className="social-btn email" href={mailHref} title="Email">
            <Icon name="mail" />
          </a>
          <a className="social-btn linkedin" href={linkedinHref} target="_blank" rel="noopener noreferrer" title="LinkedIn">
            <LinkedInIcon />
          </a>
          <a className="social-btn facebook" href={facebookHref} target="_blank" rel="noopener noreferrer" title="Facebook">
            <FacebookIcon />
          </a>
          <a className="social-btn whatsapp" href={whatsappHref} target="_blank" rel="noopener noreferrer" title="WhatsApp">
            <WhatsAppIcon />
          </a>
        </div>
      </div>
    </div>
  );
}
