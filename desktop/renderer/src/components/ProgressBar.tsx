import React from 'react';

interface Props {
    current: number;
    total: number;
    label?: string;
}

const ProgressBar: React.FC<Props> = ({ current, total, label }) => {
    const pct = total > 0 ? (current / total) * 100 : 0;
    
    return (
        <div style={{ margin: '15px 0' }}>
            {label && <div style={{ marginBottom: 5, fontSize: 14 }}>{label}</div>}
            <div style={{ height: 10, background: '#eee', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ 
                    height: '100%', 
                    width: `${pct}%`, 
                    background: '#0969da',
                    transition: 'width 0.3s ease' 
                }}></div>
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 3, textAlign: 'right' }}>{current} / {total}</div>
        </div>
    );
};

export default ProgressBar;
