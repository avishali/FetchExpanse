import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { getMonthRange } from '../utils/dateHelper';
import { Page } from '../App';
import { CompletionCard } from '../components/CompletionCard';
import { CoverageTable } from '../components/CoverageTable';
import { useDateRange } from '../context/DateRangeContext';
import { DateRangePreset } from '../components/DateRangePicker';

interface Props {
  onNavigate: (page: Page, params?: any) => void;
}

const Dashboard: React.FC<Props> = ({ onNavigate }) => {
  const { range, setRange } = useDateRange();
  const [info, setInfo] = useState<any>(null);
  const [coverageSummary, setSummary] = useState<any>(null);
  const [coverageByMonth, setMonthCov] = useState<any[]>([]);
  const [exportingPack, setExportingPack] = useState(false);

  useEffect(() => {
    Promise.all([
        api.getAppInfo(),
        api.getCoverageSummary(range),
        api.getCoverageByMonth(range)
    ]).then(([appInfo, summary, months]) => {
        setInfo({ ...appInfo });
        setSummary(summary);
        setMonthCov(months);
    });
  }, [range]);

  if (!info) return <div>Loading...</div>;

  return (
    <div>
      <h1>Dashboard</h1>
      
      {coverageSummary && (
          <div style={{ marginBottom: 20 }}>
             <CompletionCard 
                summary={coverageSummary}
                periodLabel={range.preset === DateRangePreset.Custom ? 'Custom Range' : range.preset}
                onContinue={() => onNavigate('review', { initialFilter: 'TO_REVIEW' })}
                onExport={() => onNavigate('export')}
                onExportAccountantPack={async () => {
                    if (confirm('Generate Accountant Pack (ZIP)? This may take a moment.')) {
                        setExportingPack(true);
                        try {
                            const res = await api.exportAccountantPack(range);
                            alert(`Accountant Pack created!\nLocation: ${res.path}`);
                        } catch (e: any) {
                            alert('Error: ' + e.message);
                        }
                        setExportingPack(false);
                    }
                }}
             />
             {exportingPack && <div style={{marginTop: 10, color: '#3182ce', fontWeight: 'bold'}}>Generating Accountant Pack... please wait...</div>}
          </div>
      )}



      {coverageByMonth.length > 0 && (
          <div className="card">
              <h3>Monthly Breakdown</h3>
              <CoverageTable 
                data={coverageByMonth} 
                onSelectMonth={(month) => {
                    const [y, m] = month.split('-').map(Number);
                    // m is 1-based (01..12), helper expects 0-based (0..11)
                    const { fromStr, toInclusiveStr } = getMonthRange(y, m - 1);
                    
                    setRange({ 
                        preset: DateRangePreset.Month, 
                        month: month, 
                        from: fromStr, 
                        to: toInclusiveStr 
                    });
                    onNavigate('review', { initialFilter: 'TO_REVIEW' });
                }}
             />
             {range.preset === DateRangePreset.Month && range.month && range.from && range.to && (
                 <div style={{ marginTop: 10,  fontSize: 13, background: '#edf2f7', padding: '8px 12px', borderRadius: 4, display: 'inline-block', textAlign: 'left' }}>
                     <div style={{ color: '#2d3748', fontWeight: 'bold' }}>
                        Range: {range.from} → {range.to} 
                        {' '}({Math.round((new Date(range.to).getTime() - new Date(range.from).getTime()) / (1000 * 60 * 60 * 24)) + 1} days)
                     </div>
                     <div style={{ color: '#718096', fontSize: 11, marginTop: 4, fontFamily: 'monospace' }}>
                        Query bounds: from={range.from}T00:00:00.000 local, to={range.to}T23:59:59.999 local
                     </div>
                 </div>
             )}
          </div>
      )}

      {/* Auth Status Card */}
      <div className="card">
        <h3>Status</h3>
        <p><strong>Gmail Auth:</strong> {info.auth.gmail ? '✅ Connected' : '❌ Not Connected'}</p>
        <p><strong>Dropbox Auth:</strong> {info.auth.dropbox ? '✅ Connected' : '❌ Not Connected'}</p>
        <div style={{ marginTop: 10 }}>
           {!info.auth.gmail && <button className="btn" onClick={() => onNavigate('settings')}>Connect Gmail</button>}
           {' '}
           {!info.auth.dropbox && <button className="btn" onClick={() => onNavigate('settings')}>Connect Dropbox</button>}
        </div>
      </div>

      <div className="card">
        <h3>Actions</h3>
        <button className="btn" onClick={() => onNavigate('scan')}>Run Scan</button>
        {' '}
        <button className="btn" style={{ background: '#666' }} onClick={() => onNavigate('review')}>Review Items</button>
      </div>

      <p><small>App v{info.version} • Data: {info.dataDir}</small></p>
    </div>
  );
};

export default Dashboard;
