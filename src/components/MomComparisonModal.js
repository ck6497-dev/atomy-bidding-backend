import { formatCurrency } from '../utils/format.js';

export function showMomComparisonModal({ currentBidding, prevBidding, allRoutes, currentRates, prevRates }) {
  const existing = document.getElementById('mom-modal-overlay');
  if (existing) existing.remove();

  const getMonthLabel = (title) => {
    const m = (title || '').match(/(\d+월)/);
    return m ? m[1] : title;
  };

  const curLabel = getMonthLabel(currentBidding.title);
  const prevLabel = prevBidding ? getMonthLabel(prevBidding.title) : '직전';

  const overlay = document.createElement('div');
  overlay.id = 'mom-modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    box-sizing: border-box;
    animation: rcFadeIn 0.2s ease-out;
  `;

  overlay.innerHTML = `
    <div id="mom-modal-box" style="
      background: var(--bg-surface, #1e293b);
      border: 1px solid var(--border-color, #334155);
      border-radius: 20px;
      width: 100%;
      max-width: 1100px;
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 60px rgba(0,0,0,0.45);
      overflow: hidden;
    ">
      <!-- 헤더 -->
      <div style="padding: 20px 28px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; background: var(--bg-secondary);">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 42px; height: 42px; border-radius: 12px; background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">
            📊
          </div>
          <div>
            <div style="font-size: 17px; font-weight: 900; color: var(--text-primary);">
              전월 대비 노선별 평균 운임 변동 비교 원장
            </div>
            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 2px;">
              ${prevLabel} (${prevBidding ? prevBidding.title : '-'}) ➔ ${curLabel} (${currentBidding.title})
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 14px;">
          <!-- 20FT / 40FT 스위처 -->
          <div style="display: flex; gap: 4px; background: var(--bg-primary); border-radius: 12px; padding: 4px; border: 1px solid var(--border-color);">
            <button id="mom-ft20" style="padding: 7px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 13.5px; font-weight: 800; background: transparent; color: var(--text-secondary); transition: all 0.15s;">
              20FT
            </button>
            <button id="mom-ft40" style="padding: 7px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 13.5px; font-weight: 800; background: var(--accent); color: #fff; transition: all 0.15s;">
              40FT
            </button>
          </div>

          <!-- 닫기 버튼 -->
          <button id="mom-close" style="width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); cursor: pointer; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; font-weight: 700; transition: all 0.15s;" title="닫기 (ESC)">
            ✕
          </button>
        </div>
      </div>

      <!-- 요약 브리핑 바 -->
      <div id="mom-summary-bar" style="padding: 12px 28px; background: var(--bg-surface); border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; font-size: 13.5px; flex-wrap: wrap; gap: 12px;"></div>

      <!-- 테이블 스크롤 본문 -->
      <div style="flex: 1; overflow-y: auto; padding: 20px 28px 40px 28px;">
        <div id="mom-table-container"></div>
      </div>
    </div>
  `;

  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);

  let currentFt = '40ft';

  const handleClose = () => {
    document.body.style.overflow = '';
    overlay.remove();
    window.removeEventListener('keydown', handleKeydown);
  };

  const handleKeydown = (e) => {
    if (e.key === 'Escape') handleClose();
  };

  document.getElementById('mom-close').addEventListener('click', handleClose);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleClose();
  });
  window.addEventListener('keydown', handleKeydown);

  function renderModalContent() {
    const rateKey = currentFt === '20ft' ? 'rate_20ft' : 'rate_40ft';
    const unit = currentFt.toUpperCase();

    let downCount = 0;
    let upCount = 0;
    let sameCount = 0;
    let totalCompared = 0;

    const routeDataList = allRoutes.map(route => {
      // 당월 노선 평균
      const curRates = currentRates
        .filter(r => r.route_id === route.id && r[rateKey] !== null && r[rateKey] !== undefined && r[rateKey] !== '')
        .map(r => Number(r[rateKey]));
      const curAvg = curRates.length > 0 ? Math.round(curRates.reduce((a, b) => a + b, 0) / curRates.length) : null;

      // 전월 노선 평균
      const pRates = (prevRates || [])
        .filter(r => r.route_id === route.id && r[rateKey] !== null && r[rateKey] !== undefined && r[rateKey] !== '')
        .map(r => Number(r[rateKey]));
      const prevAvg = pRates.length > 0 ? Math.round(pRates.reduce((a, b) => a + b, 0) / pRates.length) : null;

      let diffVal = null;
      let diffPct = null;
      let status = 'none';

      if (curAvg !== null && prevAvg !== null) {
        totalCompared++;
        diffVal = curAvg - prevAvg;
        diffPct = prevAvg > 0 ? ((curAvg - prevAvg) / prevAvg) * 100 : 0;
        if (diffVal < 0) {
          downCount++;
          status = 'down';
        } else if (diffVal > 0) {
          upCount++;
          status = 'up';
        } else {
          sameCount++;
          status = 'same';
        }
      }

      return {
        route,
        curAvg,
        prevAvg,
        diffVal,
        diffPct,
        status,
        curCount: curRates.length,
        prevCount: pRates.length
      };
    });

    // 상단 브리핑 바 렌더링
    const summaryBarEl = document.getElementById('mom-summary-bar');
    if (summaryBarEl) {
      summaryBarEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 16px; font-weight: 700;">
          <span style="color: var(--text-primary);">전체 ${allRoutes.length}개 노선 중 비교 가능: <strong style="color: var(--accent);">${totalCompared}개</strong></span>
          <span style="color: var(--border-color);">|</span>
          <span style="color: #10b981;">하락 노선: <strong>${downCount}개</strong> 🟢</span>
          <span style="color: var(--danger, #ef4444);">상승 노선: <strong>${upCount}개</strong> 🔴</span>
          <span style="color: var(--text-secondary);">보합 노선: <strong>${sameCount}개</strong></span>
        </div>
        <div style="color: var(--text-secondary); font-size: 12.5px; font-weight: 600;">
          * 각 노선별 포워더 제출 운임의 산술 평균 기준 (${unit})
        </div>
      `;
    }

    // 2단계 정규화 종합 계산
    const validCurAvgs = routeDataList.map(r => r.curAvg).filter(v => v !== null);
    const validPrevAvgs = routeDataList.map(r => r.prevAvg).filter(v => v !== null);
    const totalCurAvg = validCurAvgs.length > 0 ? Math.round(validCurAvgs.reduce((a, b) => a + b, 0) / validCurAvgs.length) : 0;
    const totalPrevAvg = validPrevAvgs.length > 0 ? Math.round(validPrevAvgs.reduce((a, b) => a + b, 0) / validPrevAvgs.length) : 0;
    const totalDiffVal = totalCurAvg - totalPrevAvg;
    const totalDiffPct = totalPrevAvg > 0 ? ((totalCurAvg - totalPrevAvg) / totalPrevAvg) * 100 : 0;

    // 테이블 렌더링
    let h = `
      <div style="border: 1px solid var(--border-color); border-radius: 14px; overflow: hidden; background: var(--bg-surface);">
        <table style="width: 100%; border-collapse: collapse; font-size: 13.5px; text-align: center;">
          <thead>
            <tr style="background: var(--bg-secondary); border-bottom: 2px solid var(--border-color); color: var(--text-primary); font-weight: 800; height: 46px;">
              <th style="width: 60px; padding: 10px;">No</th>
              <th style="width: 120px; padding: 10px;">국가</th>
              <th style="padding: 10px; text-align: left;">양하지 (POD)</th>
              <th style="width: 140px; padding: 10px; background: rgba(99,102,241,0.06);">${prevLabel} 평균 (${unit})</th>
              <th style="width: 140px; padding: 10px; background: rgba(99,102,241,0.06);">${curLabel} 평균 (${unit})</th>
              <th style="width: 130px; padding: 10px;">변동 금액</th>
              <th style="width: 140px; padding: 10px;">변동률 (%)</th>
            </tr>
          </thead>
          <tbody>
    `;

    routeDataList.forEach(item => {
      let diffValHtml = '<span style="color: var(--text-muted);">-</span>';
      let diffPctHtml = '<span style="color: var(--text-muted);">-</span>';

      if (item.status === 'down') {
        diffValHtml = `<strong style="color: #10b981; font-family: monospace; font-size: 14.5px;">-$${Math.abs(item.diffVal).toLocaleString()}</strong>`;
        diffPctHtml = `<span style="background: rgba(16,185,129,0.12); color: #10b981; padding: 4px 10px; border-radius: 8px; font-weight: 800; font-family: monospace;">-${Math.abs(item.diffPct).toFixed(1)}% 하락</span>`;
      } else if (item.status === 'up') {
        diffValHtml = `<strong style="color: var(--danger, #ef4444); font-family: monospace; font-size: 14.5px;">+$${item.diffVal.toLocaleString()}</strong>`;
        diffPctHtml = `<span style="background: rgba(239,68,68,0.12); color: var(--danger, #ef4444); padding: 4px 10px; border-radius: 8px; font-weight: 800; font-family: monospace;">+${item.diffPct.toFixed(1)}% 상승</span>`;
      } else if (item.status === 'same') {
        diffValHtml = `<span style="color: var(--text-secondary); font-family: monospace;">$0</span>`;
        diffPctHtml = `<span style="color: var(--text-secondary); font-weight: 700;">0.0% 보합</span>`;
      } else {
        if (item.curAvg !== null && item.prevAvg === null) {
          diffPctHtml = `<span style="color: var(--accent); font-weight: 700; font-size: 12px;">신규 입찰</span>`;
        } else if (item.curAvg === null && item.prevAvg !== null) {
          diffPctHtml = `<span style="color: var(--text-muted); font-size: 12px;">당월 미제출</span>`;
        }
      }

      const prevStr = item.prevAvg !== null ? `$${item.prevAvg.toLocaleString()}` : '<span style="color: var(--text-muted);">-</span>';
      const curStr = item.curAvg !== null ? `$${item.curAvg.toLocaleString()}` : '<span style="color: var(--text-muted);">-</span>';

      h += `
        <tr style="border-bottom: 1px solid var(--border-color); height: 44px; transition: background 0.1s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'">
          <td style="color: var(--text-secondary); font-weight: 700;">${item.route.no || '-'}</td>
          <td style="color: var(--text-primary); font-weight: 700;">${item.route.country || '-'}</td>
          <td style="color: var(--text-primary); font-weight: 700; text-align: left; padding-left: 12px;">${item.route.pod || '-'}</td>
          <td style="font-family: monospace; font-size: 14px; color: var(--text-secondary); background: rgba(99,102,241,0.02);">${prevStr}</td>
          <td style="font-family: monospace; font-size: 14.5px; font-weight: 800; color: var(--text-primary); background: rgba(99,102,241,0.02);">${curStr}</td>
          <td>${diffValHtml}</td>
          <td>${diffPctHtml}</td>
        </tr>
      `;
    });

    // 최하단 2단계 정규화 종합 합계 행
    const totalAbsPct = Math.abs(totalDiffPct).toFixed(1);
    let totalPctText = `${totalAbsPct}% 보합`;
    let totalPctColor = 'var(--text-secondary)';
    let totalBg = 'transparent';

    if (totalDiffPct < 0) {
      totalPctText = `-${totalAbsPct}% 하락`;
      totalPctColor = '#10b981';
      totalBg = 'rgba(16,185,129,0.12)';
    } else if (totalDiffPct > 0) {
      totalPctText = `+${totalAbsPct}% 상승`;
      totalPctColor = 'var(--danger, #ef4444)';
      totalBg = 'rgba(239,68,68,0.12)';
    }

    h += `
          </tbody>
          <tfoot>
            <tr style="background: var(--bg-secondary); border-top: 2.5px solid var(--border-color); height: 50px; font-weight: 900; font-size: 14px;">
              <td colspan="3" style="text-align: center; color: var(--accent); letter-spacing: 0.02em;">
                ⭐ 전체 노선 종합 (2단계 정규화 대표 평균)
              </td>
              <td style="font-family: monospace; font-size: 15px; color: var(--text-secondary);">$${totalPrevAvg.toLocaleString()}</td>
              <td style="font-family: monospace; font-size: 15.5px; color: var(--text-primary);">$${totalCurAvg.toLocaleString()}</td>
              <td style="font-family: monospace; font-size: 15px; color: ${totalPctColor};">${totalDiffVal >= 0 ? '+' : ''}$${totalDiffVal.toLocaleString()}</td>
              <td>
                <span style="background: ${totalBg}; color: ${totalPctColor}; padding: 5px 12px; border-radius: 8px; font-family: monospace; font-size: 14.5px;">
                  ${totalPctText}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    document.getElementById('mom-table-container').innerHTML = h;
  }

  renderModalContent();

  // 20FT / 40FT 토글 버튼 이벤트
  const btn20 = document.getElementById('mom-ft20');
  const btn40 = document.getElementById('mom-ft40');

  btn20.addEventListener('click', () => {
    currentFt = '20ft';
    btn20.style.background = 'var(--accent)';
    btn20.style.color = '#fff';
    btn40.style.background = 'transparent';
    btn40.style.color = 'var(--text-secondary)';
    renderModalContent();
  });

  btn40.addEventListener('click', () => {
    currentFt = '40ft';
    btn40.style.background = 'var(--accent)';
    btn40.style.color = '#fff';
    btn20.style.background = 'transparent';
    btn20.style.color = 'var(--text-secondary)';
    renderModalContent();
  });
}
