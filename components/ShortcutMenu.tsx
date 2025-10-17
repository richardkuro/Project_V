import React, { useState, useEffect, useRef } from 'react';
import { KeyboardIcon } from './Icons';

const shortcuts = [
    { action: 'Play / Pause', keys: ['Space'] },
    { action: 'Slice Clip', keys: ['S'] },
    { action: 'Copy Clip', keys: ['Ctrl', 'C'] },
    { action: 'Paste Clip', keys: ['Ctrl', 'V'] },
    { action: 'Delete Clip', keys: ['Delete'] },
    { action: 'Adjust Gain', keys: ['Shift', 'Drag'] },
];

const ShortcutMenu: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-center h-10 w-10 font-semibold rounded-full transition-all duration-200 shadow-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 shadow-[0_0_10px_rgba(100,116,139,0.3)] hover:shadow-[0_0_15px_rgba(100,116,139,0.5)]"
                aria-label="Show keyboard shortcuts"
            >
                <KeyboardIcon />
            </button>

            {isOpen && (
                <div 
                    ref={menuRef}
                    className="absolute top-full right-0 mt-2 w-64 bg-slate-900/80 backdrop-blur-lg border border-slate-700 rounded-lg shadow-2xl z-50 p-3"
                >
                    <h3 className="text-sm font-bold text-cyan-400 mb-2 text-glow">Shortcuts</h3>
                    <ul className="space-y-1.5 text-sm text-slate-300">
                        {shortcuts.map(({ action, keys }) => (
                            <li key={action} className="flex justify-between items-center">
                                <span>{action}</span>
                                <div className="flex items-center gap-1">
                                    {keys.map((key, index) => (
                                        <React.Fragment key={key}>
                                            <kbd className="px-1.5 py-0.5 text-xs font-sans font-semibold text-slate-300 bg-slate-700 border border-slate-600 rounded">
                                                {key === 'Ctrl' ? (isMac ? '⌘' : 'Ctrl') : key}
                                            </kbd>
                                            {index < keys.length -1 && <span className="text-slate-500">+</span>}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ShortcutMenu;
