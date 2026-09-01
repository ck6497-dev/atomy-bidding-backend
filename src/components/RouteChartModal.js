import Chart from 'chart.js/auto';
import { getToken } from '../store.js';

// 포워더별 대표 색상 팔레트
const COLORS = [
  '#0284c7', // Sky Blue
  '#d97706', // Deep Amber
  '#db2777', // Deep Pink
  '#7c3aed', // Deep Purple
  '#0891b2', // Deep Cyan
  '#ea580c', // Deep Orange
  '#0d9488', // Deep Teal
  '#9333ea', // Deep Violet
  '#65a30d', // Deep Lime
  '#dc2626', // Deep Red
  '#2563eb', // Deep Blue
  '#475569'  // Deep Slate
];

async function fetchRouteHistory(routeId) {
  const res = await fetch('/api/rates/history/' + encodeURIComponent(routeId), {
    headers: { 'Authorization': 'Bearer ' + getToken() }
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`데이터 조회 실패 (${res.status}): ${errText}`);
  }
  return res.json();
}

export async function openRouteChartModal(route, allForwarders) {
  const existing = document.getElementById('rc-overlay');
  if (existing) existing.remove();

  let assignedForwarders = (allForwarders || []).filter(
    f => f.assigned_routes && f.assigned_routes.includes(route.id)
  );
  if (assignedForwarders.length === 0) {
    assignedForwarders = allForwarders || [];
  }

  const overlay = document.createElement('div');
  overlay.id = 'rc-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.8);z-index:2000;display:flex;align-items:center;justify-content:center;padding:12px;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;overscroll-behavior:contain;';

  overlay.innerHTML = `
    <div id="rc-modal" style="font-family:-apple-system,BlinkMacSystemFont,'Pretendard','Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:20px;width:96vw;max-width:1460px;height:94vh;max-height:94vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 35px 90px rgba(0,0,0,0.65);overscroll-behavior:contain;">
      
      <!-- 1. 최상단 헤더 -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 30px;border-bottom:1px solid var(--border-color);flex-shrink:0;background:var(--bg-surface);">
        <div style="display:flex;align-items:center;gap:16px;">
          <div style="width:48px;height:48px;border-radius:14px;background:var(--accent-glow);display:flex;align-items:center;justify-content:center;font-size:1.6rem;border:1.5px solid var(--accent);">
            📊
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:1.6rem;font-weight:900;color:var(--text-primary);letter-spacing:-0.03em;">
                ${route.country} — ${route.pod}
              </span>
              <span style="font-size:13px;padding:4px 12px;border-radius:8px;background:var(--bg-hover);color:var(--text-primary);font-weight:800;border:1px solid var(--border-color);">
                No.${route.no}
              </span>
            </div>
            <div style="font-size:13px;color:var(--text-secondary);margin-top:3px;font-weight:600;">
              입찰 회차별 포워더 견적 스펙트럼 & 최저 제출가 벤치마킹 대시보드
            </div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:14px;">
          <!-- 뷰 탭 전환 -->
          <div style="display:flex;gap:4px;background:var(--bg-primary);border-radius:12px;padding:4px;border:1px solid var(--border-color);">
            <button id="rc-tab-chart" style="padding:9px 22px;border-radius:9px;border:none;cursor:pointer;font-size:14px;font-weight:800;background:var(--accent);color:#fff;transition:all 0.15s;">
              📈 바잉파워 차트
            </button>
            <button id="rc-tab-table" style="padding:9px 22px;border-radius:9px;border:none;cursor:pointer;font-size:14px;font-weight:800;background:transparent;color:var(--text-secondary);transition:all 0.15s;">
              📋 원장 데이터 (Table)
            </button>
          </div>
          <button id="rc-close" style="width:40px;height:40px;border-radius:50%;border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);cursor:pointer;font-size:1.3rem;display:flex;align-items:center;justify-content:center;transition:all 0.15s;font-weight:700;" title="닫기 (ESC)">
            ✕
          </button>
        </div>
      </div>

      <!-- 메인 스크롤 콘텐츠 영역 -->
      <div style="flex:1;overflow-y:auto;padding:20px 30px;min-height:0;display:flex;flex-direction:column;gap:18px;overscroll-behavior:contain;">
        
        <!-- 로딩 표시 -->
        <div id="rc-loading" style="display:flex;align-items:center;justify-content:center;height:450px;color:var(--text-secondary);font-size:var(--font-lg);gap:10px;font-weight:700;">
          ⏳ 운임 이력 데이터 분석 중...
        </div>

        <!-- 2. 최상단: 핵심 KPI 요약 카드 4종 -->
        <div id="rc-stats" style="display:none;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;flex-shrink:0;"></div>

        <!-- 3. 중간: 컨트롤 바 (포워더 칩 필터 & 20FT/40FT 토글) -->
        <div id="rc-controls" style="display:none;padding:14px 22px;border:1px solid var(--border-color);border-radius:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;flex-shrink:0;background:var(--bg-surface);">
          <div style="display:flex;flex-direction:column;gap:8px;flex:1;min-width:340px;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:14px;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
                🏢 포워더 선택 & 하이라이트 <span style="font-weight:600;color:var(--text-secondary);font-size:13px;">(이름에 마우스를 올리면 해당 선만 굵게 강조됩니다)</span>
              </span>
              <div style="display:flex;gap:10px;">
                <button id="rc-all" style="font-size:13px;color:var(--accent);background:none;border:none;cursor:pointer;font-weight:800;padding:0;">전체 선택</button>
                <span style="color:var(--border-color);">|</span>
                <button id="rc-none" style="font-size:13px;color:var(--text-secondary);background:none;border:none;cursor:pointer;font-weight:800;padding:0;">전체 해제</button>
              </div>
            </div>
            <div id="rc-chips" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
          </div>

          <!-- 20FT / 40FT 스위처 -->
          <div style="display:flex;align-items:center;gap:12px;border-left:1.5px solid var(--border-color);padding-left:22px;">
            <span style="font-size:14px;font-weight:800;color:var(--text-primary);">컨테이너 규격:</span>
            <div style="display:flex;gap:4px;background:var(--bg-primary);border-radius:12px;padding:4px;border:1px solid var(--border-color);">
              <button id="rc-ft20" style="padding:7px 20px;border-radius:8px;border:none;cursor:pointer;font-size:14px;font-weight:800;background:transparent;color:var(--text-secondary);transition:all 0.15s;">
                20FT
              </button>
              <button id="rc-ft40" style="padding:7px 20px;border-radius:8px;border:none;cursor:pointer;font-size:14px;font-weight:800;background:var(--accent);color:#fff;transition:all 0.15s;">
                40FT
              </button>
            </div>
          </div>
        </div>

        <!-- 4. 하단: 차트 뷰 -->
        <div id="rc-chart-view" style="display:none;position:relative;flex-direction:column;gap:12px;">
          
          <!-- 차트 상단 레이어 안내 배너 -->
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:24px;background:var(--bg-surface);border:1px solid var(--border-color);padding:10px 20px;border-radius:12px;font-size:13.5px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="width:20px;height:5px;background:#10b981;border-radius:3px;display:inline-block;box-shadow:0 0 10px rgba(16,185,129,0.7);"></span>
              <strong style="color:#10b981;font-size:14px;">★ 최저 제출가 (Bold Emerald)</strong>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="width:20px;height:12px;background:rgba(148,163,184,0.3);border-radius:3px;display:inline-block;border:1px dashed rgba(100,116,139,0.6);"></span>
              <span style="color:var(--text-primary);font-weight:700;font-size:13.5px;">포워더 견적 스펙트럼 (Min-Max 밴드)</span>
            </div>
          </div>

          <!-- 캔버스 영역 및 HTML 커스텀 툴팁 컨테이너 -->
          <div id="rc-canvas-container" style="position:relative;height:480px;width:100%;">
            <canvas id="rc-canvas"></canvas>
            
            <!-- HTML 커스텀 툴팁 (크기 제한 없는 고선명 대형 툴팁) -->
            <div id="rc-html-tooltip" style="
              display: none;
              position: absolute;
              pointer-events: none;
              background: var(--bg-surface, #1e293b);
              border: 2px solid var(--border-color, #475569);
              border-radius: 16px;
              padding: 18px 24px;
              box-shadow: 0 25px 60px rgba(0,0,0,0.55);
              z-index: 1000;
              min-width: 280px;
              transition: opacity 0.15s ease, transform 0.1s ease;
              font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif;
            "></div>
          </div>
        </div>

        <!-- 5. 원장 데이터 테이블 뷰 -->
        <div id="rc-table-view" style="display:none;">
          <div id="rc-table-content"></div>
        </div>
      </div>
    </div>
  `;

  // 뒷배경 스크롤 일시 정지 (Body Scroll Lock)
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);

  let currentFt = '40ft';
  let activeTab = 'chart';
  let chartInstance = null;
  let historyData = [];
  let hoveredFid = null;

  const handleClose = () => {
    // 뒷배경 스크롤 복원
    document.body.style.overflow = '';
    if (chartInstance) {
      try { chartInstance.destroy(); } catch (e) {}
    }
    overlay.remove();
  };
  document.getElementById('rc-close').addEventListener('click', handleClose);
  overlay.addEventListener('click', e => { if (e.target === overlay) handleClose(); });
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      handleClose();
      window.removeEventListener('keydown', handleKeydown);
    }
  };
  window.addEventListener('keydown', handleKeydown);

  // 데이터 로드
  try {
    historyData = await fetchRouteHistory(route.id);
  } catch (err) {
    console.error('[RouteChart] fetch error:', err);
    document.getElementById('rc-loading').innerHTML = `❌ 데이터 로드 실패: ${err.message}`;
    return;
  }

  // 데이터에 나타나는 포워더 목록 추출
  const fwdMapInData = {};
  historyData.forEach(r => {
    if (r.forwarder_id && !fwdMapInData[r.forwarder_id]) {
      const match = (allForwarders || []).find(f => f.id === r.forwarder_id);
      fwdMapInData[r.forwarder_id] = match ? match.name : (r.forwarder_name || r.forwarder_id);
    }
  });

  const finalForwardersList = [];
  const addedFids = new Set();

  assignedForwarders.forEach(f => {
    if (!addedFids.has(f.id)) {
      finalForwardersList.push(f);
      addedFids.add(f.id);
    }
  });

  Object.keys(fwdMapInData).forEach(fid => {
    if (!addedFids.has(fid)) {
      finalForwardersList.push({ id: fid, name: fwdMapInData[fid] });
      addedFids.add(fid);
    }
  });

  const finalForwarders = finalForwardersList.length > 0 ? finalForwardersList : assignedForwarders;
  let activeFids = new Set(finalForwarders.map(f => f.id));

  function renderChips() {
    const chipsContainer = document.getElementById('rc-chips');
    if (!chipsContainer) return;

    if (finalForwarders.length === 0) {
      chipsContainer.innerHTML = '<span style="color:var(--text-secondary);font-size:14px;font-weight:600;">등록된 포워더가 없습니다.</span>';
      return;
    }

    chipsContainer.innerHTML = finalForwarders.map((f, i) => {
      const c = COLORS[i % COLORS.length];
      const isVisible = activeFids.has(f.id);
      const isHovered = hoveredFid === f.id;

      return `
        <button class="rc-chip" data-fid="${f.id}" data-idx="${i}" style="
          padding: 7px 16px;
          border-radius: 24px;
          cursor: pointer;
          font-size: 13.5px;
          font-weight: 800;
          font-family: inherit;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1.8px solid ${isVisible ? c : 'var(--border-color)'};
          background: ${isVisible ? (isHovered ? c + '40' : c + '20') : 'transparent'};
          color: ${isVisible ? 'var(--text-primary)' : 'var(--text-secondary)'};
          opacity: ${isVisible ? '1' : '0.5'};
          transform: ${isHovered ? 'scale(1.05)' : 'scale(1)'};
          display: flex;
          align-items: center;
          gap: 7px;
        ">
          <span style="width:9px;height:9px;border-radius:50%;background:${isVisible ? c : '#94a3b8'};flex-shrink:0;"></span>
          ${f.name}
        </button>
      `;
    }).join('');
  }

  function buildPeriods() {
    const map = {};
    (historyData || []).forEach(r => {
      if (!map[r.bidding_id]) {
        map[r.bidding_id] = {
          biddingId: r.bidding_id,
          label: String(r.year || '').slice(-2) + '.' + String(r.month || '').padStart(2, '0'),
          year: Number(r.year) || 0,
          month: Number(r.month) || 0,
          rates: {}
        };
      }
      map[r.bidding_id].rates[r.forwarder_id] = r;
    });
    return Object.values(map).sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  }

  function getVal(r, rateKey) {
    if (!r || r[rateKey] == null || r[rateKey] === '' || isNaN(Number(r[rateKey]))) return null;
    return Number(r[rateKey]);
  }

  function calcMinMax(periods, rateKey) {
    // 포워더 칩 선택(On/Off)과 무관하게 전체 포워더의 실제 제출가 기준으로 통계 및 벤치마크 계산
    return periods.map(p => {
      const vals = finalForwarders
        .map(f => getVal(p.rates[f.id], rateKey))
        .filter(v => v !== null);
      return {
        min: vals.length ? Math.min(...vals) : null,
        max: vals.length ? Math.max(...vals) : null
      };
    });
  }

  function renderChart() {
    const loadEl = document.getElementById('rc-loading');
    const chartView = document.getElementById('rc-chart-view');
    const controlsEl = document.getElementById('rc-controls');
    const statsEl = document.getElementById('rc-stats');
    const allPeriods = buildPeriods();
    // 최근 1년(최대 12개 회차) 데이터만 추출
    const periods = allPeriods.slice(-12);

    if (periods.length === 0) {
      if (loadEl) {
        loadEl.style.display = 'flex';
        loadEl.innerHTML = '📭 해당 노선의 입찰 운임 데이터가 없습니다.<br><small style="margin-top:8px;display:block;">포워더가 운임을 입력하면 차트가 활성화됩니다.</small>';
      }
      if (chartView) chartView.style.display = 'none';
      if (controlsEl) controlsEl.style.display = 'none';
      if (statsEl) statsEl.style.display = 'none';
      return;
    }

    if (loadEl) loadEl.style.display = 'none';
    if (controlsEl) controlsEl.style.display = 'flex';
    if (chartView) chartView.style.display = 'flex';

    const rateKey = currentFt === '20ft' ? 'rate_20ft' : 'rate_40ft';
    const labels = periods.map(p => p.label);
    const minMaxArr = calcMinMax(periods, rateKey);

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const gridC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const lblC = isDark ? '#e2e8f0' : '#1e293b';

    // 포워더별 데이터셋
    const fwDatasets = finalForwarders.map((f, i) => {
      const color = COLORS[i % COLORS.length];
      const isHovered = hoveredFid === f.id;
      const hasHoverTarget = hoveredFid !== null;

      let borderWidth = 2.5;
      let pointRadius = 4;

      if (hasHoverTarget) {
        if (isHovered) {
          borderWidth = 4.5;
          pointRadius = 7.5;
        } else {
          borderWidth = 1.2;
          pointRadius = 1;
        }
      }

      return {
        label: f.name,
        fid: f.id,
        rawColor: color,
        data: periods.map(p => getVal(p.rates[f.id], rateKey)),
        borderColor: color,
        backgroundColor: color + '15',
        borderWidth: borderWidth,
        pointRadius: isHovered ? 7.5 : pointRadius,
        pointHoverRadius: 9,
        pointBackgroundColor: color,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        tension: 0.3,
        hidden: !activeFids.has(f.id),
        spanGaps: false,
      };
    });

    // Min-Max 밴드
    const bandTop = {
      label: '_band_top',
      data: minMaxArr.map(d => d.max),
      borderColor: 'transparent',
      backgroundColor: isDark ? 'rgba(148,163,184,0.16)' : 'rgba(100,116,139,0.12)',
      borderWidth: 0,
      pointRadius: 0,
      fill: 1,
      tension: 0.3,
    };

    const bandBot = {
      label: '_band_bot',
      data: minMaxArr.map(d => d.min),
      borderColor: isDark ? 'rgba(148,163,184,0.35)' : 'rgba(100,116,139,0.3)',
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderDash: [4, 4],
      pointRadius: 0,
      fill: false,
      tension: 0.3,
    };

    // 최저 제출가 초록 라인
    const minLine = {
      label: '★ 최저 제출가',
      data: minMaxArr.map(d => d.min),
      borderColor: '#10b981',
      backgroundColor: '#10b98125',
      borderWidth: 5,
      pointRadius: 6,
      pointHoverRadius: 11,
      pointBackgroundColor: '#10b981',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2.5,
      tension: 0.3,
      fill: false,
    };

    if (chartInstance) {
      try { chartInstance.destroy(); } catch (e) {}
      chartInstance = null;
    }

    try {
      const canvasEl = document.getElementById('rc-canvas');
      const tooltipEl = document.getElementById('rc-html-tooltip');
      if (!canvasEl) return;
      const ctx = canvasEl.getContext('2d');

      const dpr = Math.max(window.devicePixelRatio || 1, 2);

      chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [bandTop, bandBot, minLine, ...fwDatasets]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          devicePixelRatio: dpr,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              // 기본 캔버스 툴팁 비활성화하고 완벽한 HTML 커스텀 툴팁 사용
              enabled: false,
              external: function(context) {
                if (!tooltipEl) return;
                const tooltipModel = context.tooltip;

                if (tooltipModel.opacity === 0) {
                  tooltipEl.style.display = 'none';
                  return;
                }

                const idx = tooltipModel.dataPoints?.[0]?.dataIndex;
                if (idx === undefined || !periods[idx]) return;

                const curPeriod = periods[idx];
                const mm = minMaxArr[idx];

                // 툴팁 HTML 내용 생성 (대형 폰트와 선명한 레이아웃)
                let innerHtml = `
                  <div style="font-size: 16.5px; font-weight: 900; color: var(--text-primary, #fff); border-bottom: 1.5px solid var(--border-color, #475569); padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <span>📅 ${curPeriod.label}월 운임 동향</span>
                    <span style="font-size: 13.5px; padding: 2px 8px; border-radius: 6px; background: var(--accent); color: #fff; font-weight: 800;">${currentFt.toUpperCase()}</span>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
                `;

                // 최저 제출가 행
                if (mm && mm.min !== null) {
                  innerHtml += `
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 20px; font-size: 15.5px; font-weight: 900; color: #10b981; background: rgba(16,185,129,0.12); padding: 5px 10px; border-radius: 8px;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981;"></span>
                        <span>★ 최저 제출가</span>
                      </div>
                      <span style="font-family: monospace; font-size: 16.5px; font-variant-numeric: tabular-nums;">$${mm.min.toLocaleString()}</span>
                    </div>
                  `;
                }

                // 각 포워더별 제출 운임 행
                finalForwarders.filter(f => activeFids.has(f.id)).forEach((f, i) => {
                  const rateObj = curPeriod.rates[f.id];
                  const val = getVal(rateObj, rateKey);
                  const color = COLORS[i % COLORS.length];

                  innerHtml += `
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 20px; font-size: 14.5px; font-weight: 700; color: var(--text-primary, #e2e8f0); padding: 2px 8px;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${color};"></span>
                        <span>${f.name}</span>
                      </div>
                      <span style="font-family: monospace; font-size: 15px; font-variant-numeric: tabular-nums; ${val !== null ? '' : 'color: var(--text-muted); font-size: 13.5px;'}">
                        ${val !== null ? '$' + val.toLocaleString() : '미제출'}
                      </span>
                    </div>
                  `;
                });

                innerHtml += `</div>`;

                // 하단 견적 격차 (Spread)
                if (mm && mm.min !== null && mm.max !== null && mm.min !== mm.max) {
                  const spread = mm.max - mm.min;
                  innerHtml += `
                    <div style="border-top: 1.5px dashed var(--border-color, #475569); padding-top: 10px; font-size: 13.5px; color: var(--text-secondary, #94a3b8); display: flex; flex-direction: column; gap: 3px;">
                      <div style="display: flex; justify-content: space-between; font-weight: 800; color: var(--warning, #f59e0b); font-size: 14.5px;">
                        <span>📊 견적 격차 (Spread)</span>
                        <span style="font-family: monospace; font-variant-numeric: tabular-nums;">$${spread.toLocaleString()}</span>
                      </div>
                      <div style="font-size: 12.5px; color: var(--text-secondary);">
                        최저 $${mm.min.toLocaleString()} ~ 최고 $${mm.max.toLocaleString()}
                      </div>
                    </div>
                  `;
                }

                tooltipEl.innerHTML = innerHtml;
                tooltipEl.style.display = 'block';

                // 위치 계산 (마우스 커서 기준 및 캔버스 경계 감지)
                const containerRect = document.getElementById('rc-canvas-container').getBoundingClientRect();
                const tooltipWidth = tooltipEl.offsetWidth || 300;
                let left = tooltipModel.caretX + 15;
                let top = tooltipModel.caretY - 20;

                // 오른쪽 경계를 벗어날 경우 왼쪽에 표시
                if (left + tooltipWidth > containerRect.width - 20) {
                  left = tooltipModel.caretX - tooltipWidth - 15;
                }
                if (top < 10) top = 10;

                tooltipEl.style.left = left + 'px';
                tooltipEl.style.top = top + 'px';
              }
            }
          },
          scales: {
            x: {
              grid: { color: gridC },
              ticks: { color: lblC, font: { size: 14, weight: '800', family: "inherit" }, padding: 8 }
            },
            y: {
              grid: { color: gridC },
              ticks: {
                color: lblC,
                font: { size: 14, weight: '800', family: "inherit" },
                padding: 8,
                callback: v => '$' + Number(v).toLocaleString()
              }
            }
          }
        }
      });
    } catch (chartErr) {
      console.error('[RouteChart] Chart init failed:', chartErr);
    }

    renderKpiStats(periods, minMaxArr, rateKey);
  }

  function renderKpiStats(periods, minMaxArr, rateKey) {
    const statsEl = document.getElementById('rc-stats');
    if (!statsEl) return;

    if (periods.length === 0) {
      statsEl.style.display = 'none';
      return;
    }

    const lastPeriod = periods[periods.length - 1];
    const lastMM = minMaxArr[minMaxArr.length - 1];

    if (!lastMM || lastMM.min === null) {
      statsEl.style.display = 'none';
      return;
    }

    const minFw = finalForwarders.find(f =>
      lastPeriod.rates[f.id] &&
      Number(lastPeriod.rates[f.id][rateKey]) === lastMM.min
    );

    const winCounts = {};
    finalForwarders.forEach(f => { winCounts[f.id] = 0; });
    periods.forEach(p => {
      let lowestVal = Infinity;
      let winnerId = null;
      finalForwarders.forEach(f => {
        const val = getVal(p.rates[f.id], rateKey);
        if (val !== null && val < lowestVal) {
          lowestVal = val;
          winnerId = f.id;
        }
      });
      if (winnerId) winCounts[winnerId] = (winCounts[winnerId] || 0) + 1;
    });

    const topWinnerEntry = Object.entries(winCounts).sort((a, b) => b[1] - a[1])[0];
    const topWinnerObj = finalForwarders.find(f => f.id === topWinnerEntry?.[0]);

    const validSpreads = minMaxArr.filter(m => m.min !== null && m.max !== null).map(m => m.max - m.min);
    const avgSpread = validSpreads.length ? Math.round(validSpreads.reduce((a, b) => a + b, 0) / validSpreads.length) : 0;

    statsEl.style.display = 'grid';
    statsEl.innerHTML = `
      <!-- 카드 1: 최근 최저 제출가 (에메랄드) -->
      <div style="background:var(--bg-surface);border:1px solid var(--border-color);border-radius:16px;padding:18px 24px;box-shadow:0 4px 16px rgba(0,0,0,0.04);">
        <div style="font-size:13.5px;color:var(--text-secondary);margin-bottom:6px;font-weight:700;">
          최근 최저 제출가 (${lastPeriod.label}월)
        </div>
        <div style="font-size:2.1rem;font-weight:900;color:#10b981;letter-spacing:-0.03em;font-variant-numeric:tabular-nums;line-height:1.2;">
          $${lastMM.min.toLocaleString()}
        </div>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:5px;font-weight:600;">
          최저가 제출: <strong style="color:var(--text-primary);font-size:14px;">${minFw ? minFw.name : '-'}</strong>
        </div>
      </div>

      <!-- 카드 2: 최근 최고 제출가 (로즈 레드) -->
      <div style="background:var(--bg-surface);border:1px solid var(--border-color);border-radius:16px;padding:18px 24px;box-shadow:0 4px 16px rgba(0,0,0,0.04);">
        <div style="font-size:13.5px;color:var(--text-secondary);margin-bottom:6px;font-weight:700;">
          최근 최고 제출가 (${lastPeriod.label}월)
        </div>
        <div style="font-size:2.1rem;font-weight:900;color:var(--danger);letter-spacing:-0.03em;font-variant-numeric:tabular-nums;line-height:1.2;">
          $${lastMM.max.toLocaleString()}
        </div>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:5px;font-weight:600;">
          최저가 대비: <strong style="color:var(--danger);">+$${(lastMM.max - lastMM.min).toLocaleString()}</strong>
        </div>
      </div>

      <!-- 카드 3: 최근 견적 격차 (앰버 오렌지) -->
      <div style="background:var(--bg-surface);border:1px solid var(--border-color);border-radius:16px;padding:18px 24px;box-shadow:0 4px 16px rgba(0,0,0,0.04);">
        <div style="font-size:13.5px;color:var(--text-secondary);margin-bottom:6px;font-weight:700;">
          최근 견적 격차 (Spread)
        </div>
        <div style="font-size:2.1rem;font-weight:900;color:var(--warning);letter-spacing:-0.03em;font-variant-numeric:tabular-nums;line-height:1.2;">
          $${(lastMM.max - lastMM.min).toLocaleString()}
        </div>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:5px;font-weight:600;">
          전체 평균: <strong style="color:var(--text-primary);">$${avgSpread.toLocaleString()}</strong>
        </div>
      </div>

      <!-- 카드 4: 최다 최저가 제시 포워더 (스마트 블루) -->
      <div style="background:var(--bg-surface);border:1px solid var(--border-color);border-radius:16px;padding:18px 24px;box-shadow:0 4px 16px rgba(0,0,0,0.04);">
        <div style="font-size:13.5px;color:var(--text-secondary);margin-bottom:6px;font-weight:700;">
          최다 최저가 제시 포워더
        </div>
        <div style="font-size:1.75rem;font-weight:900;color:var(--accent);letter-spacing:-0.02em;margin-top:2px;line-height:1.2;">
          ${topWinnerObj ? topWinnerObj.name : '-'}
        </div>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:5px;font-weight:600;">
          총 ${periods.length}회차 중 <strong style="color:var(--accent);font-size:14px;">${topWinnerEntry ? topWinnerEntry[1] : 0}회</strong> 최저가 제출
        </div>
      </div>
    `;
  }

  function renderTable() {
    const periods = buildPeriods();
    const rateKey = currentFt === '20ft' ? 'rate_20ft' : 'rate_40ft';
    const vFws = finalForwarders.filter(f => activeFids.has(f.id));

    document.getElementById('rc-loading').style.display = 'none';
    document.getElementById('rc-chart-view').style.display = 'none';
    const controlsEl = document.getElementById('rc-controls');
    if (controlsEl) controlsEl.style.display = 'flex';

    const tv = document.getElementById('rc-table-view');
    tv.style.display = 'block';

    if (periods.length === 0) {
      document.getElementById('rc-table-content').innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:48px;font-size:16px;font-weight:700;">입찰 운임 데이터가 없습니다.</p>';
      return;
    }

    let h = `
      <div style="overflow-x:auto;border:1px solid var(--border-color);border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
        <table class="data-table" style="width:100%;border-collapse:collapse;font-size:14px;text-align:center;">
          <thead>
            <!-- 1단 그룹 헤더 -->
            <tr style="background:var(--bg-surface);border-bottom:1px solid var(--border-color);">
              <th rowspan="2" style="width:110px;min-width:110px;text-align:center;padding:14px 16px;border-right:1.5px solid var(--border-color);font-size:14px;font-weight:800;color:var(--text-primary);vertical-align:middle;">
                입찰 회차
              </th>
              <th colspan="${vFws.length}" style="text-align:center;padding:10px 16px;border-right:3px solid var(--border-color);font-size:13.5px;font-weight:800;color:var(--text-secondary);background:var(--bg-secondary);">
                🏢 포워더별 제출 운임 (${currentFt.toUpperCase()} 기준)
              </th>
              <th colspan="3" style="text-align:center;padding:10px 16px;font-size:13.5px;font-weight:800;color:var(--text-primary);background:rgba(148,163,184,0.12);">
                📊 회차별 요약 통계 (Summary)
              </th>
            </tr>
            <!-- 2단 개별 컬럼 헤더 -->
            <tr style="background:var(--bg-surface);border-bottom:2px solid var(--border-color);">
              ${vFws.map((f, i) => `
                <th style="width:130px;min-width:130px;color:${COLORS[i % COLORS.length]};white-space:nowrap;padding:12px 16px;font-size:13.5px;font-weight:800;text-align:center;${i === vFws.length - 1 ? 'border-right:3px solid var(--border-color);' : ''}">
                  ${f.name}
                </th>
              `).join('')}
              <th style="width:120px;min-width:120px;color:#10b981;white-space:nowrap;padding:12px 16px;font-size:13.5px;font-weight:800;text-align:center;background:rgba(16,185,129,0.06);">
                최저 제출가
              </th>
              <th style="width:120px;min-width:120px;color:var(--danger);white-space:nowrap;padding:12px 16px;font-size:13.5px;font-weight:800;text-align:center;background:rgba(239,68,68,0.04);">
                최고 제출가
              </th>
              <th style="width:125px;min-width:125px;color:var(--warning);white-space:nowrap;padding:12px 16px;font-size:13.5px;font-weight:800;text-align:center;background:rgba(245,158,11,0.04);">
                Spread (격차)
              </th>
            </tr>
          </thead>
          <tbody>
    `;

    periods.forEach(p => {
      const vals = vFws.map(f => getVal(p.rates[f.id], rateKey));
      const valid = vals.filter(v => v !== null);
      const minV = valid.length ? Math.min(...valid) : null;
      const maxV = valid.length ? Math.max(...valid) : null;
      const spread = (minV !== null && maxV !== null) ? maxV - minV : null;

      h += `
        <tr style="border-bottom:1px solid var(--border-color);transition:background 0.1s ease;">
          <!-- 회차 열 -->
          <td style="font-weight:800;text-align:center;padding:13px 16px;background:var(--bg-surface);font-size:14px;color:var(--text-primary);border-right:1.5px solid var(--border-color);white-space:nowrap;">
            ${p.label}
          </td>

          <!-- 포워더별 제출가 열 (균등 너비 130px, 가운데 정렬) -->
          ${vals.map((v, i) => {
            const isMin = v !== null && v === minV && valid.length > 1;
            const isMax = v !== null && v === maxV && valid.length > 1;
            const isLast = i === vals.length - 1;
            const borderRight = isLast ? 'border-right:3px solid var(--border-color);' : '';
            const style = isMin
              ? 'color:#10b981;font-weight:900;background:rgba(16,185,129,0.14);font-size:14.5px;'
              : (isMax ? 'color:var(--danger);font-size:14px;font-weight:700;' : 'font-size:14px;color:var(--text-primary);');
            return `<td style="padding:13px 16px;font-variant-numeric:tabular-nums;text-align:center;${borderRight}${style}">
              ${v !== null ? '$' + v.toLocaleString() : '<span style="color:var(--text-secondary);opacity:0.4;">-</span>'}
            </td>`;
          }).join('')}

          <!-- 요약 통계 영역 (독립된 배경, 가운데 정렬) -->
          <td style="color:#10b981;font-weight:900;padding:13px 16px;font-variant-numeric:tabular-nums;background:rgba(16,185,129,0.07);font-size:14.5px;text-align:center;">
            ${minV !== null ? '$' + minV.toLocaleString() : '-'}
          </td>
          <td style="color:var(--danger);padding:13px 16px;font-variant-numeric:tabular-nums;font-size:14px;font-weight:800;background:rgba(239,68,68,0.04);text-align:center;">
            ${maxV !== null ? '$' + maxV.toLocaleString() : '-'}
          </td>
          <td style="color:var(--warning);font-weight:800;padding:13px 16px;font-variant-numeric:tabular-nums;font-size:14px;background:rgba(245,158,11,0.04);text-align:center;">
            ${spread !== null ? '$' + spread.toLocaleString() : '-'}
          </td>
        </tr>
      `;
    });

    h += '</tbody></table></div>';
    document.getElementById('rc-table-content').innerHTML = h;
  }

  function showContent() {
    renderChips();
    if (activeTab === 'chart') {
      document.getElementById('rc-table-view').style.display = 'none';
      renderChart();
    } else {
      if (chartInstance) {
        try { chartInstance.destroy(); } catch (e) {}
        chartInstance = null;
      }
      renderTable();
    }
  }

  showContent();

  document.getElementById('rc-tab-chart').addEventListener('click', () => {
    activeTab = 'chart';
    document.getElementById('rc-tab-chart').style.background = 'var(--accent)';
    document.getElementById('rc-tab-chart').style.color = '#fff';
    document.getElementById('rc-tab-table').style.background = 'transparent';
    document.getElementById('rc-tab-table').style.color = 'var(--text-secondary)';
    showContent();
  });

  document.getElementById('rc-tab-table').addEventListener('click', () => {
    activeTab = 'table';
    document.getElementById('rc-tab-table').style.background = 'var(--accent)';
    document.getElementById('rc-tab-table').style.color = '#fff';
    document.getElementById('rc-tab-chart').style.background = 'transparent';
    document.getElementById('rc-tab-chart').style.color = 'var(--text-secondary)';
    showContent();
  });

  document.getElementById('rc-ft20').addEventListener('click', () => {
    currentFt = '20ft';
    document.getElementById('rc-ft20').style.background = 'var(--accent)';
    document.getElementById('rc-ft20').style.color = '#fff';
    document.getElementById('rc-ft40').style.background = 'transparent';
    document.getElementById('rc-ft40').style.color = 'var(--text-secondary)';
    showContent();
  });

  document.getElementById('rc-ft40').addEventListener('click', () => {
    currentFt = '40ft';
    document.getElementById('rc-ft40').style.background = 'var(--accent)';
    document.getElementById('rc-ft40').style.color = '#fff';
    document.getElementById('rc-ft20').style.background = 'transparent';
    document.getElementById('rc-ft20').style.color = 'var(--text-secondary)';
    showContent();
  });

  const chipsEl = document.getElementById('rc-chips');
  if (chipsEl) {
    chipsEl.addEventListener('click', e => {
      const chip = e.target.closest('[data-fid]');
      if (!chip) return;
      const fid = chip.dataset.fid;
      if (activeFids.has(fid)) {
        activeFids.delete(fid);
      } else {
        activeFids.add(fid);
      }
      showContent();
    });

    chipsEl.addEventListener('mouseover', e => {
      const chip = e.target.closest('[data-fid]');
      if (!chip) return;
      const fid = chip.dataset.fid;
      if (hoveredFid !== fid) {
        hoveredFid = fid;
        if (activeTab === 'chart') renderChart();
      }
    });

    chipsEl.addEventListener('mouseout', e => {
      const chip = e.target.closest('[data-fid]');
      if (!chip) return;
      hoveredFid = null;
      if (activeTab === 'chart') renderChart();
    });
  }

  document.getElementById('rc-all')?.addEventListener('click', () => {
    finalForwarders.forEach(f => activeFids.add(f.id));
    showContent();
  });

  document.getElementById('rc-none')?.addEventListener('click', () => {
    activeFids.clear();
    showContent();
  });
}
