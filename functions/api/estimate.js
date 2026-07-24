/* =========================================================
   견적 신청 수신 API — Cloudflare Pages Function
   POST /api/estimate
   - D1(estimates 테이블)에 저장
   - SOLAPI로 사장님 휴대폰에 SMS 즉시 알림
   환경변수(대시보드 또는 wrangler secret):
     DB               : D1 바인딩 (wrangler.toml)
     SOLAPI_API_KEY   : 솔라피 API Key
     SOLAPI_API_SECRET: 솔라피 API Secret
     OWNER_PHONE      : 알림 받을 사장님 번호 (01000000000)
     SENDER_PHONE     : 솔라피에 등록된 발신번호 (01000000000)
     TURNSTILE_SECRET : (선택) Cloudflare Turnstile 시크릿
   ========================================================= */

const TYPE = { store: '상가/점포', office: '사무실', factory: '공장', house: '주택' };
const CAT = { food: '음식점', retail: '소매점', service: '서비스업', office: '사무실', other: '기타' };
const SCOPE = { partial: '부분 철거', full: '전체 철거' };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

export async function onRequestPost(context) {
  const { request, env } = context;

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: '잘못된 요청 형식입니다.' }, 400);
  }

  // 필수값 검증
  const name = (data.name || '').toString().trim();
  const phone = (data.phone || '').toString().trim();
  const region = (data.region || '').toString().trim();
  if (!name || !phone || !region) {
    return json({ ok: false, error: '필수 항목(이름·연락처·지역)이 누락되었습니다.' }, 400);
  }
  if (!/^01[0-9]-?\d{3,4}-?\d{4}$/.test(phone.replace(/\s/g, ''))) {
    return json({ ok: false, error: '연락처 형식이 올바르지 않습니다.' }, 400);
  }

  // (선택) Turnstile 스팸 차단 — 시크릿이 설정된 경우에만 검사
  if (env.TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(env.TURNSTILE_SECRET, data.turnstileToken, request);
    if (!ok) return json({ ok: false, error: '스팸 방지 검증에 실패했습니다.' }, 400);
  }

  const est = data.estimate || {};
  const now = new Date().toISOString();

  // 1) D1 저장 (DB 바인딩이 있을 때)
  if (env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO estimates
          (created_at, name, phone, region, wish_date, building_type, category,
           size, scope, est_min, est_max, interior, memo)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        now, name, phone, region, data.date || null,
        data.type || null, data.category || null,
        data.size ?? null, data.scope || null,
        est.min ?? null, est.max ?? null,
        data.interior || null, data.memo || null
      ).run();
    } catch (e) {
      // 저장 실패해도 알림은 시도 — 다만 로그 남김
      console.error('D1 insert 실패', e);
    }
  }

  // 2) SMS 알림 (솔라피 설정이 있을 때)
  let notified = false;
  if (env.SOLAPI_API_KEY && env.SOLAPI_API_SECRET && env.OWNER_PHONE && env.SENDER_PHONE) {
    const text =
      `[네모맨 견적문의]\n` +
      `${name} / ${phone}\n` +
      `${region} · ${TYPE[data.type] || '-'} · ${data.size || '-'}평 · ${SCOPE[data.scope] || '-'}\n` +
      (est.min != null ? `예상 ${est.min.toLocaleString()}~${est.max.toLocaleString()}만원\n` : '') +
      (data.interior ? `인테리어: ${data.interior}\n` : '') +
      (data.memo ? `요청: ${data.memo}` : '');
    try {
      notified = await sendSolapiSms(env, text.trim());
    } catch (e) {
      console.error('SOLAPI 발송 실패', e);
    }
  }

  return json({ ok: true, notified });
}

// 그 외 메서드는 405
export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ ok: false, error: 'Method Not Allowed' }, 405);
}

/* ---------- SOLAPI (HMAC-SHA256 인증) ---------- */
async function sendSolapiSms(env, text) {
  const enc = new TextEncoder();
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, '');
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(env.SOLAPI_API_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(date + salt));
  const signature = [...new Uint8Array(sigBuf)].map(b => b.toString(16).padStart(2, '0')).join('');

  const res = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `HMAC-SHA256 apiKey=${env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
    },
    body: JSON.stringify({
      message: {
        to: env.OWNER_PHONE.replace(/\D/g, ''),
        from: env.SENDER_PHONE.replace(/\D/g, ''),
        text,
      },
    }),
  });
  return res.ok;
}

/* ---------- Turnstile 검증 (선택) ---------- */
async function verifyTurnstile(secret, token, request) {
  if (!token) return false;
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: form,
  });
  const out = await res.json().catch(() => ({}));
  return !!out.success;
}
