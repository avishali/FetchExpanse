import React from 'react';
import { Page } from '../App';

interface Props {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const Sidebar: React.FC<Props> = ({ activePage, onNavigate }) => {
  const links: { id: Page; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'scan', label: 'Scan' },
    { id: 'review', label: 'Organize' },
    { id: 'export', label: 'Export' },
    { id: 'recurring', label: 'Recurring' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="sidebar">
      <h2>FetchExpanse</h2>
      <nav>
        {links.map(link => (
          <a
            key={link.id}
            href="#"
            className={activePage === link.id ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); onNavigate(link.id); }}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
