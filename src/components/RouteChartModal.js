import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);
import { getToken } from '../store.js';

// 포워더별 대표 색상 팔레트 (다크/라이트 공용 고대비)
const COLORS = [
  '#0284c7', // Sky Blue
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#a855f7', // Violet
  '#84cc16', // Lime
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#64748b'  // Slate
];

async function fetchRouteHistory(routeId) {
  const res = await fetch('/api/rates/history/' + routeId, {
    headers: { 'Authorization': 'Bearer ' + getToken() }
  });
  if (!res.ok) throw new Error('history fetch failed');
  return res.json();
}

export async function openRouteChartModal(route, allForwarders) {
  const existing = document.getElementById('rc-overlay');
  if (existing) existing.remove();

  // 배정된 포워더 목록 (없으면 전체 포워더 중 운임 데이터가 있는 포워더 사용)
  let assignedForwarders = allForwarders.filter(
    f => f.assigned_routes && f.assigned_routes.includes(route.id)
  );
  if (assignedForwarders.length === 0) {
    assignedForwarders = allForwarders;
  }

  const overlay = document.createElement('div');
  overlay.id = 'rc-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn 0.2s ease-out;';

  overlay.innerHTML = `
    <div id="rc-modal" style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:18px;width:100%;max-width:1120px;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 35px 90px rgba(0,0,0,0.6);">
      
      <!-- 상단 헤더 -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 24px;border-bottom:1px solid var(--border-color);flex-shrink:0;background:var(--bg-surface);">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:42px;height:42px;border-radius:12px;background:var(--accent-glow);display:flex;align-items:center;justify-content:center;font-size:1.4rem;border:1px solid var(--accent);">
            📊
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:var(--font-lg);font-weight:800;color:var(--text-primary);letter-spacing:-0.02em;">
                ${route.country} — ${route.pod}
              </span>
              <span style="font-size:var(--font-xs);padding:2px 8px;border-radius:6px;background:var(--bg-hover);color:var(--text-secondary);font-weight:600;border:1px solid var(--border-color);">
                No.${route.no}
              </span>
            </div>
            <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:3px;">
              입찰 회차별 포워더 견적 스펙트럼 & 자사 최저 낙찰가 벤치마킹
            </div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:12px;">
          <!-- 뷰 탭 전환 -->
          <div style="display:flex;gap:3px;background:var(--bg-primary);border-radius:10px;padding:3px;border:1px solid var(--border-color);">
            <button id="rc-tab-chart" style="padding:6px 16px;border-radius:7px;border:none;cursor:pointer;font-size:var(--font-xs);font-weight:700;background:var(--accent);color:#fff;transition:all 0.15s;">
              📈 바잉파워 차트
            </button>
            <button id="rc-tab-table" style="padding:6px 16px;border-radius:7px;border:none;cursor:pointer;font-size:var(--font-xs);font-weight:700;background:transparent;color:var(--text-secondary);transition:all 0.15s;">
              📋 원장 데이터 (Table)
            </button>
          </div>
          <button id="rc-close" style="width:34px;height:34px;border-radius:50%;border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-secondary);cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;transition:all 0.15s;" title="닫기 (ESC)">
            ✕
          </button>
        </div>
      </div>

      <!-- 컨트롤 바: 포워더 칩 필터 & 20FT/40FT 토글 -->
      <div style="padding:12px 24px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;flex-shrink:0;background:var(--bg-secondary);">
        <div style="display:flex;flex-direction:column;gap:6px;flex:1;min-width:280px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:11px;font-weight:700;color:var(--text-secondary);display:flex;align-items:center;gap:4px;">
              🏢 포워더 선택 & 하이라이트 <span style="font-weight:400;color:var(--text-muted);">(이름에 마우스를 올리면 해당 선만 강조됩니다)</span>
            </span>
            <div style="display:flex;gap:8px;">
              <button id="rc-all" style="font-size:11px;color:var(--accent);background:none;border:none;cursor:pointer;font-weight:600;padding:0;">전체 선택</button>
              <span style="color:var(--border-color);">|</span>
              <button id="rc-none" style="font-size:11px;color:var(--text-muted);background:none;border:none;cursor:pointer;font-weight:600;padding:0;">전체 해제</button>
            </div>
          </div>
          <div id="rc-chips" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
        </div>

        <!-- 20FT / 40FT 스위처 -->
        <div style="display:flex;align-items:center;gap:8px;border-left:1px solid var(--border-color);padding-left:16px;">
          <span style="font-size:11px;font-weight:700;color:var(--text-muted);">컨테이너 규격:</span>
          <div style="display:flex;gap:3px;background:var(--bg-primary);border-radius:10px;padding:3px;border:1px solid var(--border-color);">
            <button id="rc-ft20" style="padding:5px 14px;border-radius:7px;border:none;cursor:pointer;font-size:var(--font-xs);font-weight:700;background:var(--accent);color:#fff;transition:all 0.15s;">
              20FT
            </button>
            <button id="rc-ft40" style="padding:5px 14px;border-radius:7px;border:none;cursor:pointer;font-size:var(--font-xs);font-weight:700;background:transparent;color:var(--text-secondary);transition:all 0.15s;">
              40FT
            </button>
          </div>
        </div>
      </div>

      <!-- 메인 콘텐츠 영역 -->
      <div style="flex:1;overflow-y:auto;padding:20px 24px;min-height:0;display:flex;flex-direction:column;gap:18px;">
        
        <!-- 로딩 표시 -->
        <div id="rc-loading" style="display:flex;align-items:center;justify-content:center;height:380px;color:var(--text-muted);font-size:var(--font-md);gap:10px;">
          <span style="animation:spin 1s infinite linear;">⏳</span> 운임 이력 데이터 분석 중...
        </div>

        <!-- 1. 차트 뷰 -->
        <div id="rc-chart-view" style="display:none;position:relative;">
          
          <!-- 차트 상단 레이어 안내 배너 -->
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:16px;background:var(--bg-surface);border:1px solid var(--border-color);padding:8px 16px;border-radius:10px;font-size:11px;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="width:14px;height:4px;background:#10b981;border-radius:2px;display:inline-block;box-shadow:0 0 8px rgba(16,185,129,0.6);"></span>
              <strong style="color:#10b981;">★ 자사 최저 낙찰가 (Bold Emerald)</strong>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="width:14px;height:8px;background:rgba(148,163,184,0.25);border-radius:2px;display:inline-block;border:1px dashed rgba(148,163,184,0.5);"></span>
              <span style="color:var(--text-secondary);">포워더 견적 스펙트럼 (Min-Max 밴드)</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;color:var(--text-muted);margin-left:auto;">
              <span>💡 팁: 선 위에 마우스를 올리면 상세 견적 격차(Spread)를 확인하실 수 있습니다.</span>
            </div>
          </div>

          <!-- 캔버스 영역 -->
          <div style="position:relative;height:380px;width:100%;">
            <canvas id="rc-canvas"></canvas>
          </div>
        </div>

        <!-- 2. 핵심 KPI 요약 카드 4종 -->
        <div id="rc-stats" style="display:none;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;"></div>

        <!-- 3. 원장 데이터 테이블 뷰 -->
        <div id="rc-table-view" style="display:none;">
          <div id="rc-table-content"></div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  let currentFt = '20ft';
  let activeTab = 'chart';
  let chartInstance = null;
  let historyData = [];
  let hoveredFid = null;

  // 닫기 이벤트
  const handleClose = () => {
    if (chartInstance) chartInstance.destroy();
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

  // 데이터 조회
  try {
    historyData = await fetchRouteHistory(route.id);
  } catch (e) {
    document.getElementById('rc-loading').innerHTML = '❌ 운임 데이터를 불러올 수 없습니다.';
    return;
  }

  // 데이터가 실제로 존재하는 포워더 목록 필터링
  const activeForwarderIdsInData = new Set(historyData.map(r => r.forwarder_id));
  const validForwarders = assignedForwarders.filter(f => activeForwarderIdsInData.has(f.id));
  const finalForwarders = validForwarders.length > 0 ? validForwarders : assignedForwarders;

  let activeFids = new Set(finalForwarders.map(f => f.id));

  // 포워더 칩 생성 헬퍼
  function renderChips() {
    const chipsContainer = document.getElementById('rc-chips');
    if (!chipsContainer) return;

    if (finalForwarders.length === 0) {
      chipsContainer.innerHTML = '<span style="color:var(--text-muted);font-size:var(--font-xs);">등록된 포워더가 없습니다.</span>';
      return;
    }

    chipsContainer.innerHTML = finalForwarders.map((f, i) => {
      const c = COLORS[i % COLORS.length];
      const isVisible = activeFids.has(f.id);
      const isHovered = hoveredFid === f.id;

      return `
        <button class="rc-chip" data-fid="${f.id}" data-idx="${i}" style="
          padding: 4px 12px;
          border-radius: 20px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1.5px solid ${isVisible ? c : 'var(--border-color)'};
          background: ${isVisible ? (isHovered ? c + '45' : c + '20') : 'transparent'};
          color: ${isVisible ? 'var(--text-primary)' : 'var(--text-muted)'};
          opacity: ${isVisible ? '1' : '0.45'};
          transform: ${isHovered ? 'scale(1.05)' : 'scale(1)'};
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          <span style="width:7px;height:7px;border-radius:50%;background:${isVisible ? c : '#64748b'};flex-shrink:0;"></span>
          ${f.name}
        </button>
      `;
    }).join('');
  }

  renderChips();

  // 입찰 회차별 그룹화 빌더
  function buildPeriods() {
    const map = {};
    historyData.forEach(r => {
      if (!map[r.bidding_id]) {
        map[r.bidding_id] = {
          biddingId: r.bidding_id,
          label: String(r.year).slice(2) + '.' + String(r.month).padStart(2, '0'),
          year: r.year,
          month: r.month,
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

  // 1. 차트 렌더링 함수
  function renderChart() {
    const periods = buildPeriods();
    const loadEl = document.getElementById('rc-loading');
    const chartView = document.getElementById('rc-chart-view');
    const statsEl = document.getElementById('rc-stats');

    if (periods.length === 0) {
      loadEl.style.display = 'flex';
      chartView.style.display = 'none';
      statsEl.style.display = 'none';
      loadEl.innerHTML = '📭 입찰 운임 데이터가 없습니다.<br><small style="margin-top:8px;display:block;">포워더가 운임을 제출하면 차트가 활성화됩니다.</small>';
      return;
    }

    loadEl.style.display = 'none';
    chartView.style.display = 'block';

    const rateKey = currentFt === '20ft' ? 'rate_20ft' : 'rate_40ft';
    const labels = periods.map(p => p.label);
    const minMaxArr = calcMinMax(periods, rateKey);

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const gridC = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
    const lblC = isDark ? '#94a3b8' : '#4a5e72';

    // 포워더별 데이터셋 구성 (Highlight & Dim 적용)
    const fwDatasets = finalForwarders.map((f, i) => {
      const color = COLORS[i % COLORS.length];
      const isHovered = hoveredFid === f.id;
      const hasHoverTarget = hoveredFid !== null;

      let borderWidth = 2;
      let pointRadius = 3.5;
      let alpha = '0.35';

      if (hasHoverTarget) {
        if (isHovered) {
          borderWidth = 3.5;
          pointRadius = 6;
          alpha = '1.0';
        } else {
          borderWidth = 1.5;
          pointRadius = 1;
          alpha = '0.12';
        }
      }

      return {
        label: f.name,
        fid: f.id,
        data: periods.map(p => getVal(p.rates[f.id], rateKey)),
        borderColor: color,
        backgroundColor: color + '15',
        borderWidth: borderWidth,
        pointRadius: isHovered ? 6 : pointRadius,
        pointHoverRadius: 7,
        pointBackgroundColor: color,
        pointBorderColor: '#fff',
        pointBorderWidth: 1.5,
        tension: 0.35,
        hidden: !activeFids.has(f.id),
        spanGaps: false,
        order: isHovered ? 2 : 10,
      };
    });

    // Min-Max 밴드 레이어
    const bandTop = {
      label: '_band_top',
      data: minMaxArr.map(d => d.max),
      borderColor: 'transparent',
      backgroundColor: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.08)',
      borderWidth: 0,
      pointRadius: 0,
      fill: '+1',
      tension: 0.35,
      order: 20
    };

    const bandBot = {
      label: '_band_bot',
      data: minMaxArr.map(d => d.min),
      borderColor: isDark ? 'rgba(148,163,184,0.25)' : 'rgba(100,116,139,0.2)',
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderDash: [4, 4],
      pointRadius: 0,
      fill: false,
      tension: 0.35,
      order: 21
    };

    // 최저 낙찰가 굵은 초록선
    const minLine = {
      label: '★ 자사 최저 낙찰가',
      data: minMaxArr.map(d => d.min),
      borderColor: '#10b981',
      backgroundColor: '#10b98120',
      borderWidth: 4,
      pointRadius: 5,
      pointHoverRadius: 9,
      pointBackgroundColor: '#10b981',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      tension: 0.35,
      fill: false,
      order: 1
    };

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    const ctx = document.getElementById('rc-canvas').getContext('2d');
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [bandTop, bandBot, minLine, ...fwDatasets]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
            borderColor: isDark ? '#334155' : '#cbd5e1',
            borderWidth: 1,
            titleColor: isDark ? '#f8fafc' : '#0f172a',
            bodyColor: isDark ? '#94a3b8' : '#334155',
            padding: 14,
            boxPadding: 4,
            cornerRadius: 10,
            callbacks: {
              title: items => `📅 ${items[0].label}월 운임 동향 (${currentFt.toUpperCase()} 기준)`,
              label: item => {
                if (item.dataset.label.startsWith('_')) return null;
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
            ticks: { color: lblC, font: { size: 11, weight: '600' } }
          },
          y: {
            grid: { color: gridC },
            ticks: {
              color: lblC,
              font: { size: 11 },
              callback: v => '$' + Number(v).toLocaleString()
            }
          }
        }
      }
    });

    // 4개 KPI 요약 카드 계산 및 렌더링
    renderKpiStats(periods, minMaxArr, rateKey);
  }

  // 2. KPI 요약 카드 렌더링
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

    // 최근 최저가 포워더 찾기
    const minFw = finalForwarders.find(f =>
      activeFids.has(f.id) &&
      lastPeriod.rates[f.id] &&
      Number(lastPeriod.rates[f.id][rateKey]) === lastMM.min
    );

    // 최다 최저가 수주 포워더 통계 계산
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

    // 전체 기간 평균 스프레드
    const validSpreads = minMaxArr.filter(m => m.min !== null && m.max !== null).map(m => m.max - m.min);
    const avgSpread = validSpreads.length ? Math.round(validSpreads.reduce((a, b) => a + b, 0) / validSpreads.length) : 0;

    statsEl.style.display = 'grid';
    statsEl.innerHTML = `
      <!-- KPI 1: 최근 최저가 -->
      <div style="background:var(--bg-surface);border:1px solid var(--border-color);border-top:3px solid #10b981;border-radius:12px;padding:14px 16px;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600;">
          최근 최저 낙찰가 (${lastPeriod.label}월)
        </div>
        <div style="font-size:1.6rem;font-weight:900;color:#10b981;letter-spacing:-0.03em;font-family:monospace;">
          $${lastMM.min.toLocaleString()}
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:3px;">
          수주: <strong style="color:var(--text-primary);">${minFw ? minFw.name : '-'}</strong>
        </div>
      </div>

      <!-- KPI 2: 최근 최고가 -->
      <div style="background:var(--bg-surface);border:1px solid var(--border-color);border-top:3px solid var(--danger);border-radius:12px;padding:14px 16px;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600;">
          최근 최고 제출가 (${lastPeriod.label}월)
        </div>
        <div style="font-size:1.6rem;font-weight:900;color:var(--danger);letter-spacing:-0.03em;font-family:monospace;">
          $${lastMM.max.toLocaleString()}
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">
          최저가 대비: +$${(lastMM.max - lastMM.min).toLocaleString()}
        </div>
      </div>

      <!-- KPI 3: 견적 격차 (Spread) -->
      <div style="background:var(--bg-surface);border:1px solid var(--border-color);border-top:3px solid var(--warning);border-radius:12px;padding:14px 16px;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600;">
          최근 견적 격차 (Spread)
        </div>
        <div style="font-size:1.6rem;font-weight:900;color:var(--warning);letter-spacing:-0.03em;font-family:monospace;">
          $${(lastMM.max - lastMM.min).toLocaleString()}
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">
          평균 스프레드: $${avgSpread.toLocaleString()}
        </div>
      </div>

      <!-- KPI 4: 최다 최저가 포워더 -->
      <div style="background:var(--bg-surface);border:1px solid var(--border-color);border-top:3px solid var(--accent);border-radius:12px;padding:14px 16px;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600;">
          최다 최저가 제시 포워더
        </div>
        <div style="font-size:1.35rem;font-weight:900;color:var(--accent);letter-spacing:-0.02em;margin-top:2px;">
          ${topWinnerObj ? topWinnerObj.name : '-'}
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">
          총 ${periods.length}회차 중 <strong style="color:var(--accent);">${topWinnerEntry ? topWinnerEntry[1] : 0}회</strong> 최저 견적 수주
        </div>
      </div>
    `;
  }

  // 3. 원장 데이터 테이블 렌더링 함수
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
      document.getElementById('rc-table-content').innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:48px;">입찰 운임 데이터가 없습니다.</p>';
      return;
    }

    let h = `
      <div style="overflow-x:auto;border:1px solid var(--border-color);border-radius:12px;">
        <table class="data-table" style="width:100%;border-collapse:collapse;font-size:var(--font-sm);">
          <thead>
            <tr style="background:var(--bg-surface);">
              <th style="white-space:nowrap;padding:12px 14px;border-bottom:2px solid var(--border-color);">입찰 회차</th>
              ${vFws.map((f, i) => `<th style="color:${COLORS[i % COLORS.length]};white-space:nowrap;padding:12px 14px;border-bottom:2px solid var(--border-color);">${f.name}</th>`).join('')}
              <th style="color:#10b981;white-space:nowrap;padding:12px 14px;border-bottom:2px solid var(--border-color);">최저가</th>
              <th style="color:var(--danger);white-space:nowrap;padding:12px 14px;border-bottom:2px solid var(--border-color);">최고가</th>
              <th style="color:var(--warning);white-space:nowrap;padding:12px 14px;border-bottom:2px solid var(--border-color);">Spread (격차)</th>
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
          <td style="font-weight:700;white-space:nowrap;padding:10px 14px;background:var(--bg-surface);">${p.label}</td>
          ${vals.map(v => {
            const isMin = v !== null && v === minV && valid.length > 1;
            const isMax = v !== null && v === maxV && valid.length > 1;
            const style = isMin
              ? 'color:#10b981;font-weight:800;background:rgba(16,185,129,0.12);'
              : (isMax ? 'color:var(--danger);' : '');
            return `<td style="padding:10px 14px;font-family:monospace;${style}">
              ${v !== null ? '$' + v.toLocaleString() : '<span style="color:var(--text-muted)">-</span>'}
            </td>`;
          }).join('')}
          <td style="color:#10b981;font-weight:800;padding:10px 14px;font-family:monospace;background:rgba(16,185,129,0.08);">
            ${minV !== null ? '$' + minV.toLocaleString() : '-'}
          </td>
          <td style="color:var(--danger);padding:10px 14px;font-family:monospace;">
            ${maxV !== null ? '$' + maxV.toLocaleString() : '-'}
          </td>
          <td style="color:var(--warning);font-weight:700;padding:10px 14px;font-family:monospace;">
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
        chartInstance.destroy();
        chartInstance = null;
      }
      renderTable();
    }
  }

  showContent();

  // 뷰 탭 전환 이벤트
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

  // 20FT / 40FT 전환 이벤트
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

  // 포워더 칩 클릭 (On/Off 토글) 및 호버 (Highlight & Dim) 이벤트 위임
  const chipsEl = document.getElementById('rc-chips');
  if (chipsEl) {
    // 1. 클릭 토글
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

    // 2. 마우스 엔터 (Highlight)
    chipsEl.addEventListener('mouseover', e => {
      const chip = e.target.closest('[data-fid]');
      if (!chip) return;
      const fid = chip.dataset.fid;
      if (hoveredFid !== fid) {
        hoveredFid = fid;
        if (activeTab === 'chart') renderChart();
      }
    });

    // 3. 마우스 리브 (Dim 해제)
    chipsEl.addEventListener('mouseout', e => {
      const chip = e.target.closest('[data-fid]');
      if (!chip) return;
      hoveredFid = null;
      if (activeTab === 'chart') renderChart();
    });
  }

  // 전체 선택 / 해제 버튼
  document.getElementById('rc-all')?.addEventListener('click', () => {
    finalForwarders.forEach(f => activeFids.add(f.id));
    showContent();
  });

  document.getElementById('rc-none')?.addEventListener('click', () => {
    activeFids.clear();
    showContent();
  });
}
