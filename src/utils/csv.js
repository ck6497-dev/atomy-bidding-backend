export function parseCSV(csvString) {
  const lines = csvString.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    let inQuotes = false;
    let currentVal = '';
    const values = [];
    
    for (let j = 0; j < row.length; j++) {
      const char = row[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentVal);
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal);
    
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = (values[index] || '').trim().replace(/^"|"$/g, '');
    });
    data.push(obj);
  }
  
  return data;
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

export function generateCSV(data, columns) {
  if (!data || !data.length) return '';
  
  // If no columns provided, auto-detect from data keys
  if (!columns) {
    const keys = Object.keys(data[0]);
    columns = keys.map(key => ({ key, label: key }));
  }
  
  const headers = columns.map(col => `"${String(col.label || col.key).replace(/"/g, '""')}"`);
  const rows = data.map(item => {
    return columns.map(col => {
      let val = item[col.key];
      if (val === null || val === undefined) val = '';
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(',');
  });
  
  return [headers.join(','), ...rows].join('\n');
}

export function downloadCSV(dataOrCsv, columnsOrFilename, filename) {
  let csvStr;
  let downloadFilename;
  
  if (typeof dataOrCsv === 'string') {
    // Called as downloadCSV(csvString, filename)
    csvStr = dataOrCsv;
    downloadFilename = columnsOrFilename || 'export.csv';
  } else {
    // Called as downloadCSV(data, columns, filename)
    csvStr = generateCSV(dataOrCsv, columnsOrFilename);
    downloadFilename = filename || 'export.csv';
  }
  
  const blob = new Blob(['\uFEFF' + csvStr], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', downloadFilename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
