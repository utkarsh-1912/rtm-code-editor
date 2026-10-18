import React, { useState } from "react";

const COLORS = ["#5B8DEF", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#06B6D4", "#F43F5E", "#6366F1"];

export const colorFor = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
};

// Round avatar: the person's photo when we have one, coloured initials otherwise.
export function Avatar({ name = "", photoURL, size = 32, isCurrentUser = false, title }) {
  const [broken, setBroken] = useState(false);
  const initials = name ? name.trim().slice(0, 2).toUpperCase() : "??";
  return (
    <span
      className={`u-av${isCurrentUser ? " u-av--me" : ""}`}
      title={title ?? `${name}${isCurrentUser ? " (you)" : ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: colorFor(name) }}
    >
      {photoURL && !broken
        ? <img src={photoURL} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        : initials}
    </span>
  );
}

function Client({ userName, photoURL, isCompact, isCurrentUser }) {
  if (isCompact) return <Avatar name={userName} photoURL={photoURL} isCurrentUser={isCurrentUser} />;
  return (
    <div className="ws-person">
      <Avatar name={userName} photoURL={photoURL} size={30} isCurrentUser={isCurrentUser} />
      <b>{userName}</b>
      <em>{isCurrentUser ? "you" : "online"}</em>
    </div>
  );
}

export default Client;
