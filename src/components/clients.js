import React from "react";

function Client({ userName, isCompact, isCurrentUser }) {
  // Generate a unique color from the username
  const getColor = (name) => {
    const colors = [
      "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b",
      "#10b981", "#06b6d4", "#f43f5e", "#6366f1"
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const initials = userName
    ? userName.substring(0, 2).toUpperCase()
    : "??";

  const bgColor = getColor(userName || "");

  if (isCompact) {
    return (
      <div
        title={userName + (isCurrentUser ? " (You)" : "")}
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          backgroundColor: bgColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontWeight: "700",
          color: "white",
          border: "2px solid var(--bg-card, #1e293b)",
          outline: isCurrentUser ? "2px solid var(--primary, #3b82f6)" : "none",
          outlineOffset: "2px",
          cursor: "default",
          transition: "transform 0.15s ease",
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "8px 12px",
      borderRadius: "8px",
      transition: "background 0.15s ease",
      cursor: "default",
    }}>
      <div style={{
        width: "36px",
        height: "36px",
        borderRadius: "50%",
        backgroundColor: bgColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "13px",
        fontWeight: "700",
        color: "white",
        flexShrink: 0,
      }}>
        {initials}
      </div>
      <div style={{ overflow: "hidden" }}>
        <div style={{
          fontSize: "13px",
          fontWeight: "600",
          color: "var(--text-main, #f8fafc)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "120px",
        }}>
          {userName}
        </div>
        <div style={{
          fontSize: "11px",
          color: "#4ade80",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}>
          <span style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: "#4ade80",
            display: "inline-block",
          }}></span>
          Online
        </div>
      </div>
    </div>
  );
}

export default Client;
