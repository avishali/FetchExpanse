import React from 'react';

interface Props {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    isOpen: boolean;
}

const ConfirmDialog: React.FC<Props> = ({ 
    title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, isOpen 
}) => {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000
        }}>
            <div style={{
                background: 'white', padding: 20, borderRadius: 8, maxWidth: 400, width: '100%',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <h3 style={{ marginTop: 0 }}>{title}</h3>
                <p>{message}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                    <button className="btn btn-secondary" onClick={onCancel}>{cancelLabel}</button>
                    <button className="btn btn-primary" onClick={onConfirm}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
