/* ============================================================
   Задачи-близнецы: материал домашней работы между занятиями.

   Зачем это вообще. Назначить домашкой пройденный урок нельзя: решение у
   ребёнка уже написано, и «сделать» его — значит открыть свой же ответ.
   Значит нужна задача НА ТУ ЖЕ КОНСТРУКЦИЮ, но с другими числами. Здесь она
   и лежит: близнец урока — то же умение, другое условие, другие числа.

   ⚠️ Правильный ответ никто не вводит руками. Программу пишет ШАБЛОН (поле
   code), движок её прогоняет и запоминает напечатанное — это и есть эталон.
   Ровно тот же приём, что в js/parent.js и в разделе «Своё задание»: автор
   не может ошибиться в ожидаемом выводе, потому что не называет его.

   ⚠️ Числа берутся из СЕМЕНИ (seed), а не из random: у одного ребёнка на
   планшете и у наставника в кабинете обязано выйти одно и то же условие.
   Тот же принцип, что у плана занятия («детерминирован по дате»).

   Устройство записи:
     id       свой, по нему хранится «сдано». Менять нельзя
     after    id урока, после которого задача становится доступной.
              ⚠️ Это не украшение: задача не должна требовать конструкции,
              которую курс ещё не объяснил. Проверяется тестом — такой урок
              обязан существовать в curriculum.js
     emoji    значок
     title    название задания
     tag      подпись на карточке: какое умение тренируем
     params   [{ k, min, max, step }] или { k, from:[...] } — откуда берутся числа
     fix      необязательно: поправить набор чисел, если они не годятся
              (например, конфет должно быть больше, чем детей)
     goal(v)  условие словами, с подставленными числами. Только текст:
              решающий не увидит программы, он поймёт задачу из этих слов
     list(v)  необязательно: требования списком
     code(v)  ЭТАЛОННАЯ программа. Её вывод и есть правильный ответ
     need     необязательно: какие куски кода обязаны быть в решении
              («def», «while»). Без этого задачу на функцию можно сдать
              тремя print с готовыми числами
     needMsg  что сказать, если need не выполнено
     starter  заготовка в редакторе
     hints    подсказки

   Правила (их проверяет tests/homework.js):
     - эталон обязан выполняться без ошибок на ЛЮБОМ семени;
     - эталон обязан что-то печатать, иначе сверять нечего;
     - никакой случайности и никакого input(): у ребёнка выпало бы другое;
     - эталон обязан удовлетворять собственному need;
     - заготовка НЕ должна давать правильный ответ сама;
     - after обязан быть настоящим id урока;
     - условие обязано называть все числа, которые нужны для решения.
   ============================================================ */
