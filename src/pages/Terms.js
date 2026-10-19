import React from "react";
import ContentLayout from "../components/ContentLayout";

export default function Terms() {
    return (
        <ContentLayout title="Terms of Service" updated="October 19, 2026">

            <h2>1. Acceptance of Terms</h2>
            <p>
                By accessing Utkristi Colabs, you agree to be bound by these terms. If you do not agree, please do not use the service.
            </p>

            <h2>2. User Accounts</h2>
            <p>
                You are responsible for maintaining the security of your account and any activities that occur under your session. You must notify us immediately of any unauthorized use of your account.
            </p>

            <h2>3. Proper Use</h2>
            <p>
                You are responsible for your own conduct and any code you save, share, or execute using our platform. You agree NOT to use the code execution environment to launch attacks, mine cryptocurrency, or perform any malicious activities.
            </p>

            <h2>4. Desktop App</h2>
            <p>
                The desktop app is provided free of charge and is not yet code-signed, so your operating system may warn you before the first launch. Code you run locally runs with your own permissions on your own machine, so only run code you trust.
            </p>

            <h2>5. Notifications and Email</h2>
            <p>
                We may send you service messages such as invitations, security notices and, with your permission, push notifications. You can opt out of non-essential messages at any time.
            </p>

            <h2>6. Plans, Trials and Billing</h2>
            <p>
                Free is free. Team is billed in advance, monthly or yearly, through Stripe, and renews automatically until you cancel in Settings under Plan &amp; billing. The Team trial is 14 days and converts to a paid subscription at the end unless cancelled before then. When a paid plan ends you move to Free: your projects remain, but you cannot create new ones above the Free limit. Prices exclude applicable taxes. If a charge was a mistake, contact support within 14 days and we will make it right.
            </p>

            <h2>7. Persistent Data</h2>
            <p>
                While we strive for 100% data availability, Utkristi Colabs is not intended as a primary backup service. You are encouraged to maintain local copies of your critical code snippets and room data.
            </p>

            <h2>8. Disclaimer of Warranty</h2>
            <p>
                Utkristi Colabs is provided "as is" and "as available" without any warranty of any kind. Your use of the service is at your own risk.
            </p>
        </ContentLayout>
    );
}
