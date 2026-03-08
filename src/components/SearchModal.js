import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Clock, Database, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getBackendUrl } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const SearchModal = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState({ rooms: [], snippets: [] });
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const modalRef = useRef(null);
    const navigate = useNavigate();
    const { user } = useAuth();

    const allResults = [...results.rooms.map(r => ({ ...r, type: 'room' })), ...results.snippets.map(s => ({ ...s, type: 'snippet' }))];
    const totalResults = allResults.length;

    const handleSelect = useCallback((item) => {
        if (item.type === 'room') {
            navigate(`/editor/${item.id}`);
        } else {
            navigate('/snippets');
        }
        onClose();
    }, [navigate, onClose]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, totalResults - 1));
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            }
            if (e.key === 'Enter' && totalResults > 0) {
                handleSelect(allResults[selectedIndex]);
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        } else {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'auto';
            setQuery('');
            setResults({ rooms: [], snippets: [] });
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'auto';
        };
    }, [isOpen, selectedIndex, results, allResults, handleSelect, onClose, totalResults]);

    useEffect(() => {
        if (!query.trim()) {
            setResults({ rooms: [], snippets: [] });
            return;
        }

        const fetchResults = async () => {
            setLoading(true);
            try {
                const response = await fetch(`${getBackendUrl()}/api/search?q=${query}&userId=${user?.uid}`);
                const data = await response.json();
                setResults(data);
                setSelectedIndex(0);
            } catch (error) {
                console.error('Search failed:', error);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(fetchResults, 300);
        return () => clearTimeout(timeoutId);
    }, [query, user]);


    if (!isOpen) return null;

    return (
        <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div style={modalStyle} ref={modalRef}>
                <div style={headerStyle}>
                    <Search size={20} color="var(--text-muted)" />
                    <input
                        autoFocus
                        placeholder="Search workspaces or snippets..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        style={inputStyle}
                    />
                    <div style={kbdStyle}>ESC</div>
                </div>

                <div style={resultsContainerStyle}>
                    {loading ? (
                        <div style={statusTextStyle}>Searching...</div>
                    ) : query && totalResults === 0 ? (
                        <div style={statusTextStyle}>No results found for "{query}"</div>
                    ) : !query ? (
                        <div style={statusTextStyle}>Type to search across your account</div>
                    ) : (
                        <div style={{ padding: '8px' }}>
                            {results.rooms.length > 0 && (
                                <Section label="Workspaces" items={results.rooms} type="room" />
                            )}
                            {results.snippets.length > 0 && (
                                <Section label="Vault (Snippets)" items={results.snippets} type="snippet" />
                            )}
                        </div>
                    )}
                </div>

                <div style={footerStyle}>
                    <div style={footerItemStyle}>
                        <span style={footerKbdStyle}>↑↓</span> to navigate
                    </div>
                    <div style={footerItemStyle}>
                        <span style={footerKbdStyle}>Enter</span> to select
                    </div>
                </div>
            </div>
        </div>
    );

    function Section({ label, items, type }) {
        return (
            <div style={{ marginBottom: '16px' }}>
                <h3 style={sectionLabelStyle}>{label}</h3>
                {items.map((item, idx) => {
                    const globalIdx = allResults.indexOf(item);
                    const isSelected = selectedIndex === globalIdx;
                    return (
                        <div
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                            style={{
                                ...itemStyle,
                                backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                border: isSelected ? '1px solid var(--primary)' : '1px solid transparent'
                            }}
                        >
                            <div style={itemIconWrapperStyle}>
                                {type === 'room' ? <Clock size={16} /> : <Database size={16} />}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={itemTitleStyle}>{item.name}</div>
                                <div style={itemSubtitleStyle}>{type === 'room' ? `ID: ${item.id}` : item.lang}</div>
                            </div>
                            {isSelected && <ArrowRight size={14} color="var(--primary)" />}
                        </div>
                    );
                })}
            </div>
        );
    }
};

const overlayStyle = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    zIndex: 2000,
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '100px',
    backdropFilter: 'blur(4px)'
};

const modalStyle = {
    width: '100%',
    maxWidth: '600px',
    backgroundColor: 'var(--bg-card)',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '440px'
};

const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-color)',
    gap: '12px'
};

const inputStyle = {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: 'var(--text-main)',
    fontSize: '16px',
    outline: 'none'
};

const kbdStyle = {
    fontSize: '10px',
    padding: '4px 6px',
    backgroundColor: 'var(--bg-dark)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    color: 'var(--text-muted)',
    fontWeight: '700'
};

const resultsContainerStyle = {
    flex: 1,
    overflowY: 'auto',
    minHeight: '200px'
};

const statusTextStyle = {
    padding: '60px 20px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '14px'
};

const sectionLabelStyle = {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '0 12px',
    marginBottom: '8px'
};

const itemStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    gap: '12px',
    transition: 'all 0.1s ease',
    margin: '2px 0'
};

const itemIconWrapperStyle = {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-dark)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)'
};

const itemTitleStyle = {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-main)',
    marginBottom: '2px'
};

const itemSubtitleStyle = {
    fontSize: '11px',
    color: 'var(--text-muted)'
};

const footerStyle = {
    padding: '12px 20px',
    borderTop: '1px solid var(--border-color)',
    backgroundColor: 'rgba(0,0,0,0.1)',
    display: 'flex',
    gap: '20px'
};

const footerItemStyle = {
    fontSize: '12px',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
};

const footerKbdStyle = {
    padding: '2px 4px',
    backgroundColor: 'var(--bg-dark)',
    borderRadius: '3px',
    border: '1px solid var(--border-color)',
    fontSize: '10px',
    fontWeight: '700'
};

export default SearchModal;
