import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { BACKEND_URL, GOOGLE_CLIENT_ID } from '../../constants/apiConfig';
import { useTheme } from '../../contexts/ThemeContext.jsx';

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
);
const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
);
const LogoIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 4H9L12 20H8L5 4Z" fill="#F59E0B"/>
    <path d="M11 4H15L18 20H14L11 4Z" fill="#F97316"/>
    <path d="M17 4H21L24 20H20L17 4Z" fill="#EA580C"/>
  </svg>
);

const Register = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  // Handle the credential JWT that Google sends back
  const handleGoogleResponse = useCallback(async (response) => {
    setGoogleLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/users/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Google login failed');
      localStorage.setItem('token', data.token);
      localStorage.setItem('userData', JSON.stringify({
        ...(data.user || {}),
        profilePic: data.user?.profilePic ?? data.user?.profilePicture ?? '',
        profilePicture: data.user?.profilePicture ?? data.user?.profilePic ?? '',
      }));
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }, [navigate]);

  // Load Google GSI script and initialise once
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const scriptId = 'google-gsi-script';
    if (document.getElementById(scriptId)) {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleResponse });
        setGsiReady(true);
      }
      return;
    }
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleResponse });
      setGsiReady(true);
    };
    document.head.appendChild(script);
  }, [handleGoogleResponse]);

  const handleGoogleSignIn = () => {
    if (!window.google?.accounts?.id) {
      setError('Google Sign-In is not ready yet. Please try again.');
      return;
    }
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        const container = document.getElementById('g_id_hidden_container_reg');
        if (container) {
          window.google.accounts.id.renderButton(container, { theme: 'outline', size: 'large', width: 400 });
          const btn = container.querySelector('div[role="button"]');
          if (btn) btn.click();
        }
      }
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
  
    try {
      if (!formData.name || !formData.email || !formData.password) {
        setError('Please fill in all fields');
        setLoading(false);
        return;
      }
      
      const response = await fetch(`${BACKEND_URL}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name, 
          email: formData.email, 
          password: formData.password, 
          role: formData.role 
        }),
      });
  
      const data = await response.json();
      console.log('Response data:', data);
      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }
  
      if (!data.token) {
        throw new Error('No authentication token received');
      }

      // Save token and user profile data
      localStorage.setItem('token', data.token);
      localStorage.setItem('userData', JSON.stringify({
        ...(data.user || { name: formData.name, email: formData.email }),
        profilePic: data.user?.profilePic ?? data.user?.profilePicture ?? '',
        profilePicture: data.user?.profilePicture ?? data.user?.profilePic ?? '',
      }));
  
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to register. Please try again.');
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  const navigateToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#212121] flex items-center justify-center p-4 font-sans relative transition-colors duration-300">
      {/* Theme Toggle */}
      <button 
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 rounded-full transition-colors"
        title="Toggle theme"
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="mb-3"><LogoIcon /></div>
          <h1 className="text-gray-900 dark:text-white text-2xl font-bold tracking-tight">CollabBoard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Real-time collaborative whiteboards</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xl transition-colors duration-300">
          <h2 className="text-gray-900 dark:text-white font-semibold text-lg mb-5 text-center">Sign up</h2>

          {/* Google OAuth button */}
          <button
            id="google-signup-btn"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || !gsiReady}
            className="w-full flex items-center justify-center gap-3 py-2.5 bg-white border border-gray-200 dark:border-transparent dark:bg-white hover:bg-gray-50 dark:hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed text-gray-800 font-medium text-sm rounded-xl transition-colors mb-4"
          >
            {googleLoading ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {googleLoading ? 'Signing in…' : 'Continue with Google'}
          </button>
          {/* Hidden container for GSI rendered button fallback */}
          <div id="g_id_hidden_container_reg" style={{ display: 'none' }} />

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
            <span className="text-gray-400 dark:text-gray-600 text-xs">or</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="text-gray-600 dark:text-gray-400 text-xs mb-1 block font-medium">Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-400"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="text-gray-600 dark:text-gray-400 text-xs mb-1 block font-medium">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-400"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-gray-600 dark:text-gray-400 text-xs mb-1 block font-medium">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all pr-10 placeholder:text-gray-400"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm px-3 py-2 rounded-lg rb-anim-fade">
                <span>⚠</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-medium text-sm rounded-xl transition-all mt-1 flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:shadow-none"
            >
              {loading && <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Signing up…' : 'Sign up'}
            </button>
          </form>

          <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-5">
            Already have an account?{' '}
            <button type="button" onClick={navigateToLogin} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors">Sign in</button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;