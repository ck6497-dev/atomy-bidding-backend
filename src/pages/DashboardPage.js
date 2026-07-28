import { 
  getRoutes, getForwarders, getBiddings, getActiveBidding,
  getRates, getAllRates
} from '../store.js';
import { downloadCSV, generateCSV } from '../utils/csv.js';
import { formatCurrency, formatNumber } from '../utils/format.js';

export function renderDashboardPage(container) {
  let filterManager = 'all';
  let searchQuery = '';
  let selectedBiddingId = null; // null = auto-select latest
  
  function render() {
    const allBiddings = getBiddings();
    const allRoutes = getRoutes();
    const allForwarders = getForwarders();
    
    // Sort biddings: active first, then by date descending
    const sortedBiddings = [...allBiddings].sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    // Auto-select: active bidding first, otherwise most recent
    let currentBidding = null;
    if (selectedBiddingId) {
      currentBidding = allBiddings.find(b => b.id === selectedBiddingId);
    }
    if (!currentBidding && sortedBiddings.length > 0) {
      currentBidding = sortedBiddings[0]; // active first, then most recent
      selectedBiddingId = currentBidding.id;
    }
    
    // Apply filters
    let filteredRoutes = allRoutes;
    if (filterManager !== 'all') {
      filteredRoutes = filteredRoutes.filter(r => r.manager === filterManager);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredRoutes = filteredRoutes.filter(r => 
        (r.country && r.country.toLowerCase().includes(q)) || 
        (r.pod && r.pod.toLowerCase().includes(q))
      );
    }
    
    // Get unique managers for filter
    const managers = [...new Set(allRoutes.map(r => r.manager).filter(Boolean))].sort();

    let stats = {
      totalRoutes: allRoutes.length,
      participatingForwarders: 0,
      completionRate: 0,
      avgLowest20ft: 0
    };

    let tableContent = '';
    
    if (!currentBidding) {
      tableContent = `<div class="empty-state">등록된 입찰이 없습니다. 입찰 관리에서 새 입찰을 생성해주세요.</div>`;
    } else {
      const allRates = getAllRates();
      const ratesByBidding = allRates.filter(r => r.biddingId === currentBidding.id);
      
      // Calculate participation
      const participatingIds = new Set(ratesByBidding.map(r => r.forwarderId));
      stats.participatingForwarders = participatingIds.size;
      
      // Calculate completion
      let expectedRates = 0;
      allRoutes.forEach(route => {
        expectedRates += allForwarders.filter(f => f.assignedRoutes && f.assignedRoutes.includes(route.id)).length;
      });
      stats.completionRate = expectedRates ? Math.round((ratesByBidding.length / expectedRates) * 100) : 0;
      
      // Build table rows
      let lowest20ftSum = 0;
      let routesWithLowest = 0;
      
      let rowsHtml = '';
      
      filteredRoutes.forEach(route => {
        const assignedForwarders = allForwarders.filter(f => f.assignedRoutes && f.assignedRoutes.includes(route.id));
        
        if (assignedForwarders.length === 0) {
          rowsHtml += `
            <tr class="route-separator">
              <td class="route-group-cell">${route.no}</td>
              <td class="route-group-cell">${route.country}</td>
              <td class="route-group-cell">${route.pod}</td>
              <td colspan="5" class="empty-cell" style="color: var(--text-muted); text-align: center;">지정된 포워더가 없습니다.</td>
            </tr>
          `;
          return;
        }

        const routeRates = assignedForwarders.map(f => {
          const rate = ratesByBidding.find(r => r.routeId === route.id && r.forwarderId === f.id) || {};
          return { forwarder: f, rate: rate };
        });

        const valid20ft = routeRates.map(r => r.rate.rate20ft).filter(val => val !== null && val !== undefined && val !== '');
        const valid40ft = routeRates.map(r => r.rate.rate40ft).filter(val => val !== null && val !== undefined && val !== '');
        
        const min20ft = valid20ft.length > 0 ? Math.min(...valid20ft) : null;
        const min40ft = valid40ft.length > 0 ? Math.min(...valid40ft) : null;

        if (min20ft !== null) {
          lowest20ftSum += min20ft;
          routesWithLowest++;
        }

        const rowSpan = assignedForwarders.length;

        routeRates.forEach((item, index) => {
          let html = `<tr class="${index === 0 ? 'route-separator' : ''}">`;
          
          if (index === 0) {
            html += `
              <td class="route-group-cell" rowspan="${rowSpan}">${route.no}</td>
              <td class="route-group-cell" rowspan="${rowSpan}">${route.country}</td>
              <td class="route-group-cell" rowspan="${rowSpan}">${route.pod}</td>
            `;
          }
          
          const r20 = item.rate.rate20ft !== undefined && item.rate.rate20ft !== null && item.rate.rate20ft !== '' ? formatCurrency(item.rate.rate20ft) : '-';
          const r40 = item.rate.rate40ft !== undefined && item.rate.rate40ft !== null && item.rate.rate40ft !== '' ? formatCurrency(item.rate.rate40ft) : '-';
          const ttime = item.rate.transitTime ? item.rate.transitTime : '-';
          const remark = item.rate.remark ? item.rate.remark : '';

          html += `
            <td class="forwarder-name-cell">${item.forwarder.name}</td>
            <td class="rate-cell">${r20}</td>
            <td class="rate-cell">${r40}</td>
            <td class="rate-cell">${ttime}</td>
            <td class="remark-cell">${remark ? `<span class="remark-text">${remark}<span class="remark-hover-card">${remark}</span></span>` : ''}</td>
          </tr>`;
          
          rowsHtml += html;
        });
      });
      
      stats.avgLowest20ft = routesWithLowest > 0 ? Math.round(lowest20ftSum / routesWithLowest) : 0;
      
      if (rowsHtml === '') {
        tableContent = `<tr><td colspan="8" style="text-align:center; color: var(--text-muted); padding: 2rem;">조건에 맞는 노선이 없습니다.</td></tr>`;
      } else {
        tableContent = rowsHtml;
      }
    }

    // Build bidding selector options
    const biddingStatusLabel = (b) => {
      if (b.status === 'active') return '진행중';
      if (b.status === 'closed') return '마감됨';
      return '준비중';
    };
    const biddingStatusIcon = (b) => {
      if (b.status === 'active') return '🟢';
      if (b.status === 'closed') return '🔴';
      return '🟡';
    };

    container.innerHTML = `
      <div class="page-header">
        <h2>📊 운임 비교 대시보드</h2>
        <div class="header-actions">
          <button id="btn-download-csv" class="btn btn-primary" ${!currentBidding ? 'disabled' : ''}>📥 CSV 다운로드</button>
        </div>
      </div>

      <div style="margin-bottom: 1.5rem;">
        <div class="card" style="display: flex; align-items: center; gap: 1rem; padding: 16px 20px;">
          <label style="color: var(--text-secondary); font-weight: 500; white-space: nowrap;">📋 입찰 선택:</label>
          <select id="bidding-selector" class="form-select" style="flex: 1; max-width: 400px;">
            ${sortedBiddings.length === 0 ? '<option value="">등록된 입찰이 없습니다</option>' : ''}
            ${sortedBiddings.map(b => `
              <option value="${b.id}" ${currentBidding && currentBidding.id === b.id ? 'selected' : ''}>
                ${biddingStatusIcon(b)} ${b.title} [${biddingStatusLabel(b)}]
              </option>
            `).join('')}
          </select>
          ${currentBidding ? `
            <span class="badge ${currentBidding.status === 'active' ? 'badge-active' : currentBidding.status === 'closed' ? 'badge-closed' : 'badge-preparing'}">
              ${biddingStatusLabel(currentBidding)}
            </span>
          ` : ''}
        </div>
      </div>
      
      <div class="dashboard-stats card-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="stat-card">
          <div class="label">총 노선 수</div>
          <div class="value">${stats.totalRoutes}</div>
        </div>
        <div class="stat-card">
          <div class="label">참여 포워더 수</div>
          <div class="value">${stats.participatingForwarders}</div>
        </div>
        <div class="stat-card">
          <div class="label">입력 완료율</div>
          <div class="value">${stats.completionRate}%</div>
        </div>
        <div class="stat-card">
          <div class="label">최저가 평균 (20FT)</div>
          <div class="value">${formatCurrency(stats.avgLowest20ft)}</div>
        </div>
      </div>

      <div class="filter-bar" style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <label for="filter-manager" style="color: var(--text-secondary); white-space: nowrap;">담당자:</label>
          <select id="filter-manager" class="form-select" style="width: auto;">
            <option value="all">전체</option>
            ${managers.map(m => `<option value="${m}" ${filterManager === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>
        <div style="flex-grow: 1;">
          <input type="text" id="search-query" class="search-input" placeholder="🔍 국가 또는 POD 검색..." value="${searchQuery}" style="width: 100%;">
        </div>
      </div>

      <div class="dashboard-table-container card" style="padding: 0; overflow-x: auto;">
        <table class="dashboard-table data-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th>No</th>
              <th>국가</th>
              <th>POD</th>
              <th>포워더명</th>
              <th>20FT($)</th>
              <th>40FT($)</th>
              <th>T.TIME</th>
              <th>REMARK</th>
            </tr>
          </thead>
          <tbody>
            ${tableContent}
          </tbody>
        </table>
      </div>
    `;

    // === Event Listeners ===
    
    // Bidding selector
    const biddingSelector = container.querySelector('#bidding-selector');
    if (biddingSelector) {
      biddingSelector.addEventListener('change', (e) => {
        selectedBiddingId = e.target.value;
        render();
      });
    }

    // Manager filter
    container.querySelector('#filter-manager').addEventListener('change', (e) => {
      filterManager = e.target.value;
      render();
    });

    // Search input
    const searchInput = container.querySelector('#search-query');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => render(), 300);
    });

    // CSV download
    const downloadBtn = container.querySelector('#btn-download-csv');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        if (!currentBidding) return;
        
        const exportData = [];
        const allRates = getAllRates();
        const ratesByBidding = allRates.filter(r => r.biddingId === currentBidding.id);
        
        filteredRoutes.forEach(route => {
          const assignedFws = allForwarders.filter(f => f.assignedRoutes && f.assignedRoutes.includes(route.id));
          assignedFws.forEach(f => {
            const rate = ratesByBidding.find(r => r.routeId === route.id && r.forwarderId === f.id) || {};
            exportData.push({
              No: route.no,
              국가: route.country,
              POD: route.pod,
              담당자: route.manager,
              포워더명: f.name,
              '20FT': rate.rate20ft || '',
              '40FT': rate.rate40ft || '',
              'T.TIME': rate.transitTime || '',
              REMARK: rate.remark || ''
            });
          });
        });
        
        const csvContent = generateCSV(exportData);
        downloadCSV(csvContent, `운임비교_${currentBidding.title}.csv`);
      });
    }
  }

  render();
}
