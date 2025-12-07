import { useState, useEffect } from 'react';
import ReconciliationModal from '../components/ReconciliationModal';
import ExportQueue from '../components/accountant/ExportQueue';
import StatementVault from '../components/accountant/StatementVault';
import AuditTrail from '../components/accountant/AuditTrail';
import ChartingModule from '../components/accountant/ChartingModule'; // optional
import ForecastSimulator from '../components/ForecastSimulator';
import FounderOverridePanel from '../components/auth/FounderOverridePanel';
import { useUser } from '../hooks/useUser';
import { logAudit } from '../utils/audit';
import withAdminAccess from '../components/auth/withAdminAccess';

function AdminCockpit() {
  const [showTools, setShowTools] = useState(false);
  const { user } = useUser();

  useEffect(() => {
    if (user?.email) {
      try {
        logAudit({
          action: 'VIEW_ADMIN_COCKPIT',
          actor: user.email,
          timestamp: new Date().toISOString(),
          context: { route: '/admin-cockpit' }
        });
      } catch (err) {
        console.error('Audit log failed:', err);
      }
    }
  }, [user]);

  const handleToggle = () => {
    const nextState = !showTools;
    setShowTools(nextState);

    try {
      logAudit({
        action: 'TOGGLE_ACCOUNTANT_TOOLS',
        actor: user?.email || 'unknown',
        timestamp: new Date().toISOString(),
        context: {
          route: '/admin-cockpit',
          showTools: nextState
        }
      });
    } catch (err) {
      console.error('Audit log failed:', err);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        Admin Cockpit
      </h1>
      <button
        onClick={handleToggle}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontWeight: 'bold',
          cursor: 'pointer',
          marginBottom: '2rem'
        }}
      >
        {showTools ? 'Hide Tools' : 'Show Full Accountant Tools'}
      </button>

      {showTools && (
        <div style={{ display: 'grid', gap: '2rem' }}>
          <ReconciliationModal />
          <ExportQueue />
          <StatementVault />
          <AuditTrail />
          <ChartingModule />
          <ForecastSimulator />
        </div>
      )}

      {user?.role === 'admin' && ( // ✅ normalized role check
        <div style={{ marginTop: '3rem' }}>
          <FounderOverridePanel />
        </div>
      )}
    </div>
  );
}

export default withAdminAccess(AdminCockpit);
