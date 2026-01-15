import React, { useState, useEffect } from 'react';
import { getMonthRange } from '../utils/dateHelper';

// Shared type (or re-defined)
// Shared type (or re-defined)
export enum DateRangePreset {
    ThisYear = 'this_year',
    LastYear = 'last_year',
    YTD = 'ytd',
    Last12Months = 'last_12_months',
    Month = 'month',
    Custom = 'custom',
}

export interface DateRangeState {
    preset: DateRangePreset;
    from?: string;
    to?: string;
    month?: string; // YYYY-MM
}

interface Props {
    value: DateRangeState;
    onChange: (val: DateRangeState) => void;
}

const DateRangePicker: React.FC<Props> = ({ value, onChange }) => {
    const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange({ ...value, preset: e.target.value as DateRangePreset });
    };

    const handleDateChange = (field: 'from' | 'to', val: string) => {
        onChange({ ...value, [field]: val, preset: DateRangePreset.Custom });
    };

    const handleMonthChange = (val: string) => {
        if (!val) return;
        // val is YYYY-MM
        const [year, month] = val.split('-').map(Number);
        
        // Use shared helper (month is 1-based from split, helper wants 0-based)
        const { fromStr, toInclusiveStr } = getMonthRange(year, month - 1);
        
        onChange({ 
            preset: DateRangePreset.Month,
            month: val,
            from: fromStr,
            to: toInclusiveStr
        });
    };

    return (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
            <div>
                <label style={{ display: 'block', fontSize: 12 }}>Period</label>
                <select value={value.preset} onChange={handlePresetChange} style={{ padding: 5 }}>
                    <option value="this_year">This Year</option>
                    <option value="last_year">Last Year</option>
                    <option value="ytd">Year to Date (2026)</option>
                    <option value="month">Specific Month</option>
                    <option value="last_12_months">Last 12 Months</option>
                    <option value="custom">Custom</option>
                </select>
            </div>

            {value.preset === DateRangePreset.Month && (
                <div>
                     <label style={{ display: 'block', fontSize: 12 }}>Month</label>
                     <input 
                        type="month" 
                        value={value.month || ''} 
                        onChange={e => handleMonthChange(e.target.value)}
                        style={{ padding: 5 }}
                    />
                </div>
            )}
            
            <div>
                <label style={{ display: 'block', fontSize: 12 }}>From</label>
                <input 
                    type="date" 
                    value={value.from || ''} 
                    onChange={e => handleDateChange('from', e.target.value)}
                    style={{ padding: 5 }}
                />
            </div>
            
            <div>
                 <label style={{ display: 'block', fontSize: 12 }}>To</label>
                 <input 
                    type="date" 
                    value={value.to || ''} 
                    onChange={e => handleDateChange('to', e.target.value)}
                    style={{ padding: 5 }}
                />
            </div>
        </div>
    );
};

export default DateRangePicker;
