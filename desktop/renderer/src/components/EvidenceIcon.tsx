
import React from 'react';

interface Props {
    hasAttachment: boolean | number;
    linksJson?: string;
}

export const EvidenceIcon: React.FC<Props> = ({ hasAttachment, linksJson }) => {
    // Priority 1: PDF (Attachment)
    if (hasAttachment) {
        return <span title="PDF attached (Strong evidence)">📄</span>;
    }

    // Priority 2: Link
    if (linksJson) {
        try {
            const links = JSON.parse(linksJson);
            if (links && links.length > 0) {
                // Check if any is image or generic link
                // For now, assume all captured links are good
                return <span title="Invoice link captured">🔗</span>;
            }
        } catch (e) {}
    }

    // Fallback / Warning
    // If we are here, there is NO evidence? 
    // Review list logic usually implies we display something or empty?
    // If the caller calls this, they expect an icon.
    // If item labels says EXPENSE but no evidence -> Warning
    return <span title="No direct evidence found" style={{ opacity: 0.5 }}>⚠️</span>;
};
