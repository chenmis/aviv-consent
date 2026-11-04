(function () {
  const F = window.FORM;
  const CFG = window.APP_CONFIG;
  const app = document.getElementById('app');
  const configured = Boolean(CFG.SUPABASE_URL && CFG.SUPABASE_PUBLISHABLE_KEY);
  const client = configured
    ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
    : null;

  const sigs = new Map(); // field name -> { pad, required }

  // --- small DOM helpers; all wording goes through textContent ---
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    Object.assign(el, props || {});
    el.append(...children.filter((c) => c !== null && c !== undefined));
    return el;
  }

  const pad2 = (n) => String(n).padStart(2, '0');
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  function nowLocal() {
    const d = new Date();
    return `${today()}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function field(def) {
    const input = h('input', {
      name: def.name,
      id: `f-${def.name}`,
      type: def.type || 'text',
      required: Boolean(def.required),
    });
    if (def.inputmode) input.inputMode = def.inputmode;
    if (def.today) input.value = today();
    if (def.now) input.value = nowLocal();
    if (def.type === 'tel' || def.type === 'email') input.dir = 'ltr';
    const label = h('label', { htmlFor: input.id, textContent: def.label });
    return h('div', { className: def.wide ? 'field wide' : 'field' }, label, input);
  }

  function signature(name, labelText, required) {
    const pad = window.createSignaturePad(update);
    sigs.set(name, { pad, required });
    return h('div', { className: 'field wide sig-field', id: `sig-${name}` },
      h('span', { className: 'field-label', textContent: labelText }),
      pad.el);
  }

  function paragraphs(list) {
    return list.map((text) => h('p', { className: 'legal', textContent: text }));
  }

  function section(title, ...children) {
    return h('section', { className: 'part' }, h('h2', { textContent: title }), ...children);
  }

  // --- sections ---
  function detailsSection() {
    const checks = F.TREATMENTS.map((t) => {
      const input = h('input', { type: 'checkbox', name: 'treatments', value: t.id });
      return h('label', { className: 'pill' }, input, h('span', { textContent: t.label }));
    });
    const otherField = field({ name: 'treatment_other', label: 'פירוט טיפול אחר', required: true, wide: true });
    const otherWrap = h('fieldset', { className: 'bare', id: 'other-wrap', hidden: true, disabled: true }, otherField);

    return section('פרטי המטופלת והטיפול',
      h('div', { className: 'grid' }, ...F.PATIENT_FIELDS.map(field)),
      h('fieldset', { className: 'bare', id: 'treatments' },
        h('legend', { className: 'field-label', textContent: 'סוג הטיפול/ים' }),
        h('div', { className: 'pills' }, ...checks),
        h('p', { className: 'error', id: 'treatments-error', hidden: true, textContent: 'יש לסמן לפחות טיפול אחד.' })),
      otherWrap,
      h('details', { className: 'clinic' },
        h('summary', { textContent: 'למילוי על ידי הצוות המטפל: אזור, תכשיר ואצווה' }),
        h('div', { className: 'grid' }, ...F.CLINIC_FIELDS.map(field))));
  }

  function questionnaireSection() {
    const rows = F.QUESTIONS.map((q, i) => {
      const yes = h('input', { type: 'radio', name: q.id, value: 'yes', required: true });
      const no = h('input', { type: 'radio', name: q.id, value: 'no', required: true });
      return h('fieldset', { className: 'question' },
        h('legend', { textContent: `${i + 1}. ${q.text}` }),
        h('div', { className: 'yesno' },
          h('label', {}, yes, h('span', { textContent: 'כן' })),
          h('label', {}, no, h('span', { textContent: 'לא' }))));
    });
    const details = h('textarea', { name: 'medical_details', id: 'f-medical_details', rows: 4 });
    return section(F.QUESTIONNAIRE_TITLE, ...rows,
      h('div', { className: 'field wide' },
        h('label', { htmlFor: details.id, textContent: F.DETAILS_LABEL }), details));
  }

  function consentSection(c) {
    const date = field({ name: `date_${c.id}`, label: 'תאריך', type: 'date', required: true, today: true });
    const fs = h('fieldset', { className: 'bare' },
      ...paragraphs(c.paragraphs),
      h('div', { className: 'grid' }, signature(`sig_${c.id}`, c.signLabel, true), date));
    const part = section(c.title, fs);
    part.dataset.consent = c.id;
    part.hidden = true;
    fs.disabled = true;
    return part;
  }

  function finalSection() {
    const L = F.FINAL.labels;
    const options = F.FINAL.photoOptions.map((o) => h('label', {},
      h('input', { type: 'radio', name: 'photo_consent', value: o.value, required: true }),
      h('span', { textContent: o.label })));
    return section(F.FINAL.title,
      h('fieldset', { className: 'question' },
        h('legend', { textContent: F.FINAL.photoLabel }),
        h('div', { className: 'yesno wide-options' }, ...options)),
      ...paragraphs(F.FINAL.paragraphs),
      h('details', { className: 'clinic' },
        h('summary', { textContent: 'מלווה או אפוטרופוס, אם רלוונטי' }),
        h('div', { className: 'grid' },
          field({ name: 'guardian_name', label: L.guardian_name, wide: true }),
          signature('guardian_signature', L.guardian_signature, false))),
      h('details', { className: 'clinic' },
        h('summary', { textContent: 'למילוי על ידי הצוות המטפל: חתימת הרופאה' }),
        h('div', { className: 'grid' },
          field({ name: 'clinician_name', label: L.clinician_name, wide: true }),
          signature('clinician_signature', L.clinician_signature, false)),
        h('p', { className: 'legal', textContent: F.FINAL.note })),
      // The client's signature closes the form, directly above the send button.
      h('div', { className: 'grid' },
        field({ name: 'patient_name', label: L.patient_name, required: true }),
        field({ name: 'signed_at', label: L.signed_at, type: 'datetime-local', required: true, now: true }),
        signature('patient_signature', L.patient_signature, true)));
  }

  // --- build page ---
  const notice = configured ? null : h('p', { className: 'notice', textContent: 'הטופס עדיין אינו פעיל לשליחה. נא לפנות למרפאה.' });
  const formError = h('p', { className: 'error submit-error', id: 'form-error', hidden: true, role: 'alert' });
  const submitBtn = h('button', { type: 'submit', className: 'submit', textContent: 'שליחת הטופס למרפאה', disabled: !configured });

  const aftercareInstructions = h('textarea', { name: 'aftercare_instructions', id: 'f-aftercare_instructions', rows: 3 });

  const form = h('form', { id: 'consent-form', autocomplete: 'off' },
    detailsSection(),
    questionnaireSection(),
    section(F.GENERAL.title, ...paragraphs(F.GENERAL.paragraphs)),
    ...F.CONSENTS.map(consentSection),
    section(F.AFTERCARE.title, ...paragraphs(F.AFTERCARE.paragraphs),
      h('div', { className: 'field wide' },
        h('label', { htmlFor: aftercareInstructions.id, textContent: F.AFTERCARE.instructionsLabel }),
        aftercareInstructions)),
    finalSection(),
    h('div', { className: 'submit-row' }, formError, submitBtn));

  app.append(
    h('div', { className: 'title-block' },
      h('h1', { textContent: F.TITLE }),
      h('p', { className: 'intro', textContent: F.INTRO })),
    ...(notice ? [notice] : []),
    form);

  const fullName = form.elements.full_name;
  const patientName = form.elements.patient_name;
  let patientNameEdited = false;
  patientName.addEventListener('input', () => { patientNameEdited = true; });
  fullName.addEventListener('input', () => {
    if (!patientNameEdited) patientName.value = fullName.value;
  });

  // --- state ---
  function selectedTreatments() {
    return [...form.querySelectorAll('input[name="treatments"]:checked')].map((i) => i.value);
  }

  function isActive(name) {
    const holder = document.getElementById(`sig-${name}`);
    return Boolean(holder) && !holder.closest('fieldset:disabled');
  }

  function update() {
    const chosen = selectedTreatments();
    form.querySelectorAll('[data-consent]').forEach((part) => {
      const on = chosen.includes(part.dataset.consent);
      part.hidden = !on;
      part.querySelector('fieldset').disabled = !on;
    });
    const otherWrap = document.getElementById('other-wrap');
    otherWrap.hidden = !chosen.includes('other');
    otherWrap.disabled = otherWrap.hidden;
    if (chosen.length) document.getElementById('treatments-error').hidden = true;

    form.elements.medical_details.required = F.QUESTIONS.some(
      (q) => form.elements[q.id].value === 'yes');

    form.querySelectorAll('.part').forEach((part) => {
      part.classList.toggle('is-complete', sectionComplete(part));
    });
  }

  function sectionComplete(part) {
    if (part.hidden) return false;
    const inputs = [...part.querySelectorAll('input, textarea')].filter((i) => !i.matches(':disabled'));
    if (!inputs.every((i) => i.checkValidity())) return false;
    if (part.querySelector('#treatments') && !selectedTreatments().length) return false;
    for (const [name, s] of sigs) {
      const holder = document.getElementById(`sig-${name}`);
      if (s.required && part.contains(holder) && isActive(name) && s.pad.isEmpty()) return false;
    }
    return true;
  }

  // --- submit ---
  function validate() {
    if (!selectedTreatments().length) {
      const err = document.getElementById('treatments-error');
      err.hidden = false;
      document.getElementById('treatments').scrollIntoView({ block: 'center' });
      return false;
    }
    if (!form.reportValidity()) return false;
    for (const [name, s] of sigs) {
      if (s.required && isActive(name) && s.pad.isEmpty()) {
        s.pad.markInvalid();
        formError.textContent = 'חסרה חתימה. יש לחתום באזור המסומן.';
        formError.hidden = false;
        document.getElementById(`sig-${name}`).scrollIntoView({ block: 'center' });
        return false;
      }
    }
    return true;
  }

  function collect() {
    const data = {};
    new FormData(form).forEach((value, key) => {
      if (key !== 'treatments' && value !== '') data[key] = value;
    });
    data.treatments = selectedTreatments();
    data.signatures = {};
    for (const [name, s] of sigs) {
      if (isActive(name) && !s.pad.isEmpty()) data.signatures[name] = s.pad.toDataURL();
    }
    return data;
  }

  function showDone() {
    app.replaceChildren(h('div', { className: 'done' },
      h('h1', { textContent: 'הטופס נשלח למרפאה' }),
      h('p', { className: 'intro', textContent: 'תודה. אין צורך לעשות דבר נוסף. אפשר לסגור את העמוד.' })));
    window.scrollTo(0, 0);
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.hidden = true;
    if (!client || !validate()) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'שולחת…';
    try {
      const { error } = await client.from('submissions').insert({ form_version: F.VERSION, data: collect() });
      if (error) throw error;
      showDone();
    } catch (err) {
      console.error('submit failed', err && err.code);
      formError.textContent = 'השליחה נכשלה והטופס לא נשמר. התשובות שלך עדיין כאן. בדקי את החיבור לאינטרנט ולחצי שוב על שליחה.';
      formError.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'שליחת הטופס למרפאה';
    }
  });

  update();
})();
