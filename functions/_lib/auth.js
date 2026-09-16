/* =========================================================
   관리자 Basic 인증 공용 헬퍼
   - functions/api/admin/** 에서 공용 사용
   환경변수:
     ADMIN_PASSWORD : 관리자 비밀번호 (Secret)
   ========================================================= */

export function checkBasic(header, password) {
  if (!header || !header.startsWith('Basic ')) return false;
  try {
    const decoded = atob(header.slice(6)); // "user:pass"
    const pass = decoded.slice(decoded.indexOf(':') + 1);
    // 길이 먼저 비교 후 상수시간 비교
    if (pass.length !== password.length) return false;
    let diff = 0;
    for (let i = 0; i < pass.length; i++) diff |= pass.charCodeAt(i) ^ password.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}
