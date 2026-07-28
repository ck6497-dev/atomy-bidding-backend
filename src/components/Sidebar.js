import { getSession } from '../store.js';
import { navigate, getCurrentRoute } from '../router.js';

export function renderSidebar(container) {
  const session = getSession();
  if (!session) {
    container.innerHTML = '';
    return;
  }
  
  let menuItems = [];
  if (session.role === 'admin') {
    menuItems = [
      { path: '#/dashboard', icon: '📊', text: '대시보드' },
      { path: '#/routes', icon: '🗺️', text: '노선 관리' },
      { path: '#/forwarders', icon: '🏢', text: '포워더 관리' },
      { path: '#/bidding', icon: '📋', text: '입찰 관리' }
    ];
  } else if (session.role === 'forwarder') {
    menuItems = [
      { path: '#/rate-entry', icon: '📝', text: '운임 입력' }
    ];
  }
  
  const updateActiveState = () => {
    const currentRoute = getCurrentRoute();
    const items = container.querySelectorAll('.sidebar-item');
    items.forEach(item => {
      if (item.getAttribute('href') === currentRoute) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  };
  
  const sidebarHtml = `
    <aside class="sidebar">
      <nav class="sidebar-menu">
        ${menuItems.map(item => `
          <a class="sidebar-item" href="${item.path}">
            <span class="sidebar-item-icon">${item.icon}</span>
            <span class="sidebar-item-text">${item.text}</span>
          </a>
        `).join('')}
      </nav>
      <div class="sidebar-footer">
        <small>© 2026 Atomy Bidding</small>
      </div>
    </aside>
  `;
  
  container.innerHTML = sidebarHtml;
  
  const links = container.querySelectorAll('.sidebar-item');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(link.getAttribute('href'));
    });
  });
  
  updateActiveState();
  
  window.addEventListener('hashchange', updateActiveState);
}
