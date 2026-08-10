import { getRoutes, addRoute, updateRoute, deleteRoute, bulkAddRoutes, generateId } from '../store.js';
import { showModal, closeModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';
import { parseCSV, generateCSV, downloadCSV, readFileAsText } from '../utils/csv.js';

// ─── 권역 목록 (7개 고정) ────────────────────────────────────────────────────
const REGIONS = [
  { value: 'southeast_asia', label: '동남아시아' },
  { value: 'northeast_asia', label: '동북아시아' },
  { value: 'north_america',  label: '북미' },
  { value: 'europe_med',     label: '유럽 및 지중해' },
  { value: 'oceania',        label: '오세아니아' },
  { value: 'latin_america',  label: '중남미' },
  { value: 'russia_cis',     label: '러시아 및 CIS' },
];

export function getRegionLabel(value) {
  const found = REGIONS.find(r => r.value === value);
  return found ? found.label : (value || '');
}

function regionSelectOptions(selectedValue = '') {
  return `<option value="">-- 선택 --</option>` +
    REGIONS.map(r =>
      `<option value="${r.value}" ${selectedValue === r.value ? 'selected' : ''}>${r.label}</option>`
    ).join('');
}

export async function renderRoutesPage(container) {
  async function render() {
    const routes = await getRoutes();
    
    container.innerHTML = `
      <div class="page-header">
        <h2>🗺️ 노선 관리</h2>
        <div class="header-actions">
          <button id="btn-add-route" class="btn btn-primary">노선 추가</button>
          <input type="file" id="csv-upload-input" accept=".csv" style="display: none;">
          <button id="btn-upload-csv" class="btn btn-outline">CSV 업로드</button>
          <button id="btn-download-csv" class="btn btn-outline">CSV 다운로드</button>
        </div>
      </div>
      
      <div class="card table-container">
        <table class="data-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th>No</th>
              <th>국가</th>
              <th>POD</th>
              <th>권역</th>
              <th>담당자</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            ${routes.length > 0 ? routes.map(route => `
              <tr>
                <td>${route.no}</td>
                <td>${route.country}</td>
                <td>${route.pod}</td>
                <td>${route.region ? `<span class="badge badge-preparing" style="font-weight:500;">${getRegionLabel(route.region)}</span>` : '<span style="color:var(--text-muted);">-</span>'}</td>
                <td>${route.manager || ''}</td>
                <td>
                  <button class="btn btn-sm btn-outline btn-edit" data-id="${route.id}">편집</button>
                  <button class="btn btn-sm btn-danger btn-delete" data-id="${route.id}">삭제</button>
                </td>
              </tr>
            `).join('') : `<tr><td colspan="6" style="text-align:center;">등록된 노선이 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    // Events
    container.querySelector('#btn-add-route').addEventListener('click', () => {
      openRouteModal();
    });

    container.querySelector('#btn-upload-csv').addEventListener('click', () => {
      container.querySelector('#csv-upload-input').click();
    });

    container.querySelector('#csv-upload-input').addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        try {
          const file = e.target.files[0];
          const text = await readFileAsText(file);
          const data = parseCSV(text);
          if (data && data.length > 0) {
            const routesToAdd = data
              .filter(row => row['No'] && row['국가'] && row['POD'])
              .map(row => {
                // CSV 권역 컬럼: 한글 이름 또는 value 모두 허용
                const regionRaw = row['권역'] || '';
                const regionMatch = REGIONS.find(r => r.label === regionRaw.trim() || r.value === regionRaw.trim());
                return {
                  no: row['No'],
                  country: row['국가'],
                  pod: row['POD'],
                  region: regionMatch ? regionMatch.value : '',
                  manager: row['담당자'] || ''
                };
              });
            
            if (routesToAdd.length > 0) {
              await bulkAddRoutes(routesToAdd);
              showToast(`CSV 업로드 완료 (${routesToAdd.length}건)`);
              await render();
            }
          }
        } catch (err) {
          showToast('CSV 처리 중 오류 발생', 'error');
        }
      }
      e.target.value = ''; // Reset
    });

    container.querySelector('#btn-download-csv').addEventListener('click', async () => {
      const routes = await getRoutes();
      const exportData = routes.map(r => ({
        No: r.no,
        국가: r.country,
        POD: r.pod,
        권역: getRegionLabel(r.region),
        담당자: r.manager || ''
      }));
      const csvContent = generateCSV(exportData);
      downloadCSV(csvContent, 'routes.csv');
    });

    container.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const allRoutes = await getRoutes();
        const route = allRoutes.find(r => r.id === id);
        if (route) openRouteModal(route);
      });
    });

    container.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (confirm('정말로 이 노선을 삭제하시겠습니까?')) {
          await deleteRoute(id);
          showToast('삭제되었습니다.');
          await render();
        }
      });
    });
  }

  function openRouteModal(route = null) {
    const isEdit = !!route;
    const content = `
      <form id="route-form">
        <div class="form-group">
          <label>No</label>
          <input type="text" id="route-no" class="form-input" value="${route ? route.no : ''}" required>
        </div>
        <div class="form-group">
          <label>국가</label>
          <input type="text" id="route-country" class="form-input" value="${route ? route.country : ''}" required>
        </div>
        <div class="form-group">
          <label>POD</label>
          <input type="text" id="route-pod" class="form-input" value="${route ? route.pod : ''}" required>
        </div>
        <div class="form-group">
          <label>권역</label>
          <select id="route-region" class="form-select">
            ${regionSelectOptions(route ? route.region : '')}
          </select>
        </div>
        <div class="form-group">
          <label>담당자</label>
          <input type="text" id="route-manager" class="form-input" value="${route ? (route.manager || '') : ''}">
        </div>
        <div class="modal-footer" style="margin-top: 1rem; text-align: right;">
          <button type="button" class="btn btn-outline" id="btn-cancel-route">취소</button>
          <button type="submit" class="btn btn-primary">저장</button>
        </div>
      </form>
    `;

    showModal({
      title: isEdit ? '노선 편집' : '노선 추가',
      content: content
    });

    document.getElementById('btn-cancel-route').addEventListener('click', () => {
      closeModal();
    });

    document.getElementById('route-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const routeData = {
        no: document.getElementById('route-no').value,
        country: document.getElementById('route-country').value,
        pod: document.getElementById('route-pod').value,
        region: document.getElementById('route-region').value,
        manager: document.getElementById('route-manager').value
      };

      try {
        if (isEdit) {
          await updateRoute(route.id, routeData);
          showToast('노선이 수정되었습니다.');
        } else {
          await addRoute(routeData);
          showToast('노선이 추가되었습니다.');
        }
        closeModal();
        await render();
      } catch (err) {
        showToast('오류: ' + err.message, 'error');
      }
    });
  }

  await render();
}
