import React from "react";
import ContentLayout from "../components/ContentLayout";

export default function Privacy() {
    return (
        <ContentLayout title="Privacy Policy" updated="October 19, 2026">

            <h2>1. Information We Collect</h2>
            <p>
                Utkristi Colabs collects minimal information to provide a professional collaborative experience:
            </p>
            <ul>
                <li><strong>Account Data:</strong> If you sign in via Google or GitHub, we store your email, name, and profile picture to manage your workspaces.</li>
                <li><strong>User Profiles:</strong> Information about your bio, social links, and editor preferences (theme, font size) is stored securely.</li>
                <li><strong>Session Metadata:</strong> We track active sessions (device type, user agent) to allow you to manage and remotely sign out of other devices for security.</li>
            </ul>

            <h2>2. Data Persistence</h2>
            <p>
                <strong>Your Code & Workspaces:</strong> Unlike ephemeral editors, Utkristi Colabs uses a PostgreSQL backend to persist your rooms, code, and chat history. This allows you to revisit your work across different devices seamlessly.
            </p>
            <p>
                <strong>Snippets:</strong> Any code you save to your personal "Snippets Library" is stored permanently until you choose to delete it.
            </p>

            <h2>3. Third-Party Services</h2>
            <p>
                We use <strong>Judge0</strong> for code execution, <strong>Neon (PostgreSQL)</strong> for data persistence and <strong>Firebase Auth</strong> for sign-in. Notifications are delivered with <strong>OneSignal</strong> (push and email fallback) and transactional email with <strong>Brevo</strong>. For push, your account ID is registered with OneSignal as your identifier, and your email address is shared with it when email delivery is needed. Please refer to their policies for further details.
            </p>

            <h2>4. Desktop App and Local Processing</h2>
            <p>
                The desktop app can run your code on a Judge0 instance on your own machine and send AI requests to a local model. Those requests stay on your computer. If neither is running, the app falls back to our server, exactly like the web version.
            </p>

            <h2>5. Imported Data (SQL)</h2>
            <p>
                CSV, TSV and JSON files you import into a SQL room are read in your browser. Their contents are sent to the code runner as part of the query when you press Run, and are not stored on our servers by the runner.
            </p>

            <h2>6. Notifications</h2>
            <p>
                Push notifications are optional and need your permission. You can switch them off at any time in Settings, and every marketing email includes an unsubscribe link.
            </p>

            <h2>7. Security</h2>
            <p>
                We provide a dedicated <strong>Security</strong> dashboard where you can see all devices currently logged into your account and remotely terminate any unrecognized sessions.
            </p>
        </ContentLayout>
    );
}
