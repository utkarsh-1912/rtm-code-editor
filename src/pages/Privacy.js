import React from "react";
import ContentLayout from "../components/ContentLayout";

export default function Privacy() {
    return (
        <ContentLayout title="Privacy Policy">
            <p>Last updated: March 07, 2026</p>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>1. Information We Collect</h2>
            <p>
                Utkristi Colabs collects minimal information to provide a professional collaborative experience:
            </p>
            <ul>
                <li><strong>Account Data:</strong> If you sign in via Google or GitHub, we store your email, name, and profile picture to manage your workspaces.</li>
                <li><strong>User Profiles:</strong> Information about your bio, social links, and editor preferences (theme, font size) is stored securely.</li>
                <li><strong>Session Metadata:</strong> We track active sessions (device type, user agent) to allow you to manage and remotely sign out of other devices for security.</li>
            </ul>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>2. Data Persistence</h2>
            <p>
                <strong>Your Code & Workspaces:</strong> Unlike ephemeral editors, Utkristi Colabs uses a PostgreSQL backend to persist your rooms, code, and chat history. This allows you to revisit your work across different devices seamlessly.
            </p>
            <p>
                <strong>Snippets:</strong> Any code you save to your personal "Snippets Library" is stored permanently until you choose to delete it.
            </p>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>3. Third-Party Services</h2>
            <p>
                We use <strong>Judge0</strong> for code execution and <strong>Neon DB (PostgreSQL)</strong> for data persistence. Authentication is handled via <strong>Firebase Auth</strong>. Please refer to their respective policies for further details.
            </p>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>4. Security</h2>
            <p>
                We provide a dedicated <strong>Security</strong> dashboard where you can see all devices currently logged into your account and remotely terminate any unrecognized sessions.
            </p>
        </ContentLayout>
    );
}
