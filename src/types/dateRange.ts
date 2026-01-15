import moment from 'moment';

export type DateRangePreset = 'this_year' | 'last_year' | 'ytd' | 'last_12_months' | 'custom' | 'month';

export interface DateRange {
    from: string; // YYYY-MM-DD (Inclusive)
    to: string;   // YYYY-MM-DD (Inclusive)
    fromDate: Date;
    toDate: Date;
    label: string;
    preset?: DateRangePreset;
}

export interface DateRangeArgs {
    year?: string | number;
    from?: string;
    to?: string;
    preset?: string;
}

export function resolveDateRange(args: DateRangeArgs): DateRange {
    let from: moment.Moment;
    let to: moment.Moment;
    let label = 'Custom Range';
    let preset: DateRangePreset = 'custom';

    if (args.preset && args.preset !== 'custom' && args.preset !== 'month') {
        // Handle presets
        switch (args.preset) {
            case 'this_year':
                from = moment().startOf('year');
                to = moment().endOf('year');
                label = 'This Year';
                preset = 'this_year';
                break;
            case 'last_year':
                from = moment().subtract(1, 'year').startOf('year');
                to = moment().subtract(1, 'year').endOf('year');
                label = 'Last Year';
                preset = 'last_year';
                break;
            case 'last_12_months':
                from = moment().subtract(12, 'months');
                to = moment();
                label = 'Last 12 Months';
                preset = 'last_12_months';
                break;
            case 'ytd':
            default:
                from = moment().startOf('year');
                to = moment();
                label = 'Year to Date';
                preset = 'ytd';
                break;
        }
    } else if (args.from || args.to) {
        // Custom range
        if (args.from && args.to) {
            from = moment(args.from);
            to = moment(args.to);
        } else if (args.from) {
            from = moment(args.from);
            to = moment(); // Today
        } else { // args.to only
            to = moment(args.to);
            from = moment(to).subtract(365, 'days');
        }
        label = `${from.format('YYYY-MM-DD')} to ${to.format('YYYY-MM-DD')}`;
    } else if (args.year) {
        // Fallback to year arg
        const year = parseInt(String(args.year));
        from = moment().year(year).startOf('year');
        to = moment().year(year).endOf('year');
        label = `Year ${year}`;
        preset = 'custom'; 
    } else {
        // Default to YTD
        from = moment().startOf('year');
        to = moment();
        label = 'Year to Date';
        preset = 'ytd';
    }

    if (!from.isValid() || !to.isValid()) {
        throw new Error(`Invalid date range`);
    }

    return {
        from: from.format('YYYY-MM-DD'),
        to: to.format('YYYY-MM-DD'),
        fromDate: from.toDate(),
        toDate: to.toDate(),
        label,
        preset
    };
}
