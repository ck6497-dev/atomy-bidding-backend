import { getSession, isAdmin, isForwarder, clearSession } from './store.js';
import { registerRoute, navigate, initRouter } from './router.js';
import { renderHeader } from './components/Header.js';
import { renderSidebar } from './components/Sidebar.js';
import { renderLoginPage } from './pages/LoginPage.js';
import { renderDashboardPage } from './pages/DashboardPage.js';
import { renderRoutesPage } from './pages/RoutesPage.js';
import { renderForwardersPage } from './pages/ForwardersPage.js';
import { renderBiddingPage } from './pages/BiddingPage.js';
import { renderRateEntryPage } from './pages/RateEntryPage.js';
import { renderAdminsPage } from './pages/AdminsPage.js';

document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  function renderAppLayout() {
    const session = getSession();
    if (!session) {
      appContainer.innerHTML = '<div id="main-content"></div>';
      return document.getElementById('main-content');
    }
    
    appContainer.innerHTML = `
      <div id="header-container"></div>
      <div id="sidebar-container"></div>
      <main class="main-content" id="main-content"></main>
    `;
    
    renderHeader(document.getElementById('header-container'));
    renderSidebar(document.getElementById('sidebar-container'));
    
    return document.getElementById('main-content');
  }

  // Route handler wrapper — supports async page renderers
  function withLayout(pageRenderer, requiredRole) {
    return async (container) => {
      const session = getSession();
      if (requiredRole === 'admin' && !isAdmin()) {
        return navigate('#/rate-entry');
      }
      if (requiredRole === 'forwarder' && !isForwarder()) {
        return navigate('#/dashboard');
      }
      
      const mainContent = renderAppLayout();
      mainContent.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:200px;color:var(--text-secondary);">로딩 중...</div>';
      await pageRenderer(mainContent);
    };
  }

  // Register routes
  registerRoute('#/login', (container) => {
    const mainContent = renderAppLayout();
    renderLoginPage(mainContent);
  });
  
  registerRoute('#/dashboard', withLayout(renderDashboardPage, 'admin'));
  registerRoute('#/routes', withLayout(renderRoutesPage, 'admin'));
  registerRoute('#/forwarders', withLayout(renderForwardersPage, 'admin'));
  registerRoute('#/bidding', withLayout(renderBiddingPage, 'admin'));
  registerRoute('#/rate-entry', withLayout(renderRateEntryPage, 'forwarder'));
  registerRoute('#/admins', withLayout(renderAdminsPage, 'admin'));

  // Initial navigation
  const session = getSession();
  if (!session) {
    if (!window.location.hash || window.location.hash === '#/login') {
      // Stay on login
    } else {
      navigate('#/login');
    }
  } else {
    if (!window.location.hash || window.location.hash === '' || window.location.hash === '#/' || window.location.hash === '#/login') {
      if (isAdmin()) navigate('#/dashboard');
      else navigate('#/rate-entry');
    }
  }

  initRouter(appContainer);
});
