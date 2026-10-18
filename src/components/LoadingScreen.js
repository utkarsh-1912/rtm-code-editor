import React from "react";
import Loader from "./ux/Loader";

// Fills the room body while the socket connects.
export default function LoadingScreen({ message = "Connecting to the room" }) {
    return <Loader variant="fill" message={message} detail="Syncing code, chat and people" />;
}
