// L1 수정: sampleData import 제거 (DB 마이그레이션 완료)

const API_URL = '/api';

// ─── JWT Token 관리 ──────────────────────────────────────────────────────────
export function setToken(token) {
  localStorage.setItem('atomy_jwt', token);
}

export function getToken() {
  return localStorage.getItem('atomy_jwt');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  };
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options.headers }
  });
  if (res.status === 401 || res.status === 403) {
    clearSession();
    window.location.hash = '#/login';
    throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
  }
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error(`요청 실패 (${res.status}): 올바르지 않은 서버 응답입니다.`);
  }
  if (!res.ok) {
    throw new Error(data.error || '요청 처리 중 오류가 발생했습니다.');
  }
  return data;
}

// ─── Auth API ────────────────────────────────────────────────────────────────
export async function loginApi(email, password) {
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error('서버 응답을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  }
  if (!res.ok) {
    throw new Error(data.error || `로그인 처리 실패 (${res.status})`);
  }
  return data;
}

export async function setPasswordApi(email, newPassword) {
  const res = await fetch(`${API_URL}/set-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, newPassword })
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error('서버 응답을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  }
  if (!res.ok) {
    throw new Error(data.error || `비밀번호 설정 실패 (${res.status})`);
  }
  return data;
}

// ─── Admin API ───────────────────────────────────────────────────────────────
export async function getAdminsApi() {
  return apiFetch('/admins');
}

export async function addAdminApi(email) {
  return apiFetch('/admins', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export async function deleteAdminApi(id) {
  return apiFetch(`/admins/${id}`, {
    method: 'DELETE'
  });
}

// ─── ID 생성 유틸 ────────────────────────────────────────────────────────────
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// ─── Routes API ──────────────────────────────────────────────────────────────
export async function getRoutes() {
  return apiFetch('/routes');
}

export async function addRoute(route) {
  return apiFetch('/routes', {
    method: 'POST',
    body: JSON.stringify(route)
  });
}

export async function updateRoute(id, updates) {
  return apiFetch(`/routes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
}

export async function deleteRoute(id) {
  return apiFetch(`/routes/${id}`, { method: 'DELETE' });
}

export async function bulkAddRoutes(routes) {
  return apiFetch('/routes/bulk', {
    method: 'POST',
    body: JSON.stringify({ routes })
  });
}

// ─── Forwarders API ──────────────────────────────────────────────────────────
export async function getForwarders() {
  return apiFetch('/forwarders');
}

export async function addForwarder(forwarder) {
  return apiFetch('/forwarders', {
    method: 'POST',
    body: JSON.stringify(forwarder)
  });
}

export async function updateForwarder(id, updates) {
  return apiFetch(`/forwarders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
}

export async function deleteForwarder(id) {
  return apiFetch(`/forwarders/${id}`, { method: 'DELETE' });
}

// ─── Biddings API ────────────────────────────────────────────────────────────
export async function getBiddings() {
  return apiFetch('/biddings');
}

export async function addBidding(bidding) {
  return apiFetch('/biddings', {
    method: 'POST',
    body: JSON.stringify(bidding)
  });
}

export async function updateBidding(id, updates) {
  return apiFetch(`/biddings/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
}

export async function getActiveBidding() {
  const biddings = await getBiddings();
  return biddings.find(b => b.status === 'active') || null;
}

// ─── 최종제출 관련 ───────────────────────────────────────────────────────────
export async function submitForwarder(biddingId, forwarderId) {
  return apiFetch('/rates/submit', {
    method: 'POST',
    body: JSON.stringify({ biddingId, forwarderId })
  });
}

export async function revokeSubmission(biddingId, forwarderId) {
  return apiFetch('/rates/revoke', {
    method: 'POST',
    body: JSON.stringify({ biddingId, forwarderId })
  });
}

export async function isForwarderSubmitted(biddingId, forwarderId) {
  const biddings = await getBiddings();
  const bidding = biddings.find(b => b.id === biddingId);
  if (!bidding) return false;
  return (bidding.submitted_forwarders || []).includes(forwarderId);
}

export async function reopenBidding(biddingId, newDeadline) {
  return updateBidding(biddingId, {
    status: 'active',
    closedAt: null,
    deadline: newDeadline
  });
}

// ─── Rates API ───────────────────────────────────────────────────────────────
export async function getAllRates(biddingId) {
  return apiFetch(`/rates?biddingId=${biddingId}`);
}

export async function getRates(biddingId) {
  return apiFetch(`/rates?biddingId=${biddingId}`);
}

export async function getRatesByForwarder(biddingId, forwarderId) {
  return apiFetch(`/rates?biddingId=${biddingId}&forwarderId=${forwarderId}`);
}

export async function saveRate(rate) {
  const payload = {
    bidding_id: rate.bidding_id || rate.biddingId,
    forwarder_id: rate.forwarder_id || rate.forwarderId,
    route_id: rate.route_id || rate.routeId,
    rate_20ft: rate.rate_20ft !== undefined ? rate.rate_20ft : rate.rate20ft,
    rate_40ft: rate.rate_40ft !== undefined ? rate.rate_40ft : rate.rate40ft,
    transit_time: rate.transit_time !== undefined ? rate.transit_time : rate.transitTime,
    remark: rate.remark
  };
  return apiFetch('/rates', {
    method: 'POST',
    body: JSON.stringify({ rates: [payload] })
  });
}

export async function saveRates(rates) {
  const ratesArray = Array.isArray(rates) ? rates : [rates];
  const payload = ratesArray.map(rate => ({
    bidding_id: rate.bidding_id || rate.biddingId,
    forwarder_id: rate.forwarder_id || rate.forwarderId,
    route_id: rate.route_id || rate.routeId,
    rate_20ft: rate.rate_20ft !== undefined ? rate.rate_20ft : rate.rate20ft,
    rate_40ft: rate.rate_40ft !== undefined ? rate.rate_40ft : rate.rate40ft,
    transit_time: rate.transit_time !== undefined ? rate.transit_time : rate.transitTime,
    remark: rate.remark
  }));
  return apiFetch('/rates', {
    method: 'POST',
    body: JSON.stringify({ rates: payload })
  });
}

export async function sendEmailApi(to, subject, html) {
  return apiFetch('/send-email', {
    method: 'POST',
    body: JSON.stringify({ to, subject, html })
  });
}

// ─── Session (로컬 전용 - JWT와 함께 사용) ───────────────────────────────────
export function getSession() {
  const data = localStorage.getItem('atomy_session');
  return data ? JSON.parse(data) : null;
}

export function setSession(session) {
  localStorage.setItem('atomy_session', JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem('atomy_session');
  localStorage.removeItem('atomy_jwt');
}

export function isAdmin() {
  const session = getSession();
  return session?.role === 'admin' || session?.role === 'super_admin';
}

export function isForwarder() {
  const session = getSession();
  return session?.role === 'forwarder';
}

// L2 수정: Legacy 호환 함수 제거 (DB로 전환 완료)
