import { getForwarders, addForwarder, updateForwarder, deleteForwarder, getRoutes, isSuperAdmin } from '../store.js';
import { showModal, closeModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';

export async function renderForwardersPage(container) {
  async function render() {
    const forwarders = await getForwarders();
    const canEdit = isSuperAdmin();

    container.innerHTML = `
      <div class="page-header">
        <h2>🏢 포워더 관리</h2>
        <div class="header-actions">
          ${canEdit ? `<button id="btn-add-forwarder" class="btn btn-primary">포워더 추가</button>` : ''}
          ${!canEdit ? `<span style="font-size:var(--font-xs);color:var(--text-muted);align-self:center;">👁️ 조회 전용 (편집은 최고관리자만 가능)</span>` : ''}
        </div>
      </div>
      
      <div class="card-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem;">
        ${forwarders.length > 0 ? forwarders.map(f => {
          const emails = (f.email || '').split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
          const emailDisplay = emails.length > 0
            ? emails.map(e => `<span style="display: inline-block; background: var(--bg-hover); padding: 2px 8px; border-radius: 4px; font-size: 0.85rem; margin-right: 4px; margin-bottom: 4px;">📧 ${e}</span>`).join('')
            : '<span style="color:var(--text-muted); font-size: 0.85rem;">이메일 없음</span>';

          return `
            <div class="card forwarder-card" style="padding: 1.5rem; display: flex; flex-direction: column; background: var(--bg-surface); border: 1px solid var(--border-color);">
              <div style="flex-grow: 1;">
                <h3 style="margin-top: 0; margin-bottom: 0.5rem; color: var(--text-primary);">${f.name}</h3>
                <div style="margin-bottom: 0.5rem; display: flex; flex-wrap: wrap; gap: 4px;">
                  ${emailDisplay}
                </div>
                <p style="color: var(--text-secondary); margin-bottom: 1rem; font-size: 0.9rem;">지정된 노선 수: <strong style="color: var(--text-primary);">${f.assigned_routes ? f.assigned_routes.length : 0}</strong>개</p>
              </div>
              ${canEdit ? `
              <div class="card-actions" style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                <button class="btn btn-sm btn-outline btn-assign" data-id="${f.id}">노선 지정</button>
                <button class="btn btn-sm btn-outline btn-edit" data-id="${f.id}">편집</button>
                <button class="btn btn-sm btn-danger btn-delete" data-id="${f.id}">삭제</button>
              </div>` : ''}
            </div>
          `;
        }).join('') : '<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-secondary);">등록된 포워더가 없습니다.</div>'}
      </div>
    `;

    // Events — 편집 버튼은 최고관리자만
    if (canEdit) {
      container.querySelector('#btn-add-forwarder').addEventListener('click', () => {
        openForwarderModal();
      });

      container.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.dataset.id;
          const allForwarders = await getForwarders();
          const forwarder = allForwarders.find(f => f.id === id);
          if (forwarder) openForwarderModal(forwarder);
        });
      });

      container.querySelectorAll('.btn-assign').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.dataset.id;
          const allForwarders = await getForwarders();
          const forwarder = allForwarders.find(f => f.id === id);
          if (forwarder) openAssignModal(forwarder);
        });
      });

      container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.dataset.id;
          if (confirm('정말로 이 포워더를 삭제하시겠습니까? (등록된 영업사원 계정도 함께 삭제됩니다)')) {
            await deleteForwarder(id);
            showToast('삭제되었습니다.');
            await render();
          }
        });
      });
    }
  }

  function openForwarderModal(forwarder = null) {
    const isEdit = !!forwarder;
    const existingEmails = forwarder && forwarder.email
      ? forwarder.email.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean)
      : [''];

    if (existingEmails.length === 0) existingEmails.push('');

    const renderEmailRow = (val = '') => `
      <div class="email-input-row" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
        <input type="email" class="form-control forwarder-email-input" value="${val}" placeholder="sales@example.com" style="flex: 1;">
        <button type="button" class="btn btn-outline btn-remove-email" style="padding: 6px 12px; color: var(--danger); border-color: var(--border-color);" title="삭제">✕</button>
      </div>
    `;

    const content = `
      <form id="forwarder-form">
        <div class="form-group" style="margin-bottom: 1.25rem;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">포워더명</label>
          <input type="text" id="forwarder-name" class="form-control" value="${forwarder ? forwarder.name : ''}" placeholder="예: 아토미 로지스틱스" required>
        </div>
        <div class="form-group" style="margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <label style="font-weight: 500;">영업사원 이메일 목록</label>
            <button type="button" id="btn-add-email-row" class="btn btn-sm btn-outline" style="padding: 4px 10px; font-size: 0.85rem;">➕ 이메일 추가</button>
          </div>
          <div id="email-inputs-container">
            ${existingEmails.map(val => renderEmailRow(val)).join('')}
          </div>
          <small style="color: var(--text-secondary); display: block; margin-top: 0.5rem; line-height: 1.4;">
            * 하나의 칸에 하나의 이메일을 입력하세요. <b>+ 이메일 추가</b> 버튼으로 영업사원을 더 추가할 수 있습니다.<br>
            * 각 이메일 주소로 포워더 계정이 자동 생성되며 초기 비밀번호는 <b>123qwe!@#</b> 입니다.
          </small>
        </div>
        <div class="modal-footer" style="margin-top: 1.5rem; text-align: right; display: flex; justify-content: flex-end; gap: 0.5rem;">
          <button type="button" class="btn btn-outline" id="btn-cancel-forwarder">취소</button>
          <button type="submit" class="btn btn-primary">저장</button>
        </div>
      </form>
    `;

    showModal({
      title: isEdit ? '포워더 편집' : '포워더 추가',
      content: content
    });

    const containerEl = document.getElementById('email-inputs-container');

    // 이벤트 바인딩: 이메일 칸 추가
    document.getElementById('btn-add-email-row').addEventListener('click', () => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = renderEmailRow('');
      const newRow = tempDiv.firstElementChild;
      containerEl.appendChild(newRow);
      newRow.querySelector('input').focus();
    });

    // 이벤트 바인딩: 삭제 버튼 (이벤트 위임)
    containerEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-remove-email')) {
        const rows = containerEl.querySelectorAll('.email-input-row');
        if (rows.length > 1) {
          e.target.closest('.email-input-row').remove();
        } else {
          // 마지막 1개는 삭제 대신 입력값 비우기
          const input = rows[0].querySelector('input');
          if (input) input.value = '';
        }
      }
    });

    document.getElementById('btn-cancel-forwarder').addEventListener('click', closeModal);

    document.getElementById('forwarder-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('forwarder-name').value.trim();
      const emailInputs = containerEl.querySelectorAll('.forwarder-email-input');
      const emailList = Array.from(emailInputs)
        .map(input => input.value.trim())
        .filter(val => val.length > 0);
      
      const emailStr = emailList.join(', ');

      try {
        if (isEdit) {
          await updateForwarder(forwarder.id, { name, email: emailStr });
          showToast('포워더가 수정되었습니다.');
        } else {
          await addForwarder({ name, email: emailStr, assigned_routes: [] });
          showToast('포워더가 추가되었습니다.');
        }
        closeModal();
        await render();
      } catch (err) {
        showToast('오류: ' + err.message, 'error');
      }
    });
  }

  async function openAssignModal(forwarder) {
    const routes = await getRoutes();
    let assigned = forwarder.assigned_routes || [];
    if (typeof assigned === 'string') {
      try { assigned = JSON.parse(assigned); } catch (e) { assigned = []; }
    }
    if (!Array.isArray(assigned)) assigned = [];
    
    let routesHtml = routes.map(route => `
      <div class="checkbox-item" style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 0.5rem;">
        <input type="checkbox" id="chk-${route.id}" class="route-chk" value="${route.id}" ${assigned.includes(route.id) ? 'checked' : ''}>
        <label for="chk-${route.id}" style="cursor: pointer; flex-grow: 1; color: var(--text-primary);">${route.no} - ${route.country} - ${route.pod}</label>
      </div>
    `).join('');

    const content = `
      <div style="margin-bottom: 1rem;">
        <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: bold; padding: 0.5rem; background: var(--bg-secondary); border-radius: 4px; color: var(--text-primary);">
          <input type="checkbox" id="chk-all"> 전체 선택/해제
        </label>
      </div>
      <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px; padding: 0.5rem; background: var(--bg-primary);">
        ${routesHtml}
      </div>
      <div class="modal-footer" style="margin-top: 1rem; text-align: right;">
        <button type="button" class="btn btn-outline" id="btn-cancel-assign">취소</button>
        <button type="button" class="btn btn-primary" id="btn-save-assign">저장</button>
      </div>
    `;

    showModal({
      title: `'${forwarder.name}' 노선 지정`,
      content: content
    });

    document.getElementById('btn-cancel-assign').addEventListener('click', closeModal);

    const checkAll = document.getElementById('chk-all');
    const checkboxes = document.querySelectorAll('.route-chk');
    
    checkAll.checked = checkboxes.length > 0 && Array.from(checkboxes).every(c => c.checked);

    checkAll.addEventListener('change', (e) => {
      checkboxes.forEach(c => c.checked = e.target.checked);
    });
    
    checkboxes.forEach(c => {
      c.addEventListener('change', () => {
        checkAll.checked = Array.from(checkboxes).every(c => c.checked);
      });
    });

    document.getElementById('btn-save-assign').addEventListener('click', async () => {
      const selectedRoutes = Array.from(checkboxes)
        .filter(c => c.checked)
        .map(c => c.value);
      
      await updateForwarder(forwarder.id, { assigned_routes: selectedRoutes });
      showToast('노선 지정이 저장되었습니다.');
      closeModal();
      await render();
    });
  }

  await render();
}
