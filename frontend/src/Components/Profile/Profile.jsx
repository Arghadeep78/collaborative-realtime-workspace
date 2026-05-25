import { useState, useEffect } from 'react';
import { User, Lock, Edit3, Save, X, Camera, Loader, Home, Sun, Moon } from 'lucide-react';
import { BACKEND_URL } from '../../constants/apiConfig';
import toast from 'react-hot-toast';
import Loading from '../Loading/Loading.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';


const Profile = () => {
    const { isDark, toggleTheme } = useTheme();
    const [userData, setUserData] = useState({ name: '', profilePic: '', authProvider: 'local' });
    const [editedData, setEditedData] = useState({ name: '', profilePic: '' });
    const isGoogleUser = userData.authProvider === 'google';
    const [isEditing, setIsEditing] = useState(false);
    
    // State for password change
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');

    // State for API calls
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);

    const syncStoredUser = (data) => {
        const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
        const nextUser = {
            ...currentUser,
            ...data,
            profilePic: data.profilePic ?? data.profilePicture ?? currentUser.profilePic ?? currentUser.profilePicture ?? '',
            profilePicture: data.profilePicture ?? data.profilePic ?? currentUser.profilePicture ?? currentUser.profilePic ?? '',
        };
        localStorage.setItem('userData', JSON.stringify(nextUser));
    };

    // Fetch user profile on component mount
    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${BACKEND_URL}/users/profile`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }); 
                if (!response.ok) {
                    throw new Error('Failed to fetch user profile.');
                }
                const data = await response.json();
                const normalizedData = {
                    ...data,
                    profilePic: data.profilePic ?? data.profilePicture ?? '',
                    authProvider: data.authProvider || 'local',
                };
                setUserData(normalizedData);
                setEditedData(normalizedData);
                syncStoredUser(normalizedData);
            } catch (err) {
                setError(err.message);
                const dummyData = { name: 'Unknown User', profilePic: '' };
                setUserData(dummyData);
                setEditedData(dummyData);
            } finally {
                setLoading(false);
            }
        };

        fetchUserProfile();
    }, []);

    const handleEditToggle = () => {
        if (isEditing) {
            setEditedData({ ...userData });
        }
        setIsEditing(!isEditing);
    };
    
    const handleGoHome = () => {
        window.location.href = '/dashboard';
    };

    const handleInputChange = (field, value) => {
        setEditedData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSave = async () => {
        setIsUpdating(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${BACKEND_URL}/users/profile`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: editedData.name, profilePicture: editedData.profilePicture ?? editedData.profilePic }),
            });

            if (!response.ok) {
                throw new Error('Failed to update profile.');
            }

            const updatedUser = await response.json();
            const normalizedUser = {
                ...updatedUser.user,
                profilePicture: updatedUser.user.profilePicture ?? '',
            };
            setUserData(normalizedUser);
            setEditedData(normalizedUser);
            syncStoredUser(normalizedUser);
            setIsEditing(false);
            toast.success('Profile updated successfully!');

        } catch (err) {
            setError(err.message);
            toast.error(err.message);
            setEditedData({ ...userData });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleProfilePicChange = async (event) => {
        const file = event.target.files[0];
        const token = localStorage.getItem('token');
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            setEditedData(prev => ({ ...prev, profilePic: e.target.result }));
        };
        reader.readAsDataURL(file);

        try {
            const formData = new FormData();
            formData.append('image', file);

            const response = await fetch(`${BACKEND_URL}/users/profile/picture`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to upload profile picture.');
            }

            const data = await response.json();
            handleInputChange('profilePic', data.url);
            syncStoredUser({ profilePic: data.url });
            toast.success('Profile picture updated!');
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            toast.error(error.message);
            setEditedData(prev => ({ ...prev, profilePic: userData.profilePic }));
        }
    };

    const handleUpdatePassword = async () => {
        if (!oldPassword || !newPassword) {
            setPasswordError("Both fields are required.");
            return;
        }
        if (newPassword.length < 8) {
            setPasswordError("New password must be at least 8 characters long.");
            return;
        }
        if( oldPassword === newPassword) {
            toast.error("New password cannot be the same as old password.");
            return;
        }
        
        setIsUpdating(true);
        setPasswordError('');
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${BACKEND_URL}/users/profile/password`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ oldPassword, newPassword }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update password.');
            }
            
            toast.success("Password updated successfully.");
            setOldPassword('');
            setNewPassword('');
            setIsChangingPassword(false);

        } catch(err) {
            setPasswordError(err.message);
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading) {
        return <Loading message="Loading profile…" />;
    }
    
    if (error && !userData.name) {
        return (
            <div className="h-full min-h-full overflow-auto flex items-center justify-center bg-gray-50 dark:bg-[#212121]">
                <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl p-8 text-red-600 dark:text-red-400">{error}</div>
            </div>
        );
    }

    return (
        <div className="h-full min-h-full overflow-auto flex items-center justify-center bg-gray-50 dark:bg-[#212121] font-sans p-6">
            <div className="w-full max-w-lg bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden">
                {error && <p className="bg-red-50 dark:bg-red-500/10 border-b border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm px-6 py-3">{error}</p>}

                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-gray-100 dark:border-white/[0.07]">
                    <div className="flex items-center gap-4 min-w-0">
                        {/* Avatar */}
                        <div className="relative group">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden border-2 border-gray-200 dark:border-white/15 shadow-sm">
                                {(isEditing ? editedData.profilePic : userData.profilePic) ? (
                                    <img
                                        src={isEditing ? editedData.profilePic : userData.profilePic}
                                        alt="Profile"
                                        className="w-full h-full object-cover"
                                        crossOrigin="anonymous"
                                        onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = `<span class="text-white text-2xl font-bold">${userData.name?.[0]?.toUpperCase() || 'U'}</span>`; }}
                                    />
                                ) : (
                                    <span className="text-white text-2xl font-bold">{userData.name?.[0]?.toUpperCase() || 'U'}</span>
                                )}
                            </div>
                            {isEditing && (
                                <button
                                    onClick={() => !isUpdating && document.getElementById('profile-pic-input').click()}
                                    className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                                >
                                    <Camera size={20} className="text-white" />
                                </button>
                            )}
                            <input
                                id="profile-pic-input"
                                type="file"
                                accept="image/*"
                                onChange={handleProfilePicChange}
                                className="hidden"
                                disabled={!isEditing || isUpdating}
                            />
                        </div>
                        <div>
                            <h1 className="text-base font-semibold text-gray-900 dark:text-white">{userData.name || 'User'}</h1>
                            <p className="text-gray-500 dark:text-white/40 text-xs mt-0.5">
                                {isGoogleUser ? 'Signed in with Google' : 'Manage your account'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleTheme}
                            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/10 rounded-full transition-colors"
                            title="Toggle theme"
                        >
                            {isDark ? <Sun size={16} /> : <Moon size={16} />}
                        </button>
                        <button onClick={handleGoHome} disabled={isUpdating}
                            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/4 dark:hover:bg-white/[0.07] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 dark:hover:text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
                            <Home size={14} />
                            Home
                        </button>
                        {!isEditing ? (
                            <button onClick={handleEditToggle}
                                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors">
                                <Edit3 size={14} />
                                Edit
                            </button>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <button onClick={handleSave} disabled={isUpdating}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
                                    {isUpdating ? <Loader className="animate-spin" size={14} /> : <Save size={14} />}
                                    {isUpdating ? 'Saving…' : 'Save'}
                                </button>
                                <button onClick={handleEditToggle} disabled={isUpdating}
                                    className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/4 dark:hover:bg-white/[0.07] text-gray-500 dark:text-white/40 dark:hover:text-white rounded-lg transition-colors disabled:opacity-50">
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-6 flex flex-col gap-5">
                    {/* Name field */}
                    <div className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-2 text-gray-500 dark:text-white/40 text-xs font-medium">
                            <User size={13} />
                            Full Name
                        </label>
                        {!isEditing ? (
                            <div className="bg-gray-50 dark:bg-white/4 text-gray-900 dark:text-white text-sm px-4 py-3 rounded-lg border border-gray-200 dark:border-white/[0.07]">{userData.name}</div>
                        ) : (
                            <input
                                type="text"
                                value={editedData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                className="bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white text-sm px-4 py-3 rounded-lg border border-gray-200 dark:border-white/10 outline-none focus:border-indigo-500 dark:focus:border-white/25 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-0 transition-all placeholder:text-gray-400 dark:placeholder:text-white/25"
                                placeholder="Enter your full name"
                                disabled={isUpdating}
                            />
                        )}
                    </div>

                    {/* Password section — hidden for Google users */}
                    {!isGoogleUser && (
                        <div className="flex flex-col gap-1.5">
                            <label className="flex items-center gap-2 text-gray-500 dark:text-white/40 text-xs font-medium">
                                <Lock size={13} />
                                Password
                            </label>
                            {!isChangingPassword ? (
                                <button onClick={() => setIsChangingPassword(true)}
                                    className="self-start px-4 py-2.5 bg-gray-50 hover:bg-gray-100 dark:bg-white/4 dark:hover:bg-white/[0.07] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 dark:hover:text-white text-sm font-medium rounded-lg transition-colors">
                                    Change Password
                                </button>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <input
                                        type="password"
                                        value={oldPassword}
                                        onChange={(e) => setOldPassword(e.target.value)}
                                        className="bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white text-sm px-4 py-3 rounded-lg border border-gray-200 dark:border-white/10 outline-none focus:border-indigo-500 dark:focus:border-white/25 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-0 transition-all placeholder:text-gray-400 dark:placeholder:text-white/25"
                                        placeholder="Current password"
                                        disabled={isUpdating}
                                    />
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white text-sm px-4 py-3 rounded-lg border border-gray-200 dark:border-white/10 outline-none focus:border-indigo-500 dark:focus:border-white/25 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-0 transition-all placeholder:text-gray-400 dark:placeholder:text-white/25"
                                        placeholder="New password (min 8 chars)"
                                        disabled={isUpdating}
                                    />
                                    {passwordError && <p className="text-red-500 dark:text-red-400 text-xs">{passwordError}</p>}
                                    <div className="flex items-center gap-2">
                                        <button onClick={handleUpdatePassword} disabled={isUpdating}
                                            className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                                            {isUpdating ? <Loader className="animate-spin" size={14}/> : 'Update Password'}
                                        </button>
                                        <button onClick={() => {
                                            setIsChangingPassword(false);
                                            setPasswordError('');
                                            setOldPassword('');
                                            setNewPassword('');
                                        }} disabled={isUpdating}
                                            className="px-4 py-2.5 bg-gray-50 hover:bg-gray-100 dark:bg-white/4 dark:hover:bg-white/[0.07] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Profile;