window.HOMEWORK = [

/* ---------- мир 1: первые шаги ---------- */
{
  id: "hw-klass",
  after: "math",
  emoji: "🏫",
  title: "Сколько человек в классе",
  tag: "арифметика",
  params: [{ k:"rows", min:3, max:8 }, { k:"desks", min:2, max:6 }, { k:"kids", min:2, max:3 }],
  goal: function(v){
    return "В классе " + v.rows + " " + ru(v.rows, "ряд", "ряда", "рядов") + ", в каждом ряду " +
           v.desks + " " + ru(v.desks, "парта", "парты", "парт") + ", за каждой партой " +
           v.kids + " " + ru(v.kids, "человек", "человека", "человек") +
           ". Напечатай одним числом, сколько человек в классе.";
  },
  list: function(){ return ["Печатается ровно одна строка — само число, без слов",
                            "Считать должна программа, а не ты в уме"]; },
  code: function(v){
    return "rows = " + v.rows + "\n" +
           "desks = " + v.desks + "\n" +
           "kids = " + v.kids + "\n" +
           "print(rows * desks * kids)\n";
  },
  starter: "rows = 0\ndesks = 0\nkids = 0\n# напечатай, сколько всего человек\n",
  hints: ["Три числа перемножаются между собой.",
          "Сначала положи каждое число в свою переменную, потом перемножь их в print."]
},

{
  id: "hw-konfety",
  after: "math",
  emoji: "🍬",
  title: "Конфеты поровну",
  tag: "деление с остатком",
  params: [{ k:"sweets", min:20, max:95 }, { k:"kids", min:3, max:9 }],
  fix: function(v){ if (v.sweets % v.kids === 0) v.sweets += 1; return v; },
  goal: function(v){
    return "Конфет " + v.sweets + ", детей " + v.kids +
           ". Раздаём поровну, ломать конфеты нельзя. Напечатай двумя строками: " +
           "сколько конфет достанется каждому, а второй строкой — сколько останется в вазе.";
  },
  list: function(){ return ["Две строки, в каждой только число",
                            "Первая строка — сколько каждому, вторая — сколько осталось"]; },
  code: function(v){
    return "sweets = " + v.sweets + "\n" +
           "kids = " + v.kids + "\n" +
           "print(sweets // kids)\n" +
           "print(sweets % kids)\n";
  },
  starter: "sweets = 0\nkids = 1\n# сколько каждому и сколько осталось\n",
  hints: ["Целая часть от деления — это //, а остаток — %.",
          "sweets // kids даёт «сколько каждому», sweets % kids — «сколько осталось»."]
},

{
  id: "hw-chek",
  after: "fstrings",
  emoji: "🧾",
  title: "Чек в магазине",
  tag: "f-строки",
  params: [{ k:"price", min:35, max:240 }, { k:"qty", min:3, max:12 }],
  goal: function(v){
    return "Один пакет сока стоит " + v.price + " ₽, купили " + v.qty + " " +
           ru(v.qty, "штуку", "штуки", "штук") +
           ". Напечатай одну строку ровно такого вида: «Итого: 350 ₽» — только вместо 350 " +
           "должна стоять настоящая сумма, посчитанная программой.";
  },
  list: function(){ return ["Одна строка: слово «Итого:», пробел, сумма, пробел, знак ₽",
                            "Сумму считает программа, а не ты"]; },
  code: function(v){
    return "price = " + v.price + "\n" +
           "qty = " + v.qty + "\n" +
           'print(f"Итого: {price * qty} ₽")\n';
  },
  starter: "price = 0\nqty = 0\n# напечатай строку «Итого: ... ₽»\n",
  hints: ["Внутри f-строки в фигурных скобках можно не только имя, но и целое действие.",
          'Получится f"Итого: {price * qty} ₽".']
},

{
  id: "hw-slovo",
  after: "text-work",
  emoji: "🔤",
  title: "Разбираем слово",
  tag: "команды строк",
  params: [{ k:"word", from:["черепаха", "программа", "клавиатура", "заголовок", "переменная"] }],
  goal: function(v){
    return "Возьми слово «" + v.word + "». Напечатай три строки: первой — это слово " +
           "заглавными буквами, второй — сколько в нём букв, третьей — это же слово, " +
           "но с буквой «а», заменённой на звёздочку.";
  },
  list: function(){ return ["Ровно три строки в этом порядке",
                            "Слово пишется в программе один раз, а дальше берётся из переменной"]; },
  code: function(v){
    return 'word = "' + v.word + '"\n' +
           "print(word.upper())\n" +
           "print(len(word))\n" +
           'print(word.replace("а", "*"))\n';
  },
  starter: 'word = ""\n# три строки: заглавными, сколько букв, с заменой\n',
  hints: ["Заглавные буквы делает .upper(), длину считает len().",
          'Замена — это .replace("а", "*"): что меняем, на что меняем.']
},

{
  id: "hw-summa-do",
  after: "for-range",
  emoji: "➕",
  title: "Сумма по порядку",
  tag: "цикл for",
  params: [{ k:"n", min:12, max:60 }],
  goal: function(v){
    return "Сложи все числа от 1 до " + v.n + " включительно и напечатай, что получилось. " +
           "Одно число, одна строка.";
  },
  list: function(){ return ["Складывать должен цикл, а не формула из учебника",
                            "Число " + "1 тоже входит в сумму, и последнее — тоже"]; },
  code: function(v){
    return "total = 0\n" +
           "for i in range(1, " + v.n + " + 1):\n" +
           "    total += i\n" +
           "print(total)\n";
  },
  need: ["for"],
  needMsg: "Сумму должен собрать цикл for: смысл задания в нём, а не в готовом ответе.",
  starter: "total = 0\n# цикл, который прибавляет к total каждое число\nprint(total)\n",
  hints: ["Заведи переменную-копилку до цикла и прибавляй к ней внутри.",
          "range(1, n + 1) даёт числа от 1 до n включительно: без «+ 1» последнее потеряется."]
},

{
  id: "hw-tablica",
  after: "range-step",
  emoji: "✖️",
  title: "Столбик умножения",
  tag: "цикл и f-строки",
  params: [{ k:"n", min:3, max:9 }],
  goal: function(v){
    return "Напечатай столбик умножения на " + v.n + ": десять строк вида «" +
           v.n + " x 1 = " + v.n + "», дальше «" + v.n + " x 2 = " + (v.n * 2) +
           "» и так до десяти. Знак умножения — латинская буква x, вокруг неё пробелы.";
  },
  list: function(){ return ["Ровно десять строк, от 1 до 10",
                            "Строки печатает цикл, а не десять команд print"]; },
  code: function(v){
    return "n = " + v.n + "\n" +
           "for i in range(1, 11):\n" +
           '    print(f"{n} x {i} = {n * i}")\n';
  },
  need: ["for"],
  needMsg: "Десять строк должен напечатать цикл — десять команд print это не решение задачи, а её обход.",
  starter: "n = 0\n# цикл от 1 до 10\n",
  hints: ["range(1, 11) даёт числа от 1 до 10.",
          'Внутри f-строки можно считать: f"{n} x {i} = {n * i}".']
},

{
  id: "hw-lesenka",
  after: "for-nested",
  emoji: "🪜",
  title: "Лесенка",
  tag: "цикл в цикле",
  params: [{ k:"n", min:4, max:9 }, { k:"ch", from:["*", "#", "+"] }],
  goal: function(v){
    return "Напечатай лесенку из " + v.n + " строк: в первой строке один знак «" + v.ch +
           "», во второй два, и так далее — в последней строке их " + v.n + ".";
  },
  list: function(){ return ["Строк ровно " + "столько, сколько ступенек",
                            "Никаких пробелов в начале строк"]; },
  code: function(v){
    return "n = " + v.n + "\n" +
           "for i in range(1, n + 1):\n" +
           '    print("' + v.ch + '" * i)\n';
  },
  need: ["for"],
  needMsg: "Лесенку должен построить цикл: строки, набранные руками, ничему не учат.",
  starter: "n = 0\n# цикл, который печатает ступеньки\n",
  hints: ["Строку можно умножить на число: знак повторится столько раз.",
          'В цикле номер строки i и есть длина ступеньки: print("*" * i).']
},

{
  id: "hw-bilet",
  after: "if-else",
  emoji: "🎟",
  title: "Цена билета",
  tag: "условия",
  params: [{ k:"age", min:4, max:17 }, { k:"full", min:200, max:600, step:50 }],
  goal: function(v){
    return "В музее такие правила: до 7 лет вход бесплатный, с 7 до 13 лет включительно — " +
           "половина цены, с 14 лет — полная цена " + v.full + " ₽. Посетителю " + v.age + " " +
           ru(v.age, "год", "года", "лет") + ". Напечатай одно число — сколько он заплатит.";
  },
  list: function(){ return ["Одна строка, только число",
                            "Возраст лежит в переменной, и правила проверяет программа"]; },
  code: function(v){
    return "age = " + v.age + "\n" +
           "full = " + v.full + "\n" +
           "if age < 7:\n" +
           "    print(0)\n" +
           "elif age < 14:\n" +
           "    print(full // 2)\n" +
           "else:\n" +
           "    print(full)\n";
  },
  need: ["if"],
  needMsg: "Правила должна проверять программа: одно напечатанное число — это ответ без задачи.",
  starter: "age = 0\nfull = 0\n# проверь правила и напечатай цену\n",
  hints: ["Три случая — значит if, elif и else.",
          "Половина цены — это full // 2, чтобы получилось целое число."]
},

{
  id: "hw-delitsya",
  after: "logic",
  emoji: "🔗",
  title: "И то, и другое",
  tag: "and, or, not",
  params: [{ k:"n", min:30, max:90 }, { k:"a", min:2, max:4 }, { k:"b", min:5, max:7 }],
  goal: function(v){
    return "Пройди все числа от 1 до " + v.n + " и напечатай те из них, которые делятся " +
           "и на " + v.a + ", и на " + v.b + " одновременно. Каждое число на своей строке, " +
           "по возрастанию.";
  },
  list: function(){ return ["Числа ищет программа, перебирая всё подряд",
                            "Если подходящих нет — не печатается ничего"]; },
  code: function(v){
    return "for i in range(1, " + v.n + " + 1):\n" +
           "    if i % " + v.a + " == 0 and i % " + v.b + " == 0:\n" +
           "        print(i)\n";
  },
  need: ["for", "and"],
  needMsg: "Нужен перебор циклом и составное условие с and — в этом и есть задание.",
  starter: "# перебери числа и напечатай подходящие\n",
  hints: ["«Делится» — значит остаток равен нулю: i % 3 == 0.",
          "Два условия соединяются словом and: оба должны быть верны."]
},

{
  id: "hw-ocenki",
  after: "lists-first",
  emoji: "📋",
  title: "Разбор оценок",
  tag: "списки",
  params: [{ k:"seedy", min:1, max:40 }, { k:"port", min:3, max:4 }],
  fix: function(v){
    /* список делаем из семени, но детерминированно и без random: числа
       раскладываются формулой, поэтому у ребёнка и у наставника он один */
    var xs = [], k = v.seedy;
    for (var i = 0; i < 8; i++){ k = (k * 37 + 11) % 5; xs.push(2 + k); }
    v.marks = xs;
    return v;
  },
  goal: function(v){
    return "Оценки за четверть: " + v.marks.join(", ") + ". Напечатай двумя строками: " +
           "первой — сумму всех оценок, второй — сколько среди них оценок «" + v.port + "» и выше.";
  },
  list: function(){ return ["Две строки, в каждой только число",
                            "Список записывается в программе один раз, дальше работает цикл"]; },
  code: function(v){
    return "marks = [" + v.marks.join(", ") + "]\n" +
           "total = 0\n" +
           "good = 0\n" +
           "for m in marks:\n" +
           "    total += m\n" +
           "    if m >= " + v.port + ":\n" +
           "        good += 1\n" +
           "print(total)\n" +
           "print(good)\n";
  },
  need: ["for"],
  needMsg: "Оценки нужно пройти циклом: посчитанные в уме числа не показывают, что ты умеешь.",
  starter: "marks = []\n# сумма и количество хороших оценок\n",
  hints: ["Заведи две копилки: одну для суммы, вторую для счётчика.",
          "Внутри цикла к сумме прибавляем всегда, а к счётчику — только если оценка подходит."]
},

{
  id: "hw-kopilka",
  after: "while-loop",
  emoji: "🐷",
  title: "Копилка",
  tag: "цикл while",
  params: [{ k:"price", min:1200, max:9000, step:100 }, { k:"week", min:150, max:700, step:50 }],
  goal: function(v){
    return "Вещь стоит " + v.price + " ₽, а откладывать получается " + v.week +
           " ₽ в неделю. Напечатай двумя строками: сколько недель придётся копить " +
           "и сколько денег накопится к этой неделе.";
  },
  list: function(){ return ["Две строки: сначала недели, потом накопленная сумма",
                            "Копить нужно, пока денег не хватит на покупку"]; },
  code: function(v){
    return "price = " + v.price + "\n" +
           "week = " + v.week + "\n" +
           "saved = 0\n" +
           "weeks = 0\n" +
           "while saved < price:\n" +
           "    saved += week\n" +
           "    weeks += 1\n" +
           "print(weeks)\n" +
           "print(saved)\n";
  },
  need: ["while"],
  needMsg: "Копить должен цикл while: заранее посчитанное число — не решение.",
  starter: "price = 0\nweek = 1\nsaved = 0\nweeks = 0\n# копи, пока не хватит\n",
  hints: ["Цикл продолжается, пока накоплено меньше цены: while saved < price.",
          "Внутри цикла и деньги растут, и счётчик недель увеличивается."]
},

{
  id: "hw-pervoe",
  after: "break-cont",
  emoji: "🎯",
  title: "Первое подходящее",
  tag: "break",
  params: [{ k:"start", min:40, max:200 }, { k:"k", min:6, max:19 }],
  goal: function(v){
    return "Найди первое число, которое больше " + v.start + " и делится на " + v.k +
           " без остатка. Напечатай его одной строкой и на этом остановись.";
  },
  list: function(){ return ["Одна строка, только число",
                            "Как только число найдено, цикл должен закончиться"]; },
  code: function(v){
    return "n = " + v.start + "\n" +
           "while True:\n" +
           "    n += 1\n" +
           "    if n % " + v.k + " == 0:\n" +
           "        print(n)\n" +
           "        break\n";
  },
  need: ["break"],
  needMsg: "Задание про остановку цикла: без break это другая задача.",
  starter: "n = 0\n# ищи, пока не найдёшь, и остановись\n",
  hints: ["Пробуй числа по очереди, начиная со следующего за данным.",
          "Как только условие сошлось — напечатай и выйди из цикла командой break."]
},

{
  id: "hw-funkciya",
  after: "functions",
  emoji: "🧩",
  title: "Своя команда",
  tag: "функции",
  params: [{ k:"a1", min:2, max:9 }, { k:"b1", min:2, max:9 },
           { k:"a2", min:10, max:20 }, { k:"b2", min:3, max:12 }],
  goal: function(v){
    return "Напиши функцию с именем perimetr, которая получает длину и ширину прямоугольника " +
           "и возвращает его периметр. Потом напечатай тремя строками периметры для сторон " +
           v.a1 + " и " + v.b1 + ", затем " + v.a2 + " и " + v.b2 + ", затем " +
           v.a1 + " и " + v.b2 + ".";
  },
  list: function(){ return ["Функция называется perimetr и именно возвращает результат, а не печатает его",
                            "Три строки — три вызова этой функции"]; },
  code: function(v){
    return "def perimetr(a, b):\n" +
           "    return (a + b) * 2\n" +
           "\n" +
           "print(perimetr(" + v.a1 + ", " + v.b1 + "))\n" +
           "print(perimetr(" + v.a2 + ", " + v.b2 + "))\n" +
           "print(perimetr(" + v.a1 + ", " + v.b2 + "))\n";
  },
  need: ["def", "return"],
  needMsg: "Задание про функцию: нужны def и return, иначе три числа можно просто напечатать.",
  starter: "def perimetr(a, b):\n    return 0\n\n# три вызова\n",
  hints: ["Периметр прямоугольника — это (a + b) * 2.",
          "Функция должна возвращать число словом return, а печатает пусть тот, кто её вызвал."]
},

/* ---------- мир 2: данные ---------- */
{
  id: "hw-spisok-rastet",
  after: "list-ops",
  emoji: "📦",
  title: "Список меняется",
  tag: "append и remove",
  params: [{ k:"add", min:11, max:40 }, { k:"drop", from:[3, 5, 7] }],
  fix: function(v){
    v.base = [3, 5, 7, 9];
    return v;
  },
  goal: function(v){
    return "Возьми список [3, 5, 7, 9]. Добавь в его конец число " + v.add +
           ", убери из него число " + v.drop + " и напечатай двумя строками: " +
           "сначала получившийся список целиком, потом сколько в нём стало чисел.";
  },
  list: function(){ return ["Две строки: сам список и его длина",
                            "Список должен измениться в программе, а не быть записан готовым"]; },
  code: function(v){
    return "nums = [3, 5, 7, 9]\n" +
           "nums.append(" + v.add + ")\n" +
           "nums.remove(" + v.drop + ")\n" +
           "print(nums)\n" +
           "print(len(nums))\n";
  },
  need: ["append", "remove"],
  needMsg: "Список нужно изменить командами append и remove, а не написать готовым.",
  starter: "nums = [3, 5, 7, 9]\n# добавь, убери, напечатай\n",
  hints: ["В конец добавляет .append(значение), убирает по значению .remove(значение).",
          "Напечатать список целиком можно прямо: print(nums)."]
},

{
  id: "hw-srezy",
  after: "slices",
  emoji: "✂️",
  title: "Три среза",
  tag: "срезы",
  params: [{ k:"first", min:2, max:4 }, { k:"last", min:2, max:3 }],
  fix: function(v){
    v.nums = [10, 20, 30, 40, 50, 60, 70, 80];
    return v;
  },
  goal: function(v){
    return "Список: [10, 20, 30, 40, 50, 60, 70, 80]. Напечатай тремя строками: " +
           "первые " + v.first + " числа, последние " + v.last + " числа и каждое второе число " +
           "с самого начала.";
  },
  list: function(){ return ["Три строки, в каждой печатается список",
                            "Всё делается срезами, без циклов"]; },
  code: function(v){
    return "nums = [10, 20, 30, 40, 50, 60, 70, 80]\n" +
           "print(nums[:" + v.first + "])\n" +
           "print(nums[-" + v.last + ":])\n" +
           "print(nums[::2])\n";
  },
  starter: "nums = [10, 20, 30, 40, 50, 60, 70, 80]\n# три среза\n",
  hints: ["Начало среза можно не писать: nums[:3] — это первые три.",
          "Отрицательный номер считает с конца, а третье число в срезе — это шаг."]
},

{
  id: "hw-top",
  after: "sorting",
  emoji: "🏆",
  title: "Тройка лучших",
  tag: "сортировка",
  params: [{ k:"seedy", min:1, max:60 }],
  fix: function(v){
    var xs = [], k = v.seedy;
    for (var i = 0; i < 7; i++){ k = (k * 41 + 17) % 90; xs.push(10 + k); }
    v.scores = xs;
    return v;
  },
  goal: function(v){
    return "Очки участников: " + v.scores.join(", ") + ". Напечатай двумя строками: " +
           "сначала список трёх лучших результатов по убыванию, потом сколько очков " +
           "у победителя.";
  },
  list: function(){ return ["Первая строка — список из трёх чисел",
                            "Вторая строка — одно число"]; },
  code: function(v){
    return "scores = [" + v.scores.join(", ") + "]\n" +
           "top = sorted(scores, reverse=True)\n" +
           "print(top[:3])\n" +
           "print(top[0])\n";
  },
  need: ["sorted"],
  needMsg: "Порядок должна навести сортировка, а не твои глаза: нужен sorted.",
  starter: "scores = []\n# три лучших и результат победителя\n",
  hints: ["sorted(список, reverse=True) выстраивает по убыванию и не портит исходный список.",
          "Три первых элемента отрезает срез [:3]."]
},

{
  id: "hw-korzina",
  after: "dict-loop",
  emoji: "🛒",
  title: "Корзина",
  tag: "словари",
  params: [{ k:"hleb", min:30, max:80 }, { k:"moloko", min:60, max:120 },
           { k:"syr", min:150, max:400, step:10 }],
  goal: function(v){
    return "В корзине: хлеб " + v.hleb + " ₽, молоко " + v.moloko + " ₽, сыр " + v.syr +
           " ₽. Сложи цены в словарь и напечатай двумя строками: общую сумму покупки " +
           "и название самого дорогого товара.";
  },
  list: function(){ return ["Две строки: число и слово",
                            "Названия товаров пиши по-русски маленькими буквами: хлеб, молоко, сыр"]; },
  code: function(v){
    return "korzina = {\"хлеб\": " + v.hleb + ", \"молоко\": " + v.moloko + ", \"сыр\": " + v.syr + "}\n" +
           "total = 0\n" +
           "dorogoy = \"\"\n" +
           "for name in korzina:\n" +
           "    total += korzina[name]\n" +
           "    if dorogoy == \"\" or korzina[name] > korzina[dorogoy]:\n" +
           "        dorogoy = name\n" +
           "print(total)\n" +
           "print(dorogoy)\n";
  },
  need: ["for"],
  needMsg: "Словарь нужно пройти циклом: сумма, посчитанная в уме, задание не решает.",
  starter: "korzina = {}\n# сумма и самый дорогой товар\n",
  hints: ["Перебор словаря даёт ключи: for name in korzina — это названия товаров.",
          "Цену по названию берут в квадратных скобках: korzina[name]."]
},

{
  id: "hw-glasnye",
  after: "dict-counter",
  emoji: "🔠",
  title: "Считаем гласные",
  tag: "словарь-счётчик",
  params: [{ k:"word", from:["информатика", "программирование", "переменная", "черепаха", "алгоритм"] }],
  goal: function(v){
    return "Слово «" + v.word + "». Посчитай, сколько в нём букв «а», «о» и «и», " +
           "и напечатай три строки вида «а: 3» — сначала про «а», потом про «о», потом про «и».";
  },
  list: function(){ return ["Три строки в этом порядке: а, о, и",
                            "Буква, двоеточие, пробел, число"]; },
  code: function(v){
    return 'word = "' + v.word + '"\n' +
           "schet = {\"а\": 0, \"о\": 0, \"и\": 0}\n" +
           "for ch in word:\n" +
           "    if ch in schet:\n" +
           "        schet[ch] += 1\n" +
           "for bukva in schet:\n" +
           '    print(f"{bukva}: {schet[bukva]}")\n';
  },
  need: ["for"],
  needMsg: "Буквы нужно пересчитать циклом, а не глазами.",
  starter: 'word = ""\n# посчитай а, о, и\n',
  hints: ["По слову можно идти циклом: for ch in word даёт по одной букве.",
          "Проверка «есть ли такой ключ» пишется словом in: if ch in schet."]
},

{
  id: "hw-vklyucheniya",
  after: "comp-if",
  emoji: "🧮",
  title: "Квадраты чётных",
  tag: "включения с условием",
  params: [{ k:"n", min:10, max:22 }],
  goal: function(v){
    return "Напечатай одной строкой список квадратов всех чётных чисел от 1 до " + v.n +
           " включительно. Собрать список нужно включением — той самой записью в одну строку.";
  },
  list: function(){ return ["Одна строка: список целиком",
                            "Список собирается включением, а не циклом с append"]; },
  code: function(v){
    return "kvadraty = [x * x for x in range(1, " + v.n + " + 1) if x % 2 == 0]\n" +
           "print(kvadraty)\n";
  },
  need: ["for"],
  needMsg: "Задание про включение: список обязан собираться записью в одну строку.",
  starter: "# собери список включением и напечатай\n",
  hints: ["Общий вид: [что берём for x in откуда if условие].",
          "Чётное — то, у которого остаток от деления на 2 равен нулю."]
},

/* ---------- мир 3: свой код ---------- */
{
  id: "hw-fn-skidka",
  after: "fn-args",
  emoji: "🏷",
  title: "Функция со скидкой",
  tag: "параметры функций",
  params: [{ k:"p1", min:300, max:900, step:50 }, { k:"d1", min:10, max:40, step:5 },
           { k:"p2", min:1000, max:2500, step:100 }, { k:"d2", min:5, max:25, step:5 }],
  goal: function(v){
    return "Напиши функцию skidka(cena, procent), которая возвращает новую цену после скидки. " +
           "Напечатай двумя строками цену " + v.p1 + " ₽ со скидкой " + v.d1 + "% и цену " +
           v.p2 + " ₽ со скидкой " + v.d2 + "%. Цена должна получаться целым числом.";
  },
  list: function(){ return ["Функция называется skidka и принимает два параметра",
                            "Две строки — два вызова"]; },
  code: function(v){
    return "def skidka(cena, procent):\n" +
           "    return cena - cena * procent // 100\n" +
           "\n" +
           "print(skidka(" + v.p1 + ", " + v.d1 + "))\n" +
           "print(skidka(" + v.p2 + ", " + v.d2 + "))\n";
  },
  need: ["def", "return"],
  needMsg: "Нужна именно функция с def и return: два напечатанных числа задание не решают.",
  starter: "def skidka(cena, procent):\n    return cena\n\n# два вызова\n",
  hints: ["Сама скидка в рублях — это cena * procent // 100.",
          "Новая цена — это цена минус скидка; двойной слэш оставляет целое число."]
},

{
  id: "hw-recursion",
  after: "recursion",
  emoji: "🔁",
  title: "Сумма цифр",
  tag: "рекурсия",
  params: [{ k:"n1", min:1000, max:99999 }, { k:"n2", min:100, max:999 }],
  goal: function(v){
    return "Напиши функцию sumcifr(n), которая складывает все цифры числа и возвращает сумму. " +
           "Функция обязана звать саму себя, циклов внутри быть не должно. " +
           "Напечатай двумя строками сумму цифр числа " + v.n1 + " и числа " + v.n2 + ".";
  },
  list: function(){ return ["Функция называется sumcifr",
                            "Внутри неё нет ни for, ни while — только вызов самой себя",
                            "Две строки — два числа"]; },
  code: function(v){
    return "def sumcifr(n):\n" +
           "    if n < 10:\n" +
           "        return n\n" +
           "    return n % 10 + sumcifr(n // 10)\n" +
           "\n" +
           "print(sumcifr(" + v.n1 + "))\n" +
           "print(sumcifr(" + v.n2 + "))\n";
  },
  need: ["def", "return"],
  needMsg: "Нужна функция с def и return, которая зовёт саму себя.",
  ban: ["for", "while"],
  banMsg: "В этом задании циклы запрещены нарочно: сумму цифр должна собрать рекурсия.",
  starter: "def sumcifr(n):\n    return 0\n\n# два вызова\n",
  hints: ["Последняя цифра числа — это n % 10, а всё остальное число — n // 10.",
          "Остановка нужна на однозначном числе: оно и есть своя сумма цифр."]
},

{
  id: "hw-class",
  after: "class-init",
  emoji: "🦸",
  title: "Класс героя",
  tag: "классы",
  params: [{ k:"hp", min:60, max:140, step:10 }, { k:"udar", min:12, max:35 },
           { k:"raz", min:2, max:4 }],
  goal: function(v){
    return "Напиши класс Geroy: при создании он получает запас здоровья, а метод udar(sila) " +
           "отнимает столько здоровья. Создай героя с " + v.hp + " здоровья, ударь его " +
           v.raz + " раза силой " + v.udar + " и напечатай, сколько здоровья осталось. " +
           "Одна строка, одно число.";
  },
  list: function(){ return ["Класс называется Geroy, метод — udar",
                            "Здоровье хранится внутри объекта, а не в отдельной переменной",
                            "Одна строка: остаток здоровья"]; },
  code: function(v){
    var body = "class Geroy:\n" +
               "    def __init__(self, hp):\n" +
               "        self.hp = hp\n" +
               "\n" +
               "    def udar(self, sila):\n" +
               "        self.hp -= sila\n" +
               "\n" +
               "g = Geroy(" + v.hp + ")\n";
    for (var i = 0; i < v.raz; i++) body += "g.udar(" + v.udar + ")\n";
    return body + "print(g.hp)\n";
  },
  need: ["class", "def"],
  needMsg: "Задание про класс: нужны class и метод, а не посчитанное число.",
  starter: "class Geroy:\n    def __init__(self, hp):\n        self.hp = hp\n\n# создай героя и бей\n",
  hints: ["Внутри __init__ значение запоминают через self: self.hp = hp.",
          "Метод меняет то же самое поле: self.hp -= sila."]
}
];

