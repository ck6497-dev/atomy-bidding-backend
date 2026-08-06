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
      const hash = window.location.hash || '';
      const queryString = hash.includes('?') ? hash.split('?')[1] : '';
      const urlParams = new URLSearchParams(queryString);
      const targetEmail = urlParams.get('email');

      if (requiredRole === 'admin' && !isAdmin()) {
        return navigate('#/rate-entry');
      }

      if (requiredRole === 'forwarder') {
        // 메일 링크를 통해 특정 이메일로 접속 요청이 들어온 경우
        if (targetEmail && session && session.email !== targetEmail) {
          clearSession();
          return navigate('#/login?email=' + encodeURIComponent(targetEmail));
        }
        // 관리자로 로그인된 상태에서 포워더 전용 운임입력 메일 링크 클릭 시
        if (!isForwarder()) {
          if (session && isAdmin()) {
            clearSession();
            return navigate('#/login' + (targetEmail ? '?email=' + encodeURIComponent(targetEmail) : ''));
          }
          return navigate('#/login');
        }
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
