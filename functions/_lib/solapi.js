/* =========================================================
   SOLAPI SMS 발송 공용 헬퍼 (HMAC-SHA256 인증)
   - functions/api/estimate.js, functions/api/consult.js 에서 공용 사용
   환경변수:
     SOLAPI_API_KEY / SOLAPI_API_SECRET / OWNER_PHONE / SENDER_PHONE
   ========================================================= */

// 발송에 필요한 환경변수가 모두 있는지
export function hasSolapiEnv(env) {
  return !!(env.SOLAPI_API_KEY && env.SOLAPI_API_SECRET && env.OWNER_PHONE && env.SENDER_PHONE);
}

export async function sendSolapiSms(env, text) {
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
export async function verifyTurnstile(secret, token, request) {
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
