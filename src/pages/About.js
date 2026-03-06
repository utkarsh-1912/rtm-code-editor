import React from "react";
import ContentLayout from "../components/ContentLayout";
import { Code, Zap, Users, Shield } from "lucide-react";

export default function About() {
    return (
        <ContentLayout title="About Utkristi Colabs">
            <p>
                Utkristi Colabs is a state-of-the-art real-time collaborative code editor designed for developers who value speed, efficiency, and seamless teamwork. Whether you are pair programming, mentoring, or conducting technical interviews, our platform provides the tools you need to code together, anywhere in the world.
            </p>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>Core Features</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px", marginTop: "20px" }}>
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
                    <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", color: "#4ade80" }}>
                        <Users size={20} /> Collaborative Chat
                    </h3>
                    <p>Communicate effectively without leaving the workspace. Our built-in chat supports emojis and real-time status updates.</p>
                </div>
                <div>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", color: "#60a5fa" }}>
                        <Shield size={20} /> Privacy First
                    </h3>
                    <p>Your code is temporary and shared only with those you invite. We do not persist your code on our servers longer than necessary.</p>
                </div>
            </div>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>Our Mission</h2>
            <p>
                To break down the barriers of remote collaboration by providing a fast, reliable, and beautiful coding environment that feels as natural as sitting next to your teammate.
            </p>
        </ContentLayout>
    );
}
