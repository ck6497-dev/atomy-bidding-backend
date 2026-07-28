import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

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
        pod VARCHAR(100)
      );

      CREATE TABLE IF NOT EXISTS biddings (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        year INT NOT NULL,
        month INT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        deadline DATE,
        submitted_forwarders JSONB DEFAULT '[]'
      );

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
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
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

    res.json({ message: '비밀번호가 성공적으로 설정되었습니다.', token, user: { id: user.id, email: user.email, role: user.role } });
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

// ─── 서버 시작 ────────────────────────────────────────────────────────────────
app.listen(port, async () => {
  console.log(`🚀 서버 실행 중: http://localhost:${port}`);
  await initDB();
});
