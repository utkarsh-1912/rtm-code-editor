import React from 'react';
import { X, FileCode, Plus, Circle } from 'lucide-react';

function TabBar({ openFiles = [], activeFile = null, onSelectFile, onCloseFile, onNewFile, isMobile = false }) {
    if (!openFiles || openFiles.length === 0) return null;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-color)',
            overflowX: 'auto',
            scrollBehavior: 'smooth',
            userSelect: 'none',
            minHeight: '38px',
            paddingLeft: '4px'
        }}>
            {openFiles.map((file) => {
                const isActive = activeFile && (activeFile.id === file.id || activeFile.path === file.path);
                return (
                    <div
                        key={file.id || file.path}
                        onClick={() => onSelectFile && onSelectFile(file)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: isMobile ? '6px 10px' : '8px 14px',
                            backgroundColor: isActive ? 'var(--bg-dark)' : 'transparent',
                            borderRight: '1px solid var(--border-color)',
                            borderTop: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                            fontSize: '12px',
                            fontWeight: isActive ? '700' : '500',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <FileCode size={14} style={{ flexShrink: 0 }} />
                        <span>{file.name}</span>
                        {file.isUnsaved && (
                            <Circle size={6} fill="var(--primary)" color="var(--primary)" style={{ flexShrink: 0 }} />
                        )}
                        {onCloseFile && openFiles.length > 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCloseFile(file);
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginLeft: '4px'
                                }}
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                );
            })}

            {onNewFile && (
                <button
                    onClick={onNewFile}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    title="New File"
                >
                    <Plus size={14} />
                </button>
            )}
        </div>
    );
}

export default TabBar;