/* ---------- служебное: числа из семени ---------- */
(function(){
  /* Склонение по числу. Живёт здесь, а не в app.js, потому что условие задачи
     собирается из данных ещё до того, как его увидит экран. */
  function ru(n, one, few, many){
    n = Math.abs(n) % 100;
    var d = n % 10;
    if (n > 10 && n < 20) return many;
    if (d > 1 && d < 5) return few;
    if (d === 1) return one;
    return many;
  }
  window.ru = ru;

  /* Тот же хэш, что у ключей заданий в app.js: короткий, устойчивый, без
     зависимостей. Из него и берутся «случайные» числа — одинаковые везде,
     где известны id задачи и семя. */
  function hash(str){
    var h = 5381;
    for (var i = 0; i < String(str).length; i++)
      h = ((h * 33) ^ String(str).charCodeAt(i)) >>> 0;
    return h;
  }

  /* Набор чисел для одной задачи при данном семени. */
  function vals(item, seed){
    var v = {};
    (item.params || []).forEach(function(p, i){
      var h = hash(item.id + "|" + seed + "|" + p.k + "|" + i);
      if (Array.isArray(p.from)){ v[p.k] = p.from[h % p.from.length]; return; }
      var step = p.step || 1;
      var n = Math.floor((p.max - p.min) / step) + 1;
      v[p.k] = p.min + (h % n) * step;
    });
    if (typeof item.fix === "function") v = item.fix(v) || v;
    return v;
  }

  /* Собрать задание целиком. Ответ считает движок — здесь его не вводят.
     runner: функция, которая выполняет код и возвращает { lines, error }.
     В игре это Runtime.get("mini").run, в тестах — прямой вызов движка. */
  function build(item, seed, runner){
    var v = vals(item, seed);
    var code = item.code(v);
    var res = runner(code);
    if (!res || res.error) return { error: (res && res.error) || { msg:"программа не выполнилась" } };
    var lines = res.lines || [];
    if (!lines.length) return { error: { msg:"эталон ничего не напечатал" } };
    return {
      id: item.id, seed: seed, vals: v,
      title: item.title, emoji: item.emoji, tag: item.tag, after: item.after,
      goal: item.goal(v),
      list: typeof item.list === "function" ? item.list(v) : (item.list || []),
      lines: lines, starter: item.starter || "# твоя программа\n",
      need: item.need || [], needMsg: item.needMsg || "",
      ban: item.ban || [], banMsg: item.banMsg || "",
      hints: item.hints || []
    };
  }

  function byId(id){
    for (var i = 0; i < window.HOMEWORK.length; i++)
      if (window.HOMEWORK[i].id === id) return window.HOMEWORK[i];
    return null;
  }

  /* Какие задачи можно давать ребёнку, который прошёл вот эти уроки.
     Правило одно и жёсткое: задача открыта, если её урок-родитель пройден.
     Задать непройденное — значит отправить ребёнка к тому, чего ему не
     объясняли, и это будет наша вина, а не его. */
  function available(solvedIds){
    var done = {};
    (solvedIds || []).forEach(function(id){ done[id] = 1; });
    return window.HOMEWORK.filter(function(it){ return !!done[it.after]; });
  }

  window.HW = { vals: vals, build: build, byId: byId, available: available, hash: hash };
})();
