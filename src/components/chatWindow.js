import React, { useState, useRef, useEffect } from "react";
import { BotMessageSquare, Send, Smile, Edit2, Trash2, X, Check } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import EmojiPicker, { SuggestionMode } from "emoji-picker-react";
import ACTIONS from "../Action";

export default function ChatWindow({ socketRef, roomId, userName, isLightMode, isMobile, messages = [], setMessages }) {
    const [inputMsg, setInputMsg] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [editingMsgId, setEditingMsgId] = useState(null);
    const [editMsgText, setEditMsgText] = useState("");

    const messagesEndRef = useRef(null);
    const emojiPickerRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Close emoji picker when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
                setShowEmojiPicker(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const sendMessage = () => {
        if (!inputMsg.trim()) return;

        const newMsg = {
            id: uuidv4(),
            sender: userName,
            text: inputMsg,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isEdited: false
        };

        setMessages((prev) => [...prev, newMsg]);
        socketRef.current?.emit(ACTIONS.SEND_MESSAGE, { roomId, message: newMsg });
        setInputMsg("");
        setShowEmojiPicker(false);
    };

    const handleEditMessage = (msgId) => {
        if (!editMsgText.trim()) return;
        setMessages((prev) => prev.map(m => m.id === msgId ? { ...m, text: editMsgText, isEdited: true } : m));
        socketRef.current?.emit(ACTIONS.EDIT_MESSAGE, { roomId, messageId: msgId, newText: editMsgText });
        setEditingMsgId(null);
        setEditMsgText("");
    };

    const handleDeleteMessage = (msgId) => {
        setMessages((prev) => prev.filter(m => m.id !== msgId));
        socketRef.current?.emit(ACTIONS.DELETE_MESSAGE, { roomId, messageId: msgId });
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleEmojiClick = (emojiObj) => {
        setInputMsg((prev) => prev + emojiObj.emoji);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "var(--bg-dark)", borderRight: "1px solid var(--border-color)", position: "relative" }}>
            <div style={{ padding: "16px", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "var(--bg-card)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <BotMessageSquare size={20} color="var(--primary)" />
                    <h2 style={{ fontSize: "16px", margin: 0, fontWeight: "600", color: "var(--text-main)" }}>Room Chat</h2>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {messages.length === 0 ? (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                        No messages yet. Say hi!
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const isMe = msg.sender === userName;
                        const isEditingThis = editingMsgId === msg.id;

                        return (
                            <div key={msg.id || idx} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "4px" }}>
                                    <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-main)" }}>{isMe ? "You" : msg.sender}</span>
                                    <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{msg.timestamp}</span>
                                </div>
                                <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px", flexDirection: isMe ? "row-reverse" : "row", maxWidth: "100%" }}>

                                    {isEditingThis ? (
                                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                            <input
                                                autoFocus
                                                type="text"
                                                value={editMsgText}
                                                onChange={(e) => setEditMsgText(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleEditMessage(msg.id); if (e.key === 'Escape') setEditingMsgId(null); }}
                                                style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--primary)", outline: "none", backgroundColor: "var(--bg-dark)", color: "var(--text-main)", fontSize: "14px", width: "100%" }}
                                            />
                                            <button onClick={() => handleEditMessage(msg.id)} style={{ background: "none", border: "none", color: "#4ade80", cursor: "pointer", padding: "4px" }}><Check size={14} /></button>
                                            <button onClick={() => setEditingMsgId(null)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: "4px" }}><X size={14} /></button>
                                        </div>
                                    ) : (
                                        <div style={{
                                            padding: "8px 12px",
                                            borderRadius: "12px",
                                            fontSize: "14px",
                                            maxWidth: "85%",
                                            width: "fit-content",
                                            overflowWrap: "anywhere",
                                            wordBreak: "normal",
                                            backgroundColor: isMe ? "var(--primary)" : "var(--secondary)",
                                            color: isMe ? "white" : "var(--text-main)",
                                            borderBottomRightRadius: isMe ? 0 : "12px",
                                            borderBottomLeftRadius: isMe ? "12px" : 0,
                                            border: isMe ? "none" : "1px solid var(--border-color)",
                                            boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                                        }}>
                                            {msg.text}
                                            {msg.isEdited && <span style={{ fontSize: "10px", opacity: 0.7, marginLeft: "6px", fontStyle: "italic" }}>(edited)</span>}
                                        </div>
                                    )}

                                    {/* Action Utilities (Edit/Delete) */}
                                    {isMe && !isEditingThis && (
                                        <div style={{ display: "flex", alignItems: "center", gap: "4px", opacity: 0.7 }}>
                                            <button
                                                onClick={() => { setEditingMsgId(msg.id); setEditMsgText(msg.text); }}
                                                title="Edit Message"
                                                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px" }}
                                            ><Edit2 size={12} /></button>
                                            <button
                                                onClick={() => handleDeleteMessage(msg.id)}
                                                title="Delete Message"
                                                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px" }}
                                            ><Trash2 size={12} /></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: "12px", backgroundColor: "var(--bg-card)", borderTop: "1px solid var(--border-color)", position: "relative" }}>

                {/* Emoji Picker Popup */}
                {showEmojiPicker && (
                    <div ref={emojiPickerRef} style={{ position: "absolute", bottom: "70px", left: isMobile ? "10px" : "16px", zIndex: 100 }}>
                        <EmojiPicker
                            onEmojiClick={handleEmojiClick}
                            theme={isLightMode ? "light" : "dark"}
                            suggestedEmojisMode={SuggestionMode.NONE}
                            width={isMobile ? 280 : 300}
                            height={isMobile ? 350 : 400}
                        />
                    </div>
                )}

                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        style={{
                            position: "absolute",
                            left: "12px",
                            background: "none",
                            border: "none",
                            color: showEmojiPicker ? "var(--primary)" : "var(--text-muted)",
                            cursor: "pointer",
                            padding: "4px",
                            display: "flex",
                            alignItems: "center"
                        }}
                    >
                        <Smile size={18} />
                    </button>

                    <input
                        type="text"
                        placeholder="Type a message..."
                        value={inputMsg}
                        onChange={(e) => setInputMsg(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={{
                            width: "100%",
                            backgroundColor: "var(--bg-dark)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "24px",
                            padding: "10px 48px 10px 40px", /* Left padding for emoji button */
                            outline: "none",
                            color: "var(--text-main)",
                            fontSize: "14px"
                        }}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!inputMsg.trim()}
                        style={{
                            position: "absolute",
                            right: "6px",
                            padding: "6px",
                            backgroundColor: inputMsg.trim() ? "var(--primary)" : "var(--secondary)",
                            color: inputMsg.trim() ? "white" : "var(--text-muted)",
                            border: "none",
                            borderRadius: "50%",
                            cursor: inputMsg.trim() ? "pointer" : "default",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "background 0.2s"
                        }}
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
