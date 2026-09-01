import { 
  getRoutes, getForwarders, getBiddings, getActiveBidding,
  getRates, getAllRates
} from '../store.js';
import { downloadCSV, generateCSV } from '../utils/csv.js';
import { formatCurrency, formatNumber } from '../utils/format.js';
import { getRegionLabel } from './RoutesPage.js';
import { openRouteChartModal } from '../components/RouteChartModal.js';
import { showMomComparisonModal } from '../components/MomComparisonModal.js';


// 권역 목록 (대시보드 필터용)
const REGION_OPTIONS = [
  { value: 'southeast_asia', label: '동남아시아' },
  { value: 'northeast_asia', label: '동북아시아' },
  { value: 'north_america',  label: '북미' },
  { value: 'europe_med',     label: '유럽 및 지중해' },
  { value: 'oceania',        label: '오세아니아' },
  { value: 'latin_america',  label: '중남미' },
  { value: 'russia_cis',     label: '러시아 및 CIS' },
];

export async function renderDashboardPage(container) {
  let filterManager = 'all';
  let filterRegion = 'all';
  let filterForwarder = 'all';
  let searchQuery = '';
  let selectedBiddingId = null;
  
  async function render() {
    const allBiddings = await getBiddings();
    const allRoutes = await getRoutes();
    const allForwarders = await getForwarders();
    
    let ratesByBidding = [];
    let prevRatesData = [];
    let prevBidding = null;

    const sortedBiddings = [...allBiddings].sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    
    let currentBidding = null;
    if (selectedBiddingId) {
      currentBidding = allBiddings.find(b => b.id === selectedBiddingId);
    }
    if (!currentBidding && sortedBiddings.length > 0) {
      currentBidding = sortedBiddings[0];
      selectedBiddingId = currentBidding.id;
    }
    
    let filteredRoutes = allRoutes;
    if (filterManager !== 'all') {
      filteredRoutes = filteredRoutes.filter(r => r.manager === filterManager);
    }
    if (filterRegion !== 'all') {
      filteredRoutes = filteredRoutes.filter(r => r.region === filterRegion);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredRoutes = filteredRoutes.filter(r => 
        (r.country && r.country.toLowerCase().includes(q)) || 
        (r.pod && r.pod.toLowerCase().includes(q))
      );
    }
    
    const managers = [...new Set(allRoutes.map(r => r.manager).filter(Boolean))].sort();
    const forwarderOptions = [...allForwarders].sort((a, b) => a.name.localeCompare(b.name));

    let stats = {
      totalRoutes: allRoutes.length,
      participatingForwarders: 0,
      completionRate: 0,
      avgLowest20ft: 0,
      momRate: null,
      momText: '-',
      momColor: 'var(--text-primary)',
      momSub: '직전 회차 없음'
    };

    let tableContent = '';
    
    if (!currentBidding) {
      tableContent = `<div class="empty-state">등록된 입찰이 없습니다. 입찰 관리에서 새 입찰을 생성해주세요.</div>`;
    } else {
      const allRatesData = await getAllRates(currentBidding.id);
      ratesByBidding = allRatesData;
      
      const participatingIds = new Set(ratesByBidding.map(r => r.forwarder_id));
      stats.participatingForwarders = participatingIds.size;
      
      let expectedRates = 0;
      allRoutes.forEach(route => {
        expectedRates += allForwarders.filter(f => f.assigned_routes && f.assigned_routes.includes(route.id)).length;
      });
      stats.completionRate = expectedRates ? Math.round((ratesByBidding.length / expectedRates) * 100) : 0;

      // ── [전월 대비 운임 변동률 계산] ──
      const currentIdx = sortedBiddings.findIndex(b => b.id === currentBidding.id);
      prevBidding = (currentIdx !== -1 && currentIdx + 1 < sortedBiddings.length) ? sortedBiddings[currentIdx + 1] : null;

      if (prevBidding) {
        try {
          prevRatesData = await getAllRates(prevBidding.id);

          // 1차: 노선별 평균 운임 계산 (40FT 기준)
          const currentRouteAvgs = [];
          const prevRouteAvgs = [];

          allRoutes.forEach(route => {
            // 이번 달 해당 노선의 제출 운임들
            const curRates = ratesByBidding
              .filter(r => r.route_id === route.id && r.rate_40ft !== null && r.rate_40ft !== undefined && r.rate_40ft !== '')
              .map(r => Number(r.rate_40ft));
            
            // 지난 달 해당 노선의 제출 운임들
            const prevRates = prevRatesData
              .filter(r => r.route_id === route.id && r.rate_40ft !== null && r.rate_40ft !== undefined && r.rate_40ft !== '')
              .map(r => Number(r.rate_40ft));

            if (curRates.length > 0) {
              const curAvg = curRates.reduce((a, b) => a + b, 0) / curRates.length;
              currentRouteAvgs.push(curAvg);
            }

            if (prevRates.length > 0) {
              const prevAvg = prevRates.reduce((a, b) => a + b, 0) / prevRates.length;
              prevRouteAvgs.push(prevAvg);
            }
          });

          // 2차: 전체 노선의 평균 종합
          if (currentRouteAvgs.length > 0 && prevRouteAvgs.length > 0) {
            const currentTotalAvg = currentRouteAvgs.reduce((a, b) => a + b, 0) / currentRouteAvgs.length;
            const prevTotalAvg = prevRouteAvgs.reduce((a, b) => a + b, 0) / prevRouteAvgs.length;

            if (prevTotalAvg > 0) {
              const diffPct = ((currentTotalAvg - prevTotalAvg) / prevTotalAvg) * 100;
              stats.momRate = diffPct;
              const absVal = Math.abs(diffPct).toFixed(1);
              if (diffPct < 0) {
                stats.momText = `-${absVal}% 하락`;
                stats.momColor = '#10b981';
              } else if (diffPct > 0) {
                stats.momText = `+${absVal}% 상승`;
                stats.momColor = 'var(--danger, #ef4444)';
              } else {
                stats.momText = `0.0% 보합`;
                stats.momColor = 'var(--text-secondary)';
              }

              const getMonthLabel = (title) => {
                const m = title.match(/(\d+월)/);
                return m ? m[1] : title;
              };
              const curLabel = getMonthLabel(currentBidding.title);
              const prevLabel = getMonthLabel(prevBidding.title);
              const curAvgFmt = '$' + Math.round(currentTotalAvg).toLocaleString();
              const prevAvgFmt = '$' + Math.round(prevTotalAvg).toLocaleString();

              stats.momSub = `${prevLabel} ${prevAvgFmt} → ${curLabel} ${curAvgFmt}`;
            }
          }
        } catch (e) {
          console.error('[Dashboard] MoM calc error:', e);
        }
      }
      
      let lowest20ftSum = 0;
      let routesWithLowest = 0;
      
      let rowsHtml = '';
      
      filteredRoutes.forEach(route => {
        const assignedForwarders = allForwarders.filter(f => f.assigned_routes && f.assigned_routes.includes(route.id));
        
        if (assignedForwarders.length === 0) {
          rowsHtml += `
            <tr class="route-separator">
              <td class="route-group-cell route-clickable" data-route-id="${route.id}" title="클릭하면 운임 추이 차트를 볼 수 있습니다">${route.no}</td>
              <td class="route-group-cell route-clickable" data-route-id="${route.id}">${route.country}</td>
              <td class="route-group-cell route-clickable" data-route-id="${route.id}">${route.pod}</td>
              <td colspan="5" class="empty-cell" style="color: var(--text-muted); text-align: center;">지정된 포워더가 없습니다.</td>
            </tr>
          `;
          return;
        }

        // 포워더 필터 적용
        const displayForwarders = filterForwarder === 'all'
          ? assignedForwarders
          : assignedForwarders.filter(f => f.id === filterForwarder);

        if (displayForwarders.length === 0) return; // 해당 포워더가 없는 노선은 건너뜀

        const routeRates = displayForwarders.map(f => {
          const rate = ratesByBidding.find(r => r.route_id === route.id && r.forwarder_id === f.id) || {};
          return { forwarder: f, rate: rate };
        });

        const valid20ft = routeRates.map(r => r.rate.rate_20ft).filter(val => val !== null && val !== undefined && val !== '');
        const valid40ft = routeRates.map(r => r.rate.rate_40ft).filter(val => val !== null && val !== undefined && val !== '');
        
        const min20ft = valid20ft.length > 0 ? Math.min(...valid20ft) : null;
        const min40ft = valid40ft.length > 0 ? Math.min(...valid40ft) : null;

        if (min20ft !== null) {
          lowest20ftSum += min20ft;
          routesWithLowest++;
        }

        const rowSpan = displayForwarders.length;

        routeRates.forEach((item, index) => {
          let html = `<tr class="${index === 0 ? 'route-separator' : ''}">`;
          
          if (index === 0) {
            html += `
              <td class="route-group-cell route-clickable" rowspan="${rowSpan}" data-route-id="${route.id}" title="클릭하면 운임 추이 차트를 볼 수 있습니다">${route.no}</td>
              <td class="route-group-cell route-clickable" rowspan="${rowSpan}" data-route-id="${route.id}">${route.country}</td>
              <td class="route-group-cell route-clickable" rowspan="${rowSpan}" data-route-id="${route.id}">${route.pod}</td>
            `;
          }
          
          const r20 = item.rate.rate_20ft !== undefined && item.rate.rate_20ft !== null && item.rate.rate_20ft !== '' ? formatCurrency(item.rate.rate_20ft) : '-';
          const r40 = item.rate.rate_40ft !== undefined && item.rate.rate_40ft !== null && item.rate.rate_40ft !== '' ? formatCurrency(item.rate.rate_40ft) : '-';
          const ttime = item.rate.transit_time ? item.rate.transit_time : '-';
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
        <div id="card-mom-trend" class="stat-card" style="cursor: pointer; transition: all 0.15s; position: relative;" title="클릭하면 전월 대비 노선별 평균 운임 변동 비교 원장 팝업이 열립니다">
          <div class="label" style="display: flex; align-items: center; justify-content: space-between;">
            <span>평균제출가 변동률 (전월대비, 40FT)</span>
            <span style="font-size: 11.5px; background: rgba(99,102,241,0.12); color: var(--accent); padding: 2px 8px; border-radius: 6px; font-weight: 800; border: 1px solid rgba(99,102,241,0.25);">원장보기 🔍</span>
          </div>
          <div class="value" style="color: ${stats.momColor}; font-size: 1.65rem; font-weight: 900; letter-spacing: -0.02em;">${stats.momText}</div>
          <div style="font-size: 13.5px; color: var(--text-secondary); margin-top: 6px; font-weight: 700; letter-spacing: -0.01em;">${stats.momSub}</div>
        </div>
        <div class="stat-card">
          <div class="label">최저가 평균 (20FT)</div>
          <div class="value">${formatCurrency(stats.avgLowest20ft)}</div>
        </div>
      </div>

      <div class="filter-bar" style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <label for="filter-region" style="color: var(--text-secondary); white-space: nowrap;">권역:</label>
          <select id="filter-region" class="form-select" style="width: auto;">
            <option value="all">전체</option>
            ${REGION_OPTIONS.map(r => `<option value="${r.value}" ${filterRegion === r.value ? 'selected' : ''}>${r.label}</option>`).join('')}
          </select>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <label for="filter-manager" style="color: var(--text-secondary); white-space: nowrap;">담당자:</label>
          <select id="filter-manager" class="form-select" style="width: auto;">
            <option value="all">전체</option>
            ${managers.map(m => `<option value="${m}" ${filterManager === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <label for="filter-forwarder" style="color: var(--text-secondary); white-space: nowrap;">포워더:</label>
          <select id="filter-forwarder" class="form-select" style="width: auto;">
            <option value="all">전체</option>
            ${forwarderOptions.map(f => `<option value="${f.id}" ${filterForwarder === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
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
    const biddingSelector = container.querySelector('#bidding-selector');
    if (biddingSelector) {
      biddingSelector.addEventListener('change', (e) => {
        selectedBiddingId = e.target.value;
        render();
      });
    }

    container.querySelector('#filter-region').addEventListener('change', (e) => {
      filterRegion = e.target.value;
      render();
    });

    container.querySelector('#filter-manager').addEventListener('change', (e) => {
      filterManager = e.target.value;
      render();
    });

    container.querySelector('#filter-forwarder').addEventListener('change', (e) => {
      filterForwarder = e.target.value;
      render();
    });

    const searchInput = container.querySelector('#search-query');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => render(), 300);
    });

    // 노선(No/국가/POD) 셀 클릭 시 운임 추이 차트 모달 오픈
    const dashTable = container.querySelector('.dashboard-table');
    if (dashTable) {
      dashTable.addEventListener('click', (e) => {
        const cell = e.target.closest('[data-route-id]');
        if (!cell) return;
        const routeId = cell.dataset.routeId;
        const route = filteredRoutes.find(r => r.id === routeId);
        if (route) openRouteChartModal(route, allForwarders);
      });
    }

    // 운임 변동률 카드 클릭 시 전월 대비 노선별 비교 원장 모달 오픈
    const momCard = container.querySelector('#card-mom-trend');
    if (momCard && currentBidding) {
      momCard.addEventListener('click', () => {
        showMomComparisonModal({
          currentBidding,
          prevBidding,
          allRoutes,
          currentRates: ratesByBidding,
          prevRates: prevRatesData
        });
      });
    }

    const downloadBtn = container.querySelector('#btn-download-csv');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', async () => {
        if (!currentBidding) return;
        
        const exportData = [];
        const allRatesData = await getAllRates(currentBidding.id);
        
        filteredRoutes.forEach(route => {
          const assignedFws = allForwarders.filter(f => f.assigned_routes && f.assigned_routes.includes(route.id));
          assignedFws.forEach(f => {
            const rate = allRatesData.find(r => r.route_id === route.id && r.forwarder_id === f.id) || {};
            exportData.push({
              No: route.no,
              권역: getRegionLabel(route.region),
              국가: route.country,
              POD: route.pod,
              담당자: route.manager || '',
              포워더명: f.name,
              // M1 수정: 0값이 falsy로 누락되지 않도록 ?? 사용
              '20FT': rate.rate_20ft ?? '',
              '40FT': rate.rate_40ft ?? '',
              'T.TIME': rate.transit_time ?? '',
              REMARK: rate.remark ?? ''
            });
          });
        });
        
        const csvContent = generateCSV(exportData);
        downloadCSV(csvContent, `운임비교_${currentBidding.title}.csv`);
      });
    }
  }

  await render();
}
