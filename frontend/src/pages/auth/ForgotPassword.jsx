import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BACKEND_URL } from '../../constants/apiConfig';
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

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Once submitted we show a confirmation screen instead of the form, since the
  // backend response is intentionally generic (found or not, same message).
  const [submitted, setSubmitted] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Please enter your email');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/users/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Something went wrong');
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-4 font-sans relative transition-colors duration-300">
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2 text-content-muted hover:text-content hover:bg-hover rounded-full transition-colors cursor-pointer"
        title="Toggle theme"
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="mb-3"><LogoIcon /></div>
          <h1 className="text-content text-2xl font-bold tracking-tight">CollabBoard</h1>
          <p className="text-content-muted text-sm mt-1">Real-time collaborative Workspace</p>
        </div>

        <div className="bg-surface border border-edge rounded-2xl p-6 shadow-xl transition-colors duration-300">
          {submitted ? (
            <div className="text-center">
              <h2 className="text-content font-semibold text-lg mb-2">Check your email</h2>
              <p className="text-content-muted text-sm mb-5">
                If an account exists for <strong className="text-content">{email}</strong>, we've
                sent a link to reset your password. The link expires in 15 minutes.
              </p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-content font-semibold text-lg mb-1 text-center">Forgot password?</h2>
              <p className="text-content-muted text-sm mb-5 text-center">
                Enter your email and we'll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div>
                  <label className="text-content-muted text-xs mb-1 block font-medium">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-muted text-content text-sm px-3 py-2.5 rounded-xl border border-edge outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-content-subtle"
                    placeholder="you@example.com"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm px-3 py-2 rounded-lg rb-anim-fade">
                    <span>⚠</span> {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-muted text-white font-medium text-sm rounded-xl transition-all mt-1 flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:shadow-none cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading && <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />}
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <p className="text-center text-content-muted text-sm mt-5">
                Remembered it?{' '}
                <button type="button" onClick={() => navigate('/login')} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors cursor-pointer">Back to sign in</button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
