import { getBiddings, addBidding, updateBidding, getActiveBidding, getForwarders, getRoutes, getAllRates, revokeSubmission, reopenBidding, isForwarderSubmitted, getToken, sendEmailApi } from '../store.js';
import { showModal, closeModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';
import { formatDate } from '../utils/format.js';

export async function renderBiddingPage(container) {
  async function checkAutoClose() {
    const biddings = await getBiddings();
    const now = new Date();
    for (const b of biddings) {
      if (b.status === 'active' && b.deadline) {
        const deadlineEnd = new Date(b.deadline);
        deadlineEnd.setHours(23, 59, 59, 999);
        if (now > deadlineEnd) {
          await updateBidding(b.id, { status: 'closed', closedAt: deadlineEnd.toISOString() });
        }
      }
    }
  }

  async function render() {
    await checkAutoClose();
    
    const biddings = await getBiddings();
    const activeBidding = await getActiveBidding();
    
    biddings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Calculate progress for active bidding
    let progressHtml = '';
    if (activeBidding) {
      const allForwarders = await getForwarders();
      const activeForwarders = allForwarders.filter(f => f.assigned_routes && f.assigned_routes.length > 0);
      const submittedCount = activeForwarders.filter(f => (activeBidding.submitted_forwarders || []).includes(f.id)).length;
      
      progressHtml = `
        <div style="margin-top: 1rem; padding: 1rem; background: var(--bg-secondary); border-radius: 6px; border: 1px solid var(--border-color);">
          <div style="margin-bottom: 0.5rem; font-weight: bold; color: var(--text-primary); display: flex; justify-content: space-between; align-items: center;">
            <span>포워더 제출 현황</span>
            <span style="font-size: 0.875rem; color: var(--text-secondary);">${submittedCount} / ${activeForwarders.length} 최종제출 완료</span>
          </div>
          <div style="background: var(--border-color); height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 1rem;">
            <div style="width: ${activeForwarders.length > 0 ? (submittedCount / activeForwarders.length * 100) : 0}%; height: 100%; background: var(--success); transition: width 0.3s;"></div>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem;">
            ${activeForwarders.map(f => {
              const isSubmitted = (activeBidding.submitted_forwarders || []).includes(f.id);
              return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-primary); border-radius: 6px; border: 1px solid var(--border-color);">
                  <div>
                    <strong style="color: var(--text-primary); font-size: 0.9rem;">${f.name}</strong>
                    <div style="font-size: 0.75rem; margin-top: 2px;">
                      ${isSubmitted 
                        ? '<span style="color: var(--success); font-weight: 600;">✅ 최종제출 완료</span>' 
                        : '<span style="color: var(--warning); font-weight: 500;">⏳ 작성 중</span>'}
                    </div>
                  </div>
                  ${isSubmitted ? `
                    <button class="btn btn-sm btn-outline btn-revoke-submission" data-forwarder-id="${f.id}" data-forwarder-name="${f.name}" style="font-size: 0.75rem; padding: 2px 8px;">
                      제출취하
                    </button>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="page-header">
        <h2>📋 입찰 관리</h2>
        <div class="header-actions">
          <button id="btn-create-bidding" class="btn btn-primary" ${activeBidding ? 'disabled title="진행중인 입찰이 있습니다"' : ''}>새 입찰 생성</button>
        </div>
      </div>
      
      ${activeBidding ? `
        <div class="card active-bidding-card" style="border: 2px solid var(--accent); margin-bottom: 2rem; background: var(--bg-surface);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h3 style="margin-top:0; color: var(--text-primary);">
                ${activeBidding.title}
                <span class="badge badge-active" style="margin-left: 0.5rem;">진행중</span>
              </h3>
              <p style="color: var(--text-secondary); margin: 0;">생성일: ${formatDate(activeBidding.created_at)}</p>
              ${activeBidding.deadline ? `<p style="color: var(--warning); margin: 4px 0 0 0; font-weight: 500;">⏰ 마감시한: ${formatDate(activeBidding.deadline)} 23:59</p>` : ''}
            </div>
            <div>
              <button id="btn-close-bidding" class="btn btn-danger" data-id="${activeBidding.id}">마감하기</button>
            </div>
          </div>
          ${progressHtml}
        </div>
      ` : ''}

      <div class="card">
        <h3>입찰 이력</h3>
        <table class="data-table" style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
          <thead>
            <tr>
              <th>입찰명</th>
              <th>상태</th>
              <th>생성일</th>
              <th>마감시한</th>
              <th>마감일</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            ${biddings.length > 0 ? biddings.map(b => {
              let badgeClass = 'badge-closed';
              let statusText = '마감됨';
              if (b.status === 'active') {
                badgeClass = 'badge-active'; statusText = '진행중';
              } else if (b.status === 'preparing') {
                badgeClass = 'badge-preparing'; statusText = '준비중';
              }
              
              return `
                <tr ${b.status === 'active' ? 'style="background: var(--accent-glow);"' : ''}>
                  <td><strong style="color: var(--text-primary);">${b.title}</strong></td>
                  <td><span class="badge ${badgeClass}">${statusText}</span></td>
                  <td><span style="color: var(--text-secondary);">${formatDate(b.created_at)}</span></td>
                  <td><span style="color: var(--text-secondary);">${b.deadline ? formatDate(b.deadline) + ' 23:59' : '-'}</span></td>
                  <td><span style="color: var(--text-secondary);">${b.closed_at ? formatDate(b.closed_at) : '-'}</span></td>
                  <td>
                    ${b.status === 'preparing' ? `<button class="btn btn-sm btn-primary btn-start" data-id="${b.id}">시작하기</button>` : ''}
                    ${b.status === 'active' ? `<button class="btn btn-sm btn-danger btn-close" data-id="${b.id}">마감하기</button>` : ''}
                    ${b.status === 'closed' ? `<button class="btn btn-sm btn-secondary btn-reopen" data-id="${b.id}" data-title="${b.title}">마감 취소/재오픈</button>` : ''}
                  </td>
                </tr>
              `;
            }).join('') : `<tr><td colspan="6" style="text-align:center; color: var(--text-secondary);">입찰 이력이 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    // Events
    const createBtn = container.querySelector('#btn-create-bidding');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        if (!activeBidding) openCreateModal();
      });
    }

    container.querySelectorAll('.btn-close, #btn-close-bidding').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (confirm('이 입찰을 마감하시겠습니까? 마감 후에는 포워더가 운임을 수정할 수 없습니다.')) {
          await updateBidding(id, { status: 'closed', closedAt: new Date().toISOString() });
          showToast('입찰이 마감되었습니다.');
          await render();
        }
      });
    });

    // 최종제출 취하 버튼 이벤트
    container.querySelectorAll('.btn-revoke-submission').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const forwarderId = e.currentTarget.dataset.forwarderId;
        const forwarderName = e.currentTarget.dataset.forwarderName;
        if (confirm(`'${forwarderName}' 포워더의 최종제출을 취하하시겠습니까?\n취하 후에는 포워더가 다시 운임을 수정할 수 있습니다.`)) {
          await revokeSubmission(activeBidding.id, forwarderId);
          showToast(`'${forwarderName}' 최종제출이 취하되었습니다.`);
          await render();
        }
      });
    });

    // 마감 취소 및 재오픈 버튼 이벤트
    container.querySelectorAll('.btn-reopen').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const biddingId = e.currentTarget.dataset.id;
        const biddingTitle = e.currentTarget.dataset.title;
        openReopenModal(biddingId, biddingTitle);
      });
    });

    container.querySelectorAll('.btn-start').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const active = await getActiveBidding();
        if (active) {
          alert('이미 진행중인 입찰이 있습니다. 먼저 마감해주세요.');
          return;
        }
        await updateBidding(id, { status: 'active' });
        showToast('입찰이 시작되었습니다.');
        await render();
      });
    });
  }

  function openCreateModal() {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    const content = `
      <form id="bidding-form">
        <div class="form-group">
          <label>연도</label>
          <select id="bid-year" class="form-select">
            <option value="${currentYear - 1}">${currentYear - 1}년</option>
            <option value="${currentYear}" selected>${currentYear}년</option>
            <option value="${currentYear + 1}">${currentYear + 1}년</option>
          </select>
        </div>
        <div class="form-group">
          <label>월</label>
          <select id="bid-month" class="form-select">
            ${Array.from({length: 12}, (_, i) => i + 1).map(m => 
              `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${m}월</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>입찰명 (자동 생성)</label>
          <input type="text" id="bid-title" class="form-input" readonly>
        </div>
        <div class="form-group">
          <label>마감시한</label>
          <input type="date" id="bid-deadline" class="form-input" required>
          <small style="color: var(--text-muted); margin-top: 4px; display: block;">해당 날짜 23:59에 자동 마감됩니다.</small>
        </div>
        <div class="modal-footer" style="margin-top: 1rem; text-align: right;">
          <button type="button" class="btn btn-outline" id="btn-cancel-bid">취소</button>
          <button type="submit" class="btn btn-primary">생성</button>
        </div>
      </form>
    `;

    showModal({
      title: '새 입찰 생성',
      content: content
    });

    const yearSelect = document.getElementById('bid-year');
    const monthSelect = document.getElementById('bid-month');
    const titleInput = document.getElementById('bid-title');
    const deadlineInput = document.getElementById('bid-deadline');

    const defaultDeadline = new Date();
    defaultDeadline.setDate(defaultDeadline.getDate() + 7);
    deadlineInput.value = defaultDeadline.toISOString().split('T')[0];
    deadlineInput.min = new Date().toISOString().split('T')[0];

    function updateTitle() {
      titleInput.value = `${yearSelect.value}년 ${monthSelect.value}월 해상 스팟 운임`;
    }

    yearSelect.addEventListener('change', updateTitle);
    monthSelect.addEventListener('change', updateTitle);
    updateTitle();

    document.getElementById('btn-cancel-bid').addEventListener('click', closeModal);

    document.getElementById('bidding-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const selectedYear = parseInt(yearSelect.value);
      const selectedMonth = parseInt(monthSelect.value);

      const newBiddingData = {
        title: titleInput.value,
        year: selectedYear,
        month: selectedMonth,
        status: 'active',
        deadline: deadlineInput.value
      };
      
      await openEmailConfirmModal(newBiddingData);
    });
  }

  async function openEmailConfirmModal(biddingData) {
    const forwarders = await getForwarders();
    const emailTargets = [];
    forwarders.forEach(f => {
      if (f.email) {
        const emails = f.email.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
        emails.forEach(email => {
          emailTargets.push({
            name: f.name,
            email: email
          });
        });
      }
    });

    const emailListStr = emailTargets.map(t => `${t.name} (${t.email})`).join(', ');

    const content = `
      <div style="color: var(--text-primary);">
        <h4 style="margin-top: 0;">새 입찰 내역: <span style="color: var(--accent);">${biddingData.title}</span></h4>
        <p>입찰 생성을 완료하기 전, 등록된 포워더들에게 메일을 발송하시겠습니까?</p>
        
        <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; margin: 1rem 0; font-size: 0.9rem;">
          <strong style="display: block; margin-bottom: 0.5rem;">수신 대상 총 (${emailTargets.length}개 이메일)</strong>
          <div style="color: var(--text-secondary); max-height: 100px; overflow-y: auto;">
            ${emailTargets.length > 0 ? emailListStr : '등록된 이메일이 없습니다.'}
          </div>
        </div>

        <div class="modal-footer" style="margin-top: 1.5rem; text-align: right; display: flex; justify-content: flex-end; gap: 0.5rem;">
          <button type="button" class="btn btn-outline" id="btn-cancel-create">취소</button>
          <button type="button" class="btn btn-secondary" id="btn-create-only">메일 발송 없이 입찰 생성</button>
          <button type="button" class="btn btn-primary" id="btn-send-and-create" ${emailTargets.length === 0 ? 'disabled' : ''}>메일 발송하고 입찰 생성</button>
        </div>
      </div>
    `;

    showModal({
      title: '📧 메일 발송 확인',
      content: content
    });

    document.getElementById('btn-cancel-create').addEventListener('click', closeModal);

    document.getElementById('btn-create-only').addEventListener('click', async () => {
      try {
        const result = await addBidding(biddingData);
        if (result.error) throw new Error(result.error);
        showToast('새 입찰이 시작되었습니다.');
      } catch (err) {
        showToast('오류: ' + err.message, 'error');
      }
      closeModal();
      await render();
    });

    document.getElementById('btn-send-and-create')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-send-and-create');
      btn.disabled = true;
      btn.innerText = '발송 중...';

      // H4 수정: 입찰 생성을 먼저 수행한 후 이메일 발송 (중복 생성 방지)
      try {
        const result = await addBidding(biddingData);
        if (result && result.error) throw new Error(result.error);

        // 입찰 생성 성공 후 이메일 발송 시도
        try {
          const emailPromises = emailTargets.map(t => {
            const targetUrl = `${window.location.origin}/#/rate-entry?email=${encodeURIComponent(t.email)}`;
            return sendEmailApi(
              t.email,
              `[Atomy] 신규 입찰 안내: ${biddingData.title}`,
              `
                <div style="font-family: sans-serif; padding: 20px;">
                  <h2>Atomy 신규 해상 스팟 운임 입찰 안내</h2>
                  <p>안녕하세요 ${t.name} 담당자님,</p>
                  <p>새로운 입찰(<strong>${biddingData.title}</strong>)이 시작되었습니다.</p>
                  <p><strong>마감 시한:</strong> ${biddingData.deadline} 23:59 까지</p>
                  <p>아래 링크를 통해 운임을 입력해 주시기 바랍니다.</p>
                  <a href="${targetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">운임 입력하기</a>
                </div>
              `
            );
          });
          await Promise.all(emailPromises);
          showToast('메일이 성공적으로 발송되었으며, 새 입찰이 시작되었습니다.');
        } catch (emailError) {
          console.error('메일 발송 실패:', emailError);
          showToast('입찰은 생성되었으나, 메일 발송 중 오류가 발생했습니다.', 'warning');
        }
      } catch (error) {
        console.error('입찰 생성 실패:', error);
        showToast('오류: ' + error.message, 'error');
      } finally {
        closeModal();
        await render();
      }
    });
  }

  async function openReopenModal(biddingId, biddingTitle) {
    const active = await getActiveBidding();
    if (active) {
      alert('현재 진행 중인 다른 입찰이 있습니다. 기존 진행 중인 입찰을 먼저 마감해주세요.');
      return;
    }

    const defaultDeadline = new Date();
    defaultDeadline.setDate(defaultDeadline.getDate() + 7);
    const defaultDeadlineStr = defaultDeadline.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];

    const content = `
      <form id="reopen-form">
        <div style="margin-bottom: 1rem; color: var(--text-primary);">
          <strong>${biddingTitle}</strong> 입찰을 마감 취소하고 다시 오픈합니다.
        </div>
        <div class="form-group">
          <label>새로운 마감시한 설정</label>
          <input type="date" id="reopen-deadline" class="form-input" value="${defaultDeadlineStr}" min="${todayStr}" required>
          <small style="color: var(--text-muted); margin-top: 4px; display: block;">해당 날짜 23:59에 자동 마감됩니다.</small>
        </div>
        <div class="modal-footer" style="margin-top: 1.5rem; text-align: right;">
          <button type="button" class="btn btn-outline" id="btn-cancel-reopen">취소</button>
          <button type="submit" class="btn btn-primary">입찰 재오픈</button>
        </div>
      </form>
    `;

    showModal({
      title: '🔄 입찰 마감 취소 및 재오픈',
      content: content
    });

    document.getElementById('btn-cancel-reopen').addEventListener('click', closeModal);

    document.getElementById('reopen-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const newDeadline = document.getElementById('reopen-deadline').value;
      await reopenBidding(biddingId, newDeadline);
      showToast('입찰이 마감 취소되고 다시 재개되었습니다.');
      closeModal();
      await render();
    });
  }

  await render();
}
