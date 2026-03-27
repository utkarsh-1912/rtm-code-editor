import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Command, FileText, Play, Eye, EyeOff, Sun, Moon, Link, Settings, X, Zap, Hash, Globe, User, Layout, MessageSquare, Terminal, Folder, FileCode, Users, Video } from 'lucide-react';

const CommandPalette = ({ isOpen, onClose, actions = [], isLightMode }) => {
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    // Group actions by category
    const categories = useMemo(() => {
        const groups = {
            'Recently Used': [],
            'Files': [],
            'Actions': [],
            'Collaboration': [],
            'Settings': []
        };
        
        const filtered = actions.filter(action => 
            action.label.toLowerCase().includes(search.toLowerCase()) ||
            (action.description && action.description.toLowerCase().includes(search.toLowerCase())) ||
            (action.category && action.category.toLowerCase().includes(search.toLowerCase()))
        );

        filtered.forEach(action => {
            const cat = action.category || 'Actions';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(action);
        });

        // Sort items within categories: Recently Used first, then Files, then others
        return Object.entries(groups).filter(([_, items]) => items.length > 0);
    }, [actions, search]);

    const flatActions = useMemo(() => categories.flatMap(([_, items]) => items), [categories]);

    useEffect(() => {
        if (isOpen) {
            setSearch('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % Math.max(1, flatActions.length));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + flatActions.length) % Math.max(1, flatActions.length));
            } else if (e.key === 'Enter' && flatActions[selectedIndex]) {
                e.preventDefault();
                flatActions[selectedIndex].run();
                onClose();
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, flatActions, selectedIndex, onClose]);

    // Scroll active item into view
    useEffect(() => {
        const activeItem = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
        if (activeItem) {
            activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [selectedIndex]);

    if (!isOpen) return null;

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={paletteContainerStyle} onClick={e => e.stopPropagation()}>
                {/* Search Header */}
                <div style={headerStyle}>
                    <Search size={20} color="var(--primary)" style={{ opacity: 0.8 }} />
                    <input 
                        ref={inputRef}
                        type="text"
                        placeholder="Type a command or search..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setSelectedIndex(0); }}
                        style={inputStyle}
                    />
                    <div style={kbdStyle}>ESC</div>
                </div>

                {/* Results List */}
                <div ref={listRef} style={listContainerStyle}>
                    {categories.length > 0 ? (
                        categories.map(([category, items]) => (
                            <div key={category}>
                                <div style={categoryHeaderStyle}>{category}</div>
                                {items.map((action) => {
                                    const globalIdx = flatActions.indexOf(action);
                                    const isSelected = selectedIndex === globalIdx;
                                    return (
                                        <div 
                                            key={`${category}-${action.id}`}
                                            data-index={globalIdx}
                                            onClick={() => { action.run(); onClose(); }}
                                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                                            style={actionItemStyle(isSelected)}
                                        >
                                            <div style={actionLeftStyle}>
                                                <div style={iconWrapperStyle(isSelected)}>
                                                    {action.icon || <Command size={16} />}
                                                </div>
                                                <div style={actionTextContainerStyle}>
                                                    <div style={actionLabelStyle}>{action.label}</div>
                                                    {action.description && <div style={actionDescStyle}>{action.description}</div>}
                                                </div>
                                            </div>
                                            {action.shortcut && (
                                                <div style={shortcutStyle(isSelected)}>{action.shortcut}</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    ) : (
                        <div style={emptyStateStyle}>
                            <div style={{ opacity: 0.5, marginBottom: '12px' }}><Search size={40} /></div>
                            <div style={{ fontSize: '14px', fontWeight: '600' }}>No results found for "{search}"</div>
                            <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '4px' }}>Try searching for files, settings, or actions.</div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={footerStyle}>
                    <div style={footerItemStyle}><span style={miniKbdStyle}>↑↓</span> Navigate</div>
                    <div style={footerItemStyle}><span style={miniKbdStyle}>↵</span> Select</div>
                    <div style={footerItemStyle}><span style={miniKbdStyle}>ALT+Z</span> Zen</div>
                    <div style={footerItemStyle}><span style={miniKbdStyle}>#</span> Files</div>
                </div>
            </div>

            <style>{`
                @keyframes scaleIn {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

// Styles (Internal to component for maximum control)
const overlayStyle = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(12px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '12vh',
    animation: 'fadeIn 0.2s ease-out'
};

const paletteContainerStyle = {
    width: '100%',
    maxWidth: '640px',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
    overflow: 'hidden',
    animation: 'scaleIn 0.15s ease-out',
    display: 'flex',
    flexDirection: 'column'
};

const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    gap: '16px'
};

const inputStyle = {
    flex: 1,
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '18px',
    fontWeight: '500',
    outline: 'none',
    fontFamily: 'inherit',
    letterSpacing: '-0.02em'
};

const kbdStyle = {
    padding: '4px 8px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: '6px',
    fontSize: '10px',
    fontWeight: '800',
    color: 'rgba(255,255,255,0.4)',
    border: '1px solid rgba(255,255,255,0.1)'
};

const listContainerStyle = {
    maxHeight: '440px',
    overflowY: 'auto',
    padding: '12px'
};

const categoryHeaderStyle = {
    padding: '12px 12px 6px',
    fontSize: '10px',
    fontWeight: '900',
    color: 'var(--primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    opacity: 0.9
};

const actionItemStyle = (selected) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderRadius: '12px',
    cursor: 'pointer',
    backgroundColor: selected ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    marginBottom: '2px',
    transform: selected ? 'translateX(4px)' : 'none'
});

const actionLeftStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
};

const iconWrapperStyle = (selected) => ({
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
    backgroundColor: selected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.04)',
    color: selected ? 'var(--primary)' : 'rgba(255,255,255,0.6)',
    transition: 'all 0.2s ease',
    border: selected ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
});

const actionTextContainerStyle = {
    display: 'flex',
    flexDirection: 'column'
};

const actionLabelStyle = {
    fontSize: '14.5px',
    fontWeight: '650',
    color: '#fff'
};

const actionDescStyle = {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.45)',
    marginTop: '2px',
    fontWeight: '500'
};

const shortcutStyle = (selected) => ({
    fontSize: '10px',
    fontWeight: '800',
    color: selected ? 'var(--primary)' : 'rgba(255,255,255,0.25)',
    letterSpacing: '0.04em'
});

const footerStyle = {
    padding: '12px 24px',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '32px'
};

const footerItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '10.5px',
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
    letterSpacing: '0.02em'
};

const miniKbdStyle = {
    padding: '2px 6px',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.08)',
    fontSize: '9px',
    fontWeight: '900',
    color: 'rgba(255,255,255,0.6)'
};

const emptyStateStyle = {
    padding: '80px 24px',
    textAlign: 'center',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
};

export default CommandPalette;
