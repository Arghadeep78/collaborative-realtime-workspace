import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { Toaster } from 'react-hot-toast';

import Register from './pages/auth/Register.jsx';
import Login from './pages/auth/Login.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import ResetPassword from './pages/auth/ResetPassword.jsx';
import Dashboard from './pages/dashboard/Dashboard.jsx';
import { BACKEND_URL } from './constants/apiConfig.js';
import Profile from './pages/profile/Profile.jsx';
import BoardRoom from './pages/board/BoardRoom.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { primePhotoCache } from './hooks/usePhotoResolver.js';

// Seed the photo cache from localStorage so the current user's avatar is
// available immediately on every page without waiting for a network fetch.
(() => {
  try {
    const u = JSON.parse(localStorage.getItem('userData') || '{}');
    if (u.email && (u.profilePicture || u.profilePic)) {
      primePhotoCache({ [u.email]: u.profilePicture || u.profilePic });
    }
  } catch { /* ignore */ }
})();

// Logout function
const logout = () => {
  // Revoke the server-side refresh token (clears the httpOnly cookie too).
  // Fire-and-forget — local state is cleared regardless of the result so the
  // user is never stuck logged in if the request fails.
  fetch(`${BACKEND_URL}/users/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => { /* ignore — clear local state anyway */ });

  localStorage.removeItem('token');
  localStorage.removeItem('userData');
  window.location.href = '/';
};

// Protected route component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/auth" replace />;
  }
  
  try {
    const decoded = jwtDecode(token);
    const currentTime = Date.now() / 1000;
    
    if (decoded.exp < currentTime) {
      logout(); // Token expired
      return null;
    }
  } catch {
    logout(); // Invalid token
    return null;
  }
  
  return children;
};

// Public route component (redirects to dashboard if already logged in)
const PublicRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  
  if (token) {
    try {
      const decoded = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      if (decoded.exp >= currentTime) {
        return <Navigate to="/dashboard" replace />;
      }
    } catch {
      // Invalid token, allow access to public route
    }
  }
  
  return children;
};

function App() {
  const renewalTimerRef = useRef(null);

  useEffect(() => {
    const scheduleTokenRenewal = (token) => {
      try {
        const decoded = jwtDecode(token);
        const currentTime = Date.now() / 1000;
        const timeUntilRenewal = (decoded.exp - currentTime - 180) * 1000; // renew 3 mins before expiry

        if (timeUntilRenewal <= 0) { logout(); return; }

        // Retry renewal after a short delay on transient failures (e.g. backend
        // restarting / offline) instead of logging the user out immediately.
        const retryRenewal = (token) => {
          clearTimeout(renewalTimerRef.current);
          renewalTimerRef.current = setTimeout(() => scheduleTokenRenewal(token), 15000);
        };

        clearTimeout(renewalTimerRef.current);
        renewalTimerRef.current = setTimeout(async () => {
          const currentToken = localStorage.getItem('token');
          let response;
          try {
            // The refresh token rides in an httpOnly cookie — credentials:'include'
            // sends it. No Authorization header: the access token is irrelevant here.
            response = await fetch(`${BACKEND_URL}/users/refresh`, {
              method: 'POST',
              credentials: 'include',
            });
          } catch (error) {
            // Network error (backend down / restarting) — don't log out, retry.
            console.warn('Token refresh request failed, will retry:', error);
            retryRenewal(currentToken);
            return;
          }

          // Only an explicit auth rejection means the session is truly invalid.
          if (response.status === 401 || response.status === 403) {
            logout();
            return;
          }

          if (!response.ok) {
            // Server error (5xx etc.) — treat as transient and retry.
            console.warn('Token renewal returned', response.status, '— will retry');
            retryRenewal(currentToken);
            return;
          }

          try {
            const { data } = await response.json();
            if (data?.token) {
              localStorage.setItem('token', data.token);
              scheduleTokenRenewal(data.token);
            } else {
              throw new Error('No token in renewal response');
            }
          } catch (error) {
            console.warn('Token renewal response invalid, will retry:', error);
            retryRenewal(currentToken);
          }
        }, timeUntilRenewal);
      } catch (err) {
        console.error('Invalid token:', err);
        logout();
      }
    };

    const token = localStorage.getItem('token');
    if (token) scheduleTokenRenewal(token);

    return () => clearTimeout(renewalTimerRef.current);
  }, []);

  return (
    <ThemeProvider>
      <BrowserRouter>
      <Routes>
        {/* Default route redirects to auth or dashboard */}
        <Route path="/" element={
          <PublicRoute>
            <Navigate to="/login" replace />
          </PublicRoute>
        } />
        
        {/* Auth page route */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register/></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword/></PublicRoute>} />
        <Route path="/reset-password/:token" element={<PublicRoute><ResetPassword/></PublicRoute>} />

        {/* Protected dashboard route */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard logout={logout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile/>
            </ProtectedRoute>
          }
        />
        {/* Protected board route */}
        <Route
          path="/board/:id"
          element={
            <ProtectedRoute>
              <BoardRoom />
            </ProtectedRoute>
          }
        />
        
        <Route path="*" element={
          localStorage.getItem('token') ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        } />
      </Routes>
      
      {/* Single source of truth for all toast styling across the app */}
      <Toaster
        position="top-center"
        gutter={8}
        toastOptions={{
          duration: 3000,
          className: 'bg-surface text-content border border-edge shadow-lg',
          style: {
            fontFamily: '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            fontSize: '14px',
            fontWeight: 500,
            padding: '10px 14px',
            borderRadius: '10px',
            maxWidth: '420px',
          },
          success: {
            duration: 2500,
            iconTheme: { primary: '#10b981', secondary: 'currentColor' },
          },
          error: {
            duration: 4000,
            iconTheme: { primary: '#ef4444', secondary: 'currentColor' },
          },
          loading: {
            iconTheme: { primary: '#6366f1', secondary: 'currentColor' },
          },
        }}
      />
    </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;