export function renderDataGrid(container, options) {
  const {
    columns = [],
    data = [],
    onCellChange,
    onRowDelete,
    showRowNumbers = true,
    showDeleteButton = false,
    emptyMessage = '데이터가 없습니다'
  } = options;

  if (!data || data.length === 0) {
    container.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
    return;
  }

  let html = `<div class="data-grid-container"><table class="data-grid">`;
  
  // Header
  html += `<thead><tr>`;
  if (showRowNumbers) {
    html += `<th class="grid-row-number" style="width: 50px;">#</th>`;
  }
  columns.forEach(col => {
    const widthStyle = col.width ? `style="width: ${col.width};"` : '';
    const isRight = col.align === 'right' || col.type === 'number';
    const alignClass = isRight ? 'text-right' : (col.align === 'center' ? 'text-center' : '');
    html += `<th ${widthStyle} class="${alignClass}">${col.label}</th>`;
  });
  if (showDeleteButton) {
    html += `<th style="width: 50px;">삭제</th>`;
  }
  html += `</tr></thead>`;
  
  // Body
  html += `<tbody>`;
  data.forEach((row, rowIndex) => {
    html += `<tr data-row-index="${rowIndex}">`;
    if (showRowNumbers) {
      html += `<td class="grid-row-number text-center">${rowIndex + 1}</td>`;
    }
    
    columns.forEach((col, colIndex) => {
      const type = col.type || 'text';
      const isRight = col.align === 'right' || type === 'number';
      const alignClass = isRight ? 'text-right' : (col.align === 'center' ? 'text-center' : '');

      html += `<td class="${alignClass}">`;
      if (type === 'readonly') {
        html += `<div class="readonly ${alignClass}">${row[col.key] || ''}</div>`;
      } else {
        const val = row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '';
        const placeholder = col.placeholder ? `placeholder="${col.placeholder}"` : '';
        const inputType = type === 'number' ? `type="number" step="1" min="0"` : `type="text"`;
        html += `<input class="grid-cell-input ${alignClass}" data-row="${rowIndex}" data-col="${colIndex}" data-key="${col.key}" ${inputType} ${placeholder} value="${val}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other" />`;
      }
      html += `</td>`;
    });
    
    if (showDeleteButton) {
      html += `<td class="text-center"><button class="btn-icon btn-danger btn-delete-row" data-row="${rowIndex}">🗑️</button></td>`;
    }
    html += `</tr>`;
  });
  html += `</tbody></table></div>`;
  
  container.innerHTML = html;
  
  // Event Listeners
  const inputs = container.querySelectorAll('.grid-cell-input');
  
  const handleInputChange = (e) => {
    if (!onCellChange) return;
    const input = e.target;
    const rowIndex = parseInt(input.dataset.row, 10);
    const key = input.dataset.key;
    // H5 수정: 빈 값은 빈 문자열로 보존 (0과 미입력 구분)
    const value = input.type === 'number' ? (input.value === '' ? '' : Number(input.value)) : input.value;
    onCellChange(rowIndex, key, value, data[rowIndex]);
  };
  
  inputs.forEach(input => {
    input.addEventListener('blur', handleInputChange);
    
    // 마우스 휠로 숫자 변동 방지
    input.addEventListener('wheel', (e) => {
      if (input.type === 'number') {
        e.preventDefault();
      }
    }, { passive: false });

    // 포커스 시 입력값 전체 선택 (엑셀식 바로 타이핑 지원)
    // [안전장치]: 외부 보안 프로그램/자동완성과의 무한 핑퐁 루프 방지
    let isMouseDown = false;

    input.addEventListener('mousedown', () => {
      if (document.activeElement !== input) {
        isMouseDown = true;
      }
    });

    input.addEventListener('focus', () => {
      if (!isMouseDown) {
        if (document.activeElement === input && typeof input.select === 'function') {
          input.select();
        }
      }
    });

    input.addEventListener('mouseup', (e) => {
      if (isMouseDown) {
        isMouseDown = false;
        if (document.activeElement === input && typeof input.select === 'function') {
          input.select();
        }
        e.preventDefault();
      }
    });

    input.addEventListener('keydown', (e) => {
      const currentRow = parseInt(input.dataset.row, 10);
      const currentCol = parseInt(input.dataset.col, 10);

      // ─── 1. 위쪽 화살표 (ArrowUp) -> 위쪽 행으로 이동 ───
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        input.blur();
        const nextInput = container.querySelector(`.grid-cell-input[data-row="${currentRow - 1}"][data-col="${currentCol}"]`);
        if (nextInput) {
          nextInput.focus();
        }
        return;
      }

      // ─── 2. 아래쪽 화살표 (ArrowDown) & 엔터 (Enter) -> 아래쪽 행으로 이동 ───
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        input.blur();
        const nextInput = container.querySelector(`.grid-cell-input[data-row="${currentRow + 1}"][data-col="${currentCol}"]`);
        if (nextInput) {
          nextInput.focus();
        }
        return;
      }

      // ─── 3. 왼쪽 화살표 (ArrowLeft) -> 이전 열/셀로 이동 ───
      if (e.key === 'ArrowLeft') {
        let isAtStart = true;
        let isAllSelected = false;
        try {
          if (input.type !== 'number') {
            isAtStart = input.selectionStart === 0 && input.selectionEnd === 0;
            isAllSelected = input.selectionStart === 0 && input.selectionEnd === input.value.length;
          }
        } catch (err) {}

        if (isAtStart || isAllSelected || input.type === 'number') {
          e.preventDefault();
          input.blur();
          let prevInput = container.querySelector(`.grid-cell-input[data-row="${currentRow}"][data-col="${currentCol - 1}"]`);
          if (!prevInput && currentRow > 0) {
            // 이전 행의 마지막 입력칸으로
            const prevRowInputs = container.querySelectorAll(`.grid-cell-input[data-row="${currentRow - 1}"]`);
            if (prevRowInputs.length > 0) {
              prevInput = prevRowInputs[prevRowInputs.length - 1];
            }
          }
          if (prevInput) {
            prevInput.focus();
          }
          return;
        }
      }

      // ─── 4. 오른쪽 화살표 (ArrowRight) -> 다음 열/셀로 이동 ───
      if (e.key === 'ArrowRight') {
        let isAtEnd = true;
        let isAllSelected = false;
        try {
          if (input.type !== 'number') {
            isAtEnd = input.selectionEnd === input.value.length;
            isAllSelected = input.selectionStart === 0 && input.selectionEnd === input.value.length;
          }
        } catch (err) {}

        if (isAtEnd || isAllSelected || input.type === 'number') {
          e.preventDefault();
          input.blur();
          let nextInput = container.querySelector(`.grid-cell-input[data-row="${currentRow}"][data-col="${currentCol + 1}"]`);
          if (!nextInput) {
            // 다음 행의 첫 번째 입력칸으로
            nextInput = container.querySelector(`.grid-cell-input[data-row="${currentRow + 1}"][data-col="0"]`);
          }
          if (nextInput) {
            nextInput.focus();
          }
          return;
        }
      }

      // ─── 5. 탭 키 (Tab / Shift+Tab) ───
      if (e.key === 'Tab') {
        e.preventDefault();
        input.blur();
        
        let nextInput = null;
        const allInputsArray = Array.from(inputs);
        const currentIndex = allInputsArray.indexOf(input);

        if (e.shiftKey) {
          if (currentIndex > 0) {
            nextInput = allInputsArray[currentIndex - 1];
          }
        } else {
          if (currentIndex < allInputsArray.length - 1) {
            nextInput = allInputsArray[currentIndex + 1];
          }
        }
        
        if (nextInput) {
          nextInput.focus();
        }
      }
    });
  });
  
  if (showDeleteButton && onRowDelete) {
    const deleteBtns = container.querySelectorAll('.btn-delete-row');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rowIndex = parseInt(e.currentTarget.dataset.row, 10);
        onRowDelete(rowIndex);
      });
    });
  }
}
