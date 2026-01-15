import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Scan from './pages/Scan';
import Settings from './pages/Settings';
import ReviewList from './pages/ReviewList';
import ReviewDetail from './pages/ReviewDetail';
import Export from './pages/Export';
import Recurring from './pages/Recurring';

// Simple Router since we want minimal deps. 
// Can upgrade to react-router-dom if needed, but state-based router works for MVP.

import { BankPage } from './pages/Bank';
import { ReconciliationPage } from './pages/Reconciliation';

export type Page = 'dashboard' | 'scan' | 'review' | 'export' | 'recurring' | 'settings' | 'bank' | 'reconciliation';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [navParams, setNavParams] = useState<any>({});
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [reviewFilter, setReviewFilter] = useState('TO_REVIEW');

  const navigate = (page: Page, params?: any) => {
      setCurrentPage(page);
      setNavParams(params || {});
      if (params?.initialFilter) {
          setReviewFilter(params.initialFilter);
      }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onNavigate={navigate} />;
      case 'scan': return <Scan />;
      case 'review': 
        if (reviewId) return <ReviewDetail id={reviewId} onBack={() => setReviewId(null)} onNext={(id) => setReviewId(id)} />;
        return <ReviewList onSelect={setReviewId} filter={reviewFilter} onFilterChange={setReviewFilter} />;
      case 'export': return <Export />;
      case 'recurring': return <Recurring />;
      case 'settings': return <Settings />;
      case 'bank': return <BankPage onNavigate={navigate} />;
      case 'reconciliation': return <ReconciliationPage accountId={navParams.accountId} onBack={() => navigate('bank')} />;
      default: return <div>Page {currentPage} coming soon</div>;
    }
  };

  return (
    <div className="layout">
      <Sidebar activePage={currentPage} onNavigate={setCurrentPage} />
      <div className="content">
        {renderPage()}
      </div>
    </div>
  );
}

export default App;
