import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

dotenv.config();

const { Pool } = pg;
const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-jwt';

// ─── CORS 설정 ─────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:4173',
  'https://atomy-bidding-backend.onrender.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS 차단: ${origin} 은 허용되지 않은 출처입니다.`));
    }
  }
}));
app.use(express.json());

// ─── Neon DB 연결 풀 ──────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ─── DB 초기화: 테이블 자동 생성 ─────────────────────────────────────────────
// ─── 백그라운드 입찰 마감시한 자동 체크 ─────────────────────────────────────────
async function checkAndCloseBiddings() {
  try {
    const result = await pool.query(`
      UPDATE biddings 
      SET status = 'closed', closed_at = NOW() 
      WHERE status = 'active' 
        AND deadline IS NOT NULL 
        AND (deadline + INTERVAL '1 day' - INTERVAL '1 millisecond') < NOW()
      RETURNING id, title;
    `);
    if (result.rows.length > 0) {
      result.rows.forEach(b => {
        console.log(`⏰ [자동 마감] 입찰 '${b.title}'(ID: ${b.id}) 마감 처리되었습니다.`);
      });
    }
  } catch (err) {
    console.error('❌ 자동 마감 체크 실패:', err);
  }
}

async function initDB() {
  const client = await pool.connect();
  try {
    // Users 테이블 (PK: id, Email: Unique)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(200) UNIQUE NOT NULL,
        password_hash VARCHAR(200),
        role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'admin', 'forwarder')),
        is_first_login BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 슈퍼 관리자 초기 계정 생성 (ck6497@atomypark.com)
    const superAdminEmail = 'ck6497@atomypark.com';
    const checkAdmin = await client.query('SELECT * FROM users WHERE email = $1', [superAdminEmail]);
    if (checkAdmin.rows.length === 0) {
      const defaultPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin123!';
      const hash = await bcrypt.hash(defaultPassword, 10);
      await client.query(
        'INSERT INTO users (email, password_hash, role, is_first_login) VALUES ($1, $2, $3, $4)',
        [superAdminEmail, hash, 'super_admin', true]
      );
      console.log('✅ 슈퍼 관리자 초기 계정 생성 완료:', superAdminEmail);
    }

    // 포워더 테이블 (users.id를 참조하도록 변경할 수도 있으나 기존 로직 유지를 위해 분리)
    await client.query(`
      CREATE TABLE IF NOT EXISTS forwarders (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(200),
        assigned_routes JSONB DEFAULT '[]'
      );
    `);

    // 다른 테이블 유지
    await client.query(`
      CREATE TABLE IF NOT EXISTS routes (
        id VARCHAR(50) PRIMARY KEY,
        no VARCHAR(20),
        country VARCHAR(100),
        pod VARCHAR(100),
        manager VARCHAR(100)
      );

      ALTER TABLE routes ADD COLUMN IF NOT EXISTS manager VARCHAR(100);

      CREATE TABLE IF NOT EXISTS biddings (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        year INT NOT NULL,
        month INT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        deadline DATE,
        closed_at TIMESTAMPTZ,
        submitted_forwarders JSONB DEFAULT '[]'
      );

      ALTER TABLE biddings ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS rates (
        id VARCHAR(50) PRIMARY KEY,
        bidding_id VARCHAR(50) REFERENCES biddings(id) ON DELETE CASCADE,
        forwarder_id VARCHAR(50),
        route_id VARCHAR(50) REFERENCES routes(id) ON DELETE CASCADE,
        rate_20ft NUMERIC,
        rate_40ft NUMERIC,
        transit_time INT,
        remark TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ DB 초기화 완료 - 모든 테이블이 준비되었습니다.');
    
    // DB 초기화 후 1회 마감 체크 및 주기적(1분) 자동 체크 시작
    await checkAndCloseBiddings();
    setInterval(checkAndCloseBiddings, 60000);
  } catch (err) {
    console.error('❌ DB 초기화 실패:', err);
  } finally {
    client.release();
  }
}

// ─── JWT 미들웨어 ────────────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: '인증 토큰이 없습니다.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
    req.user = user;
    next();
  });
}

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: '슈퍼 관리자 권한이 필요합니다.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
  next();
}

// ─── AUTH API ────────────────────────────────────────────────────────────────
// 로그인
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: '계정을 찾을 수 없습니다.' });

    const user = result.rows[0];
    
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });

    if (user.is_first_login) {
      return res.status(200).json({ 
        require_password_setup: true, 
        email: user.email, 
        message: '비밀번호 변경이 필요합니다.' 
      });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    const userInfo = { id: user.id, email: user.email, role: user.role };
    // 포워더인 경우 forwarderId도 조회
    if (user.role === 'forwarder') {
      const fwResult = await pool.query('SELECT id FROM forwarders WHERE email = $1', [user.email]);
      if (fwResult.rows.length > 0) userInfo.forwarderId = fwResult.rows[0].id;
    }
    res.json({ token, user: userInfo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 최초 비밀번호 설정 (또는 비밀번호 변경)
app.post('/api/set-password', async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });

  try {
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, is_first_login = false WHERE email = $2',
      [hash, email]
    );

    // 변경 후 바로 토큰 발급하여 자동 로그인
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    const userInfo = { id: user.id, email: user.email, role: user.role };
    if (user.role === 'forwarder') {
      const fwResult = await pool.query('SELECT id FROM forwarders WHERE email = $1', [user.email]);
      if (fwResult.rows.length > 0) userInfo.forwarderId = fwResult.rows[0].id;
    }
    res.json({ message: '비밀번호가 성공적으로 설정되었습니다.', token, user: userInfo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── ADMIN API (슈퍼 관리자용) ───────────────────────────────────────────────
// 관리자 계정 목록 조회
app.get('/api/admins', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, email, role, is_first_login, created_at FROM users WHERE role = 'admin' OR role = 'super_admin'");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 관리자 계정 추가
app.post('/api/admins', authenticateToken, requireSuperAdmin, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: '이메일을 입력해주세요.' });

  try {
    const defaultPassword = process.env.DEFAULT_INITIAL_PASSWORD || '123qwe!@#';
    const hash = await bcrypt.hash(defaultPassword, 10);
    await pool.query(
      "INSERT INTO users (email, password_hash, role, is_first_login) VALUES ($1, $2, 'admin', true)",
      [email, hash]
    );
    res.json({ message: '관리자 계정이 추가되었습니다.' });
  } catch (error) {
    if (error.code === '23505') return res.status(400).json({ error: '이미 존재하는 이메일입니다.' });
    res.status(500).json({ error: error.message });
  }
});

// ─── 헬스체크 엔드포인트 ───────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 이메일 발송 엔드포인트 ──────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS.replace(/\s+/g, ''),
  },
});

app.post('/api/send-email', authenticateToken, async (req, res) => {
  const { to, subject, html } = req.body;
  if (!to || !subject || !html) return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });

  try {
    const info = await transporter.sendMail({
      from: `"Atomy Bidding" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    res.status(200).json({ message: '이메일 발송 완료', messageId: info.messageId });
  } catch (error) {
    console.error('이메일 발송 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── 포워더 API ──────────────────────────────────────────────────────────────
app.get('/api/forwarders', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM forwarders');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/forwarders', authenticateToken, requireAdmin, async (req, res) => {
  const { name, email, assigned_routes } = req.body;
  if (!name) return res.status(400).json({ error: '이름을 입력해주세요.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = crypto.randomUUID();
    const routesJson = JSON.stringify(assigned_routes || []);
    
    await client.query(
      'INSERT INTO forwarders (id, name, email, assigned_routes) VALUES ($1, $2, $3, $4)',
      [id, name, email || null, routesJson]
    );

    if (email) {
      const defaultPassword = process.env.DEFAULT_INITIAL_PASSWORD || '123qwe!@#';
      const hash = await bcrypt.hash(defaultPassword, 10);
      await client.query(
        "INSERT INTO users (email, password_hash, role, is_first_login) VALUES ($1, $2, 'forwarder', true) ON CONFLICT (email) DO NOTHING",
        [email, hash]
      );
    }
    
    await client.query('COMMIT');
    res.json({ message: '포워더가 추가되었습니다.', id });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.put('/api/forwarders/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, assigned_routes } = req.body;
  if (!name) return res.status(400).json({ error: '이름을 입력해주세요.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const oldForwarder = await client.query('SELECT * FROM forwarders WHERE id = $1', [id]);
    if (oldForwarder.rows.length === 0) throw new Error('포워더를 찾을 수 없습니다.');
    const oldEmail = oldForwarder.rows[0].email;
    const routesJson = JSON.stringify(assigned_routes || []);
    
    await client.query(
      'UPDATE forwarders SET name = $1, email = $2, assigned_routes = $3 WHERE id = $4',
      [name, email || null, routesJson, id]
    );

    if (oldEmail !== email) {
      if (oldEmail) {
        await client.query('DELETE FROM users WHERE email = $1 AND role = $2', [oldEmail, 'forwarder']);
      }
      if (email) {
        const defaultPassword = process.env.DEFAULT_INITIAL_PASSWORD || '123qwe!@#';
        const hash = await bcrypt.hash(defaultPassword, 10);
        await client.query(
          "INSERT INTO users (email, password_hash, role, is_first_login) VALUES ($1, $2, 'forwarder', true) ON CONFLICT (email) DO NOTHING",
          [email, hash]
        );
      }
    }
    
    await client.query('COMMIT');
    res.json({ message: '포워더가 수정되었습니다.' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.delete('/api/forwarders/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const oldForwarder = await client.query('SELECT * FROM forwarders WHERE id = $1', [id]);
    if (oldForwarder.rows.length > 0) {
      const email = oldForwarder.rows[0].email;
      await client.query('DELETE FROM forwarders WHERE id = $1', [id]);
      if (email) {
        await client.query('DELETE FROM users WHERE email = $1 AND role = $2', [email, 'forwarder']);
      }
    }
    await client.query('COMMIT');
    res.json({ message: '포워더가 삭제되었습니다.' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ─── 노선 API ────────────────────────────────────────────────────────────────
app.get('/api/routes', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM routes ORDER BY CASE WHEN no ~ '^[0-9]+$' THEN no::integer ELSE 999999 END, no");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/routes', authenticateToken, requireAdmin, async (req, res) => {
  const { no, country, pod, manager } = req.body;
  try {
    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO routes (id, no, country, pod, manager) VALUES ($1, $2, $3, $4, $5)',
      [id, no, country, pod, manager]
    );
    res.json({ message: '노선이 추가되었습니다.', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/routes/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { no, country, pod, manager } = req.body;
  try {
    await pool.query(
      'UPDATE routes SET no = $1, country = $2, pod = $3, manager = $4 WHERE id = $5',
      [no, country, pod, manager, id]
    );
    res.json({ message: '노선이 수정되었습니다.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/routes/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM routes WHERE id = $1', [id]);
    res.json({ message: '노선이 삭제되었습니다.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/routes/bulk', authenticateToken, requireAdmin, async (req, res) => {
  const routes = req.body;
  if (!Array.isArray(routes)) return res.status(400).json({ error: '배열 형식이 필요합니다.' });
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of routes) {
      const id = crypto.randomUUID();
      await client.query(
        'INSERT INTO routes (id, no, country, pod, manager) VALUES ($1, $2, $3, $4, $5)',
        [id, r.no, r.country, r.pod, r.manager]
      );
    }
    await client.query('COMMIT');
    res.json({ message: `${routes.length}개의 노선이 일괄 추가되었습니다.` });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ─── 입찰 API ────────────────────────────────────────────────────────────────
app.get('/api/biddings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM biddings ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/biddings', authenticateToken, requireAdmin, async (req, res) => {
  const { title, year, month, deadline } = req.body;
  if (!title || !year || !month) return res.status(400).json({ error: '필수 값이 누락되었습니다.' });
  
  try {
    const check = await pool.query('SELECT id FROM biddings WHERE year = $1 AND month = $2', [year, month]);
    if (check.rows.length > 0) {
      return res.status(400).json({ error: '해당 연월의 입찰이 이미 존재합니다.' });
    }
    
    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO biddings (id, title, year, month, deadline) VALUES ($1, $2, $3, $4, $5)',
      [id, title, year, month, deadline || null]
    );
    res.json({ message: '입찰이 생성되었습니다.', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/biddings/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, deadline, status } = req.body;
  try {
    await pool.query(
      'UPDATE biddings SET title = $1, deadline = $2, status = $3 WHERE id = $4',
      [title, deadline || null, status, id]
    );
    res.json({ message: '입찰이 수정되었습니다.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── 운임 API ────────────────────────────────────────────────────────────────
app.get('/api/rates', authenticateToken, async (req, res) => {
  const { biddingId, forwarderId } = req.query;
  if (!biddingId) return res.status(400).json({ error: 'biddingId가 필요합니다.' });
  
  try {
    let query = 'SELECT * FROM rates WHERE bidding_id = $1';
    let params = [biddingId];
    
    if (forwarderId) {
      query += ' AND forwarder_id = $2';
      params.push(forwarderId);
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rates', authenticateToken, async (req, res) => {
  const { rates } = req.body;
  const ratesArray = Array.isArray(rates) ? rates : [rates];
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of ratesArray) {
      const { bidding_id, forwarder_id, route_id, rate_20ft, rate_40ft, transit_time, remark } = r;
      
      const check = await client.query(
        'SELECT id FROM rates WHERE bidding_id = $1 AND forwarder_id = $2 AND route_id = $3',
        [bidding_id, forwarder_id, route_id]
      );
      
      if (check.rows.length > 0) {
        await client.query(
          'UPDATE rates SET rate_20ft = $1, rate_40ft = $2, transit_time = $3, remark = $4, updated_at = NOW() WHERE id = $5',
          [rate_20ft || null, rate_40ft || null, transit_time || null, remark || null, check.rows[0].id]
        );
      } else {
        const id = crypto.randomUUID();
        await client.query(
          'INSERT INTO rates (id, bidding_id, forwarder_id, route_id, rate_20ft, rate_40ft, transit_time, remark) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [id, bidding_id, forwarder_id, route_id, rate_20ft || null, rate_40ft || null, transit_time || null, remark || null]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ message: '운임이 저장되었습니다.' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.post('/api/rates/submit', authenticateToken, async (req, res) => {
  const { biddingId, forwarderId } = req.body;
  if (!biddingId || !forwarderId) return res.status(400).json({ error: '필수 값이 누락되었습니다.' });
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = await client.query('SELECT submitted_forwarders FROM biddings WHERE id = $1', [biddingId]);
    if (b.rows.length === 0) throw new Error('입찰을 찾을 수 없습니다.');
    
    let arr = b.rows[0].submitted_forwarders || [];
    if (!Array.isArray(arr)) arr = [];
    if (!arr.includes(forwarderId)) {
      arr.push(forwarderId);
      await client.query('UPDATE biddings SET submitted_forwarders = $1 WHERE id = $2', [JSON.stringify(arr), biddingId]);
    }
    await client.query('COMMIT');
    res.json({ message: '제출 완료' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.post('/api/rates/revoke', authenticateToken, async (req, res) => {
  const { biddingId, forwarderId } = req.body;
  if (!biddingId || !forwarderId) return res.status(400).json({ error: '필수 값이 누락되었습니다.' });
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = await client.query('SELECT submitted_forwarders FROM biddings WHERE id = $1', [biddingId]);
    if (b.rows.length === 0) throw new Error('입찰을 찾을 수 없습니다.');
    
    let arr = b.rows[0].submitted_forwarders || [];
    if (!Array.isArray(arr)) arr = [];
    arr = arr.filter(id => id !== forwarderId);
    
    await client.query('UPDATE biddings SET submitted_forwarders = $1 WHERE id = $2', [JSON.stringify(arr), biddingId]);
    await client.query('COMMIT');
    res.json({ message: '제출 취소 완료' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ─── 서버 시작 ────────────────────────────────────────────────────────────────
app.listen(port, async () => {
  console.log(`🚀 서버 실행 중: http://localhost:${port}`);
  await initDB();
});
