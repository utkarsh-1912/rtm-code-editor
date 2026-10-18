import React from 'react';
import Loader from './ux/Loader';

// Inline loader (kept as a thin wrapper so existing imports keep working).
const LogoLoader = ({ message = "Loading", detail }) => <Loader variant="inline" message={message || "Loading"} detail={detail} />;

export default LogoLoader;
