export function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

export function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatDate(dateString) {
  if (!dateString) return '-';
  
  // M3 수정: 날짜 전용 문자열(YYYY-MM-DD)은 UTC로 파싱되어 시간대 문제 발생 방지
  const dateOnly = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;
  }
  
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

export function formatMonth(year, month) {
  return `${year}년 ${month}월`;
}
