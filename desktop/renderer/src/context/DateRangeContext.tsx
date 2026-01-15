import React, { createContext, useContext, useState, ReactNode } from 'react';
import { DateRangeState, DateRangePreset } from '../components/DateRangePicker';

interface DateRangeContextType {
    range: DateRangeState;
    setRange: (range: DateRangeState) => void;
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

export const DateRangeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Default to YTD
    const [range, setRangeState] = useState<DateRangeState>(() => {
        try {
            const stored = localStorage.getItem('expense_date_range');
            if (stored) return JSON.parse(stored);
        } catch (e) {
            console.error('Failed to parse stored date range', e);
        }
        return { preset: DateRangePreset.YTD };
    });

    const setRange = (newRange: DateRangeState) => {
        setRangeState(newRange);
        localStorage.setItem('expense_date_range', JSON.stringify(newRange));
    };

    return (
        <DateRangeContext.Provider value={{ range, setRange }}>
            {children}
        </DateRangeContext.Provider>
    );
};

export const useDateRange = () => {
    const context = useContext(DateRangeContext);
    if (!context) {
        throw new Error('useDateRange must be used within a DateRangeProvider');
    }
    return context;
};
