// Demo overlay on top of the Proposal Studio build:
// 1) order list: colour accents + a one-line "what needs you" summary,
// 2) order screen: "what to check before Approve" panel built from the studio's own findings,
// 3) "+ Нова РК": scripted agent chat that shows how an order gets built, then opens it for review.
(function () {
  'use strict';

  var ORDER_SUFFIX = 'a7c94e1f8b2d4c6e9a0b3d5f';

  // Why each check matters, in plain Ukrainian. Keys are the studio's check ids.
  var WHY = {
    test_cell_budget_above_default: 'Бюджет однієї тестової комірки вищий за стандартний. Перевірте, що це свідомо: агент пояснює причину в нотатці до замовлення.',
    min_two_videos: 'Менше двох відеокреативів. Meta гірше оптимізує, коли відео одне або його немає зовсім.',
    texts_recommended_counts: 'Текстів менше, ніж радить Meta (5 основних, 5 заголовків, опис). Запуск не блокує, але звужує оптимізацію.',
    promote_audience_narrow: 'Вузька аудиторія: показів може бути мало, або вони будуть дорогими.',
    mismatch: 'Звірка показала, що в Meta стоїть не те, що в замовленні. Розберіться до запуску: Meta змінила налаштування без попередження.',
    creative_disapproved: 'Meta відхилила оголошення на модерації. Потрібен інший креатив або текст.',
    added: 'Meta сама додала налаштування, якого не було в замовленні. Зазвичай нешкідливо, але варто знати.',
    budget_jump: 'Бюджет зростає більш ніж наполовину за один раз. Різкий стрибок може скинути навчання адсету.',
    keywords_multiword: 'Мінус-слово з одного слова може відрізати потрібний трафік.'
  };
  var SEV = {
    urgent: { label: 'Терміново', rank: 0 },
    attention: { label: 'Перевірити', rank: 1 },
    note: { label: 'До відома', rank: 2 }
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return n + ' ' + one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return n + ' ' + few;
    return n + ' ' + many;
  }
  function onOrderList() {
    var h = location.hash;
    return h === '' || h === '#' || h === '#/' || h.indexOf('#/?') === 0;
  }
  function onOrder() { return /^#\/p\//.test(location.hash); }
  function goToOrder(id) { location.hash = '#/p/' + id + ORDER_SUFFIX; }

  // ---------------------------------------------------------------- order list
  function toneOf(a) {
    var text = a.innerText || '';
    if (a.querySelector('[data-live="issues"], [data-severity="urgent"]')) return 'urgent';
    if (/\battention\b/i.test(text)) return 'attention';
    if (/waits for Execute/i.test(text)) return 'execute';
    if (/pending review/i.test(text)) return 'clean';
    return null;
  }
  var TAG_TEXT = {
    urgent: 'проблема після запуску',
    attention: 'чекає Approve, є попередження',
    execute: 'чекає Execute',
    clean: 'чекає Approve'
  };

  function decorateList() {
    var counts = { urgent: 0, attention: 0, execute: 0, clean: 0 };
    document.querySelectorAll('a[class*="_card_"], a[class*="_row_"]').forEach(function (a) {
      var tone = toneOf(a);
      if (!tone) {
        a.removeAttribute('data-pso-tone');
        var stale = a.querySelector('.pso-tag');
        if (stale) stale.remove();
        return;
      }
      counts[tone]++;
      if (a.getAttribute('data-pso-tone') !== tone) {
        a.setAttribute('data-pso-tone', tone);
        var old = a.querySelector('.pso-tag');
        if (old) old.remove();
        var title = a.querySelector('[class*="_cardTitle_"], [class*="_rowTitle_"]');
        if (title) title.appendChild(el('span', 'pso-tag pso-tag--' + tone, TAG_TEXT[tone]));
      }
    });
    var launchedProblems = counts.urgent;

    var needs = Array.prototype.find.call(document.querySelectorAll('main *'), function (n) {
      return n.children.length <= 3 && /^Needs you/.test((n.textContent || '').trim());
    });
    if (!needs) return;
    var scrollBox = needs.closest('[class*="_scroll_"]');
    if (!scrollBox) return;
    var sig = [counts.urgent, counts.attention, counts.execute, counts.clean].join(',');
    var box = document.querySelector('.pso-summary');
    if (box && box.getAttribute('data-sig') === sig) return;
    if (!box) {
      box = el('div', 'pso-summary');
      scrollBox.insertBefore(box, scrollBox.firstChild);
    }
    box.setAttribute('data-sig', sig);
    box.textContent = '';
    box.appendChild(el('b', null, 'На що дивитися зараз:'));
    function item(tone, text) {
      var s = el('span', 'pso-sum-item');
      s.appendChild(el('span', 'pso-dot pso-dot--' + tone));
      s.appendChild(document.createTextNode(text));
      box.appendChild(s);
    }
    var review = counts.attention + counts.clean;
    if (review) item('attention', plural(review, 'замовлення чекає', 'замовлення чекають', 'замовлень чекають') + ' на Approve' + (counts.attention ? ', з них ' + counts.attention + ' з попередженнями' : ''));
    if (counts.execute) item('execute', plural(counts.execute, 'схвалене чекає', 'схвалені чекають', 'схвалених чекають') + ' на Execute');
    if (launchedProblems) item('urgent', plural(launchedProblems, 'запущене замовлення має', 'запущені замовлення мають', 'запущених замовлень мають') + ' проблему: див. Other orders нижче');
    if (!review && !counts.execute && !launchedProblems) item('clean', 'нічого не чекає на вас');
  }

  function ensureHeadButton() {
    if (!onOrderList()) return;
    var head = document.querySelector('main > header');
    if (!head || head.querySelector('.pso-new-btn')) return;
    var b = el('button', 'pso-new-btn pso-new-btn--head', '+ Нова РК');
    b.type = 'button';
    b.onclick = openChat;
    var anchorEl = head.querySelector('h1');
    if (anchorEl && anchorEl.nextSibling) head.insertBefore(b, anchorEl.nextSibling.nextSibling || null);
    else head.appendChild(b);
  }

  function ensureBarButton() {
    var bar = document.querySelector('.mv-bar');
    if (!bar) return;
    var existing = bar.querySelector('.pso-new-btn');
    if (existing) { existing.style.visibility = onOrderList() ? 'hidden' : ''; return; }
    var b = el('button', 'pso-new-btn', '+ Нова РК');
    b.type = 'button';
    b.onclick = openChat;
    var firstBtn = bar.querySelector('.mv-bar-btn');
    bar.insertBefore(b, firstBtn);
  }

  // ---------------------------------------------------------------- order screen
  var collapsed = {};

  function readFindings() {
    var out = [];
    document.querySelectorAll('aside a[href*="/check/"]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var key = decodeURIComponent(href.split('/check/')[1] || '').split(':')[1] || '';
      var dot = a.querySelector('[class*="_dot"]');
      var m = dot && dot.className.match(/_dot(Urgent|Attention|Note)_/);
      var sev = m ? m[1].toLowerCase() : 'note';
      var nameEl = a.querySelector('[class*="_name_"]');
      var title = nameEl ? (nameEl.getAttribute('title') || nameEl.firstChild.textContent) : a.innerText;
      var small = a.querySelector('small');
      out.push({ href: href, key: key, sev: sev, title: title, raw: small ? small.textContent : '' });
    });
    out.sort(function (x, y) { return SEV[x.sev].rank - SEV[y.sev].rank; });
    return out;
  }

  function decorateOrder() {
    var page = document.querySelector('main [class*="_centre_"] > [class*="_page_"]');
    var summary = page && page.querySelector(':scope > [class*="_summary_"]');
    if (!summary || !document.querySelector('aside')) return;
    var orderId = (location.hash.match(/#\/p\/([0-9a-f]+)/) || [])[1] || '';
    var findings = readFindings();
    var isDraft = /Pending your review|Approved by you/.test(summary.innerText || '');
    // On a check's own screen the panel starts folded so the check details stay in view.
    var activeCheck = (location.hash.split('/check/')[1] || '');
    var stateKey = orderId + (activeCheck ? '|check' : '');
    if (!(stateKey in collapsed)) collapsed[stateKey] = !!activeCheck;
    var sig = stateKey + '|' + activeCheck + '|' + isDraft + '|' + findings.map(function (f) { return f.sev + f.key + f.raw; }).join(';');

    var panel = page.querySelector('.pso-focus');
    if (panel && panel.getAttribute('data-sig') === sig) return;
    if (panel) panel.remove();
    if (!findings.length && !isDraft) return;

    var c = { urgent: 0, attention: 0, note: 0 };
    findings.forEach(function (f) { c[f.sev]++; });
    var tone = c.urgent ? 'urgent' : c.attention ? 'attention' : c.note ? 'note' : 'clean';

    panel = el('section', 'pso-focus');
    panel.setAttribute('data-sig', sig);
    panel.setAttribute('data-tone', tone);
    panel.setAttribute('aria-label', 'Що перевірити');
    var isCollapsed = collapsed[stateKey];
    panel.setAttribute('data-collapsed', String(isCollapsed));

    var head = el('div', 'pso-focus-head');
    var titleText = tone === 'clean'
      ? 'Перевірки пройдені, зауважень немає'
      : isDraft ? 'Що перевірити перед Approve' : 'На що звернути увагу';
    head.appendChild(el('span', 'pso-focus-title', titleText));
    var counts = el('span', 'pso-focus-counts');
    ['urgent', 'attention', 'note'].forEach(function (s) {
      if (!c[s]) return;
      var x = el('span');
      x.appendChild(el('span', 'pso-dot pso-dot--' + s));
      x.appendChild(document.createTextNode(SEV[s].label + ': ' + c[s]));
      counts.appendChild(x);
    });
    head.appendChild(counts);
    if (findings.length) {
      var tog = el('span', 'pso-focus-toggle', isCollapsed ? 'розгорнути ▾' : 'згорнути ▴');
      head.appendChild(tog);
      head.onclick = function () {
        collapsed[stateKey] = !collapsed[stateKey];
        panel.setAttribute('data-collapsed', String(collapsed[stateKey]));
        tog.textContent = collapsed[stateKey] ? 'розгорнути ▾' : 'згорнути ▴';
      };
    }
    panel.appendChild(head);

    if (findings.length) {
      var body = el('div', 'pso-focus-body');
      findings.forEach(function (f) {
        var a = el('a', 'pso-focus-item');
        a.href = f.href;
        if (activeCheck && f.href.indexOf('/check/' + activeCheck) >= 0) a.setAttribute('data-active', 'true');
        a.appendChild(el('span', 'pso-dot pso-dot--' + f.sev));
        var t = el('span', 'pso-focus-item-title');
        t.appendChild(el('span', 'pso-sev pso-sev--' + f.sev, SEV[f.sev].label));
        t.appendChild(document.createTextNode(f.title));
        a.appendChild(t);
        a.appendChild(el('span', 'pso-focus-item-go', 'показати ›'));
        if (WHY[f.key]) a.appendChild(el('span', 'pso-focus-item-why', WHY[f.key]));
        if (f.raw) a.appendChild(el('span', 'pso-focus-item-raw', f.raw));
        body.appendChild(a);
      });
      panel.appendChild(body);
      if (isDraft && !c.urgent) {
        panel.appendChild(el('div', 'pso-focus-foot',
          'Попередження не блокують Approve: студія лише просить переконатися, що це свідомо.'));
      }
    }

    page.insertBefore(panel, summary.nextSibling);
  }

  // ---------------------------------------------------------------- agent chat
  var SCENARIOS = [
    {
      id: 'promo',
      chip: 'Просунь 2 останні пости @moova.pl, $40 на тиждень',
      match: /промо|пост|рил|reel|post|promo|boost|просун/i,
      order: 'de300002',
      steps: [
        ['Читаю контракт студії', 'схема замовлення, карта ринків, політика промо'],
        ['Знаходжу пости', '@moova.pl: ринок PL. Обидва пости ще не просувались: перевірив журнал і живі адсети'],
        ['Беру форму з минулого запуску', 'SMM | PL @moova.pl | 04.08.26: та сама кампанія, новий адсет на кожен пост'],
        ['Збираю замовлення', '2 адсети, 2 оголошення, $40 на весь період, 7 днів, часовий пояс вказано явно'],
        ['Проганяю перевірки', 'усе пройдено, 1 нотатка: вузька аудиторія', 'warn'],
        ['Створюю замовлення і пишу нотатку «чому так»', 'для того, хто перевірятиме']
      ],
      result: {
        title: 'SMM promo: 2 posts | PL | 09.10.26',
        rows: [['Платформа', 'Meta, мета Engagement'], ['Структура', '2 адсети, 2 оголошення'], ['Бюджет', '$40 на 7 днів'], ['Перевірки', '1 нотатка, блокувань немає'], ['Запуск', 'усе створиться на паузі']]
      }
    },
    {
      id: 'test',
      chip: 'Креатив-тест на UK: 4 нові креативи, по $10 на день, 4 дні',
      match: /тест|test|креатив|creative/i,
      order: 'de300001',
      steps: [
        ['Читаю контракт студії', 'схема замовлення, карта ринків, правила креатив-тестів'],
        ['Підбираю креативи з бібліотеки', 'англійська, без банів у цьому кабінеті, сортування за CPA. Обрано 2101, 2102, 2104 (відео), 2112'],
        ['Пишу тексти', 'заголовок і основний текст на кожне оголошення, перевірка на стоп-слова, український переклад для рев\'ю'],
        ['Збираю замовлення', '4 адсети в наявній кампанії Creative Test | EN, по одному креативу в комірці. Відеокомірка $15 на день: відео вчиться повільніше'],
        ['Проганяю перевірки', '1 попередження: бюджет відеокомірки вищий за стандарт. 2 нотатки', 'warn'],
        ['Створюю замовлення і пишу нотатку «чому так»', 'пояснюю, чому відеокомірка дорожча']
      ],
      result: {
        title: 'Creative test batch 3 | EN-GB | 09.10.26',
        rows: [['Платформа', 'Meta, мета Sales'], ['Структура', '4 адсети, 4 оголошення'], ['Бюджет', '$45 на день, $180 за 4 дні'], ['Перевірки', '1 попередження, 2 нотатки']]
      }
    },
    {
      id: 'scale',
      chip: 'Масштабуй переможця тесту 2, решту постав на паузу',
      match: /масштаб|scale|переможц|winner|пауз/i,
      order: 'de300006',
      steps: [
        ['Читаю статистику тесту 2', 'витрати й реєстрації по кожному оголошенню, зібрані студією з Meta'],
        ['Визначаю переможця', 'найнижчий CPA при достатній кількості конверсій'],
        ['Збираю замовлення на зміни', '3 зміни: бюджет переможця вгору, двоє інших на паузу'],
        ['Проганяю перевірки', '2 попередження: бюджет росте більш ніж наполовину', 'warn'],
        ['Створюю замовлення на зміни', 'нічого не змінюється в Meta до Approve і Execute']
      ],
      result: {
        title: 'Scale the winner, pause the rest | EN test batch 2',
        rows: [['Тип', 'зміни в уже запущеній кампанії'], ['Зміни', '3'], ['Перевірки', '2 попередження про стрибок бюджету']]
      }
    },
    {
      id: 'google',
      chip: 'Google Search на Україну: домашні тренування, 500 грн на день',
      match: /google|search|пошук|ключов|keyword/i,
      order: 'de300008',
      steps: [
        ['Читаю контракт студії', 'для Google студія готує файл для Google Ads Editor, а не пише в кабінет напряму'],
        ['Підбираю ключові слова', '2 групи оголошень, фразові й точні відповідності, мінус-слова'],
        ['Пишу оголошення', '3 адаптивні пошукові оголошення українською'],
        ['Проганяю перевірки', '1 нотатка: мінус-слово з одного слова', 'warn'],
        ['Створюю замовлення', 'після Approve студія згенерує файл, у файлі все на паузі']
      ],
      result: {
        title: 'UA | Search | Home workouts | 12.10.26',
        rows: [['Платформа', 'Google Ads, через файл для Ads Editor'], ['Структура', '2 групи оголошень, 3 оголошення'], ['Бюджет', '500 грн на день']],
        hint: 'У демо це замовлення вже схвалене, тож ви побачите наступний крок: файл для Ads Editor.'
      }
    }
  ];

  function pickScenario(text) {
    var order = ['google', 'scale', 'test', 'promo'];
    for (var i = 0; i < order.length; i++) {
      var s = SCENARIOS.filter(function (x) { return x.id === order[i]; })[0];
      if (s.match.test(text)) return s;
    }
    return SCENARIOS[0];
  }

  var chatOpen = false;

  function openChat() {
    if (chatOpen) return;
    chatOpen = true;
    var busy = false;
    var timers = [];

    var back = el('div', 'pso-backdrop');
    var box = el('div', 'pso-chat');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Нова рекламна кампанія');

    var head = el('div', 'pso-chat-head');
    var ht = el('div');
    ht.appendChild(el('h2', null, 'Нова РК: опишіть словами, що запустити'));
    ht.appendChild(el('small', null, 'Агент збере повне замовлення. Нічого не піде в Meta чи Google, доки людина не перевірить його й не натисне Approve.'));
    head.appendChild(ht);
    var x = el('button', 'pso-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Закрити');
    head.appendChild(x);

    var log = el('div', 'pso-chat-log');
    var foot = el('div', 'pso-chat-foot');
    var chips = el('div', 'pso-chips');
    SCENARIOS.forEach(function (s) {
      var c = el('button', 'pso-chip', s.chip);
      c.type = 'button';
      c.onclick = function () { send(s.chip, s); };
      chips.appendChild(c);
    });
    var row = el('form', 'pso-input-row');
    var input = el('input', 'pso-input');
    input.placeholder = 'Наприклад: три укр рила, по $10 на тиждень';
    var sendBtn = el('button', 'pso-send', 'Надіслати');
    sendBtn.type = 'submit';
    row.appendChild(input);
    row.appendChild(sendBtn);
    row.onsubmit = function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (v) send(v, pickScenario(v));
    };
    foot.appendChild(chips);
    foot.appendChild(row);
    foot.appendChild(el('div', 'pso-disclaimer',
      'У справжній студії тут працює Claude через MCP. У демо відповіді заскриптовані: ваш запит зіставляється з найближчим прикладом.'));

    box.appendChild(head);
    box.appendChild(log);
    box.appendChild(foot);
    back.appendChild(box);
    document.body.appendChild(back);

    agentSay('Привіт! Напишіть, що треба запустити, як написали б колезі: рекламний кабінет, ринок, бюджет, строки. Або оберіть приклад нижче.');
    setTimeout(function () { input.focus(); }, 50);

    function close() {
      timers.forEach(clearTimeout);
      back.remove();
      document.removeEventListener('keydown', onKey, true);
      chatOpen = false;
    }
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', onKey, true);
    x.onclick = close;
    back.addEventListener('mousedown', function (e) { if (e.target === back) close(); });

    function scroll() { log.scrollTop = log.scrollHeight; }
    function agentWrap() {
      var m = el('div', 'pso-msg pso-msg--agent');
      m.appendChild(el('div', 'pso-who', 'Агент'));
      var b = el('div', 'pso-bubble');
      m.appendChild(b);
      log.appendChild(m);
      return b;
    }
    function agentSay(text) { agentWrap().textContent = text; scroll(); }
    function setBusy(v) {
      busy = v;
      input.disabled = v;
      sendBtn.disabled = v;
      chips.querySelectorAll('button').forEach(function (b) { b.disabled = v; });
    }

    function send(text, sc) {
      if (busy) return;
      setBusy(true);
      input.value = '';
      log.appendChild(el('div', 'pso-msg pso-msg--user', text));
      scroll();
      var bubble = agentWrap();
      bubble.appendChild(document.createTextNode('Беруся. Ось що роблю:'));
      var list = el('ul', 'pso-steps');
      bubble.appendChild(list);
      var t = 600;
      sc.steps.forEach(function (st, i) {
        var li = el('li', 'pso-step');
        li.appendChild(el('span', 'pso-step-icon'));
        li.appendChild(el('span', 'pso-step-title', st[0]));
        li.appendChild(el('span', 'pso-step-sub', st[1]));
        timers.push(setTimeout(function () {
          li.setAttribute('data-state', 'run');
          list.appendChild(li);
          scroll();
        }, t));
        t += 900 + (i === sc.steps.length - 2 ? 500 : 0);
        timers.push(setTimeout(function () { li.setAttribute('data-state', st[2] || 'done'); }, t));
      });
      timers.push(setTimeout(function () { showResult(sc); setBusy(false); }, t + 400));
    }

    function showResult(sc) {
      var bubble = agentWrap();
      bubble.appendChild(document.createTextNode('Готово. Замовлення чекає на вашу перевірку:'));
      var card = el('div', 'pso-result');
      card.appendChild(el('h3', null, sc.result.title));
      var dl = el('dl');
      sc.result.rows.forEach(function (r) {
        dl.appendChild(el('dt', null, r[0]));
        dl.appendChild(el('dd', null, r[1]));
      });
      card.appendChild(dl);
      var open = el('button', 'pso-open', 'Відкрити на рев\'ю →');
      open.type = 'button';
      open.onclick = function () { close(); goToOrder(sc.order); };
      card.appendChild(open);
      card.appendChild(el('div', 'pso-hint', sc.result.hint ||
        'Approve натискає тільки людина: в агента такої кнопки немає.'));
      bubble.appendChild(card);
      scroll();
    }
  }

  // ---------------------------------------------------------------- loop
  function tick() {
    try {
      ensureBarButton();
      if (onOrderList()) { ensureHeadButton(); decorateList(); }
      else if (onOrder()) decorateOrder();
    } catch (e) { /* the demo must keep working even if the overlay misreads the DOM */ }
  }
  setInterval(tick, 500);
  window.addEventListener('hashchange', function () { setTimeout(tick, 50); });
})();
