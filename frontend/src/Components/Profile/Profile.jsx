import React, { useState, useEffect } from 'react';
import { User, Lock, Edit3, Save, X, Camera, Loader, Home } from 'lucide-react';
import { BACKEND_URL } from '../../constants/apiConfig';
import toast from 'react-hot-toast';
import Loading from '../Loading/Loading.jsx';


const Profile = () => {
    const [userData, setUserData] = useState({ name: '', profilePic: '' });
    const [editedData, setEditedData] = useState({ name: '', profilePic: '' });
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
                body: JSON.stringify({ name: editedData.name, profilePic: editedData.profilePic }),
            });

            if (!response.ok) {
                throw new Error('Failed to update profile.');
            }

            const updatedUser = await response.json();
            const normalizedUser = {
                ...updatedUser.user,
                profilePic: updatedUser.user.profilePic ?? updatedUser.user.profilePicture ?? '',
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
            <div className="h-full min-h-full overflow-auto flex items-center justify-center bg-gray-950 text-white">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-red-400">{error}</div>
            </div>
        );
    }

    return (
        <div className="h-full min-h-full overflow-auto flex items-center justify-center bg-gray-950 text-white font-sans p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black">
            <div className="w-full max-w-lg bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden">
                {error && <p className="bg-red-900/30 border-b border-red-800 text-red-400 text-sm px-6 py-3">{error}</p>}
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800/50">
                    <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className="relative group">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center overflow-hidden border-2 border-gray-800 shadow-lg shadow-indigo-500/20">
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
                                    className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
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
                            <h1 className="text-lg font-bold text-white">{userData.name || 'User'}</h1>
                            <p className="text-gray-500 text-xs mt-0.5">Manage your account</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={handleGoHome} disabled={isUpdating}
                            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-xs font-medium rounded-xl transition-colors disabled:opacity-50">
                            <Home size={14} />
                            Home
                        </button>
                        {!isEditing ? (
                            <button onClick={handleEditToggle}
                                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl transition-colors">
                                <Edit3 size={14} />
                                Edit
                            </button>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <button onClick={handleSave} disabled={isUpdating}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-xl transition-colors disabled:opacity-50">
                                    {isUpdating ? <Loader className="animate-spin" size={14} /> : <Save size={14} />}
                                    {isUpdating ? 'Saving…' : 'Save'}
                                </button>
                                <button onClick={handleEditToggle} disabled={isUpdating}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-xl transition-colors disabled:opacity-50">
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
                        <label className="flex items-center gap-2 text-gray-400 text-xs font-medium">
                            <User size={14} />
                            Full Name
                        </label>
                        {!isEditing ? (
                            <div className="bg-gray-800/50 text-white text-sm px-4 py-3 rounded-xl border border-gray-700/50">{userData.name}</div>
                        ) : (
                            <input
                                type="text"
                                value={editedData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                className="bg-gray-800/50 text-white text-sm px-4 py-3 rounded-xl border border-gray-700/80 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                placeholder="Enter your full name"
                                disabled={isUpdating}
                            />
                        )}
                    </div>

                    {/* Password section */}
                    <div className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-2 text-gray-400 text-xs font-medium">
                            <Lock size={14} />
                            Password
                        </label>
                        {!isChangingPassword ? (
                            <button onClick={() => setIsChangingPassword(true)}
                                className="self-start px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors">
                                Change Password
                            </button>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <input
                                    type="password"
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    className="bg-gray-800/50 text-white text-sm px-4 py-3 rounded-xl border border-gray-700/80 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                    placeholder="Old Password"
                                    disabled={isUpdating}
                                />
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="bg-gray-800/50 text-white text-sm px-4 py-3 rounded-xl border border-gray-700/80 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                    placeholder="New Password"
                                    disabled={isUpdating}
                                />
                                {passwordError && <p className="text-red-400 text-xs">{passwordError}</p>}
                                <div className="flex items-center gap-2">
                                    <button onClick={handleUpdatePassword} disabled={isUpdating}
                                        className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
                                        {isUpdating ? <Loader className="animate-spin" size={14}/> : 'Update Password'}
                                    </button>
                                    <button onClick={() => {
                                        setIsChangingPassword(false);
                                        setPasswordError('');
                                        setOldPassword('');
                                        setNewPassword('');
                                    }} disabled={isUpdating}
                                        className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
