import React, { useState } from 'react';
import { Octokit } from 'octokit';
import { Github, Lock, Globe } from 'lucide-react';
import { Modal } from './ux/primitives';
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
        <Modal
            open
            onClose={onClose}
            label="GitHub"
            title="Export to a gist"
            description="Create a new gist from the code in this room."
            onSubmit={handleExport}
            footer={<>
                <button type="button" className="u-btn u-btn--ghost" onClick={onClose}>Cancel</button>
                <button type="submit" className="u-btn u-btn--solid" disabled={isExporting}>
                    {isExporting ? 'Exporting…' : <><Github size={15} /> Create gist</>}
                </button>
            </>}
        >
            <div className="u-field">
                <label htmlFor="gist-desc">Description</label>
                <input id="gist-desc" className="u-input" placeholder="e.g. Binary search, pairing notes" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="u-field">
                <label htmlFor="gist-token">Personal access token</label>
                <input id="gist-token" className="u-input" type="password" autoComplete="off" placeholder="Token with the gist scope" value={token} onChange={(e) => setToken(e.target.value)} />
                <span className="u-hint">Used once for this export and not stored. Create one on <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="u-ul">GitHub</a> with the <span className="u-mono">gist</span> scope.</span>
            </div>
            <div className="u-field">
                <span className="u-field-label">Visibility</span>
                <div className="u-tiles">
                    <button type="button" className={`u-tile${!isPublic ? ' on' : ''}`} onClick={() => setIsPublic(false)} aria-pressed={!isPublic}>
                        <span className="u-tile-ico"><Lock size={16} /></span><span><b>Secret</b><span>link only</span></span>
                    </button>
                    <button type="button" className={`u-tile${isPublic ? ' on' : ''}`} onClick={() => setIsPublic(true)} aria-pressed={isPublic}>
                        <span className="u-tile-ico"><Globe size={16} /></span><span><b>Public</b><span>listed on profile</span></span>
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default GistModal;
