import { useState } from 'react';
import { callApi } from '../../shared/api';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

interface LoginPanelProps {
  onLogin: (token: string, rememberMe: boolean) => void;
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
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

export default function LoginPanel({ onLogin }: LoginPanelProps) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  async function handleLogin() {
    setError('');
    setLoggingIn(true);
    try {
      const data = await callApi<{ token: string }>('developer-login', {
        method: 'POST',
        body: { code, password },
      });
      onLogin(data.token, rememberMe);
    } catch (err: any) {
      setError(err.message);
      setLoggingIn(false);
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
            Client portal
          </Typography>
        </Stack>

        <Typography variant="h4" fontWeight={600} gutterBottom>
          Sign in
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Use the access code provided by your admin
        </Typography>

        <Stack spacing={2}>
          <Box>
            <FieldLabel htmlFor="code">Access codes</FieldLabel>
            <TextField
              id="code"
              autoComplete="username"
              placeholder="ORG-CODE"
              value={code}
              onChange={(e) => setCode(e.target.value)}
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
          
          <Button
            variant="contained" disableElevation
            onClick={handleLogin}
            disabled={loggingIn}
            startIcon={loggingIn ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {loggingIn ? 'Signing in…' : 'Sign in'}
          </Button>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </Paper>
    </Box>
  );
}
