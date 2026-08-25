/* ============================================================
   Программа курса: 5 миров, 100 уроков.
   Здесь только каркас — заголовки и порядок.
   Сам контент урока лежит в content/worldN.js и находится по id.
   Поле id менять нельзя: по нему сохраняется прогресс.
   ============================================================ */
var CURRICULUM = [
{
  n: 1, key: "start", title: "Первые шаги", icon: "🌱",
  desc: "От первой команды до собственной функции. Всё рисуется и запускается сразу.",
  engine: "mini",
  lessons: [
    { id:"print-first",   title:"Первая команда",        sub:"print и вывод на экран" },
    { id:"text-vs-num",   title:"Текст и числа",         sub:"чем строка отличается от числа" },
    { id:"vars",          title:"Переменные",            sub:"коробки для значений" },
    { id:"math",          title:"Арифметика",            sub:"порядок действий и остаток" },
    { id:"errors-read",   title:"Как читать ошибки",     sub:"красный текст — это подсказка" },
    { id:"fstrings",      title:"Строки и f-строки",     sub:"склеиваем текст с числами" },
    { id:"str-methods",   title:"Команды строк",         sub:"upper, split, replace и другие" },
    { id:"text-work",     title:"Разрезать и склеить",   sub:"работа с текстом на практике" },
    { id:"turtle-first",  title:"Черепашка",             sub:"код, который рисует" },
    { id:"turtle-pen",    title:"Цвет и перо",           sub:"палитра, толщина, пунктир" },
    { id:"for-range",     title:"Цикл for",              sub:"как не писать одно и то же" },
    { id:"range-step",    title:"range с шагом",         sub:"считаем через два и назад" },
    { id:"for-turtle",    title:"Цикл + черепашка",      sub:"многоугольники и спирали" },
    { id:"for-nested",    title:"Цикл в цикле",          sub:"узоры и таблицы" },
    { id:"if-else",       title:"Условия",               sub:"программа принимает решения" },
    { id:"logic",         title:"and, or, not",          sub:"составные условия" },
    { id:"lists-first",   title:"Списки",                sub:"много значений в одной коробке" },
    { id:"while-loop",    title:"Цикл while",            sub:"повторяй, пока не случится" },
    { id:"break-cont",    title:"break и continue",      sub:"и защита от вечного цикла" },
    { id:"functions",     title:"Функции",               sub:"своя команда с именем", boss:true }
  ]
},
{
  n: 2, key: "data", title: "Данные", icon: "📦",
  desc: "Списки, словари, множества и первые настоящие проекты по разбору информации.",
  engine: "mini",
  lessons: [
    { id:"list-ops",      title:"Список умеет расти",    sub:"append, pop, remove" },
    { id:"slices",        title:"Срезы",                 sub:"вырезаем кусок без цикла" },
    { id:"sorting",       title:"Сортировка",            sub:"sorted, sort и ключ" },
    { id:"grid",          title:"Двумерные списки",      sub:"сетка, поле, карта" },
    { id:"proj-field",    title:"Проект: игровое поле",  sub:"рисуем и заполняем клетки" },
    { id:"dict-first",    title:"Словари",               sub:"ключ и значение" },
    { id:"dict-loop",     title:"Перебор словаря",       sub:"items, keys, values" },
    { id:"dict-counter",  title:"Словарь-счётчик",       sub:"считаем повторы" },
    { id:"sets",          title:"Множества",             sub:"уникальные значения" },
    { id:"tuples",        title:"Кортежи",               sub:"неизменяемые наборы" },
    { id:"nested",        title:"Вложенные структуры",   sub:"список словарей" },
    { id:"comp-basic",    title:"Списковые включения",   sub:"цикл в одну строку" },
    { id:"comp-if",       title:"Включения с условием",  sub:"фильтр внутри строки" },
    { id:"comp-dict",     title:"Словарные включения",   sub:"строим словарь на лету" },
    { id:"lambda",        title:"lambda",                sub:"функция без имени" },
    { id:"text-stats",    title:"Статистика текста",     sub:"частоты слов и букв" },
    { id:"random",        title:"Случайность",           sub:"randint, choice, shuffle" },
    { id:"proj-pass",     title:"Проект: генератор паролей", sub:"случайность на практике" },
    { id:"proj-lyrics",   title:"Проект: разбор песни",  sub:"полный цикл обработки текста" },
    { id:"boss-db",       title:"База данных героев",    sub:"своя структура данных", boss:true }
  ]
},
{
  n: 3, key: "code", title: "Свой код", icon: "🛠",
  desc: "Функции всерьёз, поиск багов, тесты и первые классы. Здесь начинается инженерия.",
  engine: "mini",
  lessons: [
    { id:"fn-args",       title:"Параметры функций",     sub:"вход и выход" },
    { id:"fn-multi",      title:"Несколько результатов", sub:"возвращаем кортеж" },
    { id:"scope",         title:"Область видимости",     sub:"где живёт переменная" },
    { id:"fn-default",    title:"Значения по умолчанию", sub:"и знаменитая ловушка" },
    { id:"fn-varargs",    title:"*args и **kwargs",      sub:"любое число аргументов" },
    { id:"recursion",     title:"Рекурсия",              sub:"функция зовёт саму себя" },
    { id:"fn-as-value",   title:"Функция как значение",  sub:"передаём поведение" },
    { id:"modules-own",   title:"Свои модули",           sub:"разложить код по файлам" },
    { id:"try-except",    title:"try и except",          sub:"ловим ошибку и живём дальше" },
    { id:"raise",         title:"Свои исключения",       sub:"сообщаем о проблеме" },
    { id:"debug",         title:"Охота на баг",          sub:"как искать причину" },
    { id:"assert",        title:"Первые тесты",          sub:"assert и проверка сам себя" },
    { id:"spec-tests",    title:"Пиши по спецификации",  sub:"скрытые тесты как на работе" },
    { id:"class-first",   title:"Первый класс",          sub:"объект со своими данными" },
    { id:"class-methods", title:"Методы",                sub:"объект умеет действовать" },
    { id:"class-init",    title:"__init__ и __repr__",   sub:"рождение и внешний вид" },
    { id:"inherit",       title:"Наследование",          sub:"общее и особенное" },
    { id:"dataclass",     title:"dataclass",             sub:"класс без лишнего кода" },
    { id:"proj-game-oop", title:"Проект: игра на классах", sub:"персонажи и бой" },
    { id:"boss-lib",      title:"Своя библиотека",       sub:"набор функций для других", boss:true }
  ]
},
{
  n: 4, key: "real", title: "Настоящий Python", icon: "⚙️",
  desc: "Стандартная библиотека, файлы, генераторы и декораторы. С середины мира включается настоящий CPython.",
  engine: "mixed",
  lessons: [
    { id:"imports",       title:"import",                sub:"чужой код в своей программе" },
    { id:"math-random",   title:"math и random",         sub:"модули стандартной библиотеки" },
    { id:"datetime",      title:"Дата и время",          sub:"datetime на практике" },
    { id:"files-read",    title:"Чтение файлов",         sub:"with и построчный разбор" },
    { id:"files-write",   title:"Запись файлов",         sub:"сохраняем результат" },
    { id:"pathlib",       title:"pathlib",               sub:"пути без склейки строк" },
    { id:"json",          title:"JSON",                  sub:"формат обмена данными" },
    { id:"csv",           title:"CSV и таблицы",         sub:"данные из таблиц" },
    { id:"collections",   title:"collections",           sub:"Counter и defaultdict" },
    { id:"itertools",     title:"itertools",             sub:"комбинации и цепочки" },
    { id:"generators",    title:"Генераторы",            sub:"yield и ленивые вычисления", engine:"pyodide" },
    { id:"decorators",    title:"Декораторы",            sub:"обёртка вокруг функции", engine:"pyodide" },
    { id:"context",       title:"Контекстные менеджеры", sub:"свой with", engine:"pyodide" },
    { id:"regex",         title:"Регулярные выражения",  sub:"поиск по шаблону", engine:"pyodide" },
    { id:"typing",        title:"Подсказки типов",       sub:"код, понятный другим", engine:"pyodide" },
    { id:"pip-venv",      title:"pip и окружения",       sub:"чужие пакеты", engine:"pyodide" },
    { id:"read-code",     title:"Чтение чужого кода",    sub:"навык, о котором молчат", engine:"pyodide" },
    { id:"pep8",          title:"Стиль кода",            sub:"PEP 8 и читаемость", engine:"pyodide" },
    { id:"perf",          title:"Что тормозит",          sub:"сложность и измерения", engine:"pyodide" },
    { id:"boss-package",  title:"Свой пакет",            sub:"собрать и оформить", boss:true, engine:"pyodide" }
  ]
},
{
  n: 5, key: "pro", title: "Профессия", icon: "🚀",
  desc: "Четыре больших проекта, git и выход из тренажёра в настоящую разработку.",
  engine: "pyodide",
  lessons: [
    { id:"quest-1",       title:"Квест: замысел",        sub:"проектируем текстовую игру" },
    { id:"quest-2",       title:"Квест: комнаты",        sub:"структура данных мира" },
    { id:"quest-3",       title:"Квест: инвентарь",      sub:"состояние игрока" },
    { id:"quest-4",       title:"Квест: финал",          sub:"собираем и играем" },
    { id:"data-1",        title:"Данные: загрузка",      sub:"pandas и таблица" },
    { id:"data-2",        title:"Данные: чистка",        sub:"пропуски и мусор" },
    { id:"data-3",        title:"Данные: вопросы",       sub:"группировки и агрегаты" },
    { id:"data-4",        title:"Данные: графики",       sub:"визуализация выводов" },
    { id:"api-1",         title:"API: что это",          sub:"запрос и ответ" },
    { id:"api-2",         title:"API: разбор ответа",    sub:"JSON из интернета" },
    { id:"api-3",         title:"API: свой клиент",      sub:"обёртка над сервисом" },
    { id:"api-4",         title:"API: проект",           sub:"погода или курс валют" },
    { id:"web-1",         title:"Сайт: Flask",           sub:"первая страница" },
    { id:"web-2",         title:"Сайт: маршруты",        sub:"несколько страниц" },
    { id:"web-3",         title:"Сайт: формы",           sub:"данные от пользователя" },
    { id:"web-4",         title:"Сайт: публикация",      sub:"выложить в интернет" },
    { id:"git-1",         title:"git",                   sub:"история изменений" },
    { id:"git-2",         title:"GitHub",                sub:"код на виду" },
    { id:"docs",          title:"Как искать ответы",     sub:"документация и поиск" },
    { id:"final",         title:"Выпускной",             sub:"переносим проект на компьютер", boss:true }
  ]
}
];

/* ---------- служебные функции по программе ---------- */
(function(){
  var flat = [];
  CURRICULUM.forEach(function(w){
    w.lessons.forEach(function(l, i){
      l.world = w.n; l.pos = i + 1; l.num = (w.n - 1) * 20 + i + 1;
      l.engine = l.engine || (w.engine === "mixed" ? "mini" : w.engine);
      flat.push(l);
    });
  });
  CURRICULUM.flat = flat;
  CURRICULUM.byId = function(id){
    for (var i = 0; i < flat.length; i++) if (flat[i].id === id) return flat[i];
    return null;
  };
  CURRICULUM.world = function(n){
    for (var i = 0; i < CURRICULUM.length; i++) if (CURRICULUM[i].n === n) return CURRICULUM[i];
    return null;
  };
  CURRICULUM.total = flat.length;
})();

/* Порядок уроков первой волны — для переноса старого прогресса */
var LEGACY_ORDER = ["print-first","vars","fstrings","turtle-first","for-range",
                    "for-turtle","if-else","lists-first","while-loop","functions"];
