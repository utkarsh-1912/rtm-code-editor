import React from "react";
import ContentLayout from "../components/ContentLayout";
import {
    Video,
    Zap,
    Shield,
    Cpu,
    Globe,
    Lock,
    Layers
} from "lucide-react";

export default function About() {
    return (
        <ContentLayout title="Utkristi Colabs Vision">
            <div style={{ marginBottom: '60px' }}>
                <p style={{ fontSize: '20px', lineHeight: '1.6', color: 'var(--text-main)', fontWeight: '500' }}>
                    Utkristi Colabs is a next-generation collaborative IDE engineered for the highest tier of technical teams.
                    We've eliminated the friction of remote engineering by fusing high-performance code synchronization with cinematic video communication and enterprise-grade reliability.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '40px' }}>
                <section>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '22px', fontWeight: '800', marginBottom: '16px', color: 'var(--primary)' }}>
                        <Video size={24} /> Cinematic Video
                    </h2>
                    <p style={{ color: 'var(--text-muted)', lineHeight: '1.7' }}>
                        Experience 4K, low-latency video conferencing integrated directly into your workspace.
                        Our cinematic 16:9 grid intelligently scales to provide an immersive pair-programming experience.
                    </p>
                </section>

                <section>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '22px', fontWeight: '800', marginBottom: '16px', color: '#10b981' }}>
                        <Layers size={24} /> Focus-Driven Workspace
                    </h2>
                    <p style={{ color: 'var(--text-muted)', lineHeight: '1.7' }}>
                        Utkristi Colabs features <strong>Glassmorphism 2.0</strong> aesthetics and a dedicated <strong>Zen Mode</strong> (`Alt+Z`) 
                        to eliminate distractions. Our <strong>Command Palette</strong> (`Ctrl+K`) ensures every IDE action is just a keystroke away.
                    </p>
                </section>

                <section>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '22px', fontWeight: '800', marginBottom: '16px', color: '#8b5cf6' }}>
                        <Zap size={24} /> Enterprise Hub
                    </h2>
                    <p style={{ color: 'var(--text-muted)', lineHeight: '1.7' }}>
                        Manage your engineering lifecycle with our high-fidelity <strong>Dashboard</strong>. 
                        Includes horizontal activity carousels, real-time project health, and <strong>SMTP Relay Diagnostics</strong> 
                        to ensure your team communication never fails.
                    </p>
                </section>

                <section>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '22px', fontWeight: '800', marginBottom: '16px', color: '#f59e0b' }}>
                        <Cpu size={24} /> Next-Gen Execution
                    </h2>
                    <p style={{ color: 'var(--text-muted)', lineHeight: '1.7' }}>
                        Powered by Node 22 and PostgreSQL, Utkristi Colabs offers persistent multi-file environments with 
                        sub-millisecond Operational Transformation (OT) for conflict-free global collaboration.
                    </p>
                </section>
            </div>

            <div style={{ marginTop: '80px', padding: '40px', borderRadius: '24px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <h2 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '16px' }}>Engineered for Excellence</h2>
                <p style={{ color: 'var(--text-muted)', maxWidth: '700px', margin: '0 auto 30px', fontSize: '18px' }}>
                    Whether you're conducting a critical technical interview or architecting the next unicorn,
                    Utkristi Colabs provides the premium environment your team deserves.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)' }}><Shield size={16} /> SOC2 Compliant Logic</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)' }}><Globe size={16} /> Global Relay Network</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)' }}><Zap size={16} /> 99.9% Uptime SLA</span>
                </div>
            </div>
        </ContentLayout>
    );
}
