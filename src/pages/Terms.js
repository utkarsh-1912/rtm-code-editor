import React from "react";
import ContentLayout from "../components/ContentLayout";

export default function Terms() {
    return (
        <ContentLayout title="Terms of Service">
            <p>Last updated: March 07, 2026</p>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>1. Acceptance of Terms</h2>
            <p>
                By accessing Utkristi Colabs, you agree to be bound by these terms. If you do not agree, please do not use the service.
            </p>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>2. Proper Use</h2>
            <p>
                You are responsible for your own conduct and any code you share or execute using our platform. You agree NOT to:
            </p>
            <ul>
                <li>Use the service for any illegal or unauthorized purpose.</li>
                <li>Attempt to circumvent any code execution limits or bandwidth restrictions.</li>
                <li>Share sensitive, private, or proprietary information that you do not have the right to distribute.</li>
                <li>Use the code execution environment to launch attacks, mine cryptocurrency, or perform any malicious activities.</li>
            </ul>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>3. Termination</h2>
            <p>
                We reserve the right to terminate access to any room or the service entirely if we detect abuse or violations of these terms.
            </p>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>4. Disclaimer of Warranty</h2>
            <p>
                Utkristi Colabs is provided "as is" and "as available" without any warranty of any kind. We do not guarantee that the service will be uninterrupted or error-free. Your use of the service is at your own risk.
            </p>
        </ContentLayout>
    );
}
