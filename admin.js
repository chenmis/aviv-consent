// Everything rendered here was typed by the public, so it only ever goes through
// textContent. Signature images are accepted only as PNG data URLs.
(function () {
  const F = window.FORM;
  const CFG = window.APP_CONFIG;
  const app = document.getElementById('app');
  const PAGE_LIMIT = 500;

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    Object.assign(el, props || {});
    el.append(...children.filter((c) => c !== null && c !== undefined));
    return el;
  }

  // replaceChildren would print a null child as the text "null".
  function render(...children) {
    app.replaceChildren(...children.filter((c) => c !== null && c !== undefined));
  }

  if (!CFG.SUPABASE_URL || !CFG.SUPABASE_PUBLISHABLE_KEY) {
    app.append(h('p', { className: 'notice', textContent: 'המערכת עדיין לא חוברה למסד הנתונים.' }));
    return;
  }

  // sessionStorage: closing the browser logs out, which suits a shared clinic computer.
  const client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_PUBLISHABLE_KEY, {
    auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  function formatDateTime(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  }

  // --- login ---
  function showLogin(message) {
    const email = h('input', { type: 'email', id: 'email', required: true, autocomplete: 'username', dir: 'ltr' });
    const password = h('input', { type: 'password', id: 'password', required: true, autocomplete: 'current-password', dir: 'ltr' });
    const error = h('p', { className: 'error', hidden: !message, role: 'alert', textContent: message || '' });
    const button = h('button', { type: 'submit', className: 'submit', textContent: 'כניסה' });
    const form = h('form', { className: 'login' },
      h('h1', { textContent: 'טפסים שהתקבלו' }),
      h('div', { className: 'field' }, h('label', { htmlFor: 'email', textContent: 'דוא״ל' }), email),
      h('div', { className: 'field' }, h('label', { htmlFor: 'password', textContent: 'סיסמה' }), password),
      error, button);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      button.disabled = true;
      const { error: err } = await client.auth.signInWithPassword({ email: email.value, password: password.value });
      password.value = '';
      button.disabled = false;
      if (err) {
        error.textContent = 'הדוא״ל או הסיסמה שגויים.';
        error.hidden = false;
        return;
      }
      start();
    });
    app.replaceChildren(form);
  }

  async function signOut(message) {
    await client.auth.signOut();
    showLogin(message);
  }

  function toolbar(...extra) {
    const out = h('button', { type: 'button', className: 'link no-print', textContent: 'יציאה' });
    out.addEventListener('click', () => signOut());
    return h('div', { className: 'toolbar no-print' }, ...extra, out);
  }

  // --- list ---
  async function showList() {
    app.replaceChildren(h('p', { className: 'intro', textContent: 'טוען טפסים…' }));
    const { data, error } = await client
      .from('submissions')
      .select('id,created_at,full_name:data->>full_name,national_id:data->>national_id,phone:data->>phone,treatment_date:data->>treatment_date')
      .order('created_at', { ascending: false })
      .limit(PAGE_LIMIT);
    if (error) {
      app.replaceChildren(toolbar(), h('p', { className: 'error', textContent: 'טעינת הטפסים נכשלה. יש לרענן את העמוד.' }));
      return;
    }

    const search = h('input', { type: 'search', placeholder: 'חיפוש לפי שם, תעודת זהות או טלפון' });
    search.setAttribute('aria-label', 'חיפוש');
    const body = h('tbody');
    const empty = h('p', { className: 'intro', hidden: true });

    function renderRows() {
      const q = search.value.trim();
      const rows = data.filter((r) => !q || [r.full_name, r.national_id, r.phone].some((v) => (v || '').includes(q)));
      body.replaceChildren(...rows.map((r) => {
        const open = h('button', { type: 'button', className: 'link', textContent: r.full_name || 'ללא שם' });
        open.addEventListener('click', () => showRecord(r.id));
        return h('tr', {},
          h('td', {}, open),
          h('td', { textContent: r.national_id || '' }),
          h('td', { textContent: r.phone || '' }),
          h('td', { textContent: r.treatment_date || '' }),
          h('td', { textContent: formatDateTime(r.created_at) }));
      }));
      empty.hidden = rows.length > 0;
      empty.textContent = data.length ? 'לא נמצאו טפסים תואמים.' : 'עדיין לא התקבלו טפסים. קישור הטופס ללקוחות נמצא בעמוד הראשי.';
    }
    search.addEventListener('input', renderRows);
    renderRows();

    const table = h('table', { className: 'records' },
      h('thead', {}, h('tr', {},
        ...['שם', 'תעודת זהות', 'טלפון', 'תאריך טיפול', 'התקבל'].map((t) => h('th', { textContent: t })))),
      body);

    render(
      toolbar(),
      h('h1', { textContent: 'טפסים שהתקבלו' }),
      h('div', { className: 'field search' }, search),
      data.length === PAGE_LIMIT
        ? h('p', { className: 'notice', textContent: `מוצגים ${PAGE_LIMIT} הטפסים האחרונים בלבד.` })
        : null,
      h('div', { className: 'table-scroll' }, table),
      empty);
  }

  // --- single record ---
  function row(label, value) {
    return h('div', { className: 'answer' },
      h('dt', { textContent: label }),
      h('dd', { textContent: value === undefined || value === '' ? '—' : String(value) }));
  }

  function signatureRow(label, src) {
    const valid = typeof src === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(src);
    return h('div', { className: 'answer' },
      h('dt', { textContent: label }),
      h('dd', {}, valid ? h('img', { className: 'sig-image', src, alt: `חתימה: ${label}` }) : document.createTextNode('—')));
  }

  function block(title, ...children) {
    return h('section', { className: 'part is-complete' }, h('h2', { textContent: title }), ...children);
  }

  const legal = (list) => list.map((text) => h('p', { className: 'legal', textContent: text }));

  async function showRecord(id) {
    app.replaceChildren(h('p', { className: 'intro', textContent: 'טוען טופס…' }));
    const { data: rec, error } = await client.from('submissions').select('*').eq('id', id).single();
    if (error) {
      app.replaceChildren(toolbar(), h('p', { className: 'error', textContent: 'טעינת הטופס נכשלה. יש לרענן את העמוד.' }));
      return;
    }
    const d = rec.data || {};
    const sigs = d.signatures || {};
    const chosen = Array.isArray(d.treatments) ? d.treatments : [];
    const L = F.FINAL.labels;
    const yesNo = { yes: 'כן', no: 'לא' };

    const back = h('button', { type: 'button', className: 'link', textContent: 'חזרה לרשימה' });
    back.addEventListener('click', showList);
    const print = h('button', { type: 'button', className: 'link', textContent: 'הדפסה או שמירה כ-PDF' });
    print.addEventListener('click', () => window.print());

    const treatmentNames = chosen
      .map((t) => (F.TREATMENTS.find((x) => x.id === t) || { label: String(t) }).label)
      .join(', ');

    render(
      toolbar(back, print),
      h('h1', { textContent: F.TITLE }),
      h('p', { className: 'brand', textContent: F.BRAND }),
      h('p', { className: 'legal', textContent: F.INTRO }),
      h('p', { className: 'intro', textContent: `התקבל ${formatDateTime(rec.created_at)}. גרסת טופס ${rec.form_version}.` }),
      rec.form_version !== F.VERSION
        ? h('p', { className: 'notice', textContent: `הטופס נחתם בגרסה ${rec.form_version}. נוסח ההסכמה המוצג כאן הוא של הגרסה הנוכחית, ${F.VERSION}.` })
        : null,
      block('פרטי המטופלת והטיפול',
        h('dl', { className: 'answers' },
          ...F.PATIENT_FIELDS.map((f) => row(f.label, d[f.name])),
          row('סוג הטיפול/ים', treatmentNames),
          chosen.includes('other') ? row('פירוט טיפול אחר', d.treatment_other) : null,
          ...F.CLINIC_FIELDS.map((f) => row(f.label, d[f.name])))),
      block(F.QUESTIONNAIRE_TITLE,
        h('dl', { className: 'answers stacked' },
          ...F.QUESTIONS.map((q, i) => {
            const r = row(`${i + 1}. ${q.text}`, yesNo[d[q.id]]);
            if (d[q.id] === 'yes') r.classList.add('flagged');
            return r;
          }),
          row(F.DETAILS_LABEL, d.medical_details))),
      block(F.GENERAL.title, ...legal(F.GENERAL.paragraphs)),
      ...F.CONSENTS.filter((c) => chosen.includes(c.id)).map((c) => block(c.title,
        ...legal(c.paragraphs),
        h('dl', { className: 'answers' },
          signatureRow(c.signLabel, sigs[`sig_${c.id}`]),
          row('תאריך', d[`date_${c.id}`])))),
      block(F.AFTERCARE.title, ...legal(F.AFTERCARE.paragraphs),
        h('dl', { className: 'answers stacked' }, row(F.AFTERCARE.instructionsLabel, d.aftercare_instructions))),
      block(F.FINAL.title,
        h('dl', { className: 'answers stacked' },
          row(F.FINAL.photoLabel, (F.FINAL.photoOptions.find((o) => o.value === d.photo_consent) || {}).label)),
        ...legal(F.FINAL.paragraphs),
        h('dl', { className: 'answers' },
          row(L.patient_name, d.patient_name),
          row(L.signed_at, d.signed_at ? formatDateTime(d.signed_at) : ''),
          signatureRow(L.patient_signature, sigs.patient_signature),
          row(L.guardian_name, d.guardian_name),
          signatureRow(`${L.guardian_signature} (מלווה)`, sigs.guardian_signature),
          row(L.clinician_name, d.clinician_name),
          signatureRow(`${L.clinician_signature} (רופאה)`, sigs.clinician_signature)),
        h('p', { className: 'legal', textContent: F.FINAL.note })),
      h('p', { className: 'form-footer', dir: 'ltr', textContent: F.FOOTER }));
    window.scrollTo(0, 0);
  }

  // --- startup ---
  async function start() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      showLogin();
      return;
    }
    // RLS returns an empty list, not an error, to a logged-in non-admin, so check explicitly.
    const { data, error } = await client.from('admins').select('user_id').eq('user_id', session.user.id);
    if (error || !data.length) {
      await signOut('לחשבון זה אין הרשאה לצפות בטפסים.');
      return;
    }
    showList();
  }

  start();
})();
