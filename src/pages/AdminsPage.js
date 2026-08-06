import { getAdminsApi, addAdminApi, deleteAdminApi, getSession } from '../store.js';
import { showModal, closeModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';

export async function renderAdminsPage(container) {
  const session = getSession();

  async function render() {
    container.innerHTML = `
      <div class="page-header">
        <h2>👑 팀원(관리자) 관리</h2>
        <button id="btn-add-admin" class="btn btn-primary">➕ 새 팀원 추가</button>
      </div>
      
      <div class="card" style="padding: 1.5rem;">
        <div id="admins-list">
          <p style="color: var(--text-secondary);">로딩 중...</p>
        </div>
      </div>
    `;

    // 팀원 추가 모달 열기
    container.querySelector('#btn-add-admin').addEventListener('click', () => {
      openAddAdminModal();
    });

    await loadAdmins();
  }

  async function loadAdmins() {
    const listContainer = container.querySelector('#admins-list');
    try {
      const admins = await getAdminsApi();
      if (admins.error) throw new Error(admins.error);
      
      if (!Array.isArray(admins) || admins.length === 0) {
        listContainer.innerHTML = '<p style="color: var(--text-secondary);">등록된 팀원이 없습니다.</p>';
        return;
      }

      listContainer.innerHTML = `
        <div style="overflow-x: auto;">
          <table class="data-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="width: 80px; text-align: center;">ID</th>
                <th>이메일 주소</th>
                <th style="width: 140px; text-align: center;">권한</th>
                <th style="width: 150px; text-align: center;">가입 상태</th>
                <th style="width: 100px; text-align: center;">관리</th>
              </tr>
            </thead>
            <tbody>
              ${admins.map(a => {
                const isMe = session && session.id === a.id;
                const isSuper = a.role === 'super_admin';
                const canDelete = !isMe && !isSuper;

                return `
                  <tr>
                    <td style="text-align: center; color: var(--text-muted); font-size: 0.85rem;">${a.id}</td>
                    <td style="font-weight: 500;">
                      ${a.email}
                      ${isMe ? '<span style="font-size: 0.75rem; color: var(--accent); margin-left: 6px; border: 1px solid var(--accent); padding: 1px 6px; border-radius: 4px;">나</span>' : ''}
                    </td>
                    <td style="text-align: center;">
                      <span class="badge ${isSuper ? 'badge-primary' : 'badge-secondary'}">
                        ${isSuper ? '최고 관리자' : '일반 관리자'}
                      </span>
                    </td>
                    <td style="text-align: center; font-size: 0.9rem;">
                      ${a.is_first_login 
                        ? '<span style="color: var(--warning);">⚠️ 비밀번호 미설정</span>' 
                        : '<span style="color: var(--success);">✅ 사용 중</span>'}
                    </td>
                    <td style="text-align: center;">
                      ${canDelete ? `
                        <button class="btn btn-sm btn-danger btn-delete-admin" data-id="${a.id}" data-email="${a.email}">삭제</button>
                      ` : `
                        <span style="color: var(--text-muted); font-size: 0.8rem;">-</span>
                      `}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      // 삭제 버튼 이벤트 바인딩
      listContainer.querySelectorAll('.btn-delete-admin').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.dataset.id;
          const email = e.target.dataset.email;
          if (confirm(`'${email}' 팀원 계정을 정말로 삭제하시겠습니까?`)) {
            try {
              const res = await deleteAdminApi(id);
              if (res.error) throw new Error(res.error);
              showToast('팀원 계정이 삭제되었습니다.');
              await loadAdmins();
            } catch (err) {
              showToast('삭제 실패: ' + err.message, 'error');
            }
          }
        });
      });

    } catch (err) {
      listContainer.innerHTML = `<p style="color: var(--danger);">불러오기 실패: ${err.message}</p>`;
    }
  }

  function openAddAdminModal() {
    const modalContent = `
      <form id="add-admin-form">
        <div class="form-group" style="margin-bottom: 1.25rem;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">팀원 이메일 주소</label>
          <input type="email" id="new-admin-email" class="form-control" placeholder="team@atomypark.com" required style="width: 100%;">
          <small style="color: var(--text-secondary); display: block; margin-top: 0.5rem; line-height: 1.4;">
            * 이메일 입력 시 관리자 계정이 바로 생성됩니다.<br>
            * 초기 비밀번호는 <b>123qwe!@#</b> 로 설정되며, 팀원이 최초 로그인 시 새 비밀번호로 변경하게 됩니다.
          </small>
        </div>
        <div class="modal-footer" style="margin-top: 1.5rem; text-align: right; display: flex; justify-content: flex-end; gap: 0.5rem;">
          <button type="button" class="btn btn-outline" id="btn-cancel-admin">취소</button>
          <button type="submit" class="btn btn-primary">추가하기</button>
        </div>
      </form>
    `;

    showModal({
      title: '👑 새 팀원(관리자) 추가',
      content: modalContent
    });

    document.getElementById('btn-cancel-admin').addEventListener('click', closeModal);

    document.getElementById('add-admin-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('new-admin-email');
      const email = emailInput.value.trim();

      try {
        const res = await addAdminApi(email);
        if (res.error) throw new Error(res.error);

        showToast('새 팀원 계정이 추가되었습니다.');
        closeModal();
        await loadAdmins();
      } catch (err) {
        showToast('오류: ' + err.message, 'error');
      }
    });
  }

  await render();
}
