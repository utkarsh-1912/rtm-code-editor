import React, { useState, useEffect, useRef, useMemo } from 'react';
import Icon from "./icons/Icon";

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
                    <Icon name="search" size={20} style={{ color: "var(--primary)", opacity: 0.8 }} />
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
                                                    {action.icon || <Icon name="palette" size={16} />}
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
                            <div style={{ opacity: 0.5, marginBottom: '12px' }}><Icon name="search" size={24} /></div>
                            <div style={{ fontSize: '14px', fontWeight: '600' }}>No results found for "{search}"</div>
                            <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '4px' }}>Try searching for files, settings, or actions.</div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={footerStyle}>
                    <div style={footerItemStyle}><span style={miniKbdStyle}>↑↓</span> Navigate</div>
                    <div style={footerItemStyle}><span style={miniKbdStyle}>↵</span> Select</div>
                    <div style={footerItemStyle}><span style={miniKbdStyle}>Alt F</span> Focus</div>
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

// Styles: follow the workspace tokens so the palette matches both themes.
const overlayStyle = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(5,5,4,0.5)',
    backdropFilter: 'blur(6px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '12vh 16px 16px',
    animation: 'fadeIn 0.2s ease-out'
};

const paletteContainerStyle = {
    width: '100%',
    maxWidth: '640px',
    backgroundColor: 'var(--u-raise, #181816)',
    color: 'var(--u-ink, #E8E6DF)',
    border: '1px solid var(--u-line, rgba(232,230,223,.1))',
    borderRadius: '20px',
    boxShadow: 'var(--u-shadow, 0 30px 80px -30px rgba(0,0,0,.7))',
    overflow: 'hidden',
    animation: 'scaleIn 0.25s cubic-bezier(.22,1,.36,1)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'var(--u-text, inherit)'
};

const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '18px 22px',
    borderBottom: '1px solid var(--u-line)',
    gap: '14px',
    color: 'var(--u-ink-3)'
};

const inputStyle = {
    flex: 1,
    background: 'none',
    border: 'none',
    color: 'var(--u-ink)',
    fontSize: '19px',
    fontWeight: '500',
    outline: 'none',
    fontFamily: 'inherit',
    letterSpacing: '-0.02em'
};

const kbdStyle = {
    padding: '3px 7px',
    borderRadius: '6px',
    fontSize: '10.5px',
    fontFamily: 'var(--u-mono)',
    color: 'var(--u-ink-3)',
    border: '1px solid var(--u-line)'
};

const listContainerStyle = {
    maxHeight: '440px',
    overflowY: 'auto',
    padding: '8px'
};

const categoryHeaderStyle = {
    padding: '12px 12px 6px',
    fontSize: '11px',
    fontFamily: 'var(--u-mono)',
    color: 'var(--u-ink-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
};

const actionItemStyle = (selected) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderRadius: '12px',
    cursor: 'pointer',
    backgroundColor: selected ? 'var(--u-tint)' : 'transparent',
    boxShadow: selected ? 'inset 2px 0 0 var(--u-accent)' : 'none',
    transition: 'background-color .15s',
    marginBottom: '2px'
});

const actionLeftStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    minWidth: 0
};

const iconWrapperStyle = (selected) => ({
    width: '32px',
    height: '32px',
    flex: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
    backgroundColor: selected ? 'var(--u-solid)' : 'var(--u-tint)',
    color: selected ? 'var(--u-on-solid)' : 'var(--u-ink-2)',
    transition: 'all 0.2s ease'
});

const actionTextContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0
};

const actionLabelStyle = {
    fontSize: '14.5px',
    fontWeight: '500',
    color: 'var(--u-ink)'
};

const actionDescStyle = {
    fontSize: '12px',
    color: 'var(--u-ink-3)',
    marginTop: '2px'
};

const shortcutStyle = (selected) => ({
    fontSize: '11px',
    fontFamily: 'var(--u-mono)',
    color: selected ? 'var(--u-ink)' : 'var(--u-ink-3)'
});

const footerStyle = {
    padding: '10px 22px',
    borderTop: '1px solid var(--u-line)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '22px',
    flexWrap: 'wrap'
};

const footerItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    fontSize: '11px',
    fontFamily: 'var(--u-mono)',
    color: 'var(--u-ink-3)'
};

const miniKbdStyle = {
    padding: '1px 6px',
    borderRadius: '5px',
    border: '1px solid var(--u-line)',
    fontSize: '10px',
    color: 'var(--u-ink-2)'
};

const emptyStateStyle = {
    padding: '64px 24px',
    textAlign: 'center',
    color: 'var(--u-ink-2)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
};

export default CommandPalette;
