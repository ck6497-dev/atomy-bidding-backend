const routes = {};
let currentRoute = '';
let mainContainer = null;

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  window.location.hash = path;
}

export function getCurrentRoute() {
  return currentRoute;
}

export function onRouteChange(callback) {
  // not needed, but keep for compatibility
}

export function initRouter(container) {
  mainContainer = container;
  
  const handleHashChange = () => {
    const hash = window.location.hash || '#/login';
    currentRoute = hash;
    
    // Look up route handler using the FULL hash (including #)
    const handler = routes[hash];
    if (handler) {
      mainContainer.innerHTML = '';
      handler(mainContainer);
    } else if (routes['#/login']) {
      navigate('#/login');
    }
  };
  
  window.addEventListener('hashchange', handleHashChange);
  
  // Handle current hash
  handleHashChange();
}
