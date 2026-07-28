import { sampleRoutes, sampleForwarders, sampleBidding, sampleRates } from './utils/sampleData.js';

export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function getData(key) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

export function setData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Routes CRUD
export function getRoutes() {
  return getData('atomy_routes') || [];
}

export function saveRoutes(routes) {
  setData('atomy_routes', routes);
}

export function addRoute(route) {
  const routes = getRoutes();
  const newRoute = { ...route, id: generateId() };
  routes.push(newRoute);
  saveRoutes(routes);
  return newRoute;
}

export function updateRoute(id, updates) {
  const routes = getRoutes();
  const index = routes.findIndex(r => r.id === id);
  if (index !== -1) {
    routes[index] = { ...routes[index], ...updates };
    saveRoutes(routes);
    return routes[index];
  }
  return null;
}

export function deleteRoute(id) {
  const routes = getRoutes();
  saveRoutes(routes.filter(r => r.id !== id));
}

// Forwarders CRUD  
export function getForwarders() {
  return getData('atomy_forwarders') || [];
}

export function saveForwarders(forwarders) {
  setData('atomy_forwarders', forwarders);
}

export function addForwarder(forwarder) {
  const forwarders = getForwarders();
  const newForwarder = { ...forwarder, id: generateId() };
  forwarders.push(newForwarder);
  saveForwarders(forwarders);
  return newForwarder;
}

export function updateForwarder(id, updates) {
  const forwarders = getForwarders();
  const index = forwarders.findIndex(f => f.id === id);
  if (index !== -1) {
    forwarders[index] = { ...forwarders[index], ...updates };
    saveForwarders(forwarders);
    return forwarders[index];
  }
  return null;
}

export function deleteForwarder(id) {
  const forwarders = getForwarders();
  saveForwarders(forwarders.filter(f => f.id !== id));
}

// Biddings CRUD
export function getBiddings() {
  return getData('atomy_biddings') || [];
}

export function addBidding(bidding) {
  const biddings = getBiddings();
  const newBidding = { ...bidding, id: generateId() };
  biddings.push(newBidding);
  setData('atomy_biddings', biddings);
  return newBidding;
}

export function updateBidding(id, updates) {
  const biddings = getBiddings();
  const index = biddings.findIndex(b => b.id === id);
  if (index !== -1) {
    biddings[index] = { ...biddings[index], ...updates };
    setData('atomy_biddings', biddings);
    return biddings[index];
  }
  return null;
}

export function getActiveBidding() {
  const biddings = getBiddings();
  return biddings.find(b => b.status === 'active') || null;
}

// 최종제출 관련
export function submitForwarder(biddingId, forwarderId) {
  const biddings = getBiddings();
  const index = biddings.findIndex(b => b.id === biddingId);
  if (index !== -1) {
    const submitted = biddings[index].submittedForwarders || [];
    if (!submitted.includes(forwarderId)) {
      submitted.push(forwarderId);
      biddings[index].submittedForwarders = submitted;
      setData('atomy_biddings', biddings);
    }
    return biddings[index];
  }
  return null;
}

export function revokeSubmission(biddingId, forwarderId) {
  const biddings = getBiddings();
  const index = biddings.findIndex(b => b.id === biddingId);
  if (index !== -1) {
    const submitted = biddings[index].submittedForwarders || [];
    biddings[index].submittedForwarders = submitted.filter(id => id !== forwarderId);
    setData('atomy_biddings', biddings);
    return biddings[index];
  }
  return null;
}

export function isForwarderSubmitted(biddingId, forwarderId) {
  const biddings = getBiddings();
  const bidding = biddings.find(b => b.id === biddingId);
  if (!bidding) return false;
  return (bidding.submittedForwarders || []).includes(forwarderId);
}

export function reopenBidding(biddingId, newDeadline) {
  return updateBidding(biddingId, {
    status: 'active',
    closedAt: null,
    deadline: newDeadline
  });
}

// Rates CRUD
export function getAllRates() {
  return getData('atomy_rates') || [];
}

export function saveAllRates(rates) {
  setData('atomy_rates', rates);
}

export function getRates(biddingId) {
  return getAllRates().filter(r => r.biddingId === biddingId);
}

export function getRatesByForwarder(biddingId, forwarderId) {
  return getAllRates().filter(r => r.biddingId === biddingId && r.forwarderId === forwarderId);
}

export function saveRate(rate) {
  const rates = getAllRates();
  const index = rates.findIndex(r => r.biddingId === rate.biddingId && r.routeId === rate.routeId && r.forwarderId === rate.forwarderId);
  
  const targetRate = { ...rate };
  if (!targetRate.id) targetRate.id = generateId();

  if (index !== -1) {
    rates[index] = { ...rates[index], ...targetRate };
  } else {
    rates.push(targetRate);
  }
  saveAllRates(rates);
  return targetRate;
}

export function saveRates(newRates) {
  const rates = getAllRates();
  
  newRates.forEach(rate => {
    const index = rates.findIndex(r => r.biddingId === rate.biddingId && r.routeId === rate.routeId && r.forwarderId === rate.forwarderId);
    
    const targetRate = { ...rate };
    if (!targetRate.id) targetRate.id = generateId();
    
    if (index !== -1) {
      rates[index] = { ...rates[index], ...targetRate };
    } else {
      rates.push(targetRate);
    }
  });
  
  saveAllRates(rates);
}

// Session
export function getSession() {
  return getData('atomy_session');
}

export function setSession(session) {
  setData('atomy_session', session);
}

export function clearSession() {
  localStorage.removeItem('atomy_session');
}

export function isAdmin() {
  const session = getSession();
  return session?.role === 'admin';
}

export function isForwarder() {
  const session = getSession();
  return session?.role === 'forwarder';
}

// Init
export function hasData() {
  const routes = getData('atomy_routes');
  return routes && routes.length > 0;
}

export function initSampleData() {
  if (!hasData()) {
    saveRoutes(sampleRoutes);
    saveForwarders(sampleForwarders);
    setData('atomy_biddings', [sampleBidding]);
    saveAllRates(sampleRates);
  }
}
