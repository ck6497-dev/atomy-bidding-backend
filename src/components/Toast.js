export function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  const icons = {
    'success': '✅',
    'error': '❌',
    'info': 'ℹ️',
    'warning': '⚠️'
  };
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '✅'}</span>
    <span class="toast-message">${message}</span>
    <button class="btn-icon toast-close">✕</button>
  `;
  
  container.appendChild(toast);
  
  // slide in animation
  toast.style.transform = 'translateX(100%)';
  toast.style.opacity = '0';
  toast.style.transition = 'all 0.3s ease';
  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  }, 10);
  
  const removeToast = () => {
    toast.style.transform = 'translateX(100%)';
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }, 300);
  };
  
  toast.querySelector('.toast-close').addEventListener('click', removeToast);
  
  setTimeout(() => {
    if (document.body.contains(toast)) {
      removeToast();
    }
  }, 3000);
}
