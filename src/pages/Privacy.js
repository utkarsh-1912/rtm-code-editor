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
                <li><strong>Meetings and Room Invites:</strong> When you schedule a call or make a room invite-only or private, we store the title, time and the email addresses you invite, to send invitations and reminders and to check who may join.</li>
                <li><strong>Session Metadata:</strong> We track active sessions (device type, user agent) to allow you to manage and remotely sign out of other devices for security.</li>
            </ul>

            <h2>2. Data Persistence</h2>
            <p>
                <strong>Your Code & Workspaces:</strong> Unlike ephemeral editors, Utkristi Colabs stores your rooms, code, and chat history in a managed database. This allows you to revisit your work across different devices seamlessly.
            </p>
            <p>
                <strong>Snippets:</strong> Any code you save to your personal "Snippets Library" is stored permanently until you choose to delete it.
            </p>

            <h2>3. Third-Party Services</h2>
            <p>
                We rely on a small number of trusted service providers, each only for its job: running code in isolated sandboxes, hosting our database, signing you in, processing payments (we receive your plan status and a customer reference, never your card number), sending email and push notifications, and answering AI copilot requests. When you ask the AI copilot something, your prompt and the code you asked about are sent through our server to an AI model provider to get an answer. For push notifications your account ID is registered with the notification provider, and your email address is shared with it when email delivery is needed. Each provider processes data only to deliver its service to you. A list of the providers we use is available on request through <a href="/support">Support</a>.
            </p>

            <h2>4. Desktop App and Local Processing</h2>
            <p>
                The desktop app can run your code and AI requests on your own machine. Those requests stay on your computer. If neither is running, the app falls back to our server, exactly like the web version.
            </p>

            <h2>5. Imported Data (SQL)</h2>
            <p>
                CSV, TSV and JSON files you import into a SQL room are read in your browser. Their contents are sent to the code runner as part of the query when you press Run, and are not stored on our servers by the runner.
            </p>

            <h2>6. Notifications</h2>
            <p>
                Push notifications are optional and need your permission. You can switch them off at any time in Settings, and every marketing email includes an unsubscribe link.
            </p>

            <h2>7. Plans and Billing Data</h2>
            <p>
                For paid plans we store your plan, billing period, trial dates and our payment processor's customer and subscription references. Invoices and payment methods are held by the payment processor and managed in its billing portal, linked from Settings.
            </p>

            <h2>8. Security</h2>
            <p>
                We provide a dedicated <strong>Security</strong> dashboard where you can see all devices currently logged into your account and remotely terminate any unrecognized sessions.
            </p>
        </ContentLayout>
    );
}
