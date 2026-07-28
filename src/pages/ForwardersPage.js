import { getForwarders, addForwarder, updateForwarder, deleteForwarder, getRoutes } from '../store.js';
import { showModal, closeModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';

export function renderForwardersPage(container) {
  function render() {
    const forwarders = getForwarders();
    
    container.innerHTML = `
      <div class="page-header">
        <h2>🏢 포워더 관리</h2>
        <div class="header-actions">
          <button id="btn-add-forwarder" class="btn btn-primary">포워더 추가</button>
        </div>
      </div>
      
      <div class="card-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
        ${forwarders.length > 0 ? forwarders.map(f => `
          <div class="card forwarder-card" style="padding: 1.5rem; display: flex; flex-direction: column; background: var(--bg-surface); border: 1px solid var(--border-color);">
            <div style="flex-grow: 1;">
              <h3 style="margin-top: 0; margin-bottom: 0.5rem; color: var(--text-primary);">${f.name}</h3>
              <p style="color: var(--text-secondary); margin-bottom: 0.25rem; font-size: 0.9rem;">📧 ${f.email || '<span style="color:var(--text-muted);">이메일 없음</span>'}</p>
              <p style="color: var(--text-secondary); margin-bottom: 1rem;">지정된 노선 수: <strong style="color: var(--text-primary);">${f.assignedRoutes ? f.assignedRoutes.length : 0}</strong>개</p>
            </div>
            <div class="card-actions" style="display: flex; gap: 0.5rem; justify-content: flex-end;">
              <button class="btn btn-sm btn-outline btn-assign" data-id="${f.id}">노선 지정</button>
              <button class="btn btn-sm btn-outline btn-edit" data-id="${f.id}">편집</button>
              <button class="btn btn-sm btn-danger btn-delete" data-id="${f.id}">삭제</button>
            </div>
          </div>
        `).join('') : '<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-secondary);">등록된 포워더가 없습니다.</div>'}
      </div>
    `;

    // Events
    container.querySelector('#btn-add-forwarder').addEventListener('click', () => {
      openForwarderModal();
    });

    container.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const forwarder = getForwarders().find(f => f.id === id);
        if (forwarder) openForwarderModal(forwarder);
      });
    });

    container.querySelectorAll('.btn-assign').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const forwarder = getForwarders().find(f => f.id === id);
        if (forwarder) openAssignModal(forwarder);
      });
    });

    container.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        if (confirm('정말로 이 포워더를 삭제하시겠습니까?')) {
          deleteForwarder(id);
          showToast('삭제되었습니다.');
          render();
        }
      });
    });
  }

  function openForwarderModal(forwarder = null) {
    const isEdit = !!forwarder;
    const content = `
      <form id="forwarder-form">
        <div class="form-group">
          <label>포워더명</label>
          <input type="text" id="forwarder-name" class="form-input" value="${forwarder ? forwarder.name : ''}" required>
        </div>
        <div class="form-group">
          <label>이메일 주소</label>
          <input type="email" id="forwarder-email" class="form-input" value="${forwarder && forwarder.email ? forwarder.email : ''}" placeholder="메일발송 시 사용할 이메일">
        </div>
        <div class="modal-footer" style="margin-top: 1rem; text-align: right;">
          <button type="button" class="btn btn-outline" id="btn-cancel-forwarder">취소</button>
          <button type="submit" class="btn btn-primary">저장</button>
        </div>
      </form>
    `;

    showModal({
      title: isEdit ? '포워더 편집' : '포워더 추가',
      content: content
    });

    document.getElementById('btn-cancel-forwarder').addEventListener('click', closeModal);

    document.getElementById('forwarder-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('forwarder-name').value;
      const email = document.getElementById('forwarder-email').value;
      
      if (isEdit) {
        updateForwarder(forwarder.id, { name, email });
        showToast('포워더가 수정되었습니다.');
      } else {
        addForwarder({ name, email, assignedRoutes: [] });
        showToast('포워더가 추가되었습니다.');
      }
      closeModal();
      render();
    });
  }

  function openAssignModal(forwarder) {
    const routes = getRoutes();
    const assigned = forwarder.assignedRoutes || [];
    
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
    
    // Set initial checkAll state
    checkAll.checked = checkboxes.length > 0 && Array.from(checkboxes).every(c => c.checked);

    checkAll.addEventListener('change', (e) => {
      checkboxes.forEach(c => c.checked = e.target.checked);
    });
    
    checkboxes.forEach(c => {
      c.addEventListener('change', () => {
        checkAll.checked = Array.from(checkboxes).every(c => c.checked);
      });
    });

    document.getElementById('btn-save-assign').addEventListener('click', () => {
      const selectedRoutes = Array.from(checkboxes)
        .filter(c => c.checked)
        .map(c => c.value);
      
      updateForwarder(forwarder.id, { assignedRoutes: selectedRoutes });
      showToast('노선 지정이 저장되었습니다.');
      closeModal();
      render();
    });
  }

  render();
}
