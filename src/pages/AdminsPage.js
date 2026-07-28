import { getAdminsApi, addAdminApi } from '../store.js';

export async function renderAdminsPage(container) {
  const html = `
    <div class="page-header">
      <h2>👑 팀원(관리자) 관리</h2>
      <button id="btn-add-admin" class="btn btn-primary">새 팀원 추가</button>
    </div>
    
    <div class="card">
      <div id="admins-list">
        <p>로딩 중...</p>
      </div>
    </div>

    <!-- 팀원 추가 모달 -->
    <div id="add-admin-modal" class="modal" style="display: none;">
      <div class="modal-content">
        <div class="modal-header">
          <h3>새 팀원(관리자) 추가</h3>
          <span class="close-modal" id="close-admin-modal">&times;</span>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>팀원 이메일</label>
            <input type="email" id="new-admin-email" class="form-input" placeholder="team@atomypark.com" required>
            <small style="color: var(--text-secondary); display: block; margin-top: 0.5rem;">초기 비밀번호는 <b>123qwe!@#</b> 로 고정됩니다. 최초 로그인 시 변경하게 됩니다.</small>
          </div>
          <div id="add-admin-error" style="color: #ef4444; margin-top: 1rem; display: none;"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="cancel-add-admin">취소</button>
          <button class="btn btn-primary" id="save-new-admin">추가하기</button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  const loadAdmins = async () => {
    try {
      const admins = await getAdminsApi();
      if (admins.error) throw new Error(admins.error);
      
      const listContainer = container.querySelector('#admins-list');
      
      if (admins.length === 0) {
        listContainer.innerHTML = '<p>등록된 팀원이 없습니다.</p>';
        return;
      }

      listContainer.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>이메일</th>
              <th>권한</th>
              <th>가입 상태</th>
            </tr>
          </thead>
          <tbody>
            ${admins.map(a => `
              <tr>
                <td>${a.id}</td>
                <td>${a.email}</td>
                <td>
                  <span class="badge ${a.role === 'super_admin' ? 'badge-primary' : 'badge-secondary'}">
                    ${a.role === 'super_admin' ? '최고 관리자' : '일반 관리자'}
                  </span>
                </td>
                <td>${a.is_first_login ? '비밀번호 미설정' : '사용 중'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      container.querySelector('#admins-list').innerHTML = `<p style="color: red;">불러오기 실패: ${err.message}</p>`;
    }
  };

  await loadAdmins();

  const modal = container.querySelector('#add-admin-modal');
  const btnAdd = container.querySelector('#btn-add-admin');
  const btnClose = container.querySelector('#close-admin-modal');
  const btnCancel = container.querySelector('#cancel-add-admin');
  const btnSave = container.querySelector('#save-new-admin');
  const emailInput = container.querySelector('#new-admin-email');
  const errorMsg = container.querySelector('#add-admin-error');

  const closeModal = () => {
    modal.style.display = 'none';
    emailInput.value = '';
    errorMsg.style.display = 'none';
  };

  btnAdd.addEventListener('click', () => modal.style.display = 'block');
  btnClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);

  btnSave.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!email) {
      errorMsg.textContent = '이메일을 입력해주세요.';
      errorMsg.style.display = 'block';
      return;
    }

    btnSave.disabled = true;
    try {
      const result = await addAdminApi(email);
      if (result.error) throw new Error(result.error);
      
      closeModal();
      await loadAdmins(); // 목록 새로고침
    } catch (err) {
      errorMsg.textContent = err.message;
      errorMsg.style.display = 'block';
    } finally {
      btnSave.disabled = false;
    }
  });
}
