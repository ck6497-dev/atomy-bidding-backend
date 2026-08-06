export function showModal({ title, content, onConfirm, onCancel, confirmText = '확인', cancelText = '취소', showFooter = false }) {
  closeModal();
  
  const hasCustomFooter = typeof content === 'string' && content.includes('modal-footer');
  const shouldRenderFooter = (showFooter || onConfirm) && !hasCustomFooter;

  const footerHtml = shouldRenderFooter ? `
    <div class="modal-footer">
      <button class="btn btn-secondary btn-cancel">${cancelText}</button>
      ${onConfirm ? `<button class="btn btn-primary btn-confirm">${confirmText}</button>` : ''}
    </div>
  ` : '';

  const modalHtml = `
    <div class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="btn-icon btn-close">✕</button>
        </div>
        <div class="modal-body"></div>
        ${footerHtml}
      </div>
    </div>
  `;
  
  const container = document.createElement('div');
  container.id = 'modal-container';
  container.innerHTML = modalHtml;
  document.body.appendChild(container);
  
  const overlay = container.querySelector('.modal-overlay');
  const modalBody = container.querySelector('.modal-body');
  const btnClose = container.querySelector('.btn-close');
  const btnCancel = container.querySelector('.btn-cancel');
  const btnConfirm = container.querySelector('.btn-confirm');
  
  if (typeof content === 'string') {
    modalBody.innerHTML = content;
  } else if (content instanceof Element) {
    modalBody.appendChild(content);
  }
  
  const handleClose = () => {
    if (onCancel) onCancel();
    closeModal();
  };
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleClose();
  });
  
  if (btnClose) btnClose.addEventListener('click', handleClose);
  if (btnCancel) btnCancel.addEventListener('click', handleClose);
  
  if (btnConfirm && onConfirm) {
    btnConfirm.addEventListener('click', async () => {
      closeModal();
      try {
        await onConfirm();
      } catch (err) {
        console.error('Modal onConfirm error:', err);
      }
    });
  }
  
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      handleClose();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
  
  // slideUp animation simulation
  const modal = container.querySelector('.modal');
  modal.style.transform = 'translateY(20px)';
  modal.style.opacity = '0';
  modal.style.transition = 'all 0.3s ease';
  setTimeout(() => {
    modal.style.transform = 'translateY(0)';
    modal.style.opacity = '1';
  }, 10);
  
  return modalBody;
}

export function closeModal() {
  const container = document.getElementById('modal-container');
  if (container) {
    const modal = container.querySelector('.modal');
    modal.style.transform = 'translateY(20px)';
    modal.style.opacity = '0';
    setTimeout(() => {
      container.remove();
    }, 300);
  }
}
