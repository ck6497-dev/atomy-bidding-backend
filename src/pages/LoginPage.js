import { setSession, setToken, loginApi, setPasswordApi } from '../store.js';
import { navigate } from '../router.js';

export function renderLoginPage(container) {
  let isSettingPassword = false;
  let currentEmail = '';

  const renderForm = () => {
    container.innerHTML = `
      <div class="login-container" style="background: var(--bg-primary); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem;">
        <div class="login-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); box-shadow: 0 8px 32px rgba(0,0,0,0.5); backdrop-filter: blur(10px); padding: 3rem; border-radius: 1rem; width: 100%; max-width: 400px;">
          <div class="text-center" style="margin-bottom: 2.5rem; text-align: center;">
            <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem; color: var(--text-primary); text-shadow: 0 2px 4px rgba(0,0,0,0.3);">🚢 Atomy Bidding</h1>
            <p style="color: var(--text-secondary);">${isSettingPassword ? '최초 로그인 - 비밀번호 설정' : '스마트한 해상 운임 비교 시스템'}</p>
          </div>
          
          <form id="login-form">
            ${!isSettingPassword ? `
              <div class="form-group" style="margin-bottom: 1.5rem;">
                <label style="color: var(--text-primary); display: block; margin-bottom: 0.5rem;">이메일 아이디</label>
                <input type="email" id="email" class="form-input" required placeholder="admin@example.com" style="width: 100%; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 0.75rem; border-radius: 0.5rem;">
              </div>
              <div class="form-group" style="margin-bottom: 2rem;">
                <label style="color: var(--text-primary); display: block; margin-bottom: 0.5rem;">비밀번호</label>
                <input type="password" id="password" class="form-input" required placeholder="비밀번호를 입력하세요" style="width: 100%; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 0.75rem; border-radius: 0.5rem;">
              </div>
            ` : `
              <div class="form-group" style="margin-bottom: 1.5rem;">
                <label style="color: var(--text-primary); display: block; margin-bottom: 0.5rem;">새 비밀번호</label>
                <input type="password" id="new-password" class="form-input" required placeholder="새 비밀번호 입력" style="width: 100%; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 0.75rem; border-radius: 0.5rem;">
              </div>
              <div class="form-group" style="margin-bottom: 2rem;">
                <label style="color: var(--text-primary); display: block; margin-bottom: 0.5rem;">새 비밀번호 확인</label>
                <input type="password" id="new-password-confirm" class="form-input" required placeholder="새 비밀번호 재입력" style="width: 100%; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 0.75rem; border-radius: 0.5rem;">
              </div>
            `}
            <button type="submit" class="btn btn-primary" style="width: 100%; padding: 0.75rem; font-size: 1.1rem; border-radius: 0.5rem;">
              ${isSettingPassword ? '비밀번호 설정 및 로그인' : '로그인'}
            </button>
            <div id="error-msg" style="color: #ef4444; margin-top: 1rem; text-align: center; display: none;"></div>
          </form>
        </div>
      </div>
    `;

    const form = container.querySelector('#login-form');
    const errorMsg = container.querySelector('#error-msg');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorMsg.style.display = 'none';
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      try {
        if (!isSettingPassword) {
          const email = container.querySelector('#email').value;
          const password = container.querySelector('#password').value;
          
          const result = await loginApi(email, password);
          
          if (result.error) {
            throw new Error(result.error);
          }

          if (result.require_password_setup) {
            isSettingPassword = true;
            currentEmail = result.email;
            renderForm();
            return;
          }

          // 정상 로그인
          setToken(result.token);
          setSession({
            role: result.user.role,
            email: result.user.email,
            id: result.user.id,
            forwarderId: result.user.forwarderId || null
          });
          
          if (result.user.role === 'admin' || result.user.role === 'super_admin') {
            navigate('#/dashboard');
          } else {
            navigate('#/rate-entry');
          }
        } else {
          // 비밀번호 설정
          const newPassword = container.querySelector('#new-password').value;
          const confirmPassword = container.querySelector('#new-password-confirm').value;

          if (newPassword !== confirmPassword) {
            throw new Error('비밀번호가 일치하지 않습니다.');
          }
          if (newPassword.length < 6) {
            throw new Error('비밀번호는 최소 6자리 이상이어야 합니다.');
          }

          const result = await setPasswordApi(currentEmail, newPassword);
          if (result.error) {
            throw new Error(result.error);
          }

          setToken(result.token);
          setSession({
            role: result.user.role,
            email: result.user.email,
            id: result.user.id,
            forwarderId: result.user.forwarderId || null
          });

          if (result.user.role === 'admin' || result.user.role === 'super_admin') {
            navigate('#/dashboard');
          } else {
            navigate('#/rate-entry');
          }
        }
      } catch (err) {
        errorMsg.textContent = err.message;
        errorMsg.style.display = 'block';
        submitBtn.disabled = false;
      }
    });
  };

  renderForm();
}
