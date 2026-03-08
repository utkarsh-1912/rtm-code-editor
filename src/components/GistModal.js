import React, { useState } from 'react';
import { Octokit } from 'octokit';
import { Github, Lock, Globe, X, Send } from 'lucide-react';
import toast from 'react-hot-toast';

const GistModal = ({ isOpen, onClose, code, language, fileName }) => {
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [token, setToken] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    if (!isOpen) return null;

    const handleExport = async () => {
        if (!token) {
            toast.error("GitHub Personal Access Token is required.");
            return;
        }
        if (!code || code.trim() === "") {
            toast.error("Code content cannot be empty for Gist export.");
            setIsExporting(false);
            return;
        }

        setIsExporting(true);
        const octokit = new Octokit({ auth: token });

        try {
            const ext = language === 'javascript' ? 'js' : language === 'python' ? 'py' : 'txt';
            const safeFileName = (fileName || `snippet`).replace(/[^a-zA-Z0-9.-]/g, '_');
            const finalFileName = safeFileName.includes('.') ? safeFileName : `${safeFileName}.${ext}`;

            const response = await octokit.rest.gists.create({
                description: description || 'Exported from Utkristi Colabs',
                public: isPublic,
                files: {
                    [finalFileName]: {
                        content: code
                    }
                }
            });

            if (response.status === 201) {
                toast.success("Gist created successfully!");
                window.open(response.data.html_url, '_blank');
                onClose();
            }
        } catch (err) {
            console.error("Gist Error:", err);
            toast.error(err.message || "Failed to create Gist. Check your token permissions.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 2000,
            backdropFilter: 'blur(8px)'
        }}>
            <div style={{
                width: '100%', maxWidth: '480px', backgroundColor: 'var(--bg-card)',
                borderRadius: '24px', border: '1px solid var(--border-color)',
                padding: '32px', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
            }}>
                <button onClick={onClose} style={{
                    position: 'absolute', top: '24px', right: '24px',
                    background: 'transparent', border: 'none', color: 'var(--text-muted)',
                    cursor: 'pointer'
                }}>
                    <X size={20} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ color: 'var(--text-main)', backgroundColor: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '12px' }}>
                        <Github size={24} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Export to GitHub Gist</h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Create a new gist from your current code.</p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>Gist Description</label>
                        <input
                            placeholder="e.g. My Awesome Algorithm"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>Personal Access Token (classic)</label>
                        <input
                            type="password"
                            placeholder="ghp_xxxxxxxxxxxx"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            style={inputStyle}
                        />
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                            Need a token? Generate one on <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>GitHub</a> with `gist` scope.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={() => setIsPublic(false)}
                            style={toggleButtonStyle(!isPublic)}
                        >
                            <Lock size={16} /> Secret
                        </button>
                        <button
                            onClick={() => setIsPublic(true)}
                            style={toggleButtonStyle(isPublic)}
                        >
                            <Globe size={16} /> Public
                        </button>
                    </div>

                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        style={{
                            marginTop: '10px', width: '100%', padding: '14px',
                            backgroundColor: 'white', color: 'black', border: 'none',
                            borderRadius: '12px', fontWeight: '700', fontSize: '16px',
                            cursor: isExporting ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                            transition: 'all 0.2s', opacity: isExporting ? 0.7 : 1
                        }}
                    >
                        {isExporting ? 'Exporting...' : <><Send size={18} /> Create Gist</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

const inputStyle = {
    padding: '12px 16px',
    backgroundColor: 'var(--bg-dark)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    color: 'var(--text-main)',
    outline: 'none',
    fontSize: '14px'
};

const toggleButtonStyle = (active) => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px',
    borderRadius: '10px',
    border: active ? '1px solid var(--primary)' : '1px solid var(--border-color)',
    backgroundColor: active ? 'rgba(0, 59, 251, 0.1)' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--text-muted)',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
});

export default GistModal;
