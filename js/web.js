/* ============================================================
   Фионика — судья раздела «HTML и CSS».

   Решение фаундера 11.09.2026 (1.141.0): второй шаг HTML и CSS — раздел
   заданий, где страницу ребёнка проверяет не человек и не наш Python, а
   сам браузер. Только механика: задания — js/web-tasks.js, экраны —
   js/screens-web.js.

   ⚠️ КАК СУДИМ. Разметку разбирает встроенный DOMParser: документ получается
   «инертным» — картинки не грузятся, скрипты не выполняются, в сеть он не
   ходит. Это важно так же, как запертая рамка показа (js/studio.js): судья
   читает чужой HTML и не должен ничего по нему делать.
   А вот ОФОРМЛЕНИЕ мы читаем сами, маленьким разборщиком CSS, а не через
   getComputedStyle. Причин две:
     1) у инертного документа нет окна — браузер его не рисует, и
        вычисленных стилей у него попросту нет;
     2) тестовый браузер (jsdom) не разбирает таблицы стилей вовсе. Судья,
        который работает у ребёнка и молчит в тесте, — это судья, которого
        никто не проверял.
   Совпадение правила с элементом проверяет штатный el.matches — тот же
   движок селекторов, что у браузера.

   ⚠️ Упрощение, и оно честное: из двух подходящих правил побеждает то, что
   написано ПОЗЖЕ, без подсчёта специфичности. Атрибут style="…" сильнее
   любого правила. Для заданий раздела этого хватает — в них не бывает двух
   споров за одно свойство; если такие задания появятся, считать надо будет
   и специфичность.
   ============================================================ */
window.WEB = (function(){

  function parseHTML(src){
    return new DOMParser().parseFromString(String(src || ""), "text/html");
  }

  /* «color: red; font-size: 18px» → [{prop, val}]. !important отбрасываем:
     порядок правил мы и так соблюдаем, а спорить им не с кем. */
  function parseDecls(text){
    var out = [];
    String(text || "").split(";").forEach(function(part){
      var i = part.indexOf(":");
      if (i < 0) return;
      var prop = part.slice(0, i).trim().toLowerCase();
      var val = part.slice(i + 1).replace(/\s*!important\s*$/i, "").trim();
      if (prop && val) out.push({ prop: prop, val: val });
    });
    return out;
  }

  /* Текст таблицы стилей → [{sel, decls}] в порядке написания.
     @media и @supports раскрываются (правила внутри них — те же правила),
     остальные @-блоки (@font-face, @keyframes) и @import пропускаются. */
  function parseCSS(text){
    var src = String(text || "").replace(/\/\*[\s\S]*?\*\//g, ""), rules = [];
    (function walk(s){
      var pos = 0;
      while (pos < s.length){
        var open = s.indexOf("{", pos);
        if (open < 0) break;
        var head = s.slice(pos, open);
        var semi = head.lastIndexOf(";");
        if (semi >= 0) head = head.slice(semi + 1);        /* «@import …;» и мусор до правила */
        head = head.trim();
        if (head.charAt(0) === "@"){
          var depth = 1, j = open + 1;
          while (j < s.length && depth){
            if (s.charAt(j) === "{") depth++;
            else if (s.charAt(j) === "}") depth--;
            j++;
          }
          if (/^@(media|supports)\b/i.test(head)) walk(s.slice(open + 1, j - 1));
          pos = j;
          continue;
        }
        var close = s.indexOf("}", open);
        if (close < 0) close = s.length;
        if (head) rules.push({ sel: head, decls: parseDecls(s.slice(open + 1, close)) });
        pos = close + 1;
      }
    })(src);
    return rules;
  }

  /* Всё, чем пользуются проверки заданий. Каждая функция терпит null вместо
     элемента: проверка «у h1 задан цвет» на странице без h1 обязана сказать
     «нет», а не упасть. */
  function make(src){
    src = String(src || "");
    var doc = parseHTML(src), rules = [];
    Array.prototype.forEach.call(doc.querySelectorAll("style"), function(st){
      rules = rules.concat(parseCSS(st.textContent));
    });
    function list(p){ return Array.isArray(p) ? p : [p]; }
    function hit(el, sel){
      return sel.split(",").some(function(part){
        part = part.trim();
        if (!part) return false;
        try { return el.matches(part); } catch(e){ return false; }
      });
    }
    function fromDecls(decls, props){
      var v = null;
      decls.forEach(function(d){ if (props.indexOf(d.prop) >= 0) v = d.val; });
      return v;
    }
    function sheet(el, props){
      if (!el || !el.matches) return null;
      props = list(props);
      var v = null;
      rules.forEach(function(r){
        if (!hit(el, r.sel)) return;
        var x = fromDecls(r.decls, props);
        if (x !== null) v = x;
      });
      return v;
    }
    function inline(el, props){
      if (!el || !el.getAttribute) return null;
      return fromDecls(parseDecls(el.getAttribute("style") || ""), list(props));
    }
    /* inherit — для свойств, которые браузер наследует (цвет, шрифт,
       выравнивание): не нашли у элемента — смотрим у родителя. */
    function css(el, props, inherit){
      var e = el;
      while (e && e.nodeType === 1){
        var v = inline(e, props);
        if (v === null) v = sheet(e, props);
        if (v !== null) return v;
        if (!inherit) return null;
        e = e.parentElement;
      }
      return null;
    }
    function q(sel){ try { return doc.querySelector(sel); } catch(e){ return null; } }
    function qa(sel){
      try { return Array.prototype.slice.call(doc.querySelectorAll(sel)); } catch(e){ return []; }
    }
    return {
      src: src, doc: doc, rules: rules,
      q: q, qa: qa,
      n: function(sel){ return qa(sel).length; },
      text: function(el){ return el ? String(el.textContent || "").replace(/\s+/g, " ").trim() : ""; },
      attr: function(el, name){ return el && el.getAttribute ? String(el.getAttribute(name) || "").trim() : ""; },
      css: css, sheet: sheet, inline: inline,
      /* a стоит в документе раньше b */
      before: function(a, b){ return !!(a && b && (a.compareDocumentPosition(b) & 4)); },
      px: function(v){
        var m = /^(-?\d+(?:\.\d+)?)px$/i.exec(String(v || "").trim());
        return m ? parseFloat(m[1]) : NaN;
      }
    };
  }

  /* Итог по заданию: по пункту на каждую проверку, в том же порядке, в каком
     требования стоят на экране. Упавшая проверка — это «нет», а не поломка. */
  function judge(task, src){
    var W = make(src);
    return (task.checks || []).map(function(c){
      var ok = false;
      try { ok = !!c.f(W); } catch(e){ ok = false; }
      return { t: c.t, ok: ok };
    });
  }
  function passed(res){ return !!res.length && res.every(function(x){ return x.ok; }); }

  return { parseHTML: parseHTML, parseCSS: parseCSS, parseDecls: parseDecls,
           make: make, judge: judge, passed: passed };
})();
