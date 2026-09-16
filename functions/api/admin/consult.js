/* =========================================================
   상담 신청 목록 조회 API (관리자) — Cloudflare Pages Function
   GET /api/admin/consult
   - Basic 인증(비밀번호: env.ADMIN_PASSWORD)
   - D1 consult_inquiries 최신순 반환 (photos 는 키 배열로 파싱)
   환경변수:
     DB             : D1 바인딩
     ADMIN_PASSWORD : 관리자 비밀번호 (Secret)
   ========================================================= */

import { checkBasic } from '../../_lib/auth.js';

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra },
  });

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.ADMIN_PASSWORD) {
    return json({ ok: false, error: 'ADMIN_PASSWORD가 설정되지 않았습니다.' }, 500);
  }
  if (!checkBasic(request.headers.get('Authorization'), env.ADMIN_PASSWORD)) {
    return json({ ok: false, error: '인증이 필요합니다.' }, 401, {
      'WWW-Authenticate': 'Basic realm="nemoman-admin"',
    });
  }
  if (!env.DB) {
    return json({ ok: false, error: 'D1(DB)이 설정되지 않았습니다.' }, 500);
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 500);
  const { results } = await env.DB
    .prepare('SELECT * FROM consult_inquiries ORDER BY id DESC LIMIT ?')
    .bind(limit)
    .all();

  const rows = results.map(r => {
    let photos = [];
    try { photos = JSON.parse(r.photos || '[]'); } catch { photos = []; }
    return { ...r, photos: Array.isArray(photos) ? photos : [] };
  });

  return json({ ok: true, count: rows.length, rows });
}

// GET 외 메서드 차단
export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return json({ ok: false, error: 'Method Not Allowed' }, 405);
}
