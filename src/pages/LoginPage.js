import { setSession, getForwarders } from '../store.js';
import { navigate } from '../router.js';

export function renderLoginPage(container) {
  const forwarders = getForwarders();
  
  const html = `
    <div class="login-container" style="background: var(--bg-primary); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem;">
      <div class="login-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); box-shadow: 0 8px 32px rgba(0,0,0,0.5); backdrop-filter: blur(10px); padding: 3rem; border-radius: 1rem; width: 100%; max-width: 500px;">
        <div class="text-center" style="margin-bottom: 2.5rem; text-align: center;">
          <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem; color: var(--text-primary); text-shadow: 0 2px 4px rgba(0,0,0,0.3);">🚢 Atomy Bidding</h1>
          <p style="color: var(--text-secondary);">스마트한 해상 운임 비교 시스템</p>
        </div>
        
        <div class="role-cards" style="display: flex; gap: 1rem; margin-bottom: 2rem;">
          <div class="role-card" id="card-admin" style="flex: 1; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 0.75rem; padding: 2rem 1rem; text-align: center; cursor: pointer; transition: all 0.3s ease;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">👨‍💼</div>
            <h3 style="color: var(--text-primary); margin: 0;">관리자</h3>
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.5rem;">노선/포워더 관리 및 운임 비교 대시보드</p>
          </div>
          
          <div class="role-card" id="card-forwarder" style="flex: 1; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 0.75rem; padding: 2rem 1rem; text-align: center; cursor: pointer; transition: all 0.3s ease;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🚢</div>
            <h3 style="color: var(--text-primary); margin: 0;">포워더</h3>
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.5rem;">담당 노선 운임 입력</p>
          </div>
        </div>
        
        <div id="forwarder-selection" class="hidden" style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid var(--border-color); display: none;">
          <div class="form-group">
            <label class="form-label" style="color: var(--text-primary); display: block; margin-bottom: 0.5rem;">포워더 선택</label>
            <select id="forwarder-select" class="form-select" style="width: 100%; margin-bottom: 1rem; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 0.75rem; border-radius: 0.5rem;">
              <option value="">소속을 선택하세요</option>
              ${forwarders.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
            </select>
            <button id="btn-start-forwarder" class="btn btn-primary" style="width: 100%; padding: 0.75rem; font-size: 1.1rem; border-radius: 0.5rem; transition: all 0.3s ease;" disabled>시작하기</button>
          </div>
        </div>
      </div>
    </div>
    <style>
      .role-card:hover {
        transform: translateY(-5px);
        border-color: var(--accent);
        box-shadow: 0 0 15px var(--accent-glow);
        background: linear-gradient(145deg, var(--bg-secondary), var(--bg-hover));
      }
      .hidden { display: none !important; }
      #forwarder-selection:not(.hidden) { display: block !important; }
      #btn-start-forwarder:not(:disabled):hover {
        background: var(--accent-hover);
        box-shadow: 0 0 10px var(--accent-glow);
      }
    </style>
  `;
  
  container.innerHTML = html;
  
  const cardAdmin = container.querySelector('#card-admin');
  const cardForwarder = container.querySelector('#card-forwarder');
  const forwarderSelection = container.querySelector('#forwarder-selection');
  const forwarderSelect = container.querySelector('#forwarder-select');
  const btnStartForwarder = container.querySelector('#btn-start-forwarder');
  
  cardAdmin.addEventListener('click', () => {
    setSession({ role: 'admin', forwarderId: null, forwarderName: null });
    navigate('#/dashboard');
  });
  
  cardForwarder.addEventListener('click', () => {
    if (forwarderSelection.classList.contains('hidden')) {
      forwarderSelection.classList.remove('hidden');
      forwarderSelection.style.opacity = '0';
      forwarderSelection.style.transform = 'translateY(-10px)';
      forwarderSelection.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        forwarderSelection.style.opacity = '1';
        forwarderSelection.style.transform = 'translateY(0)';
      }, 10);
    }
  });
  
  forwarderSelect.addEventListener('change', (e) => {
    if (e.target.value) {
      btnStartForwarder.disabled = false;
    } else {
      btnStartForwarder.disabled = true;
    }
  });
  
  btnStartForwarder.addEventListener('click', () => {
    const selectedId = forwarderSelect.value;
    const selectedForwarder = forwarders.find(f => f.id === selectedId);
    if (selectedForwarder) {
      setSession({ 
        role: 'forwarder', 
        forwarderId: selectedForwarder.id, 
        forwarderName: selectedForwarder.name 
      });
      navigate('#/rate-entry');
    }
  });
}
