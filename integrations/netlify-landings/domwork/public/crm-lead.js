(function (global) {
  'use strict';
  function fullPhone(code, input) {
    const raw = String(input || '').trim();
    const digits = raw.replace(/\D/g, '');
    const prefix = code === '+7KZ' ? '+7' : code === 'other' ? '' : code;
    // Pasted international numbers already contain their country prefix.
    const full = raw.startsWith('+') || !prefix ? '+' + digits : prefix + digits;
    return /^\+[1-9]\d{6,14}$/.test(full) ? full : '';
  }
  function setup(config, source) {
    const form = document.getElementById('leadForm');
    const cc = document.getElementById('cc'), phone = document.getElementById('phone');
    const button = document.getElementById('submitBtn'), label = button.textContent;
    const error = document.createElement('p');
    error.id = 'crm-error'; error.hidden = true; error.setAttribute('role', 'alert');
    error.setAttribute('aria-live', 'assertive');
    error.style.cssText = 'color:#b91c1c;margin:0;line-height:1.5';
    button.before(error);
    // No country-specific mask silently discards digits or pasted prefixes.
    phone.removeAttribute('maxlength');
    const sync = () => {
      document.getElementById('f-tg').hidden = cc.value === '+998';
      phone.placeholder = cc.value === 'other' ? '+ davlat kodi va raqam' : 'Telefon raqamingiz';
    };
    cc.addEventListener('change', sync); sync();
    form.addEventListener('input', event => event.target.closest('.field')?.classList.remove('bad'));
    const attribution = {};
    try {
      const query = new URL(global.location.href).searchParams;
      for (const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid']) {
        const value = query.get(key); if (value) attribution[key] = value.slice(0,500);
      }
    } catch { /* no attribution */ }
    let busy = false, pending = null;
    const bad = (id, value) => {
      const field = document.getElementById(id);
      field.classList.toggle('bad', value);
      field.querySelector('input,select')?.setAttribute('aria-invalid', String(value));
    };
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      const name = form.elements.namedItem('name').value.trim();
      const number = fullPhone(cc.value, phone.value);
      const goal = form.querySelector('input[name="goal"]:checked')?.value;
      const time = form.querySelector('input[name="time"]:checked')?.value;
      bad('f-name', name.length < 2 || name.length > 120); bad('f-phone', !number);
      bad('f-goal', !goal); bad('f-time', !time);
      if (form.querySelector('.field.bad')) { form.querySelector('.field.bad input, .field.bad select')?.focus(); return; }
      const details = { name, phone: number, goal, time, telegram: form.elements.namedItem('telegram').value.trim() };
      const signature = JSON.stringify(details);
      if (!pending || pending.signature !== signature) pending = { signature, externalId: source + '_' + global.crypto.randomUUID() };
      busy = true; button.disabled = true; button.textContent = 'Yuborilmoqda…'; error.hidden = true;
      form.setAttribute('aria-busy','true');
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch('/.netlify/functions/lead', {
          method:'POST', headers:{'Content-Type':'application/json'}, signal:controller.signal,
          body:JSON.stringify({ ...details, ...attribution, externalId:pending.externalId,
            'bot-field':form.elements.namedItem('bot-field').value })
        });
        let result; try { result = await response.json(); } catch { /* non-JSON is failure */ }
        if (!response.ok || result?.ok !== true || (!result.id && !result.ignored))
          throw new Error(result?.error || 'Ariza tasdiqlanmadi. Qayta yuborib ko‘ring');
        // Keep existing Netlify Forms as a best-effort secondary copy AFTER CRM confirms.
        form.elements.namedItem('phone_full').value = number;
        form.elements.namedItem('page').value = global.location.href;
        for (const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])
          form.elements.namedItem(key).value = attribution[key] || '';
        const backupController = new AbortController();
        const backupTimer = setTimeout(() => backupController.abort(), 8000);
        fetch('/', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
          body:new URLSearchParams(new FormData(form)).toString(), signal:backupController.signal })
          .catch(() => {}).finally(() => clearTimeout(backupTimer));
        try { if (global.fbq) global.fbq('track','Lead'); } catch { /* optional analytics */ }
        document.getElementById('okName').textContent = name.split(' ')[0];
        const gift = document.getElementById(source === 'domwork' ? 'pdfBtn' : 'giftBtn');
        const url = source === 'domwork' ? config.PDF_URL : config.GIFT_URL;
        gift.href = url || config.TELEGRAM_ADMIN;
        if (!url) gift.textContent = source === 'domwork' ? 'PDF Telegram orqali yuboriladi' : "🎁 Sovg'ani Telegram'da olish";
        form.hidden = true;
        document.getElementById('success').hidden = false;
        document.getElementById('success').scrollIntoView({behavior:'smooth',block:'center'});
      } catch (failure) {
        error.textContent = failure.name === 'AbortError' ? 'So‘rov vaqti tugadi. Qayta yuboring; forma tozalanmagan.' : failure.message;
        error.hidden = false;
      } finally {
        clearTimeout(timer); busy = false; button.disabled = false; button.textContent = label;
        form.removeAttribute('aria-busy');
      }
    });
  }
  global.CRMLeadForm = { setup, fullPhone };
})(window);
