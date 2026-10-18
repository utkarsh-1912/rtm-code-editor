import React from 'react';
import Loader from './ux/Loader';

// Full-viewport loader for whole pages.
const SpaceLoader = ({ message = "Loading your workspace" }) => <Loader variant="screen" message={message} />;

export default SpaceLoader;
