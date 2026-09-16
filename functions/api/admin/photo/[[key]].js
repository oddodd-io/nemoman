/* =========================================================
   상담 신청 사진 조회 API (관리자) — Cloudflare Pages Function
   GET /api/admin/photo/consult/2026/09/<uuid>.jpg
   - Basic 인증(비밀번호: env.ADMIN_PASSWORD)
   - R2(env.PHOTOS)에서 객체를 스트리밍 (consult/ 로 시작하는 키만 허용)
   환경변수:
     PHOTOS         : R2 바인딩
     ADMIN_PASSWORD : 관리자 비밀번호 (Secret)
   ========================================================= */

import { checkBasic } from '../../../_lib/auth.js';

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra },
  });

export async function onRequestGet(context) {
  const { request, env, params } = context;

  if (!env.ADMIN_PASSWORD) {
    return json({ ok: false, error: 'ADMIN_PASSWORD가 설정되지 않았습니다.' }, 500);
  }
  if (!checkBasic(request.headers.get('Authorization'), env.ADMIN_PASSWORD)) {
    return json({ ok: false, error: '인증이 필요합니다.' }, 401, {
      'WWW-Authenticate': 'Basic realm="nemoman-admin"',
    });
  }
  if (!env.PHOTOS) {
    return json({ ok: false, error: 'PHOTOS(R2)가 설정되지 않았습니다.' }, 500);
  }

  // [[key]] 는 경로 세그먼트 배열 → "consult/yyyy/mm/uuid.ext"
  const segs = Array.isArray(params.key) ? params.key : [params.key || ''];
  const key = segs.map(s => decodeURIComponent(s)).join('/');
  if (!key.startsWith('consult/') || key.includes('..')) {
    return json({ ok: false, error: '허용되지 않은 경로입니다.' }, 400);
  }

  const obj = await env.PHOTOS.get(key);
  if (!obj) return json({ ok: false, error: '사진을 찾을 수 없습니다.' }, 404);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  if (!headers.get('Content-Type')) headers.set('Content-Type', 'application/octet-stream');
  headers.set('Cache-Control', 'private, max-age=3600');
  headers.set('ETag', obj.httpEtag);
  return new Response(obj.body, { headers });
}

// GET 외 메서드 차단
export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return json({ ok: false, error: 'Method Not Allowed' }, 405);
}
