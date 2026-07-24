/* =========================================================
   간편견적 · 비용계산기 로직 (estimate.html)
   ========================================================= */

// ===== 공통: 스티키 헤더 + 모바일 내비 =====
const header = document.getElementById('header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

const burger = document.getElementById('hamburger');
const nav = document.getElementById('nav');
burger.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  burger.setAttribute('aria-expanded', open);
});
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));

// ===== 계산기 =====
const won = n => n.toLocaleString();
const TYPE = { store: '상가/점포', office: '사무실', factory: '공장', house: '주택' };
const CAT = { food: '음식점', retail: '소매점', service: '서비스업', office: '사무실', other: '기타' };
const SCOPE = { partial: '부분 철거', full: '전체 철거' };
let calcData = {}, estResult = null;

// 빈 필드에 err 표시 + 첫 오류로 포커스
function markInvalid(ids) {
  let first = null;
  ids.forEach(id => {
    const el = document.getElementById(id);
    const empty = !el.value || (el.type === 'number' && !(parseFloat(el.value) > 0));
    el.classList.toggle('err', empty);
    if (empty && !first) first = el;
  });
  if (first) { first.focus(); first.scrollIntoView({ block: 'center' }); }
  return !first;
}

// 계산 결과 초기화 (입력이 바뀌면 숫자 신뢰성 위해 계산 모드로 복귀)
function resetResult() {
  if (!estResult) return;
  estResult = null;
  resultBox.classList.remove('show');
  calcBtn.textContent = '예상 비용 계산하기';
  calcBtn.onclick = calcEstimate;
}

function calcEstimate() {
  if (!markInvalid(['estType', 'estCategory', 'estSize', 'estScope'])) return;
  const type = estType.value, category = estCategory.value;
  const size = parseFloat(estSize.value), scope = estScope.value;
  calcData = { type, category, size, scope };

  // 평당 20만원(부분철거) 기준 + 가산 요소
  let base = size * 20;
  const factors = [size + '평'];
  if (scope === 'full') { base *= 1.4; factors.push('전체 철거'); } else { factors.push('부분 철거'); }
  if (category === 'food') { base *= 1.2; factors.push('음식점 가산'); }
  if (type === 'factory') { base *= 1.15; factors.push('공장 가산'); }
  if (optWaste.checked) { base *= 1.15; factors.push('폐기물 많음'); }
  if (optNight.checked) { base *= 1.2; factors.push('야간/휴일'); }
  if (optHigh.checked) { base *= 1.1; factors.push('고층/무EV'); }

  const min = Math.round(base * 0.85), max = Math.round(base * 1.15);
  const avg = Math.round((min + max) / 2);
  const support = Math.min(250, Math.round(avg * 0.6));
  const selfPay = Math.max(0, avg - support);
  estResult = { min, max, support, selfPay, factors };

  resultAmount.textContent = won(min) + ' ~ ' + won(max) + '만원';
  resultSupport.textContent = '정부지원 대상 시 예상 자기부담금 약 ' + won(selfPay)
    + '만원 (지원금 ' + support + '만원)';
  resultFactors.innerHTML = factors.map(f => '<span class="factor">' + f + '</span>').join('');
  resultBox.classList.add('show');

  calcBtn.textContent = '견적 신청하러 가기 →';
  calcBtn.onclick = () => goToStep(2);
}

function buildRecap() {
  if (!estResult) { recap.style.display = 'none'; return; }
  recap.style.display = 'flex';
  recap.innerHTML = '<span>' + (TYPE[calcData.type] || '') + ' · ' + (CAT[calcData.category] || '')
    + ' · ' + calcData.size + '평 · ' + (SCOPE[calcData.scope] || '') + '</span>'
    + '<span class="amt">예상 ' + won(estResult.min) + '~' + won(estResult.max) + '만원</span>';
}

function goToStep(step) {
  [ind1, ind2, ind3].forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i + 1 < step) el.classList.add('done');
    if (i + 1 === step) el.classList.add('active');
  });
  step1.style.display = step === 1 ? 'block' : 'none';
  step2.style.display = step === 2 ? 'block' : 'none';
  step3.classList.toggle('show', step === 3);
  if (step === 2) buildRecap();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelector('.calc-card').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

async function submitEstimate() {
  if (!markInvalid(['estName', 'estPhone', 'estRegion'])) return;
  if (!estAgree.checked) { estAgree.closest('.agree').classList.add('err'); estAgree.focus(); return; }

  const payload = {
    ...calcData, estimate: estResult, name: estName.value, phone: estPhone.value,
    region: estRegion.value, date: estDate.value, memo: estMemo.value, interior: estInterior.value
  };

  const label = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = '전송 중…';
  try {
    const res = await fetch('/api/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || '전송에 실패했습니다.');
  } catch (e) {
    submitBtn.disabled = false;
    submitBtn.textContent = label;
    alert((e && e.message ? e.message : '전송에 실패했습니다.') + '\n잠시 후 다시 시도하시거나 전화로 문의해 주세요.');
    return;
  }

  doneRecap.innerHTML = '<b>' + estName.value + '</b>님, '
    + (estResult ? '예상 견적 ' + won(estResult.min) + '~' + won(estResult.max) + '만원으로 ' : '')
    + '접수되었습니다.';
  goToStep(3);
}

calcBtn.addEventListener('click', calcEstimate);
backBtn.addEventListener('click', () => goToStep(1));
submitBtn.addEventListener('click', submitEstimate);

// 1단계 입력 변경 → 에러 해제 + 계산 결과 무효화
['estType', 'estCategory', 'estSize', 'estScope', 'optWaste', 'optNight', 'optHigh'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
    el.classList.remove('err'); resetResult();
  });
});
// 2단계 입력 변경 → 에러 해제
['estName', 'estRegion'].forEach(id =>
  document.getElementById(id).addEventListener('input', e => e.target.classList.remove('err')));
estAgree.addEventListener('change', () => estAgree.closest('.agree').classList.remove('err'));

// 연락처 자동 포맷 (숫자만 → 3-4-4 / 3-3-4)
estPhone.addEventListener('input', () => {
  const d = estPhone.value.replace(/\D/g, '').slice(0, 11);
  estPhone.value = d.length < 4 ? d
    : d.length < 7 ? d.slice(0, 3) + '-' + d.slice(3)
    : d.length < 11 ? d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6)
    : d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
  estPhone.classList.remove('err');
});

// 희망 시공일: 오늘 이전 선택 불가
(function () {
  const t = new Date();
  estDate.min = new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
})();

// 인테리어 크로스셀 선택
document.querySelectorAll('.int-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.int-opt').forEach(o => o.classList.remove('sel'));
    opt.classList.add('sel');
    estInterior.value = opt.dataset.value;
  });
});
