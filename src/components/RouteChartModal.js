import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);
import { getToken } from '../store.js';

const COLORS = ['#06b6d4','#f59e0b','#ec4899','#8b5cf6','#10b981','#ef4444','#3b82f6','#f97316','#14b8a6','#a855f7','#84cc16','#64748b'];

async function fetchRouteHistory(routeId) {
  const res = await fetch('/api/rates/history/' + routeId, {
    headers: { 'Authorization': 'Bearer ' + getToken() }
  });
  if (!res.ok) throw new Error('history fetch failed');
  return res.json();
}

function makeChipHtml(f, i) {
  const c = COLORS[i % COLORS.length];
  return '<button class="rc-chip" data-fid="' + f.id + '" data-idx="' + i + '" style="' +
    'padding:4px 12px;border-radius:20px;cursor:pointer;font-size:var(--font-xs);font-weight:600;' +
    'transition:all 0.2s;border:2px solid ' + c + ';background:' + c + '30;color:var(--text-primary);' +
    'display:flex;align-items:center;gap:5px;">' +
    '<span style="width:8px;height:8px;border-radius:50%;background:' + c + ';flex-shrink:0;"></span>' +
    f.name + '</button>';
}

export async function openRouteChartModal(route, allForwarders) {
  const existing = document.getElementById('rc-overlay');
  if (existing) existing.remove();

  const assignedForwarders = allForwarders.filter(
    f => f.assigned_routes && f.assigned_routes.includes(route.id)
  );

  const overlay = document.createElement('div');
  overlay.id = 'rc-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);backdrop-filter:blur(5px);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;';

  const chipsHtml = assignedForwarders.length === 0
    ? '<span style="color:var(--text-muted);font-size:var(--font-sm);">배정된 포워더가 없습니다</span>'
    : assignedForwarders.map((f,i) => makeChipHtml(f,i)).join('') +
      '<button id="rc-all" style="padding:4px 10px;border-radius:20px;border:1px solid var(--border-color);background:transparent;color:var(--text-secondary);cursor:pointer;font-size:var(--font-xs);">전체 선택</button>' +
      '<button id="rc-none" style="padding:4px 10px;border-radius:20px;border:1px solid var(--border-color);background:transparent;color:var(--text-secondary);cursor:pointer;font-size:var(--font-xs);">전체 해제</button>';

  overlay.innerHTML = '<div id="rc-modal" style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:16px;width:100%;max-width:1080px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.55);">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:18px 24px;border-bottom:1px solid var(--border-color);flex-shrink:0;">' +
      '<div style="display:flex;align-items:center;gap:12px;">' +
        '<span style="font-size:1.4rem;">📊</span>' +
        '<div>' +
          '<div style="font-size:var(--font-lg);font-weight:700;color:var(--text-primary);">' + route.country + ' — ' + route.pod + '</div>' +
          '<div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:2px;">No.' + route.no + ' · 입찰 회차별 포워더 운임 추이</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<div style="display:flex;gap:3px;background:var(--bg-surface);border-radius:8px;padding:3px;border:1px solid var(--border-color);">' +
          '<button id="rc-tab-chart" style="padding:6px 14px;border-radius:6px;border:none;cursor:pointer;font-size:var(--font-sm);font-weight:600;background:var(--accent);color:#fff;">📈 차트</button>' +
          '<button id="rc-tab-table" style="padding:6px 14px;border-radius:6px;border:none;cursor:pointer;font-size:var(--font-sm);font-weight:600;background:transparent;color:var(--text-secondary);">📋 테이블</button>' +
        '</div>' +
        '<button id="rc-close" style="width:32px;height:32px;border-radius:50%;border:1px solid var(--border-color);background:var(--bg-surface);color:var(--text-secondary);cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">✕</button>' +
      '</div>' +
    '</div>' +
    '<div style="padding:12px 24px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;flex-shrink:0;background:var(--bg-surface);">' +
      '<div id="rc-chips" style="display:flex;flex-wrap:wrap;gap:6px;flex:1;">' + chipsHtml + '</div>' +
      '<div style="display:flex;gap:3px;background:var(--bg-secondary);border-radius:8px;padding:3px;border:1px solid var(--border-color);flex-shrink:0;">' +
        '<button id="rc-ft20" style="padding:5px 14px;border-radius:6px;border:none;cursor:pointer;font-size:var(--font-sm);font-weight:700;background:var(--accent);color:#fff;">20FT</button>' +
        '<button id="rc-ft40" style="padding:5px 14px;border-radius:6px;border:none;cursor:pointer;font-size:var(--font-sm);font-weight:700;background:transparent;color:var(--text-secondary);">40FT</button>' +
      '</div>' +
    '</div>' +
    '<div style="flex:1;overflow-y:auto;padding:24px;min-height:0;display:flex;flex-direction:column;gap:16px;">' +
      '<div id="rc-loading" style="display:flex;align-items:center;justify-content:center;height:340px;color:var(--text-muted);font-size:var(--font-md);gap:8px;text-align:center;">⏳ 데이터 로딩 중...</div>' +
      '<div id="rc-chart-view" style="display:none;position:relative;height:380px;"><canvas id="rc-canvas"></canvas></div>' +
      '<div id="rc-stats" style="display:none;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;"></div>' +
      '<div id="rc-table-view" style="display:none;"><div id="rc-table-content"></div></div>' +
    '</div>' +
  '</div>';

  document.body.appendChild(overlay);

  let currentFt = '20ft', activeTab = 'chart', chartInstance = null, historyData = [];
  let activeFids = new Set(assignedForwarders.map(f => f.id));

  document.getElementById('rc-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  try { historyData = await fetchRouteHistory(route.id); }
  catch (e) { document.getElementById('rc-loading').innerHTML = '❌ 데이터를 불러올 수 없습니다.'; return; }

  function buildPeriods() {
    const map = {};
    historyData.forEach(r => {
      if (!map[r.bidding_id]) map[r.bidding_id] = {
        biddingId: r.bidding_id,
        label: String(r.year).slice(2) + '.' + String(r.month).padStart(2,'0'),
        year: r.year, month: r.month, rates: {}
      };
      map[r.bidding_id].rates[r.forwarder_id] = r;
    });
    return Object.values(map).sort((a,b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  }

  function getVal(r, rateKey) {
    if (!r || r[rateKey] == null || r[rateKey] === '') return null;
    return Number(r[rateKey]);
  }

  function calcMinMax(periods, rateKey) {
    return periods.map(p => {
      const vals = assignedForwarders.filter(f => activeFids.has(f.id))
        .map(f => getVal(p.rates[f.id], rateKey)).filter(v => v !== null);
      return { min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null };
    });
  }

  function renderChart() {
    const periods = buildPeriods();
    const loadEl = document.getElementById('rc-loading');
    const chartView = document.getElementById('rc-chart-view');
    const statsEl = document.getElementById('rc-stats');
    if (periods.length === 0) {
      loadEl.style.display = 'flex'; chartView.style.display = 'none'; statsEl.style.display = 'none';
      loadEl.innerHTML = '📭 입찰 운임 데이터가 없습니다.<br><small style="margin-top:8px;display:block;">포워더가 운임을 입력하면 차트가 표시됩니다.</small>';
      return;
    }
    loadEl.style.display = 'none'; chartView.style.display = 'block';
    const rateKey = currentFt === '20ft' ? 'rate_20ft' : 'rate_40ft';
    const labels = periods.map(p => p.label);
    const minMaxArr = calcMinMax(periods, rateKey);

    const fwDatasets = assignedForwarders.map((f,i) => {
      const color = COLORS[i % COLORS.length];
      return {
        label: f.name,
        data: periods.map(p => getVal(p.rates[f.id], rateKey)),
        borderColor: color, backgroundColor: color + '18',
        borderWidth: 2, pointRadius: 4, pointHoverRadius: 7,
        pointBackgroundColor: color, pointBorderColor: '#fff', pointBorderWidth: 1.5,
        tension: 0.35, hidden: !activeFids.has(f.id), spanGaps: false,
      };
    });

    const bandTop = { label:'_band_top', data: minMaxArr.map(d=>d.max), borderColor:'transparent', backgroundColor:'rgba(148,163,184,0.13)', borderWidth:0, pointRadius:0, fill:'+1', tension:0.35 };
    const bandBot = { label:'_band_bot', data: minMaxArr.map(d=>d.min), borderColor:'rgba(148,163,184,0.25)', backgroundColor:'transparent', borderWidth:1, borderDash:[4,4], pointRadius:0, fill:false, tension:0.35 };
    const minLine = { label:'★ 최저 낙찰가', data: minMaxArr.map(d=>d.min), borderColor:'#10b981', backgroundColor:'#10b98125', borderWidth:3, pointRadius:5, pointHoverRadius:9, pointBackgroundColor:'#10b981', pointBorderColor:'#fff', pointBorderWidth:2, tension:0.35, fill:false };

    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const gridC = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    const lblC  = isDark ? '#94a3b8' : '#4a5e72';

    chartInstance = new Chart(document.getElementById('rc-canvas').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [bandTop, bandBot, minLine, ...fwDatasets] },
      options: {
        responsive:true, maintainAspectRatio:false,
        interaction: { mode:'index', intersect:false },
        plugins: {
          legend: { display:false },
          tooltip: {
            backgroundColor: isDark ? '#1e293b' : '#fff',
            borderColor: isDark ? '#334155' : '#c8d3dc',
            borderWidth:1,
            titleColor: isDark ? '#f1f5f9' : '#1a2433',
            bodyColor: isDark ? '#94a3b8' : '#4a5e72',
            padding:14,
            callbacks: {
              title: items => '📅 ' + items[0].label + ' (' + currentFt.toUpperCase() + ' 기준)',
              label: item => {
                if (item.dataset.label.startsWith('_')) return null;
                const v = item.raw;
                if (v == null) return '   ' + item.dataset.label + ': 미제출';
                const ico = item.dataset.label === '★ 최저 낙찰가' ? '🟢' : '  ';
                return ico + ' ' + item.dataset.label + ': $' + Number(v).toLocaleString();
              },
              afterBody: items => {
                const mm = minMaxArr[items[0].dataIndex];
                if (!mm || mm.min == null || mm.max == null || mm.min === mm.max) return [];
                return ['', '  견적 격차 (Spread): $' + (mm.max - mm.min).toLocaleString()];
              }
            }
          }
        },
        scales: {
          x: { grid:{ color:gridC }, ticks:{ color:lblC, font:{ size:12 } } },
          y: { grid:{ color:gridC }, ticks:{ color:lblC, font:{ size:12 }, callback: v => '$' + Number(v).toLocaleString() } }
        }
      }
    });

    // 요약 통계
    const last = periods[periods.length-1];
    const lastMM = minMaxArr[minMaxArr.length-1];
    if (lastMM && lastMM.min !== null) {
      const rk = currentFt === '20ft' ? 'rate_20ft' : 'rate_40ft';
      const minFw = assignedForwarders.find(f => activeFids.has(f.id) && last.rates[f.id] && Number(last.rates[f.id][rk]) === lastMM.min);
      statsEl.style.display = 'grid';
      statsEl.innerHTML =
        '<div style="background:var(--bg-surface);border:1px solid var(--border-color);border-top:3px solid #10b981;border-radius:10px;padding:14px 16px;">' +
          '<div style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:4px;">최근 최저가 (' + last.label + ')</div>' +
          '<div style="font-size:var(--font-xl);font-weight:700;color:#10b981;">$' + lastMM.min.toLocaleString() + '</div>' +
          (minFw ? '<div style="font-size:var(--font-xs);color:var(--text-secondary);margin-top:2px;">' + minFw.name + '</div>' : '') +
        '</div>' +
        '<div style="background:var(--bg-surface);border:1px solid var(--border-color);border-top:3px solid var(--danger);border-radius:10px;padding:14px 16px;">' +
          '<div style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:4px;">최근 최고가 (' + last.label + ')</div>' +
          '<div style="font-size:var(--font-xl);font-weight:700;color:var(--danger);">$' + lastMM.max.toLocaleString() + '</div>' +
        '</div>' +
        '<div style="background:var(--bg-surface);border:1px solid var(--border-color);border-top:3px solid var(--warning);border-radius:10px;padding:14px 16px;">' +
          '<div style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:4px;">견적 격차 (Spread)</div>' +
          '<div style="font-size:var(--font-xl);font-weight:700;color:var(--warning);">$' + (lastMM.max - lastMM.min).toLocaleString() + '</div>' +
        '</div>' +
        '<div style="background:var(--bg-surface);border:1px solid var(--border-color);border-top:3px solid var(--accent);border-radius:10px;padding:14px 16px;">' +
          '<div style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:4px;">입찰 회차 수</div>' +
          '<div style="font-size:var(--font-xl);font-weight:700;color:var(--accent);">' + periods.length + '회</div>' +
        '</div>';
    } else { statsEl.style.display = 'none'; }
  }

  function renderTable() {
    const periods = buildPeriods();
    const rateKey = currentFt === '20ft' ? 'rate_20ft' : 'rate_40ft';
    const vFws = assignedForwarders.filter(f => activeFids.has(f.id));
    document.getElementById('rc-loading').style.display = 'none';
    document.getElementById('rc-chart-view').style.display = 'none';
    document.getElementById('rc-stats').style.display = 'none';
    const tv = document.getElementById('rc-table-view'); tv.style.display = 'block';
    if (periods.length === 0) { document.getElementById('rc-table-content').innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:48px;">입찰 운임 데이터가 없습니다.</p>'; return; }

    let h = '<div style="overflow-x:auto;"><table class="data-table" style="width:100%;border-collapse:collapse;font-size:var(--font-sm);"><thead><tr>' +
      '<th style="white-space:nowrap;min-width:80px;">입찰 회차</th>' +
      vFws.map((f,i) => '<th style="color:' + COLORS[i%COLORS.length] + ';white-space:nowrap;">' + f.name + '</th>').join('') +
      '<th style="color:#10b981;white-space:nowrap;">최저가</th>' +
      '<th style="color:var(--danger);white-space:nowrap;">최고가</th>' +
      '<th style="white-space:nowrap;">Spread</th>' +
    '</tr></thead><tbody>';

    periods.forEach(p => {
      const vals = vFws.map(f => getVal(p.rates[f.id], rateKey));
      const valid = vals.filter(v => v !== null);
      const minV = valid.length ? Math.min(...valid) : null;
      const maxV = valid.length ? Math.max(...valid) : null;
      h += '<tr><td style="font-weight:600;white-space:nowrap;">' + p.label + '</td>' +
        vals.map(v => '<td style="' + (v !== null && v === minV && valid.length > 1 ? 'color:#10b981;font-weight:700;' : v !== null && v === maxV && valid.length > 1 ? 'color:var(--danger);' : '') + '">' +
          (v !== null ? '$' + v.toLocaleString() : '<span style="color:var(--text-muted)">-</span>') + '</td>').join('') +
        '<td style="color:#10b981;font-weight:700;">' + (minV !== null ? '$' + minV.toLocaleString() : '-') + '</td>' +
        '<td style="color:var(--danger);">' + (maxV !== null ? '$' + maxV.toLocaleString() : '-') + '</td>' +
        '<td style="color:var(--warning);font-weight:600;">' + (minV !== null && maxV !== null ? '$' + (maxV - minV).toLocaleString() : '-') + '</td>' +
      '</tr>';
    });
    h += '</tbody></table></div>';
    document.getElementById('rc-table-content').innerHTML = h;
  }

  function showContent() {
    if (activeTab === 'chart') { document.getElementById('rc-table-view').style.display = 'none'; renderChart(); }
    else { if (chartInstance) { chartInstance.destroy(); chartInstance = null; } renderTable(); }
  }
  showContent();

  document.getElementById('rc-tab-chart').addEventListener('click', () => {
    activeTab = 'chart';
    document.getElementById('rc-tab-chart').style.background = 'var(--accent)'; document.getElementById('rc-tab-chart').style.color = '#fff';
    document.getElementById('rc-tab-table').style.background = 'transparent'; document.getElementById('rc-tab-table').style.color = 'var(--text-secondary)';
    document.getElementById('rc-table-view').style.display = 'none'; renderChart();
  });
  document.getElementById('rc-tab-table').addEventListener('click', () => {
    activeTab = 'table';
    document.getElementById('rc-tab-table').style.background = 'var(--accent)'; document.getElementById('rc-tab-table').style.color = '#fff';
    document.getElementById('rc-tab-chart').style.background = 'transparent'; document.getElementById('rc-tab-chart').style.color = 'var(--text-secondary)';
    renderTable();
  });
  document.getElementById('rc-ft20').addEventListener('click', () => {
    currentFt = '20ft';
    document.getElementById('rc-ft20').style.background = 'var(--accent)'; document.getElementById('rc-ft20').style.color = '#fff';
    document.getElementById('rc-ft40').style.background = 'transparent'; document.getElementById('rc-ft40').style.color = 'var(--text-secondary)';
    showContent();
  });
  document.getElementById('rc-ft40').addEventListener('click', () => {
    currentFt = '40ft';
    document.getElementById('rc-ft40').style.background = 'var(--accent)'; document.getElementById('rc-ft40').style.color = '#fff';
    document.getElementById('rc-ft20').style.background = 'transparent'; document.getElementById('rc-ft20').style.color = 'var(--text-secondary)';
    showContent();
  });
  document.getElementById('rc-chips') && document.getElementById('rc-chips').addEventListener('click', e => {
    const chip = e.target.closest('[data-fid]'); if (!chip) return;
    const fid = chip.dataset.fid; const idx = parseInt(chip.dataset.idx); const color = COLORS[idx % COLORS.length];
    if (activeFids.has(fid)) {
      activeFids.delete(fid);
      chip.style.background = 'transparent'; chip.style.color = 'var(--text-muted)'; chip.style.opacity = '0.45'; chip.style.borderColor = 'var(--border-color)';
    } else {
      activeFids.add(fid);
      chip.style.background = color + '30'; chip.style.color = 'var(--text-primary)'; chip.style.opacity = '1'; chip.style.borderColor = color;
    }
    showContent();
  });
  document.getElementById('rc-all') && document.getElementById('rc-all').addEventListener('click', () => {
    assignedForwarders.forEach((f,i) => {
      activeFids.add(f.id);
      const chip = document.querySelector('[data-fid="' + f.id + '"]');
      if (chip) { const c = COLORS[i%COLORS.length]; chip.style.background = c+'30'; chip.style.color = 'var(--text-primary)'; chip.style.opacity = '1'; chip.style.borderColor = c; }
    });
    showContent();
  });
  document.getElementById('rc-none') && document.getElementById('rc-none').addEventListener('click', () => {
    activeFids.clear();
    document.querySelectorAll('[data-fid]').forEach(chip => { chip.style.background = 'transparent'; chip.style.color = 'var(--text-muted)'; chip.style.opacity = '0.45'; chip.style.borderColor = 'var(--border-color)'; });
    showContent();
  });
}