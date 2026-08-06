import { getSession, clearSession } from '../store.js';
import { navigate } from '../router.js';

export function renderHeader(container) {
  const session = getSession();
  
  // H2 수정: super_admin도 관리자로 표시
  const isAdminRole = session?.role === 'admin' || session?.role === 'super_admin';
  const roleName = isAdminRole ? (session?.role === 'super_admin' ? '최고관리자' : '관리자') : '포워더';
  const userName = isAdminRole ? roleName : (session?.forwarderName || '');
  
  const headerHtml = `
    <header class="header">
      <div class="header-logo" style="cursor: pointer;">🚢 Atomy Bidding</div>
      <div class="header-info"></div>
      <div class="header-user">
        ${session ? `
          <span class="badge badge-active">${roleName}</span>
          <span>${userName}</span>
          <button class="btn btn-sm btn-secondary" id="btn-logout">로그아웃</button>
        ` : ''}
      </div>
    </header>
  `;
  
  container.innerHTML = headerHtml;
  
  const logo = container.querySelector('.header-logo');
  if (logo) {
    logo.addEventListener('click', () => {
      // H3 수정: super_admin도 대시보드로 이동
      if (session?.role === 'admin' || session?.role === 'super_admin') navigate('#/dashboard');
      else if (session?.role === 'forwarder') navigate('#/rate-entry');
      else navigate('#/login');
    });
  }
  
  const logoutBtn = container.querySelector('#btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearSession();
      navigate('#/login');
    });
  }
}
