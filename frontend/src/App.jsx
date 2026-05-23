import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { Toaster } from 'react-hot-toast';

import Register from './Components/AuthPages/Register.jsx';
import Login from './Components/AuthPages/Login.jsx';
import Dashboard from './Components/Dashboard/dashboard.jsx';
import { BACKEND_URL } from './constants/apiConfig.js';
import Profile from './Components/Profile/Profile.jsx';
import WhiteboardRoom from './Components/Whiteboard/WhiteboardRoom.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';

// Logout function
const logout = () => {
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

// Function to schedule token renewal
const scheduleTokenRenewal = (token) => {
  try {
    const decoded = jwtDecode(token);
    const currentTime = Date.now() / 1000;
    const expiryTime = decoded.exp;
    const timeUntilRenewal = (expiryTime - currentTime - 180) * 1000; // renew 3 mins before expiry
    
    if (timeUntilRenewal <= 0) {
      logout();
      return;
    }
    
    setTimeout(async () => {
      try {
        const currentToken = localStorage.getItem('token');
        const response = await fetch(`${BACKEND_URL}/users/renew-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`,
          },
        });
        
        if (!response.ok) {
          throw new Error('Token renewal failed');
        }
        
        const data = await response.json();
        if (data.token) {
          localStorage.setItem('token', data.token);
          scheduleTokenRenewal(data.token);
        } else {
          throw new Error('No token in renewal response');
        }
      } catch (error) {
        console.error('Error renewing token:', error);
        logout();
      }
    }, timeUntilRenewal);
  } catch (err) {
    console.error('Invalid token:', err);
    logout();
  }
};

function App() {
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      scheduleTokenRenewal(token);
    }
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
              <WhiteboardRoom />
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
          className: 'dark:bg-[#1e293b] dark:text-[#f1f5f9] bg-white text-gray-900 border border-gray-200 dark:border-white/10 shadow-lg',
          style: {
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
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