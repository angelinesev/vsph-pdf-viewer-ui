import { useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { callApi } from '../../shared/api';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Link from '@mui/material/Link';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface LoginPanelProps {
  supabase: SupabaseClient;
  onLogin: (jwt: string) => void;
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <Typography
      component="label"
      htmlFor={htmlFor}
      variant="body2"
      fontWeight={500}
      color="text.primary"
      sx={{ display: 'block', mb: 0.75 }}
    >
      {children}
    </Typography>
  );
}

export default function LoginPanel({ supabase, onLogin }: LoginPanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);

  async function handleLogin() {
    setError('');
    setOk('');
    setSigningIn(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setError(authError.message);
      setSigningIn(false);
      return;
    }
    const jwt = data.session!.access_token;
    try {
      await callApi('admin-me', { adminJwt: jwt });
      onLogin(jwt);
    } catch (err: any) {
      setError(err.message + ' — use Bootstrap or add user to platform_admins.');
      setSigningIn(false);
    }
  }

  async function handleBootstrap() {
    setError('');
    setOk('');
    setBootstrapping(true);
    try {
      await callApi('admin-bootstrap', {
        method: 'POST',
        body: { email: email.trim(), password, bootstrap_secret: bootstrapSecret },
      });
      setOk('Admin created. Click Sign in.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBootstrapping(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: { xs: 2.5, sm: 4 },
        bgcolor: 'background.default',
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          width: '100%',
          maxWidth: 450,
          p: 4,
          borderRadius: 1,
          boxShadow: '0 5px 15px rgba(9, 11, 17, 0.05), 0 15px 35px -5px rgba(19, 23, 32, 0.05)',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.85rem',
              bgcolor: 'primary.main',
              flexShrink: 0,
            }}
          >
            V
          </Box>
          <Typography variant="subtitle1" fontWeight={700} color="primary.main">
            Admin portal
          </Typography>
        </Stack>

        <Typography variant="h4" fontWeight={600} gutterBottom>
          Sign in
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Manage the VSPH plan, organizations, and client access codes.
        </Typography>

        <Stack spacing={2}>
          <Box>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <TextField
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
            />
          </Box>
          <Box>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <TextField
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
            />
          </Box>
          <Button variant="contained" onClick={handleLogin} disabled={signingIn}>
            {signingIn ? 'Signing in…' : 'Sign in'}
          </Button>

          {(error || ok) && <Alert severity={ok ? 'success' : 'error'}>{ok || error}</Alert>}

          <Accordion
            disableGutters
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', '&::before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" fontWeight={500}>
                First-time setup
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <Box>
                  <FieldLabel htmlFor="bootstrapSecret">Bootstrap secret</FieldLabel>
                  <TextField
                    id="bootstrapSecret"
                    type="password"
                    placeholder="BOOTSTRAP_SECRET"
                    value={bootstrapSecret}
                    onChange={(e) => setBootstrapSecret(e.target.value)}
                    fullWidth
                  />
                </Box>
                <Button variant="outlined" color="inherit" onClick={handleBootstrap} disabled={bootstrapping}>
                  {bootstrapping ? 'Creating…' : 'Create first admin'}
                </Button>
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            <Link href="/" underline="hover">
              Back to home
            </Link>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
