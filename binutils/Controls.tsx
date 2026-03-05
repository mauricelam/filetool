import React from 'react';

interface Flag {
    flag: string;
    label: string;
}

interface ControlsProps {
    toolName: string;
    flags: Flag[];
    selectedFlags: string[];
    onFlagChange: (toolName: string, flag: string, checked: boolean) => void;
}

export const Controls: React.FC<ControlsProps> = ({ toolName, flags, selectedFlags, onFlagChange }) => {
    return (
        <div className="binutils-controls">
            {flags.map((flagInfo) => (
                <label key={flagInfo.flag} className="flag-label">
                    <input
                        type="checkbox"
                        checked={selectedFlags.includes(flagInfo.flag)}
                        onChange={(e) => onFlagChange(toolName, flagInfo.flag, e.target.checked)}
                    />
                    <span>{flagInfo.flag}: {flagInfo.label}</span>
                </label>
            ))}
        </div>
    );
};
