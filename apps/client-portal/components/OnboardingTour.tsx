import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

interface Step {
  targets: string[];
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    targets: ['tour-folders'],
    title: 'Folders',
    body: 'This is where your projects live. Create a folder for each estate or development, then open it to upload brochures.',
  },
  {
    targets: ['tour-analytics'],
    title: 'Analytics',
    body: 'See opens, unique visitors, and top countries for every brochure you share — right here.',
  },
  {
    targets: ['tour-stats'],
    title: 'Usage & storage',
    body: 'Keep an eye on your brochure limit and storage usage, so you always know how much room you have left.',
  },
  {
    targets: ['tour-upload', 'tour-create-project'],
    title: 'Upload',
    body: 'Open any project and click Upload to add a new PDF.',
  },
];

interface OnboardingTourProps {
  open: boolean;
  onClose: () => void;
  onStart: () => void;
  onNeedUploadTarget: () => Promise<void>;
}

interface Placement {
  top: number;
  left: number;
  arrow: 'left' | 'top';
  arrowOffset: number;
}

function computePlacement(rect: DOMRect): Placement {
  const width = 320;
  const margin = 16;
  const inSidebar = rect.right < 150;

  if (inSidebar) {
    let top = rect.top;
    top = Math.min(top, window.innerHeight - 220);
    top = Math.max(top, margin);
    return { top, left: rect.right + margin, arrow: 'left', arrowOffset: rect.top + rect.height / 2 - top };
  }

  let left = rect.left;
  left = Math.min(left, window.innerWidth - width - margin);
  left = Math.max(left, margin);
  const top = rect.bottom + margin;
  return { top, left, arrow: 'top', arrowOffset: rect.left + rect.width / 2 - left };
}

export default function OnboardingTour({ open, onClose, onStart, onNeedUploadTarget }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    onStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let rafId = 0;
    let lastRect: DOMRect | null = null;

    function findTarget(): DOMRect | null {
      const current = STEPS[step];
      for (const key of current.targets) {
        const el = document.querySelector(`[data-tour="${key}"]`);
        if (el) return el.getBoundingClientRect();
      }
      return null;
    }

    function rectsEqual(a: DOMRect | null, b: DOMRect | null) {
      if (a === b) return true;
      if (!a || !b) return false;
      return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
    }

    // Keep re-measuring every frame instead of a one-shot query: the target
    // can exist in the DOM but still be mid-reflow (fonts, images, a layout
    // shift right after navigating into a project) — a single measurement
    // taken too early positions the spotlight against a stale rect.
    function tick() {
      if (cancelled) return;
      const r = findTarget();
      if (!rectsEqual(r, lastRect)) {
        lastRect = r;
        setRect(r);
        setPlacement(r ? computePlacement(r) : null);
      }
      rafId = requestAnimationFrame(tick);
    }

    async function run() {
      if (step === 3) {
        await onNeedUploadTarget();
      }
      if (!cancelled) rafId = requestAnimationFrame(tick);
    }
    run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function handleNext() {
    if (isLast) {
      onClose();
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 1300,
          bgcolor: rect ? 'transparent' : 'rgba(17, 24, 39, 0.35)',
        }}
      />

      {rect && (
        <Box
          sx={{
            position: 'fixed',
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            borderRadius: 2,
            boxShadow: '0 0 0 3px #0362fc, 0 0 0 9999px rgba(17, 24, 39, 0.35)',
            zIndex: 1301,
            pointerEvents: 'none',
            transition: 'top 0.15s, left 0.15s',
          }}
        />
      )}

      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          top: placement ? placement.top : '50%',
          left: placement ? placement.left : '50%',
          transform: placement ? 'none' : 'translate(-50%, -50%)',
          width: 320,
          p: 3,
          borderRadius: 3,
          bgcolor: 'primary.main',
          color: '#fff',
          zIndex: 1400,
          transition: 'top 0.15s, left 0.15s',
        }}
      >
        {placement && placement.arrow === 'left' && (
          <Box
            sx={{
              position: 'absolute',
              left: -8,
              top: Math.max(16, Math.min(placement.arrowOffset, 220)),
              width: 16,
              height: 16,
              bgcolor: 'primary.main',
              transform: 'rotate(45deg)',
            }}
          />
        )}
        {placement && placement.arrow === 'top' && (
          <Box
            sx={{
              position: 'absolute',
              top: -8,
              left: Math.max(16, Math.min(placement.arrowOffset, 288)),
              width: 16,
              height: 16,
              bgcolor: 'primary.main',
              transform: 'rotate(45deg)',
            }}
          />
        )}

        <IconButton
          aria-label="Close"
          size="small"
          onClick={onClose}
          sx={{ position: 'absolute', top: 8, right: 8, color: 'rgba(255,255,255,0.75)' }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        <Typography variant="overline" sx={{ opacity: 0.85, letterSpacing: 1 }}>
          Step {step + 1} of {STEPS.length}
        </Typography>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 0.5, mb: 1 }}>
          {current.title}
        </Typography>
        <Typography variant="body2" sx={{ mb: 2.5, opacity: 0.95 }}>
          {current.body}
        </Typography>

        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Link
            component="button"
            type="button"
            underline="hover"
            onClick={onClose}
            sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}
          >
            Hide these tips
          </Link>
          <Button
            variant="contained"
            size="small"
            disableElevation
            onClick={handleNext}
            sx={{ bgcolor: '#fff', color: 'primary.main', '&:hover': { bgcolor: '#f0f0f0' } }}
          >
            {isLast ? 'Done' : 'Next'}
          </Button>
        </Stack>
      </Paper>
    </>
  );
}
