import React from 'react';
import { Code, Database, Search, Filter, Plus, Terminal } from 'lucide-react';
import AppLayout from '../components/AppLayout';

const Snippets = () => {
    return (
        <AppLayout>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>My Snippets</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Save and reuse your favorite code blocks across any room.</p>
                </div>
                <button
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 24px',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                    <Plus size={20} /> New Snippet
                </button>
            </div>

            <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                padding: '32px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            backgroundColor: 'var(--bg-dark)',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            width: '300px'
                        }}>
                            <Search size={16} color="var(--text-muted)" />
                            <input
                                placeholder="Search snippets..."
                                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)', fontSize: '14px', width: '100%' }}
                            />
                        </div>
                        <button style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            backgroundColor: 'var(--bg-dark)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            color: 'var(--text-muted)',
                            cursor: 'pointer'
                        }}>
                            <Filter size={16} /> Filter
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '20px',
                        backgroundColor: 'rgba(59, 130, 246, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '24px',
                        color: 'var(--border-color)'
                    }}>
                        <Database size={40} />
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px' }}>No snippets here yet</h3>
                    <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 32px', lineHeight: '1.6' }}>
                        Your code fragments will appear here once you save them from the editor. Start building your personal library!
                    </p>
                    <div style={{ display: 'flex', gap: '24px', opacity: 0.3 }}>
                        <Code size={20} />
                        <Database size={20} />
                        <Terminal size={20} />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default Snippets;
