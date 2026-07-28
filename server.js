import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const app = express();
const port = process.env.PORT || 3001;

// ─── CORS 설정: 허용된 도메인만 접근 가능 (보안) ─────────────────────────────
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:4173',
];
// Render 배포 후 프론트엔드 URL이 생기면 여기에 추가 예정
// allowedOrigins.push('https://your-frontend.onrender.com');

app.use(cors({
  origin: (origin, callback) => {
    // 개발 환경에서 origin 없는 요청 허용 (Postman, 서버 내부 요청 등)
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
  max: 10,              // 최대 연결 수
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ─── DB 초기화: 테이블 자동 생성 ─────────────────────────────────────────────
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      -- 사용자 테이블 (관리자 / 포워더 계정)
      CREATE TABLE IF NOT EXISTS users (
        id        VARCHAR(50) PRIMARY KEY,
        name      VARCHAR(100) NOT NULL,
        password  VARCHAR(100) NOT NULL,
        role      VARCHAR(20)  NOT NULL CHECK (role IN ('admin', 'forwarder'))
      );

      -- 포워더 테이블 (추가 정보: 이메일, 담당 노선)
      CREATE TABLE IF NOT EXISTS forwarders (
        id              VARCHAR(50) PRIMARY KEY,
        name            VARCHAR(100) NOT NULL,
        email           VARCHAR(200),
        assigned_routes JSONB DEFAULT '[]'
      );

      -- 노선 테이블
      CREATE TABLE IF NOT EXISTS routes (
        id      VARCHAR(50) PRIMARY KEY,
        no      VARCHAR(20),
        country VARCHAR(100),
        pod     VARCHAR(100)
      );

      -- 입찰 테이블
      CREATE TABLE IF NOT EXISTS biddings (
        id                   VARCHAR(50) PRIMARY KEY,
        title                VARCHAR(200) NOT NULL,
        year                 INT NOT NULL,
        month                INT NOT NULL,
        status               VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at           TIMESTAMPTZ DEFAULT NOW(),
        deadline             DATE,
        submitted_forwarders JSONB DEFAULT '[]'
      );

      -- 운임 입력 테이블
      CREATE TABLE IF NOT EXISTS rates (
        id            VARCHAR(50) PRIMARY KEY,
        bidding_id    VARCHAR(50) REFERENCES biddings(id) ON DELETE CASCADE,
        forwarder_id  VARCHAR(50),
        route_id      VARCHAR(50) REFERENCES routes(id) ON DELETE CASCADE,
        rate_20ft     NUMERIC,
        rate_40ft     NUMERIC,
        transit_time  INT,
        remark        TEXT,
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ DB 초기화 완료 - 모든 테이블이 준비되었습니다.');
  } catch (err) {
    console.error('❌ DB 초기화 실패:', err);
  } finally {
    client.release();
  }
}

// ─── 헬스체크 엔드포인트 (cron-job.org 용 - 서버가 잠들지 않도록) ───────────
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

app.post('/api/send-email', async (req, res) => {
  const { to, subject, html } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
  }

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
