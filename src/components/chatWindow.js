import React, { useState, useRef, useEffect } from "react";
import { Send, Smile, Edit2, Trash2, X, Check } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import EmojiPicker, { SuggestionMode } from "emoji-picker-react";
import ACTIONS from "../Action";
import { Avatar } from "./clients";

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
        <div className="cw">
            <div className="cw-list" role="log" aria-live="polite" aria-label="Chat messages">
                {messages.length === 0 ? (
                    <div className="cw-empty">
                        <span className="u-label">Room chat</span>
                        <p>No messages yet. Say hi to everyone in the room.</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const isMe = msg.sender === userName;
                        const isEditingThis = editingMsgId === msg.id;
                        const grouped = idx > 0 && messages[idx - 1].sender === msg.sender;
                        return (
                            <div key={msg.id || idx} className={`cw-msg${isMe ? " me" : ""}${grouped ? " grouped" : ""}`}>
                                {!grouped && (
                                    <div className="cw-meta">
                                        <Avatar name={msg.sender} size={20} />
                                        <b>{isMe ? "You" : msg.sender}</b>
                                        <span>{msg.timestamp}</span>
                                    </div>
                                )}
                                {isEditingThis ? (
                                    <div className="cw-edit">
                                        <input
                                            autoFocus
                                            className="u-input"
                                            value={editMsgText}
                                            onChange={(e) => setEditMsgText(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleEditMessage(msg.id); if (e.key === 'Escape') setEditingMsgId(null); }}
                                            aria-label="Edit message"
                                        />
                                        <button className="u-icon" onClick={() => handleEditMessage(msg.id)} aria-label="Save edit"><Check size={15} /></button>
                                        <button className="u-icon" onClick={() => setEditingMsgId(null)} aria-label="Cancel edit"><X size={15} /></button>
                                    </div>
                                ) : (
                                    <div className="cw-row">
                                        <div className="cw-bubble">
                                            {msg.text}
                                            {msg.isEdited && <em> (edited)</em>}
                                        </div>
                                        {isMe && (
                                            <div className="cw-actions">
                                                <button className="u-icon" onClick={() => { setEditingMsgId(msg.id); setEditMsgText(msg.text); }} aria-label="Edit message" title="Edit"><Edit2 size={13} /></button>
                                                <button className="u-icon u-icon--danger" onClick={() => handleDeleteMessage(msg.id)} aria-label="Delete message" title="Delete"><Trash2 size={13} /></button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="cw-composer">
                {showEmojiPicker && (
                    <div ref={emojiPickerRef} className="cw-emoji">
                        <EmojiPicker
                            onEmojiClick={handleEmojiClick}
                            theme={isLightMode ? "light" : "dark"}
                            suggestedEmojisMode={SuggestionMode.NONE}
                            width={isMobile ? 280 : 300}
                            height={isMobile ? 350 : 400}
                        />
                    </div>
                )}
                <div className="cw-input">
                    <button className={`u-icon${showEmojiPicker ? " on" : ""}`} onClick={() => setShowEmojiPicker(!showEmojiPicker)} aria-label="Insert emoji" title="Emoji">
                        <Smile size={18} />
                    </button>
                    <input
                        type="text"
                        placeholder="Message the room"
                        value={inputMsg}
                        onChange={(e) => setInputMsg(e.target.value)}
                        onKeyDown={handleKeyDown}
                        aria-label="Message"
                    />
                    <button className="cw-send" onClick={sendMessage} disabled={!inputMsg.trim()} aria-label="Send message" title="Send (Enter)">
                        <Send size={15} />
                    </button>
                </div>
            </div>
        </div>
    );
}
