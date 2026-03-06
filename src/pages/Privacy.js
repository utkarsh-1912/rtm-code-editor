import React from "react";
import ContentLayout from "../components/ContentLayout";

export default function Privacy() {
    return (
        <ContentLayout title="Privacy Policy">
            <p>Last updated: March 07, 2026</p>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>1. Information We Collect</h2>
            <p>
                Utkristi Colabs is designed to be a privacy-focused tool. We do not require account creation to use the core features. We only collect minimal information necessary to facilitate real-time collaboration:
            </p>
            <ul>
                <li><strong>Display Name:</strong> The name you choose when joining a room, visible only to participants in that room.</li>
                <li><strong>Socket ID:</strong> A temporary identifier used to route messages and code updates.</li>
                <li><strong>Room ID:</strong> A unique identifier for your collaboration session.</li>
            </ul>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>2. Data Persistence</h2>
            <p>
                <strong>Your Code:</strong> We do not store your code in a permanent database. Code is synchronized across participants in real-time. We use local storage on your device to help you recover work if you accidentally refresh the page, but this data never leaves your machine unless shared through the socket connection.
            </p>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>3. Third-Party Services</h2>
            <p>
                We use <strong>Judge0 (via RapidAPI)</strong> to provide code execution features. When you click "Run Code", your source code and selected language are sent to their servers for processing. Please refer to their respective privacy policies regarding how they handle execution data.
            </p>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>4. Security</h2>
            <p>
                While we use industry-standard WebSocket protocols (Socket.io), please be aware that URLs containing Room IDs serve as invitation tokens. Sharing these links gives anyone access to your live session.
            </p>
        </ContentLayout>
    );
}
