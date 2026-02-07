// components/StatusComponents.jsx
import React from 'react';
import { Save, CheckCircle, AlertCircle, Users, Wifi, WifiOff } from 'lucide-react';

export const SaveStatusIndicator = ({ saveStatus, lastSaved, lastUpdatedBy, handleManualSave }) => {
  if (saveStatus === 'saving') {
    return (
      <div className="save-status saving">
        <Save size={16} className="animate-spin" />
        <span>Saving...</span>
      </div>
    );
  } else if (saveStatus === 'saved') {
    return (
      <div className="save-status saved">
        <CheckCircle size={16} />
        <span>Saved {lastSaved && `at ${lastSaved.toLocaleTimeString()}`}</span>
        {/* {lastUpdatedBy && (
          <span className="update-indicator">
            (Updated by {lastUpdatedBy})
          </span>
        )} */}
      </div>
    );
  } else if (saveStatus === 'error') {
    return (
      <div className="save-status error" onClick={handleManualSave} style={{ cursor: 'pointer' }}>
        <AlertCircle size={16} />
        <span>Save failed - Click to retry</span>
      </div>
    );
  }
  return null;
};

export const ConnectionStatusIndicator = ({ isConnected }) => {
  return (
    <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
      {isConnected ? (
        <>
          <Wifi size={16} />
          <span>Online</span>
        </>
      ) : (
        <>
          <WifiOff size={16} />
          <span>Offline</span>
        </>
      )}
    </div>
  );
};

export const ConnectedUsersIndicator = ({ isConnected, connectedUsers }) => {
  // console.log('Connected Users:', connectedUsers);
  if (!isConnected || connectedUsers.length === 0) return null;
  
  return (
    <div className="connected-users">
      <Users size={16} />
      <span>{connectedUsers.length} user{connectedUsers.length !== 1 ? 's' : ''} online</span>
    </div>
  );
};