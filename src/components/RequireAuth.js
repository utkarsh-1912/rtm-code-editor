import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SpaceLoader from "./SpaceLoader";

// Pages that belong to an account (workspace, snippets, settings). Guests are sent to sign in
// and come back here afterwards. `allowGuest` lets a page handle guests itself.
export default function RequireAuth({ children, allowGuest = false }) {
    const { user, loading } = useAuth();
    const location = useLocation();
    if (loading) return <SpaceLoader />;
    if (!user && !allowGuest) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
    return children;
}
