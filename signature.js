// Touch, pen and mouse signature pad. The canvas keeps its drawing across resizes.
window.createSignaturePad = function createSignaturePad(onChange) {
  const INK = '#2f2219';
  const wrap = document.createElement('div');
  wrap.className = 'sig';

  const canvas = document.createElement('canvas');
  canvas.className = 'sig-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'אזור חתימה');
  const ctx = canvas.getContext('2d');

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'sig-clear';
  clearBtn.textContent = 'ניקוי החתימה';

  wrap.append(canvas, clearBtn);

  let empty = true;
  let drawing = false;
  let last = null;

  function applyPen() {
    const ratio = canvas.width / (canvas.clientWidth || 1);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2 * ratio;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const tw = Math.round(w * dpr);
    const th = Math.round(h * dpr);
    if (canvas.width === tw && canvas.height === th) return;
    let copy = null;
    if (!empty) {
      copy = document.createElement('canvas');
      copy.width = canvas.width;
      copy.height = canvas.height;
      copy.getContext('2d').drawImage(canvas, 0, 0);
    }
    canvas.width = tw;
    canvas.height = th;
    if (copy) ctx.drawImage(copy, 0, 0, tw, th);
    applyPen();
  }

  function point(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height),
    };
  }

  function dot(p) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    resize();
    canvas.setPointerCapture(e.pointerId);
    drawing = true;
    last = point(e);
    dot(last);
    if (empty) {
      empty = false;
      wrap.classList.add('is-signed');
      wrap.classList.remove('is-invalid');
      onChange();
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    e.preventDefault();
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) {
      const p = point(ev);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
    }
  });

  const stop = () => { drawing = false; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    empty = true;
    wrap.classList.remove('is-signed');
    onChange();
  }
  clearBtn.addEventListener('click', clear);

  new ResizeObserver(resize).observe(canvas);

  return {
    el: wrap,
    isEmpty: () => empty,
    toDataURL: () => canvas.toDataURL('image/png'),
    clear,
    markInvalid: () => wrap.classList.add('is-invalid'),
  };
};
