import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '../../src/tokens.css';
import '../../src/brand.css';
import '../../src/certificate.css';
import '../../src/styles.css';
import '../../src/site.css';
import '../../src/class.css';
import '../../src/attendance.css';

import { AuthProvider } from './AuthContext.jsx';
import PublicShell from '../../src/components/site/PublicShell.jsx';
import Sidebar from '../../src/components/Sidebar.jsx';
import RegisterPage from '../../src/pages/site/RegisterPage.jsx';
import JoinClassPage from '../../src/pages/site/JoinClassPage.jsx';
import ListPage from '../../src/pages/ListPage.jsx';
import WorkshopPage from '../../src/pages/WorkshopPage.jsx';
import PeoplePage from '../../src/pages/PeoplePage.jsx';
import ConsolePage from '../../src/pages/ConsolePage.jsx';
import AttendancePage from '../../src/pages/AttendancePage.jsx';
import ClassPage from '../../src/pages/ClassPage.jsx';
import ImportPage from '../../src/pages/ImportPage.jsx';
import EditPage from '../../src/pages/EditPage.jsx';
import TicketPage from '../../src/pages/TicketPage.jsx';
import IdCardsPage from '../../src/pages/IdCardsPage.jsx';
import '../../src/idcard.css';

const at = new URLSearchParams(location.search).get('at') || '/';
const isPublic = /^\/(register|class)\//.test(at);

/* The admin shell, copied from App.jsx: sidebar, main, footer. */
function AdminShell({ children }) {
  return (
    <div className="shell">
      <Sidebar />
      <div className="shell-main">
        <main>{children}</main>
        <div className="foot">WORKSHOP by Al-Majeed School of Research Methodology and Innovation</div>
      </div>
    </div>
  );
}

const Shell = isPublic ? PublicShell : AdminShell;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <MemoryRouter initialEntries={[at]}>
        <Shell>
          <Routes>
            <Route path="/register/:workshopId" element={<RegisterPage />} />
            <Route path="/class/:workshopId" element={<JoinClassPage />} />
            <Route path="/" element={<ListPage />} />
            <Route path="/w/:id" element={<WorkshopPage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/console" element={<ConsolePage />} />
            <Route path="/w/:id/attendance" element={<AttendancePage />} />
            <Route path="/w/:id/class" element={<ClassPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/w/:id/edit" element={<EditPage />} />
            <Route path="/w/:id/t/:regId" element={<TicketPage />} />
            <Route path="/w/:id/cards" element={<IdCardsPage />} />
          </Routes>
        </Shell>
      </MemoryRouter>
    </AuthProvider>
  </StrictMode>,
);
