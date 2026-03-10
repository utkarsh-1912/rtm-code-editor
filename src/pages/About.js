import React from "react";
import ContentLayout from "../components/ContentLayout";
import { Code, Zap, Users, Shield, MousePointer2, Terminal, Settings, Eye } from "lucide-react";

export default function About() {
    return (
        <ContentLayout title="About Utkristi Colabs">
            <p>
                Utkristi Colabs is a state-of-the-art real-time collaborative code editor designed for developers who value speed, efficiency, and seamless teamwork. Whether you are pair programming, mentoring, or conducting technical interviews, our platform provides the tools you need to code together, anywhere in the world.
            </p>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>Core Features</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "30px", marginTop: "20px" }}>
                <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", color: "var(--primary)" }}>
                        <Code size={20} /> Pro IDE Workspace
                    </h3>
                    <p>Sub-millisecond latency for real-time sync, now featuring multi-file Project support. Your code, file structure, and chat history are saved automatically.</p>
                </div>
                <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", color: "#f87171" }}>
                        <Zap size={20} /> Advanced Collaboration
                    </h3>
                    <p>Go beyond text with built-in WebRTC Voice and Video chat. Use "Follow Me" mode to lead your team or see their presence with Shared Pointers.</p>
                </div>
                <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", color: "#fbbf24" }}>
                        <MousePointer2 size={20} /> Collaborative Whiteboard
                    </h3>
                    <p>Sketch architectural diagrams in real-time. Our dual-canvas engine ensures smooth, synchronized drawing with multi-user support.</p>
                </div>
                <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", color: "#a855f7" }}>
                        <Terminal size={20} /> Snippets Library
                    </h3>
                    <p>Build your personal vault of reusable code. Save, organize, and search through your code snippets with our built-in Snippets Library.</p>
                </div>
                <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", color: "#ec4899" }}>
                        <Settings size={20} /> Power User Tools
                    </h3>
                    <p>Boost productivity with Vim and Emacs keybindings. Real-time linting provides instant feedback as you type in our premium IDE environment.</p>
                </div>
                <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", color: "#60a5fa" }}>
                        <Eye size={20} /> Live Preview
                    </h3>
                    <p>See your changes instantly. Our integrated real-time preview renders HTML, CSS, and JS projects as you type, right inside the workspace.</p>
                </div>
                <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", color: "#4ade80" }}>
                        <Users size={20} /> Team Discussions
                    </h3>
                    <p>Communicate effectively with integrated project-level discussions. Keep your team aligned with synchronized chats and persistent history.</p>
                </div>
                <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", color: "var(--text-muted)" }}>
                        <Shield size={20} /> Security & Privacy
                    </h3>
                    <p>Manage your account security with ease. Track active sessions across devices and remotely sign out for complete control over your data.</p>
                </div>
            </div>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>Our Mission</h2>
            <p>
                To break down the barriers of remote collaboration by providing a fast, reliable, and beautiful coding environment that feels as natural as sitting next to your teammate.
            </p>
        </ContentLayout>
    );
}
