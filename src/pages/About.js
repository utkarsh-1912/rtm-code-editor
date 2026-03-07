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
                        <Code size={20} /> Real-time Sync
                    </h3>
                    <p>Experience sub-millisecond latency with our advanced WebSocket integration. What you type is what they see, instantly.</p>
                </div>
                <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", color: "#f87171" }}>
                        <Zap size={20} /> Instant Execution
                    </h3>
                    <p>Run your code across multiple languages including Python, C++, Java, and JavaScript, powered by the Judge0 API.</p>
                </div>
                <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", color: "#fbbf24" }}>
                        <MousePointer2 size={20} /> Live Cursors
                    </h3>
                    <p>See exactly where your teammates are working. Real-time visual presence with name tags ensures everyone is on the same page.</p>
                </div>
                <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", color: "#a855f7" }}>
                        <Terminal size={20} /> Custom Stdin
                    </h3>
                    <p>Test your logic with custom standard input. Essential for competitive programming and complex data-driven debugging.</p>
                </div>
                <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", color: "#ec4899" }}>
                        <Settings size={20} /> Tailored Editor
                    </h3>
                    <p>Make the workspace yours. Customize font size, tab spacing, and word wrap settings that persist across your sessions.</p>
                </div>
                <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", color: "#60a5fa" }}>
                        <Eye size={20} /> Spectator Mode
                    </h3>
                    <p>Share your progress without worry. Generate read-only links for observers to follow along without interfering with the code.</p>
                </div>
                <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", color: "#4ade80" }}>
                        <Users size={20} /> Collaborative Chat
                    </h3>
                    <p>Communicate effectively with built-in chat support for emojis and real-time status updates, keeping communication in-context.</p>
                </div>
                <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", color: "var(--text-muted)" }}>
                        <Shield size={20} /> Privacy First
                    </h3>
                    <p>Your code is shared only with those you invite. We do not persist your code on our servers longer than necessary for the session.</p>
                </div>
            </div>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>Our Mission</h2>
            <p>
                To break down the barriers of remote collaboration by providing a fast, reliable, and beautiful coding environment that feels as natural as sitting next to your teammate.
            </p>
        </ContentLayout>
    );
}
