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

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>2. User Accounts</h2>
            <p>
                You are responsible for maintaining the security of your account and any activities that occur under your session. You must notify us immediately of any unauthorized use of your account.
            </p>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>3. Proper Use</h2>
            <p>
                You are responsible for your own conduct and any code you save, share, or execute using our platform. You agree NOT to use the code execution environment to launch attacks, mine cryptocurrency, or perform any malicious activities.
            </p>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>4. Persistent Data</h2>
            <p>
                While we strive for 100% data availability, Utkristi Colabs is not intended as a primary backup service. You are encouraged to maintain local copies of your critical code snippets and room data.
            </p>

            <h2 style={{ color: "var(--text-main)", marginTop: "40px", marginBottom: "20px" }}>5. Disclaimer of Warranty</h2>
            <p>
                Utkristi Colabs is provided "as is" and "as available" without any warranty of any kind. Your use of the service is at your own risk.
            </p>
        </ContentLayout>
    );
}
