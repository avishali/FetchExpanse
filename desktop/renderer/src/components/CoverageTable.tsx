
import React from 'react';
import { formatDate } from '../utils/displayFormat';

interface MonthCoverage {
    month: string;
    count_expense: number;
    count_to_review: number;
    missing_evidence: number;
    missing_amount: number;
}

interface Props {
    data: MonthCoverage[];
    onSelectMonth: (month: string) => void;
}

export const CoverageTable: React.FC<Props> = ({ data, onSelectMonth }) => {
    
    const getBadge = (row: MonthCoverage) => {
        if (row.count_to_review > 0 || row.missing_evidence > 0) {
            return <span style={{ color: '#c53030', fontWeight: 'bold' }}>RED</span>;
        }
        if (row.missing_amount > 0) {
            return <span style={{ color: '#d69e2e', fontWeight: 'bold' }}>YELLOW</span>;
        }
        return <span style={{ color: '#2c7a7b', fontWeight: 'bold' }}>GREEN</span>;
    };

    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
            <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee', fontSize: 13, color: '#666' }}>
                    <th style={{ padding: 10 }}>Month</th>
                    <th style={{ padding: 10, textAlign: 'right' }}>Expenses</th>
                    <th style={{ padding: 10, textAlign: 'right' }}>To Review</th>
                    <th style={{ padding: 10, textAlign: 'right' }}>Missing Evidence</th>
                    <th style={{ padding: 10, textAlign: 'right' }}>Missing Amount</th>
                    <th style={{ padding: 10, textAlign: 'center' }}>Readiness</th>
                    <th style={{ padding: 10 }}></th>
                </tr>
            </thead>
            <tbody>
                {data.map(row => (
                    <tr key={row.month} 
                        style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
                        onClick={() => onSelectMonth(row.month)}
                        className="hover-row"
                    >
                        <td style={{ padding: 10, fontWeight: 'bold' }}>{row.month}</td>
                        <td style={{ padding: 10, textAlign: 'right' }}>{row.count_expense}</td>
                        <td style={{ padding: 10, textAlign: 'right', color: row.count_to_review > 0 ? '#e53e3e' : '#ccc' }}>
                            {row.count_to_review}
                        </td>
                        <td style={{ padding: 10, textAlign: 'right', color: row.missing_evidence > 0 ? '#e53e3e' : '#ccc' }}>
                            {row.missing_evidence}
                        </td>
                        <td style={{ padding: 10, textAlign: 'right', color: row.missing_amount > 0 ? '#d69e2e' : '#ccc' }}>
                            {row.missing_amount}
                        </td>
                        <td style={{ padding: 10, textAlign: 'center' }}>
                            {getBadge(row)}
                        </td>
                        <td style={{ padding: 10, textAlign: 'right' }}>
                            <span style={{ color: '#2b6cb0', fontSize: 12 }}>Review &rarr;</span>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};
