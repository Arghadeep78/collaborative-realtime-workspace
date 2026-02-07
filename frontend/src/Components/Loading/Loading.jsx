// Components/Loading/Loading.jsx
import React from 'react';

const Loading = ({ message = "Loading..." }) => {
  return (
    <div className="h-full min-h-full overflow-auto flex flex-col items-center justify-center bg-gray-950 text-white font-sans gap-4">
      <div className="relative">
        <div className="w-14 h-14 border-4 border-gray-800 rounded-full" />
        <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin absolute inset-0" />
      </div>
      <p className="text-gray-400 text-sm font-medium">{message}</p>
    </div>
  );
};

export default Loading;