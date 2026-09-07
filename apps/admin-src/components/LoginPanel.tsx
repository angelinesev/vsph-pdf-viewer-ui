import { useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { callApi } from '../../shared/api';
import logoUrl from '../../shared/VS-Logo.png';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

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
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin() {
    setError('');
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
      setError(err.message + ' — contact an existing admin to be added to platform_admins.');
      setSigningIn(false);
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
        <Stack direction="row" alignItems="center" justifyContent="center" sx={{ mb: 2 }}>
          <Box
            component="img"
            src={logoUrl}
            alt="Visual Studios"
            sx={{
              display: 'block',
              width: 'min(100%, 230px)',
              height: 'auto',
            }}
          />
        </Stack>

        <Typography variant="h4" fontWeight={600} textAlign="center" gutterBottom>
          Sign in
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
          Manage the VSPH plan, organizations, and client access codes.
        </Typography>

        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}
        >
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
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          title={showPassword ? 'Hide password' : 'Show password'}
                          onClick={() => setShowPassword((v) => !v)}
                          edge="end"
                          size="small"
                        >
                          {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>
            <Button type="submit" variant="contained" disableElevation disabled={signingIn}>
              {signingIn ? 'Signing in…' : 'Sign in'}
            </Button>

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
