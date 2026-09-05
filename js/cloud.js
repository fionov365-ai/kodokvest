/* ============================================================
   Разговор с сервером прогресса. Ничего не знает про игру:
   умеет только «прочитай», «запиши», «список» и «проверь настройку».

   Все запросы простые: GET без своих заголовков и POST с телом-строкой.
   Это сделано намеренно — браузер не посылает предварительный запрос
   OPTIONS, и настройка CORS не может стать источником загадочных отказов.

   Ни одна ошибка отсюда не должна ломать игру: наверху всё в .catch().
   ============================================================ */
var Cloud = (function(){
  function cfg(){
    return (typeof CLOUD_CONFIG === "object" && CLOUD_CONFIG) ? CLOUD_CONFIG : { url:"", code:"" };
  }
  function url(){ return String(cfg().url || "").trim().replace(/\/+$/, ""); }

  /* Код ученика — настройка устройства, а не сайта: сайт-то один для всех.
     Сначала смотрим, что записано в этом браузере, и только потом берём
     значение из cloud-config.js как значение по умолчанию. */
  var CODE_KEY = "kodokvest_code";
  var CODE_RE = /^[a-z0-9][a-z0-9_-]{2,31}$/;
  function validCode(c){
    c = String(c || "").trim().toLowerCase();
    return CODE_RE.test(c) ? c : null;
  }
  function myCode(){
    var saved = null;
    try { saved = localStorage.getItem(CODE_KEY); } catch(e){}
    return validCode(saved) || validCode(cfg().code) || "";
  }
  function setCode(c){
    var v = validCode(c);
    if (!v) return false;
    try { localStorage.setItem(CODE_KEY, v); } catch(e){}
    return true;
  }
  function forgetCode(){ try { localStorage.removeItem(CODE_KEY); } catch(e){} }
  function hasUrl(){ return !!url(); }
  function configured(){ return !!(url() && myCode()); }
  function ready(){ return typeof fetch === "function" && !!url(); }

  function ask(params, body){
    if (!ready()) return Promise.reject(new Error("Сервер не настроен: не заполнен js/cloud-config.js."));
    var qs = Object.keys(params).map(function(k){
      return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
    }).join("&");
    var full = url() + (url().indexOf("?") >= 0 ? "&" : "?") + qs;
    /* тело передаём строкой без своих заголовков — fetch сам поставит text/plain */
    var opt = body === undefined ? { method:"GET" } : { method:"POST", body:body };
    return fetch(full, opt).then(function(r){
      return r.text().then(function(txt){
        var j = null;
        try { j = JSON.parse(txt); } catch(e){}
        if (!j) throw new Error("Сервер ответил не по формату (" + r.status + "): " +
                                String(txt).slice(0, 140));
        if (!r.ok || j.ok === false) throw new Error(j.error || ("Сервер ответил " + r.status));
        return j;
      });
    }, function(){
      throw new Error("Сервер недоступен. Проверь интернет и адрес функции в js/cloud-config.js.");
    });
  }

  return {
    configured: configured,
    hasUrl: hasUrl,
    url: url,
    myCode: myCode,
    setCode: setCode,
    forgetCode: forgetCode,
    validCode: validCode,
    ping: function(){ return ask({ op:"ping" }); },
    load: function(code){ return ask({ op:"load", code: code || myCode() }); },
    save: function(data, code){
      return ask({ op:"save", code: code || myCode() }, JSON.stringify(data));
    },
    list: function(key){ return ask({ op:"list", key: key || "" }); },
    stats: function(key){ return ask({ op:"stats", key: key || "" }); }
  };
})();
