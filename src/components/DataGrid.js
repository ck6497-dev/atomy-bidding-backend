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
    html += `<th ${widthStyle}>${col.label}</th>`;
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
      html += `<td>`;
      if (type === 'readonly') {
        html += `<div class="readonly">${row[col.key] || ''}</div>`;
      } else {
        const val = row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '';
        const placeholder = col.placeholder ? `placeholder="${col.placeholder}"` : '';
        const inputType = type === 'number' ? `type="number" step="1" min="0"` : `type="text"`;
        html += `<input class="grid-cell-input" data-row="${rowIndex}" data-col="${colIndex}" data-key="${col.key}" ${inputType} ${placeholder} value="${val}" />`;
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
    const value = input.type === 'number' ? Number(input.value) : input.value;
    onCellChange(rowIndex, key, value, data[rowIndex]);
  };
  
  inputs.forEach(input => {
    input.addEventListener('blur', handleInputChange);
    
    input.addEventListener('keydown', (e) => {
      const currentRow = parseInt(input.dataset.row, 10);
      const currentCol = parseInt(input.dataset.col, 10);
      
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
        // Move down
        const nextInput = container.querySelector(`.grid-cell-input[data-row="${currentRow + 1}"][data-col="${currentCol}"]`);
        if (nextInput) {
          nextInput.focus();
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        input.blur();
        
        let nextInput = null;
        if (e.shiftKey) {
          // Move backward
          const allInputsArray = Array.from(inputs);
          const currentIndex = allInputsArray.indexOf(input);
          if (currentIndex > 0) {
            nextInput = allInputsArray[currentIndex - 1];
          }
        } else {
          // Move forward
          const allInputsArray = Array.from(inputs);
          const currentIndex = allInputsArray.indexOf(input);
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
