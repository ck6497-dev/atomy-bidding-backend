import { getSession, clearSession } from '../store.js';
import { navigate } from '../router.js';

// 테마 초기화: localStorage에 저장된 테마를 적용
export function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved === 'light' ? 'light' : '');
}

// 테마 전환
function toggleTheme(btn) {
  const current = localStorage.getItem('theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', next);
  document.documentElement.setAttribute('data-theme', next === 'light' ? 'light' : '');
  if (btn) btn.querySelector('.theme-icon').textContent = next === 'dark' ? '🌙' : '☀️';
}

export function renderHeader(container) {
  const session = getSession();
  
  // H2 수정: super_admin도 관리자로 표시
  const isAdminRole = session?.role === 'admin' || session?.role === 'super_admin';
  const roleName = isAdminRole ? (session?.role === 'super_admin' ? '최고관리자' : '관리자') : (session?.forwarderName || '포워더');
  const userName = isAdminRole ? roleName : (session?.forwarderName || '');

  const currentTheme = localStorage.getItem('theme') || 'dark';
  const themeIcon = currentTheme === 'dark' ? '🌙' : '☀️';
  const themeLabel = currentTheme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환';
  
  const headerHtml = `
    <header class="header">
      <div class="header-logo" style="cursor: pointer;">🚢 Atomy Bidding</div>
      <div class="header-info"></div>
      <div class="header-user">
        ${session ? `
          <span class="badge badge-active">${roleName}</span>
          <span>${userName}</span>
        ` : ''}
        <button class="theme-toggle-btn" id="btn-theme-toggle" title="${themeLabel}" aria-label="${themeLabel}">
          <span class="theme-icon">${themeIcon}</span>
        </button>
        ${session ? `
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

  const themeBtn = container.querySelector('#btn-theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => toggleTheme(themeBtn));
  }
  
  const logoutBtn = container.querySelector('#btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearSession();
      navigate('#/login');
    });
  }
}
