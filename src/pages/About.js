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
        <ContentLayout title="The RTM Studio Vision">
            <div style={{ marginBottom: '60px' }}>
                <p style={{ fontSize: '20px', lineHeight: '1.6', color: 'var(--text-main)', fontWeight: '500' }}>
                    RTM Studio (Utkristi Colabs) is a next-generation collaborative IDE engineered for the highest tier of technical teams. 
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
                        Our cinematic 16:9 grid intelligently scales to provide an immersive pair-programming experience without ever clipping or cluttered layouts.
                    </p>
                </section>

                <section>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '22px', fontWeight: '800', marginBottom: '16px', color: '#10b981' }}>
                        <Layers size={24} /> Multi-File Projects
                    </h2>
                    <p style={{ color: 'var(--text-muted)', lineHeight: '1.7' }}>
                        Move beyond simple one-off snippets. Utkristi Colabs supports persistent, hierarchical project directories 
                        synced across all participants with sub-millisecond precision using our advanced Operational Transformation engine.
                    </p>
                </section>

                <section>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '22px', fontWeight: '800', marginBottom: '16px', color: '#8b5cf6' }}>
                        <Lock size={24} /> Enterprise Communication
                    </h2>
                    <p style={{ color: 'var(--text-muted)', lineHeight: '1.7' }}>
                        Collaborate with confidence. Our enterprise-grade notification system handles project invitations with 
                        professional branding, reliable delivery, and full self-service subscription management to respect user privacy and compliance.
                    </p>
                </section>

                <section>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '22px', fontWeight: '800', marginBottom: '16px', color: '#f59e0b' }}>
                        <Cpu size={24} /> High-Performance Stack
                    </h2>
                    <p style={{ color: 'var(--text-muted)', lineHeight: '1.7' }}>
                        Built on an uncompromising infrastructure of Node.js, WebSockets (Socket.io), and Neon PostgreSQL. 
                        We ensure that every keystroke, cursor movement, and whiteboard stroke is persistent and real-time.
                    </p>
                </section>
            </div>

            <div style={{ marginTop: '80px', padding: '40px', borderRadius: '24px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <h2 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '16px' }}>Engineered for Excellence</h2>
                <p style={{ color: 'var(--text-muted)', maxWidth: '700px', margin: '0 auto 30px', fontSize: '18px' }}>
                    Whether you're conducting a critical technical interview or architecting the next unicorn, 
                    RTM Studio provides the premium environment your team deserves.
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
