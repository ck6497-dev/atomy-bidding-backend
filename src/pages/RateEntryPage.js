import { getSession, getRoutes, getForwarders, getActiveBidding, getRatesByForwarder, saveRate, getBiddings, isForwarderSubmitted, submitForwarder } from '../store.js';
import { renderDataGrid } from '../components/DataGrid.js';
import { showToast } from '../components/Toast.js';
import { showModal } from '../components/Modal.js';

export function renderRateEntryPage(container) {
  const session = getSession();
  
  if (!session || session.role !== 'forwarder') {
    container.innerHTML = '<div style="color: var(--text-primary);">권한이 없습니다.</div>';
    return;
  }

  let selectedBiddingId = null;
  let isEditing = false;
  let hasChanges = false;
  let editGridData = null; // 편집 중 데이터 (원본과 분리)

  function render() {
    const forwarderId = session.forwarderId;
    const forwarder = getForwarders().find(f => f.id === forwarderId);
    const allBiddings = getBiddings();
    
    const sortedBiddings = [...allBiddings]
      .filter(b => b.status === 'active' || b.status === 'closed')
      .sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (b.status === 'active' && a.status !== 'active') return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

    let bidding = null;
    if (selectedBiddingId) {
      bidding = allBiddings.find(b => b.id === selectedBiddingId);
    }
    if (!bidding && sortedBiddings.length > 0) {
      bidding = sortedBiddings[0];
      selectedBiddingId = bidding.id;
    }

    const isClosed = bidding ? bidding.status === 'closed' : true;
    const isSubmitted = bidding ? isForwarderSubmitted(bidding.id, forwarderId) : false;

    if (!bidding || sortedBiddings.length === 0) {
      container.innerHTML = `
        <div class="page-header"><h2>📝 운임 입력</h2></div>
        <div class="empty-state card">
          <h3 style="color: var(--text-primary);">현재 진행중인 입찰이 없습니다</h3>
          <p style="color: var(--text-secondary);">관리자가 입찰을 시작하면 여기에 운임을 입력할 수 있습니다.</p>
        </div>
      `;
      return;
    }

    const assignedRouteIds = forwarder.assignedRoutes || [];
    const routes = getRoutes().filter(r => assignedRouteIds.includes(r.id));

    if (routes.length === 0) {
      container.innerHTML = `
        <div class="page-header"><h2>📝 운임 입력</h2></div>
        <div class="empty-state card">
          <h3 style="color: var(--text-primary);">지정된 노선이 없습니다</h3>
          <p style="color: var(--text-secondary);">입력할 노선이 지정되지 않았습니다. 관리자에게 문의하세요.</p>
        </div>
      `;
      return;
    }

    // Get existing rates from store
    const existingRates = getRatesByForwarder(bidding.id, forwarderId);

    // 원본 데이터 (저장된 값)
    const savedGridData = routes.map(route => {
      const rate = existingRates.find(r => r.routeId === route.id) || {};
      return {
        id: route.id,
        no: route.no,
        country: route.country,
        pod: route.pod,
        rate20ft: rate.rate20ft !== undefined && rate.rate20ft !== null ? rate.rate20ft : '',
        rate40ft: rate.rate40ft !== undefined && rate.rate40ft !== null ? rate.rate40ft : '',
        transitTime: rate.transitTime !== undefined && rate.transitTime !== null ? rate.transitTime : '',
        remark: rate.remark || ''
      };
    });

    // 편집 중이면 editGridData 사용, 아니면 savedGridData
    const gridData = isEditing && editGridData ? editGridData : savedGridData;

    // 컬럼 정의
    const columns = [
      { key: 'country', label: '국가', type: 'readonly', width: '15%' },
      { key: 'pod', label: 'POD', type: 'readonly', width: '15%' },
      { key: 'rate20ft', label: '20FT ($)', type: 'number', width: '10%' },
      { key: 'rate40ft', label: '40FT ($)', type: 'number', width: '10%' },
      { key: 'transitTime', label: 'T.TIME (일)', type: 'number', width: '10%' },
      { key: 'remark', label: 'REMARK', type: 'text', width: '40%' }
    ];

    // 편집 모드가 아니거나 마감/최종제출 상태이면 → 모든 셀 읽기 전용
    if (!isEditing || isClosed || isSubmitted) {
      columns.forEach(col => {
        if (col.type !== 'readonly') col.type = 'readonly';
      });
    }

    const statusLabel = (b) => b.status === 'active' ? '진행중' : '마감됨';
    const statusIcon = (b) => b.status === 'active' ? '🟢' : '🔴';

    // 상태 메시지
    let statusMessage = '';
    if (isClosed) {
      statusMessage = '<span style="color: var(--danger); font-weight: bold;">🔒 마감된 입찰 (읽기 전용)</span>';
    } else if (isSubmitted) {
      statusMessage = '<span style="color: var(--success); font-weight: bold;">✅ 최종제출 완료 (읽기 전용)</span>';
    } else if (isEditing) {
      statusMessage = `<span id="save-status" style="color: var(--accent); font-size: 0.9em; font-weight: 500;">✏️ 편집 중${hasChanges ? ' — 변경사항 있음' : ''}</span>`;
    } else {
      statusMessage = '<span style="color: var(--text-muted); font-size: 0.9em;">📋 조회 모드</span>';
    }

    // 버튼 영역
    let buttonsHtml = '';
    if (!isClosed && !isSubmitted) {
      if (isEditing) {
        buttonsHtml = `
          <button id="btn-cancel-edit" class="btn btn-secondary">✕ 취소</button>
          <button id="btn-save" class="btn btn-primary">💾 저장</button>
        `;
      } else {
        buttonsHtml = `
          <button id="btn-edit" class="btn btn-primary">✏️ 편집</button>
          <button id="btn-final-submit" class="btn btn-danger" style="margin-left: 0.5rem;">📨 최종제출</button>
        `;
      }
    }

    container.innerHTML = `
      <div class="page-header">
        <h2 style="margin: 0;">📝 운임 입력</h2>
        <div style="display: flex; align-items: center; gap: 1rem;">
          ${statusMessage}
          ${buttonsHtml}
        </div>
      </div>

      <div style="margin-bottom: 1.5rem;">
        <div class="card" style="display: flex; align-items: center; gap: 1rem; padding: 16px 20px; flex-wrap: wrap;">
          <label style="color: var(--text-secondary); font-weight: 500; white-space: nowrap;">📋 입찰 선택:</label>
          <select id="bidding-selector" class="form-select" style="flex: 1; max-width: 400px;" ${isEditing ? 'disabled' : ''}>
            ${sortedBiddings.map(b => `
              <option value="${b.id}" ${bidding && bidding.id === b.id ? 'selected' : ''}>
                ${statusIcon(b)} ${b.title} [${statusLabel(b)}]
              </option>
            `).join('')}
          </select>
          <span class="badge ${isClosed ? 'badge-closed' : 'badge-active'}">
            ${statusLabel(bidding)}
          </span>
          ${!isClosed && bidding.deadline ? (() => {
            const now = new Date();
            const deadlineDate = new Date(bidding.deadline);
            deadlineDate.setHours(23, 59, 59, 999);
            const diffMs = deadlineDate - now;
            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            let urgencyColor = 'var(--success)';
            let urgencyBg = 'var(--success-bg)';
            if (diffDays <= 1) { urgencyColor = 'var(--danger)'; urgencyBg = 'var(--danger-bg)'; }
            else if (diffDays <= 2) { urgencyColor = 'var(--warning)'; urgencyBg = 'var(--warning-bg)'; }
            return `
              <div style="display: flex; align-items: center; gap: 8px; margin-left: auto; padding: 8px 16px; background: ${urgencyBg}; border: 1px solid ${urgencyColor}; border-radius: 8px;">
                <span style="font-size: 1.1rem;">⏰</span>
                <span style="color: ${urgencyColor}; font-weight: 700; font-size: 0.9rem;">마감시한: [${diffDays > 0 ? `D-${diffDays}` : 'D-Day'}] ${bidding.deadline} (23:59)</span>
              </div>
            `;
          })() : ''}
        </div>
      </div>
      
      <div class="card" id="grid-container" style="padding: 0; overflow-x: auto;">
      </div>
    `;

    // === 이벤트 바인딩 ===

    // 입찰 선택 (편집 중이 아닐 때만)
    const biddingSelector = container.querySelector('#bidding-selector');
    if (biddingSelector) {
      biddingSelector.addEventListener('change', (e) => {
        selectedBiddingId = e.target.value;
        isEditing = false;
        hasChanges = false;
        editGridData = null;
        render();
      });
    }

    // [편집] 버튼
    const editBtn = container.querySelector('#btn-edit');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        isEditing = true;
        hasChanges = false;
        // 원본 데이터 복사 (편집 중 변경은 이 복사본에서만)
        editGridData = savedGridData.map(row => ({ ...row }));
        render();
      });
    }

    // [취소] 버튼
    const cancelBtn = container.querySelector('#btn-cancel-edit');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (hasChanges) {
          showModal({
            title: '편집 취소',
            content: '<p style="color: var(--text-secondary);">변경사항이 저장되지 않습니다. 편집을 취소하시겠습니까?</p>',
            confirmText: '취소하기',
            onConfirm: () => {
              isEditing = false;
              hasChanges = false;
              editGridData = null;
              render();
            }
          });
        } else {
          isEditing = false;
          editGridData = null;
          render();
        }
      });
    }

    // [저장] 버튼
    const saveBtn = container.querySelector('#btn-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        // === 유효성 검사 ===
        const numericFields = [
          { key: 'rate20ft', label: '20FT' },
          { key: 'rate40ft', label: '40FT' },
          { key: 'transitTime', label: 'T.TIME' }
        ];
        const errors = [];

        gridData.forEach((row) => {
          numericFields.forEach(field => {
            const val = row[field.key];
            if (val !== '' && val !== null && val !== undefined) {
              const num = Number(val);
              if (isNaN(num) || String(val).trim() === '') {
                errors.push(`• ${row.no}번 노선 (${row.pod}) — ${field.label}: "${val}"`);
              } else if (num < 0) {
                errors.push(`• ${row.no}번 노선 (${row.pod}) — ${field.label}: 음수 값 불가 (${val})`);
              }
            }
          });
        });

        if (errors.length > 0) {
          showModal({
            title: '⚠️ 입력값 오류',
            content: `
              <div style="color: var(--text-primary);">
                <p style="margin-bottom: 1rem; color: var(--text-secondary);">
                  다음 항목에 숫자가 아닌 값이 포함되어 있습니다.<br>
                  20FT, 40FT, T.TIME 에는 <strong style="color: var(--accent);">숫자만</strong> 입력 가능합니다.
                </p>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 16px; max-height: 200px; overflow-y: auto;">
                  ${errors.map(e => `<div style="padding: 4px 0; color: var(--danger);">${e}</div>`).join('')}
                </div>
              </div>
            `
          });
          return;
        }

        // === 저장 ===
        gridData.forEach(row => {
          saveRate({
            biddingId: bidding.id,
            routeId: row.id,
            forwarderId: forwarderId,
            rate20ft: row.rate20ft === '' ? null : Number(row.rate20ft),
            rate40ft: row.rate40ft === '' ? null : Number(row.rate40ft),
            transitTime: row.transitTime === '' ? null : Number(row.transitTime),
            remark: row.remark
          });
        });

        isEditing = false;
        hasChanges = false;
        editGridData = null;
        showToast('운임이 저장되었습니다 ✓');
        render();
      });
    }

    // [최종제출] 버튼
    const finalSubmitBtn = container.querySelector('#btn-final-submit');
    if (finalSubmitBtn) {
      finalSubmitBtn.addEventListener('click', () => {
        // 운임이 하나라도 입력되어 있는지 확인
        const hasAnyRate = savedGridData.some(row => 
          (row.rate20ft !== '' && row.rate20ft !== null) || 
          (row.rate40ft !== '' && row.rate40ft !== null)
        );
        if (!hasAnyRate) {
          showModal({
            title: '⚠️ 최종제출 불가',
            content: '<p style="color: var(--text-secondary);">운임이 하나도 입력되지 않았습니다. 운임을 먼저 입력해주세요.</p>'
          });
          return;
        }
        showModal({
          title: '📨 최종제출 확인',
          content: `
            <div style="color: var(--text-primary);">
              <p style="margin-bottom: 1rem; color: var(--text-secondary);">
                최종제출 후에는 <strong style="color: var(--danger);">운임 수정이 불가</strong>합니다.<br>
                관리자에게 요청해야만 수정할 수 있습니다.
              </p>
              <p style="color: var(--text-primary); font-weight: 600;">최종제출 하시겠습니까?</p>
            </div>
          `,
          confirmText: '최종제출',
          onConfirm: () => {
            submitForwarder(bidding.id, forwarderId);
            showToast('✅ 최종제출이 완료되었습니다.');
            render();
          }
        });
      });
    }

    // === DataGrid 렌더링 ===
    const gridContainer = container.querySelector('#grid-container');
    
    const handleCellChange = (rowIndex, colKey, value) => {
      if (!isEditing || isClosed) return;
      gridData[rowIndex][colKey] = value;
      hasChanges = true;
      // 상태 메시지 실시간 업데이트
      const statusEl = document.getElementById('save-status');
      if (statusEl) {
        statusEl.innerHTML = '✏️ 편집 중 — <strong style="color: var(--warning);">변경사항 있음</strong>';
      }
    };

    renderDataGrid(gridContainer, {
      columns,
      data: gridData,
      onCellChange: handleCellChange,
      showRowNumbers: true
    });
  }

  render();
}
