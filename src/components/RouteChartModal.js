import Chart from 'chart.js/auto';
import { getToken } from '../store.js';

// 포워더별 대표 색상 팔레트 (선명한 고대비 색상)
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
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.8);z-index:2000;display:flex;align-items:center;justify-content:center;padding:12px;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;';

  overlay.innerHTML = `
    <div id="rc-modal" style="font-family:-apple-system,BlinkMacSystemFont,'Pretendard','Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:20px;width:96vw;max-width:1460px;height:94vh;max-height:94vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 35px 90px rgba(0,0,0,0.65);">
      
      <!-- 상단 헤더 -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:20px 32px;border-bottom:1px solid var(--border-color);flex-shrink:0;background:var(--bg-surface);">
        <div style="display:flex;align-items:center;gap:16px;">
          <div style="width:50px;height:50px;border-radius:14px;background:var(--accent-glow);display:flex;align-items:center;justify-content:center;font-size:1.7rem;border:1.5px solid var(--accent);">
            📊
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:1.65rem;font-weight:900;color:var(--text-primary);letter-spacing:-0.03em;">
                ${route.country} — ${route.pod}
              </span>
              <span style="font-size:13px;padding:4px 12px;border-radius:8px;background:var(--bg-hover);color:var(--text-primary);font-weight:800;border:1px solid var(--border-color);">
                No.${route.no}
              </span>
            </div>
            <div style="font-size:13.5px;color:var(--text-secondary);margin-top:4px;font-weight:600;">
              입찰 회차별 포워더 견적 스펙트럼 & 자사 최저 낙찰가 벤치마킹 대시보드
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

      <!-- 컨트롤 바: 포워더 칩 필터 & 20FT/40FT 토글 -->
      <div style="padding:14px 32px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;flex-shrink:0;background:var(--bg-secondary);">
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

      <!-- 메인 콘텐츠 영역 -->
      <div style="flex:1;overflow-y:auto;padding:24px 32px;min-height:0;display:flex;flex-direction:column;gap:22px;">
        
        <!-- 로딩 표시 -->
        <div id="rc-loading" style="display:flex;align-items:center;justify-content:center;height:450px;color:var(--text-secondary);font-size:var(--font-lg);gap:10px;font-weight:700;">
          ⏳ 운임 이력 데이터 분석 중...
        </div>

        <!-- 1. 차트 뷰 -->
        <div id="rc-chart-view" style="display:none;position:relative;">
          
          <!-- 차트 상단 레이어 안내 배너 -->
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:20px;background:var(--bg-surface);border:1px solid var(--border-color);padding:12px 22px;border-radius:14px;font-size:13.5px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="width:22px;height:6px;background:#10b981;border-radius:3px;display:inline-block;box-shadow:0 0 10px rgba(16,185,129,0.7);"></span>
              <strong style="color:#10b981;font-size:14.5px;">★ 자사 최저 낙찰가 (Bold Emerald)</strong>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="width:20px;height:12px;background:rgba(148,163,184,0.3);border-radius:3px;display:inline-block;border:1px dashed rgba(100,116,139,0.6);"></span>
              <span style="color:var(--text-primary);font-weight:700;font-size:13.5px;">포워더 견적 스펙트럼 (Min-Max 밴드)</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;color:var(--text-secondary);margin-left:auto;font-size:13px;font-weight:500;">
              <span>💡 포워더 이름에 마우스를 올리면 해당 선만 강조되며, 선에 마우스를 올리면 상세 견적 격차(Spread)가 표시됩니다.</span>
            </div>
          </div>

          <!-- 캔버스 영역 (고선명 렌더링) -->
          <div style="position:relative;height:480px;width:100%;">
            <canvas id="rc-canvas"></canvas>
          </div>
        </div>

        <!-- 2. 핵심 KPI 요약 카드 4종 -->
        <div id="rc-stats" style="display:none;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px;"></div>

        <!-- 3. 원장 데이터 테이블 뷰 -->
        <div id="rc-table-view" style="display:none;">
          <div id="rc-table-content"></div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  let currentFt = '40ft';
  let activeTab = 'chart';
  let chartInstance = null;
  let historyData = [];
  let hoveredFid = null;

  const handleClose = () => {
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
    return periods.map(p => {
      const vals = finalForwarders
        .filter(f => activeFids.has(f.id))
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
    const statsEl = document.getElementById('rc-stats');
    const periods = buildPeriods();

    if (periods.length === 0) {
      if (loadEl) {
        loadEl.style.display = 'flex';
        loadEl.innerHTML = '📭 해당 노선의 입찰 운임 데이터가 없습니다.<br><small style="margin-top:8px;display:block;">포워더가 운임을 입력하면 차트가 활성화됩니다.</small>';
      }
      if (chartView) chartView.style.display = 'none';
      if (statsEl) statsEl.style.display = 'none';
      return;
    }

    if (loadEl) loadEl.style.display = 'none';
    if (chartView) chartView.style.display = 'block';

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

    // 최저 낙찰가 초록 라인
    const minLine = {
      label: '★ 자사 최저 낙찰가',
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
      if (!canvasEl) return;
      const ctx = canvasEl.getContext('2d');

      // 고해상도 Retina 배율 (모니터 확대율 125%/150% 완벽 대응)
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
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderColor: isDark ? '#334155' : '#cbd5e1',
              borderWidth: 1.5,
              titleColor: isDark ? '#f8fafc' : '#0f172a',
              titleFont: { size: 14.5, weight: '800', family: "inherit" },
              bodyColor: isDark ? '#e2e8f0' : '#1e293b',
              bodyFont: { size: 13.5, weight: '700', family: "inherit" },
              padding: 16,
              cornerRadius: 12,
              callbacks: {
                title: items => `📅 ${items[0].label}월 운임 동향 (${currentFt.toUpperCase()} 기준)`,
                label: item => {
                  if (item.dataset.label && item.dataset.label.startsWith('_')) return null;
                  const v = item.raw;
                  if (v == null) return `   ${item.dataset.label}: 미제출`;
                  const isMin = item.dataset.label === '★ 자사 최저 낙찰가';
                  const icon = isMin ? '🟢' : '  ';
                  return `${icon} ${item.dataset.label}: $${Number(v).toLocaleString()}`;
                },
                afterBody: items => {
                  const idx = items[0].dataIndex;
                  const mm = minMaxArr[idx];
                  if (!mm || mm.min == null || mm.max == null || mm.min === mm.max) return [];
                  const spread = mm.max - mm.min;
                  return [
                    '',
                    `📊 포워더 견적 격차 (Spread): $${spread.toLocaleString()}`,
                    `   (최저 $${mm.min.toLocaleString()} ~ 최고 $${mm.max.toLocaleString()})`
                  ];
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: gridC },
              ticks: { color: lblC, font: { size: 13, weight: '800', family: "inherit" } }
            },
            y: {
              grid: { color: gridC },
              ticks: {
                color: lblC,
                font: { size: 13, weight: '800', family: "inherit" },
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
      activeFids.has(f.id) &&
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
      <div style="background:var(--bg-surface);border:1px solid var(--border-color);border-top:4px solid #10b981;border-radius:16px;padding:18px 24px;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
        <div style="font-size:14px;color:var(--text-secondary);margin-bottom:6px;font-weight:800;">
          최근 최저 낙찰가 (${lastPeriod.label}월)
        </div>
        <div style="font-size:2.1rem;font-weight:900;color:#10b981;letter-spacing:-0.03em;font-family:monospace;">
          $${lastMM.min.toLocaleString()}
        </div>
        <div style="font-size:13.5px;color:var(--text-primary);margin-top:5px;font-weight:700;">
          수주: <strong style="color:var(--text-primary);font-size:14.5px;">${minFw ? minFw.name : '-'}</strong>
        </div>
      </div>

      <div style="background:var(--bg-surface);border:1px solid var(--border-color);border-top:4px solid var(--danger);border-radius:16px;padding:18px 24px;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
        <div style="font-size:14px;color:var(--text-secondary);margin-bottom:6px;font-weight:800;">
          최근 최고 제출가 (${lastPeriod.label}월)
        </div>
        <div style="font-size:2.1rem;font-weight:900;color:var(--danger);letter-spacing:-0.03em;font-family:monospace;">
          $${lastMM.max.toLocaleString()}
        </div>
        <div style="font-size:13.5px;color:var(--text-secondary);margin-top:5px;font-weight:700;">
          최저가 대비: <strong style="color:var(--danger);">+$${(lastMM.max - lastMM.min).toLocaleString()}</strong>
        </div>
      </div>

      <div style="background:var(--bg-surface);border:1px solid var(--border-color);border-top:4px solid var(--warning);border-radius:16px;padding:18px 24px;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
        <div style="font-size:14px;color:var(--text-secondary);margin-bottom:6px;font-weight:800;">
          최근 견적 격차 (Spread)
        </div>
        <div style="font-size:2.1rem;font-weight:900;color:var(--warning);letter-spacing:-0.03em;font-family:monospace;">
          $${(lastMM.max - lastMM.min).toLocaleString()}
        </div>
        <div style="font-size:13.5px;color:var(--text-secondary);margin-top:5px;font-weight:700;">
          전체 평균 스프레드: <strong style="color:var(--text-primary);">$${avgSpread.toLocaleString()}</strong>
        </div>
      </div>

      <div style="background:var(--bg-surface);border:1px solid var(--border-color);border-top:4px solid var(--accent);border-radius:16px;padding:18px 24px;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
        <div style="font-size:14px;color:var(--text-secondary);margin-bottom:6px;font-weight:800;">
          최다 최저가 제시 포워더
        </div>
        <div style="font-size:1.75rem;font-weight:900;color:var(--accent);letter-spacing:-0.02em;margin-top:2px;">
          ${topWinnerObj ? topWinnerObj.name : '-'}
        </div>
        <div style="font-size:13.5px;color:var(--text-primary);margin-top:5px;font-weight:700;">
          총 ${periods.length}회차 중 <strong style="color:var(--accent);font-size:14.5px;">${topWinnerEntry ? topWinnerEntry[1] : 0}회</strong> 최저 견적 수주
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
    document.getElementById('rc-stats').style.display = 'none';

    const tv = document.getElementById('rc-table-view');
    tv.style.display = 'block';

    if (periods.length === 0) {
      document.getElementById('rc-table-content').innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:48px;font-size:16px;font-weight:700;">입찰 운임 데이터가 없습니다.</p>';
      return;
    }

    let h = `
      <div style="overflow-x:auto;border:1px solid var(--border-color);border-radius:14px;">
        <table class="data-table" style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:var(--bg-surface);">
              <th style="white-space:nowrap;padding:14px 18px;border-bottom:2px solid var(--border-color);font-size:14px;font-weight:800;color:var(--text-primary);">입찰 회차</th>
              ${vFws.map((f, i) => `<th style="color:${COLORS[i % COLORS.length]};white-space:nowrap;padding:14px 18px;border-bottom:2px solid var(--border-color);font-size:14px;font-weight:800;">${f.name}</th>`).join('')}
              <th style="color:#10b981;white-space:nowrap;padding:14px 18px;border-bottom:2px solid var(--border-color);font-size:14px;font-weight:800;">최저가</th>
              <th style="color:var(--danger);white-space:nowrap;padding:14px 18px;border-bottom:2px solid var(--border-color);font-size:14px;font-weight:800;">최고가</th>
              <th style="color:var(--warning);white-space:nowrap;padding:14px 18px;border-bottom:2px solid var(--border-color);font-size:14px;font-weight:800;">Spread (격차)</th>
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
        <tr style="border-bottom:1px solid var(--border-color);">
          <td style="font-weight:800;white-space:nowrap;padding:14px 18px;background:var(--bg-surface);font-size:14px;color:var(--text-primary);">${p.label}</td>
          ${vals.map(v => {
            const isMin = v !== null && v === minV && valid.length > 1;
            const isMax = v !== null && v === maxV && valid.length > 1;
            const style = isMin
              ? 'color:#10b981;font-weight:900;background:rgba(16,185,129,0.15);font-size:14.5px;'
              : (isMax ? 'color:var(--danger);font-size:14px;font-weight:700;' : 'font-size:14px;color:var(--text-primary);');
            return `<td style="padding:14px 18px;font-family:monospace;${style}">
              ${v !== null ? '$' + v.toLocaleString() : '<span style="color:var(--text-secondary);">-</span>'}
            </td>`;
          }).join('')}
          <td style="color:#10b981;font-weight:900;padding:14px 18px;font-family:monospace;background:rgba(16,185,129,0.1);font-size:14.5px;">
            ${minV !== null ? '$' + minV.toLocaleString() : '-'}
          </td>
          <td style="color:var(--danger);padding:14px 18px;font-family:monospace;font-size:14px;font-weight:800;">
            ${maxV !== null ? '$' + maxV.toLocaleString() : '-'}
          </td>
          <td style="color:var(--warning);font-weight:800;padding:14px 18px;font-family:monospace;font-size:14px;">
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
