import React from 'react';

interface SidebarProps {
    tools: { name: string }[];
    selectedTool: string;
    onSelect: (tool: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ tools, selectedTool, onSelect }) => {
    return (
        <aside className="binutils-sidebar">
            <div className="sidebar-inner">
                <h3>Tools</h3>
                <ul className="tool-list">
                    {tools.map((tool) => (
                        <li
                            key={tool.name}
                            className={`tool-item ${selectedTool === tool.name ? 'selected' : ''}`}
                            onClick={() => onSelect(tool.name)}
                        >
                            {tool.name}
                        </li>
                    ))}
                </ul>
            </div>
        </aside>
    );
};
