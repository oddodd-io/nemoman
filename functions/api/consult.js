/* =========================================================
   상담 신청 수신 API (욕실·철거·기타) — Cloudflare Pages Function
   POST /api/consult  (multipart/form-data)
   - 사진(최대 5장)을 R2(env.PHOTOS)에 업로드
   - D1(consult_inquiries 테이블)에 저장
   - SOLAPI로 사장님 휴대폰에 SMS 즉시 알림
   환경변수(대시보드 또는 wrangler secret):
     DB               : D1 바인딩 (wrangler.toml)
     PHOTOS           : R2 바인딩 (wrangler.toml) — 없으면 사진 저장 생략
     SOLAPI_API_KEY   : 솔라피 API Key
     SOLAPI_API_SECRET: 솔라피 API Secret
     OWNER_PHONE      : 알림 받을 사장님 번호 (01048667734)
     SENDER_PHONE     : 솔라피에 등록된 발신번호 (01000000000)
     TURNSTILE_SECRET : (선택) Cloudflare Turnstile 시크릿
   ========================================================= */

import { hasSolapiEnv, sendSolapiSms, verifyTurnstile } from '../_lib/solapi.js';

// 상담 종류 (consult.html 라디오 value → 표시 라벨)
const KIND = { bath: '욕실·화장실 시공', demo: '점포·상가 철거', etc: '기타 인테리어' };

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

export async function onRequestPost(context) {
  const { request, env } = context;

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: '잘못된 요청 형식입니다.' }, 400);
  }

  const str = (k) => (form.get(k) || '').toString().trim();

  // 필수값 검증
  const kind = str('kind');
  const name = str('name');
  const phone = str('phone');
  const region = str('region');
  const memo = str('memo');
  const source = str('source').slice(0, 200);
  const scope = form.getAll('scope').map(v => v.toString().trim()).filter(Boolean);
  const files = form.getAll('photos').filter(f => f && typeof f === 'object' && f.size > 0);

  if (!KIND[kind]) {
    return json({ ok: false, error: '상담 종류를 선택해주세요.' }, 400);
  }
  if (!phone || !region) {
    return json({ ok: false, error: '필수 항목(연락처·지역)이 누락되었습니다.' }, 400);
  }
  if (!/^01[0-9]-?\d{3,4}-?\d{4}$/.test(phone.replace(/\s/g, ''))) {
    return json({ ok: false, error: '연락처 형식이 올바르지 않습니다.' }, 400);
  }
  if (!files.length && !scope.length && !memo) {
    return json({ ok: false, error: '사진, 공사 범위, 메모 중 하나는 입력해주세요.' }, 400);
  }
  if (files.length > MAX_PHOTOS) {
    return json({ ok: false, error: `사진은 최대 ${MAX_PHOTOS}장까지 첨부할 수 있습니다.` }, 400);
  }
  for (const f of files) {
    if (!(f.type || '').startsWith('image/')) {
      return json({ ok: false, error: '이미지 파일만 첨부할 수 있습니다.' }, 400);
    }
    if (f.size > MAX_PHOTO_BYTES) {
      return json({ ok: false, error: '사진 한 장당 8MB 이하만 첨부할 수 있습니다.' }, 400);
    }
  }

  // (선택) Turnstile 스팸 차단 — 시크릿이 설정된 경우에만 검사
  if (env.TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(env.TURNSTILE_SECRET, str('turnstileToken'), request);
    if (!ok) return json({ ok: false, error: '스팸 방지 검증에 실패했습니다.' }, 400);
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // 1) R2 사진 업로드 (PHOTOS 바인딩이 있을 때)
  const photoKeys = [];
  if (env.PHOTOS) {
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    for (const f of files) {
      const ext = extOf(f);
      const key = `consult/${yyyy}/${mm}/${crypto.randomUUID()}.${ext}`;
      try {
        await env.PHOTOS.put(key, f.stream(), {
          httpMetadata: { contentType: f.type || 'application/octet-stream' },
        });
        photoKeys.push(key);
      } catch (e) {
        console.error('R2 업로드 실패', key, e);
      }
    }
  } else if (files.length) {
    console.warn('PHOTOS(R2) 바인딩이 없어 사진 저장을 건너뜁니다. 첨부 수:', files.length);
  }

  // 2) D1 저장 (DB 바인딩이 있을 때)
  if (env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO consult_inquiries
          (created_at, kind, name, phone, region, scope, memo, photos, source)
         VALUES (?,?,?,?,?,?,?,?,?)`
      ).bind(
        nowIso, kind, name || null, phone, region,
        scope.length ? scope.join(',') : null,
        memo || null,
        JSON.stringify(photoKeys),
        source || null
      ).run();
    } catch (e) {
      // 저장 실패해도 알림은 시도 — 다만 로그 남김
      console.error('D1 insert 실패', e);
    }
  }

  // 3) SMS 알림 (솔라피 설정이 있을 때)
  let notified = false;
  if (hasSolapiEnv(env)) {
    const text =
      `[공간F5 상담] ${KIND[kind]}\n` +
      `${name || '-'} / ${phone}\n` +
      `${region} · ${scope.length ? scope.join(',') : '-'}\n` +
      (files.length && !photoKeys.length ? `사진 ${files.length}장 첨부(저장 안 됨 · 문자로 요청)\n` : `사진 ${photoKeys.length}장\n`) +
      (memo ? memo : '');
    try {
      notified = await sendSolapiSms(env, text.trim());
    } catch (e) {
      console.error('SOLAPI 발송 실패', e);
    }
  }

  return json({ ok: true, notified, photos: photoKeys.length });
}

// 그 외 메서드는 405
export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ ok: false, error: 'Method Not Allowed' }, 405);
}

// 확장자: MIME 우선, 없으면 파일명에서, 그래도 없으면 jpg
function extOf(f) {
  const byType = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/heic': 'heic', 'image/heif': 'heif', 'image/gif': 'gif' };
  if (byType[f.type]) return byType[f.type];
  const m = /\.([a-z0-9]{2,5})$/i.exec(f.name || '');
  return m ? m[1].toLowerCase() : 'jpg';
}
