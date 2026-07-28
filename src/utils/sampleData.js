function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export const sampleRoutes = [
  { id: 'route-1', no: 1, country: '미국', pod: 'Los Angeles (LA)', manager: '김물류' },
  { id: 'route-2', no: 2, country: '미국', pod: 'New York (NY)', manager: '김물류' },
  { id: 'route-3', no: 3, country: '미국', pod: 'Long Beach (LB)', manager: '김물류' },
  { id: 'route-4', no: 4, country: '중국', pod: 'Shanghai (SHA)', manager: '이수출' },
  { id: 'route-5', no: 5, country: '중국', pod: 'Qingdao (QDO)', manager: '이수출' },
  { id: 'route-6', no: 6, country: '일본', pod: 'Tokyo (TYO)', manager: '이수출' },
  { id: 'route-7', no: 7, country: '일본', pod: 'Osaka (OSA)', manager: '박해운' },
  { id: 'route-8', no: 8, country: '베트남', pod: 'Ho Chi Minh (HCM)', manager: '박해운' },
  { id: 'route-9', no: 9, country: '독일', pod: 'Hamburg (HAM)', manager: '박해운' },
  { id: 'route-10', no: 10, country: '네덜란드', pod: 'Rotterdam (RTM)', manager: '박해운' }
];

export const sampleForwarders = [
  { id: 'fw-1', name: 'MSK Logistics', assignedRoutes: sampleRoutes.map(r => r.id) },
  { id: 'fw-2', name: 'Maersk Korea', assignedRoutes: sampleRoutes.map(r => r.id) },
  { id: 'fw-3', name: 'Evergreen Shipping', assignedRoutes: sampleRoutes.map(r => r.id) },
  { id: 'fw-4', name: 'COSCO Korea', assignedRoutes: sampleRoutes.map(r => r.id) },
  { id: 'fw-5', name: 'HMM', assignedRoutes: sampleRoutes.map(r => r.id) },
  { id: 'fw-6', name: 'Yang Ming', assignedRoutes: sampleRoutes.map(r => r.id) },
  { id: 'fw-7', name: 'ONE Korea', assignedRoutes: sampleRoutes.map(r => r.id) }
];

const now = new Date();
export const sampleBidding = {
  id: 'bidding-1',
  title: `${now.getFullYear()}년 ${now.getMonth() + 1}월 정기 스팟 비딩`,
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  status: 'active',
  createdAt: now.toISOString(),
  closedAt: null
};

export const sampleRates = [];

sampleRoutes.forEach(route => {
  sampleForwarders.forEach((forwarder) => {
    const isMissing = Math.random() > 0.85;
    
    let base20ft = 0;
    let transitTime = 0;
    
    if (route.country === '미국' && route.pod.includes('NY')) {
      base20ft = 2200 + (Math.random() * 500);
      transitTime = 25 + Math.floor(Math.random() * 5);
    } else if (route.country === '미국') {
      base20ft = 1800 + (Math.random() * 400);
      transitTime = 14 + Math.floor(Math.random() * 4);
    } else if (route.country === '유럽' || route.country === '독일' || route.country === '네덜란드') {
      base20ft = 2000 + (Math.random() * 400);
      transitTime = 30 + Math.floor(Math.random() * 5);
    } else if (route.country === '중국' || route.country === '일본') {
      base20ft = 200 + (Math.random() * 100);
      transitTime = 3 + Math.floor(Math.random() * 2);
    } else if (route.country === '베트남') {
      base20ft = 400 + (Math.random() * 150);
      transitTime = 7 + Math.floor(Math.random() * 3);
    } else {
      base20ft = 1000 + (Math.random() * 500);
      transitTime = 15 + Math.floor(Math.random() * 10);
    }
    
    const base40ft = base20ft * (1.5 + (Math.random() * 0.4));
    
    const remarks = ['', '', '', 'BAF 포함', 'GRI 적용예정', 'LSS 별도', '스페이스 확보가능'];
    
    sampleRates.push({
      id: generateId(),
      biddingId: sampleBidding.id,
      routeId: route.id,
      forwarderId: forwarder.id,
      rate20ft: isMissing ? null : Math.floor(base20ft),
      rate40ft: isMissing ? null : Math.floor(base40ft),
      transitTime: isMissing ? null : transitTime,
      remark: isMissing ? '' : remarks[Math.floor(Math.random() * remarks.length)]
    });
  });
});
