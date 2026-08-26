/* ============================================================
   Мир 4 «Настоящий Python» — содержание уроков.
   Ключ объекта = id из curriculum.js. Менять ключи нельзя.
   Схема урока описана в content/world1.js, новое — в README.

   Что появилось в этом мире:
     - файлы с данными: task.data и theory[i].data — {"имя.txt": "текст"}
       Файлы живут в памяти запуска, ученик видит их в панели «файлы на диске».
     - модули стандартной библиотеки: math, random, json, csv, datetime,
       collections, itertools, re, pathlib, statistics, time.

   Правило этого мира: ничего, что зависит от текущего времени
   (date.today(), datetime.now(), time.time()), в примерах и решениях
   не печатаем — иначе сверка с настоящим python3 невозможна.
   ============================================================ */
window.CONTENT = window.CONTENT || {};
CONTENT.world4 = {

"imports": {
  lede: "Свои модули в Мире 3 уже были. Теперь то же самое, но с чужими: <b>стандартная библиотека</b> — это готовый код, который лежит в Python с самого начала.",
  theory: [
    { h:"import берёт готовое",
      p:"Никто не пишет квадратный корень руками. Модуль <code>math</code> уже есть: подключил — пользуйся. Точно так же, как со своим <code>tools.py</code> из Мира 3, только файл лежит не рядом, а внутри Python.",
      demo:'import math\n\nprint(math.sqrt(144))\nprint(math.floor(3.7), math.ceil(3.2))\nprint(math.pi)' },
    { h:"Три способа записи",
      p:"<code>import math</code> — весь модуль, обращаться через точку. <code>from math import sqrt</code> — только нужное имя. <code>import math as m</code> — короткое имя. Первый способ понятнее: по коду сразу видно, откуда команда.",
      demo:'import math\nfrom math import sqrt, floor\nimport math as m\n\nprint(math.sqrt(16))\nprint(sqrt(16))\nprint(m.sqrt(16))\nprint(floor(2.9))' },
    { h:"Имя модуля — не переменная",
      p:"Модуль подключается один раз в начале файла. Если написать <code>math = 5</code>, имя займётся числом, и <code>math.sqrt</code> перестанет работать. Поэтому свои переменные так не называют.",
      demo:'import math\n\nmath = 5\nprint(math.sqrt(9))',
      err:true },
    { h:"Чего нет — того нет",
      p:"Если модуля не существует, Python скажет об этом сразу при импорте. В тренажёре доступны не все модули настоящего Python — только те, что нужны для уроков. Если модуль не найдётся и ошибку не поймать, в красной карточке будет список доступных.",
      demo:'try:\n    import telepathy\nexcept ImportError as e:\n    print("не нашлось:", e)\n\nimport math\nprint("а math на месте:", math.floor(9.9))' }
  ],
  task:{
    type:"code",
    goal:"Посчитай длину гипотенузы и площадь круга, пользуясь модулем <code>math</code>.",
    list:[
      "Подключи math через import",
      "hypot(a, b) — длина гипотенузы прямоугольного треугольника по теореме Пифагора",
      "circle(r) — площадь круга, округлённая до двух знаков",
      "В math уже есть готовый hypot — но сейчас собери его сам, из корня",
      "Строки с print менять не нужно"
    ],
    starter:'def hypot(a, b):\n    return 0\n\n\ndef circle(r):\n    return 0\n\n\nprint(hypot(3, 4))\nprint(hypot(5, 12))\nprint(circle(1))\nprint(circle(2.5))\n',
    solution:'import math\n\n\ndef hypot(a, b):\n    return math.sqrt(a * a + b * b)\n\n\ndef circle(r):\n    return round(math.pi * r * r, 2)\n\n\nprint(hypot(3, 4))\nprint(hypot(5, 12))\nprint(circle(1))\nprint(circle(2.5))\n',
    hints:[
      "Строка import math идёт в самом начале файла, до функций",
      "Теорема Пифагора: квадрат гипотенузы равен сумме квадратов катетов. Значит нужен корень из суммы квадратов",
      "Площадь круга — π на радиус в квадрате. Число π лежит в math.pi, а округляет round из Мира 1"
    ],
    check:{ kind:"output", needCode:["import"],
            needMsg:"Условие задания: считать нужно через модуль math, а не своими формулами." }
  }
},

"math-random": {
  lede: "Два самых частых модуля разом: <code>math</code> для точных вычислений и <code>random</code> для случайности. Заодно разберёмся, почему случайность в программе — управляемая.",
  theory: [
    { h:"math: что там есть",
      p:"Корень, факториал, наибольший общий делитель, числа π и e, модуль числа. Всё это уже написано и проверено — своё писать незачем.",
      demo:'import math\n\nprint(math.sqrt(2))\nprint(math.factorial(6))\nprint(math.gcd(24, 36))\nprint(round(math.pi, 3), round(math.e, 3))\nprint(math.fabs(-7))' },
    { h:"floor, ceil, round и trunc — разные вещи",
      p:"<code>floor</code> всегда вниз, <code>ceil</code> всегда вверх, <code>trunc</code> отбрасывает дробь, <code>round</code> округляет к ближайшему. У <code>round</code> есть особенность: половинки идут к чётному, поэтому <code>round(2.5)</code> это 2.",
      demo:'import math\n\nfor x in [2.5, 3.5, -2.5, 2.4, 2.6]:\n    print(x, "->", math.floor(x), math.ceil(x), math.trunc(x), round(x))' },
    { h:"random: случайность из модуля",
      p:"В Мире 2 <code>randint</code> и <code>choice</code> работали сразу — это было упрощение тренажёра. В настоящем Python их надо подключать: <code>import random</code>. Дальше всё как раньше.",
      demo:'import random\n\nrandom.seed(1)\nprint(random.randint(1, 6))\nprint(random.choice(["меч", "щит", "лук"]))\nnums = [1, 2, 3, 4, 5]\nrandom.shuffle(nums)\nprint(len(nums), sorted(nums))' },
    { h:"seed делает случайность повторяемой",
      p:"<code>random.seed(число)</code> задаёт начало последовательности. С одинаковым seed программа выдаёт одинаковые «случайные» числа — это нужно, чтобы искать ошибки и проверять решения. Без seed каждый запуск разный.",
      demo:'import random\n\nrandom.seed(42)\nfirst = [random.randint(1, 100) for i in range(5)]\nrandom.seed(42)\nsecond = [random.randint(1, 100) for i in range(5)]\nprint(first == second)\nprint(len(first), min(first) >= 1, max(first) <= 100)' },
    { h:"statistics: среднее и медиана",
      p:"Рядом стоит ещё один модуль — <code>statistics</code>. Среднее можно считать через <code>sum</code> и <code>len</code>, но медиану руками писать долго — а она уже есть. И обрати внимание: у целых чисел <code>mean</code> отдаёт целое, а не «6.0».",
      demo:'import statistics\n\nscores = [4, 8, 6, 10, 2]\nprint(statistics.mean(scores))\nprint(statistics.median(scores))\nprint(statistics.median([1, 2, 3, 4]))' }
  ],
  task:{
    type:"code",
    goal:"Собери отчёт по оценкам: среднее, медиана и разброс.",
    list:[
      "Подключи модуль statistics",
      "report(scores) возвращает строку «среднее 6, медиана 6, разброс 8»",
      "Среднее — через statistics.mean, округлить до одного знака. У целых чисел с целым средним mean отдаёт целое, поэтому в первой строке будет 6, а не 6.0",
      "Разброс — максимум минус минимум",
      "Строки с print менять не нужно"
    ],
    starter:'def report(scores):\n    return ""\n\n\nprint(report([4, 8, 6, 10, 2]))\nprint(report([5, 5, 5]))\nprint(report([1, 100]))\n',
    solution:'import statistics\n\n\ndef report(scores):\n    avg = round(statistics.mean(scores), 1)\n    mid = statistics.median(scores)\n    spread = max(scores) - min(scores)\n    return f"среднее {avg}, медиана {mid}, разброс {spread}"\n\n\nprint(report([4, 8, 6, 10, 2]))\nprint(report([5, 5, 5]))\nprint(report([1, 100]))\n',
    hints:[
      "statistics.mean(scores) даёт среднее, statistics.median(scores) — медиану",
      "Среднее округляем: round(statistics.mean(scores), 1)",
      "Собери строку f-строкой: f\"среднее {avg}, медиана {mid}, разброс {spread}\""
    ],
    check:{ kind:"output", needCode:["statistics"],
            needMsg:"По условию среднее и медиану берём из модуля statistics." }
  }
},

"datetime": {
  lede: "Дата — не строка. Если хранить «26.08.2026» текстом, к ней нельзя прибавить десять дней и нельзя сравнить с другой датой. Для этого есть модуль <code>datetime</code>.",
  theory: [
    { h:"date — просто дата",
      p:"Создаётся тремя числами: год, месяц, день. Печатается как <code>2026-08-26</code> — это международный стандарт ISO 8601, от большего к меньшему. У даты есть поля <code>year</code>, <code>month</code>, <code>day</code>, а метод <code>weekday()</code> отдаёт номер дня недели, считая с нуля: понедельник это 0, среда — 2.",
      demo:'from datetime import date\n\nd = date(2026, 8, 26)\nprint(d)\nprint(d.year, d.month, d.day)\nprint(d.weekday())' },
    { h:"strftime — своя запись",
      p:"Формат задаётся значками: <code>%d</code> день, <code>%m</code> месяц, <code>%Y</code> год, <code>%H</code> часы, <code>%M</code> минуты. Названия месяцев и дней Python пишет по-английски — так он устроен без дополнительной настройки. А <code>isoformat()</code> даёт ту самую стандартную запись <code>2026-08-26</code>.",
      demo:'from datetime import date\n\nd = date(2026, 8, 26)\nprint(d.strftime("%d.%m.%Y"))\nprint(d.strftime("%d/%m/%y"))\nprint(d.strftime("%A"))\nprint(d.strftime("%d %B %Y"))\nprint(d.isoformat())' },
    { h:"timedelta — срок",
      p:"Разница между датами и то, что можно к дате прибавить. Дни, часы, минуты, недели. Вычитание двух дат даёт как раз <code>timedelta</code>, у него есть поле <code>days</code>.",
      demo:'from datetime import date, timedelta\n\nstart = date(2026, 9, 1)\nend = date(2026, 9, 30)\nprint(end - start)\nprint((end - start).days)\nprint(start + timedelta(days=7))\nprint(start - timedelta(days=1))\nprint(start + timedelta(weeks=2))' },
    { h:"Даты сравниваются",
      p:"Больше, меньше, равно — всё работает. Значит даты можно сортировать обычным <code>sorted</code>, и не нужно ничего придумывать.",
      demo:'from datetime import date\n\nbirthdays = [date(2011, 5, 17), date(2010, 12, 1), date(2011, 1, 3)]\nprint(sorted(birthdays))\nprint(min(birthdays), max(birthdays))\nprint(date(2026, 1, 1) < date(2026, 2, 1))' },
    { h:"datetime — дата и время вместе",
      p:"То же самое, но с часами, минутами и секундами. Метод <code>date()</code> отрезает время. Про <code>datetime.now()</code>: он даёт текущий момент, поэтому в примерах его не печатают — вывод был бы каждый раз разный.",
      demo:'from datetime import datetime\n\nwhen = datetime(2026, 8, 26, 14, 30)\nprint(when)\nprint(when.hour, when.minute)\nprint(when.strftime("%H:%M %d.%m.%Y"))\nprint(when.date())\n\nnow = datetime.now()\nprint("сейчас известно:", now.year >= 2024)' }
  ],
  task:{
    type:"code",
    goal:"Посчитай, сколько дней осталось до каждого дня рождения в 2026 году, считая от 1 сентября.",
    list:[
      "days_left(start, when) возвращает число дней между двумя датами",
      "line(name, start, when) возвращает строку «аня: 15.09.2026, дней осталось: 14»",
      "Дату в строке печатать через strftime(\"%d.%m.%Y\")",
      "Если день рождения уже прошёл, число будет отрицательным — так и надо",
      "Цикл внизу менять не нужно"
    ],
    starter:'from datetime import date\n\n\ndef days_left(start, when):\n    return 0\n\n\ndef line(name, start, when):\n    return name\n\n\nstart = date(2026, 9, 1)\npeople = [("аня", date(2026, 9, 15)), ("боря", date(2026, 12, 31)), ("витя", date(2026, 8, 20))]\nfor name, when in people:\n    print(line(name, start, when))\n',
    solution:'from datetime import date\n\n\ndef days_left(start, when):\n    return (when - start).days\n\n\ndef line(name, start, when):\n    return f"{name}: {when.strftime(\'%d.%m.%Y\')}, дней осталось: {days_left(start, when)}"\n\n\nstart = date(2026, 9, 1)\npeople = [("аня", date(2026, 9, 15)), ("боря", date(2026, 12, 31)), ("витя", date(2026, 8, 20))]\nfor name, when in people:\n    print(line(name, start, when))\n',
    hints:[
      "Вычитание двух дат даёт timedelta, а у него есть поле days: (when - start).days",
      "В f-строке кавычки внутри должны быть другими: f\"{when.strftime('%d.%m.%Y')}\"",
      "В строку по порядку идут: имя, отформатированная дата, потом вызов days_left"
    ],
    check:{ kind:"output", needCode:["strftime"],
            needMsg:"По условию дату нужно печатать через strftime, а не собирать из полей вручную." }
  }
},

"files-read": {
  lede: "Программа перестаёт быть игрушкой, когда работает с настоящими данными. Данные лежат в файлах — научимся их читать.",
  theory: [
    { h:"Файлы урока видно справа",
      p:"В панели «файлы на диске» лежит <code>герои.txt</code>. Это настоящий файл для программы: его можно открыть, прочитать и разобрать. В тренажёре он живёт в памяти, но код точно такой же, как на компьютере.",
      data:{ "герои.txt": "аня 7 маг\nборя 9 воин\nвитя 5 лучник\n" },
      demo:'f = open("герои.txt")\nprint(f.read())\nf.close()' },
    { h:"with закрывает файл сам",
      p:"Открытый файл надо закрывать. Забыть легко, поэтому пишут <code>with</code>: он закроет файл сам, даже если внутри случится ошибка. Способ по умолчанию — других причин писать иначе почти не бывает. И ещё одна привычка: указывать <code>encoding=\"utf-8\"</code>. В тренажёре кодировка и так эта, а вот на Windows без указания русский текст может прочитаться мусором.",
      data:{ "герои.txt": "аня 7 маг\nборя 9 воин\nвитя 5 лучник\n" },
      demo:'with open("герои.txt", encoding="utf-8") as f:\n    text = f.read()\n\nprint(len(text), "знаков")\nprint(repr(text[:12]))\nprint(f.closed)' },
    { h:"По файлу можно идти циклом",
      p:"Это самый частый способ: строка за строкой, не загружая весь файл в память. Осторожно: у каждой строки на конце остаётся <code>\\n</code>, поэтому почти всегда пишут <code>strip()</code>.",
      data:{ "герои.txt": "аня 7 маг\nборя 9 воин\nвитя 5 лучник\n" },
      demo:'with open("герои.txt") as f:\n    for line in f:\n        print(repr(line))\n\nprint("--- и без лишнего ---")\nwith open("герои.txt") as f:\n    for line in f:\n        print(line.strip())' },
    { h:"Разбор строки",
      p:"Прочитали строку — разобрали на части знакомым <code>split()</code>. Числа приходят текстом, поэтому <code>int</code> обязателен: <code>\"7\" * 2</code> даст «77», а не 14.",
      data:{ "герои.txt": "аня 7 маг\nборя 9 воин\nвитя 5 лучник\n" },
      demo:'total = 0\nwith open("герои.txt") as f:\n    for line in f:\n        name, power, kind = line.split()\n        total += int(power)\n        print(f"{name:8} {kind:8} {power}")\nprint("всего силы:", total)' },
    { h:"Файла может не быть",
      p:"Обращение к несуществующему файлу — ошибка <code>FileNotFoundError</code>. Это как раз тот случай, когда пригодится <code>try</code> из Мира 3: программа не должна падать из-за отсутствующего файла.",
      data:{ "герои.txt": "аня 7 маг\n" },
      demo:'try:\n    with open("нет-такого.txt") as f:\n        print(f.read())\nexcept FileNotFoundError:\n    print("файла нет, работаю без него")\n\nwith open("герои.txt") as f:\n    print("а этот есть:", f.read().strip())' }
  ],
  task:{
    type:"code",
    goal:"Прочитай <code>оценки.txt</code> и посчитай средний балл каждого ученика.",
    list:[
      "В файле строки вида «аня 5 4 5 3»: имя и оценки через пробел",
      "Для каждой строки напечатать «аня: средний 4.25»",
      "Средний балл округлить до двух знаков",
      "В конце напечатать «лучший: имя» — у кого средний больше всех",
      "Открытие файла в заготовке уже есть: оценки надо превратить в числа и посчитать"
    ],
    data:{ "оценки.txt": "аня 5 4 5 3\nборя 3 3 4\nвитя 5 5 5 4 5\n" },
    starter:'best_name = ""\nbest_avg = 0\n\nwith open("оценки.txt") as f:\n    for line in f:\n        parts = line.split()\n        name = parts[0]\n        marks = parts[1:]\n        print(name, marks)\n\nprint("лучший:", best_name)\n',
    solution:'best_name = ""\nbest_avg = 0\n\nwith open("оценки.txt") as f:\n    for line in f:\n        parts = line.split()\n        name = parts[0]\n        marks = [int(m) for m in parts[1:]]\n        avg = round(sum(marks) / len(marks), 2)\n        print(f"{name}: средний {avg}")\n        if avg > best_avg:\n            best_avg = avg\n            best_name = name\n\nprint("лучший:", best_name)\n',
    hints:[
      "parts[1:] — это срез: все оценки без имени. Но они строки, их надо превратить в числа",
      "Включением это одна строка: marks = [int(m) for m in parts[1:]]",
      "Средний балл: round(sum(marks) / len(marks), 2). Лучшего запоминай в двух переменных сверху"
    ],
    check:{ kind:"output", needCode:["open"],
            needMsg:"Оценки нужно прочитать из файла через open, а не вписать в код." }
  }
},

"files-write": {
  lede: "Программа, которая только читает, — половина дела. Теперь научимся сохранять результат так, чтобы он остался после закрытия программы.",
  theory: [
    { h:"Режим «w» — писать с нуля",
      p:"Второй аргумент <code>open</code> — режим. <code>\"w\"</code> означает «писать»: если файла нет, он появится, а если есть — <b>его содержимое стирается сразу</b>. Это самая частая потеря данных у новичков.",
      demo:'with open("отчёт.txt", "w") as f:\n    f.write("первая строка\\n")\n    f.write("вторая строка\\n")\n\nwith open("отчёт.txt") as f:\n    print(f.read())' },
    { h:"write не добавляет перевод строки",
      p:"<code>print</code> сам переводит строку, а <code>write</code> — нет. Забудешь <code>\\n</code> — всё склеится в одну строку. Ещё <code>write</code> возвращает число записанных знаков, это иногда удобно.",
      demo:'with open("склейка.txt", "w") as f:\n    f.write("раз")\n    f.write("два")\n    n = f.write("три")\n\nprint("записали знаков:", n)\nwith open("склейка.txt") as f:\n    print(repr(f.read()))' },
    { h:"Режим «a» — дописать в конец",
      p:"<code>\"a\"</code> от слова append: старое остаётся, новое добавляется в конец. Так ведут журналы: каждый запуск дописывает свою строку.",
      demo:'with open("журнал.txt", "w") as f:\n    f.write("начало\\n")\n\nfor i in range(3):\n    with open("журнал.txt", "a") as f:\n        f.write(f"шаг {i}\\n")\n\nwith open("журнал.txt") as f:\n    print(f.read())' },
    { h:"Сразу список строк",
      p:"<code>writelines</code> пишет список целиком — но переводы строк всё равно твоя забота. Часто удобнее собрать текст через <code>join</code> и записать одним <code>write</code>.",
      demo:'rows = ["аня,5\\n", "боря,4\\n"]\nwith open("таблица.txt", "w") as f:\n    f.writelines(rows)\n\nlines = ["первая", "вторая", "третья"]\nwith open("текст.txt", "w") as f:\n    f.write("\\n".join(lines) + "\\n")\n\nwith open("текст.txt") as f:\n    print(f.read())' }
  ],
  task:{
    type:"fix",
    goal:"Программа должна вести журнал: записать заголовок, а потом дописать три шага. В журнале должно оказаться четыре строки.",
    symptom:"В журнале остаётся только одна строка — «шаг 2». Заголовок и первые два шага куда-то пропадают.",
    list:[
      "Найди и исправь одну ошибку, не переписывая программу",
      "Строки с print и цикл трогать не нужно",
      "Подумай, чем отличаются режимы \"w\" и \"a\""
    ],
    starter:'with open("журнал.txt", "w") as f:\n    f.write("журнал работ\\n")\n\nfor i in range(3):\n    with open("журнал.txt", "w") as f:\n        f.write(f"шаг {i}\\n")\n\nwith open("журнал.txt") as f:\n    print(f.read())\n',
    solution:'with open("журнал.txt", "w") as f:\n    f.write("журнал работ\\n")\n\nfor i in range(3):\n    with open("журнал.txt", "a") as f:\n        f.write(f"шаг {i}\\n")\n\nwith open("журнал.txt") as f:\n    print(f.read())\n',
    hints:[
      "Открой файл в панели справа после запуска и посмотри, что в нём осталось",
      "Режим \"w\" стирает содержимое при каждом открытии — а открываем мы его в цикле",
      "Дописывать в конец умеет режим \"a\": with open(\"журнал.txt\", \"a\") as f"
    ],
    check:{ kind:"output", fixBudget:2 }
  }
},

"pathlib": {
  lede: "Путь к файлу — это не просто строка. Склеивать пути руками через <code>+</code> — источник ошибок, поэтому в Python есть <code>pathlib</code>.",
  theory: [
    { h:"Path вместо строки",
      p:"<code>Path</code> знает, что он путь. Части соединяются знаком дробной черты: в коде всегда пишут <code>/</code>, а печатается путь так, как принято в системе — на Windows будет обратная черта.",
      demo:'from pathlib import Path\n\np = Path("данные") / "герои.txt"\nprint(p)\nprint(Path("папка") / "вложенная" / "файл.txt")' },
    { h:"Разбор имени",
      p:"У пути есть готовые части: <code>name</code> — имя с расширением, <code>stem</code> — без расширения, <code>suffix</code> — только расширение, <code>parent</code> — папка. Руками через <code>split(\".\")</code> это делать больше не нужно.",
      demo:'from pathlib import Path\n\np = Path("данные") / "отчёт.2026.txt"\nprint("name:", p.name)\nprint("stem:", p.stem)\nprint("suffix:", p.suffix)\nprint("parent:", p.parent)\nprint(Path("readme").suffix == "")' },
    { h:"Чтение и запись одной строкой",
      p:"Для маленьких файлов <code>read_text</code> и <code>write_text</code> короче, чем <code>open</code> с <code>with</code>: файл открывается и закрывается сам. На настоящем компьютере им тоже передают <code>encoding=\"utf-8\"</code>.",
      data:{ "письмо.txt": "привет\nэто письмо\n" },
      demo:'from pathlib import Path\n\np = Path("письмо.txt")\nprint(p.exists())\nprint(p.read_text())\n\nnew = Path("ответ.txt")\nnew.write_text("получил, спасибо\\n")\nprint(new.read_text())\nprint(new.exists(), Path("нет-такого.txt").exists())' },
    { h:"Замена расширения",
      p:"<code>with_suffix</code> делает новый путь с другим расширением — обычная задача, когда из <code>.txt</code> получается <code>.csv</code>, а из <code>фото.png</code> — <code>фото.jpg</code>.",
      demo:'from pathlib import Path\n\np = Path("таблица.txt")\nprint(p.with_suffix(".csv"))\nprint(Path("данные/отчёт.txt").with_suffix(".json"))\nprint(p.with_suffix(".csv").name)' }
  ],
  task:{
    type:"code",
    goal:"Разбери список путей и собери из них отчёт.",
    list:[
      "describe(path) возвращает строку «отчёт.txt: имя отчёт, тип txt, папка данные»",
      "Если у файла нет расширения, тип пишем «нет»",
      "Если файл лежит без папки, папка получится «.» — так решает сам pathlib",
      "Пользуйся Path, а не split по точкам и косым чертам",
      "Цикл внизу менять не нужно"
    ],
    starter:'from pathlib import Path\n\n\ndef describe(path):\n    return str(path)\n\n\nfor raw in ["данные/отчёт.txt", "readme", "img/лого.png", "заметки.md"]:\n    print(describe(Path(raw)))\n',
    solution:'from pathlib import Path\n\n\ndef describe(path):\n    kind = path.suffix[1:] if path.suffix else "нет"\n    return f"{path.name}: имя {path.stem}, тип {kind}, папка {path.parent}"\n\n\nfor raw in ["данные/отчёт.txt", "readme", "img/лого.png", "заметки.md"]:\n    print(describe(Path(raw)))\n',
    hints:[
      "path.suffix даёт расширение вместе с точкой: «.txt». Убрать точку поможет срез [1:]",
      "Пустая строка — ложь, поэтому короткий if: path.suffix[1:] if path.suffix else \"нет\"",
      "Остальное собирается f-строкой из path.name, path.stem и path.parent"
    ],
    check:{ kind:"output", needCode:["suffix"],
            needMsg:"Разбирать путь нужно средствами Path (name, stem, suffix, parent), а не split." }
  }
},

"json": {
  lede: "JSON — то, на чём разговаривают программы в интернете. Внутри это знакомые словари и списки, только записанные текстом.",
  theory: [
    { h:"dumps: из Python в текст",
      p:"<code>json.dumps</code> превращает словарь в строку. По умолчанию русские буквы прячутся в коды вида <code>\\u0430</code> — так безопаснее для старых систем. Чтобы читалось глазами, добавляют <code>ensure_ascii=False</code>.",
      demo:'import json\n\nhero = {"имя": "аня", "сила": 7, "жив": True, "оружие": None}\nprint(json.dumps(hero))\nprint(json.dumps(hero, ensure_ascii=False))' },
    { h:"Отступы для человека",
      p:"<code>indent=2</code> раскладывает JSON по строкам. Так его читают люди; программам отступы не нужны, и для передачи по сети их не ставят — лишние байты.",
      demo:'import json\n\ndata = {"герои": [{"имя": "аня", "сила": 7}, {"имя": "боря", "сила": 9}], "мир": 1}\nprint(json.dumps(data, ensure_ascii=False, indent=2))' },
    { h:"loads: из текста в Python",
      p:"Обратное превращение. Важно, что получается: <code>true</code> становится <code>True</code>, <code>null</code> — <code>None</code>, объект — словарём, массив — списком. Дальше это обычные данные Python.",
      demo:'import json\n\ntext = \'{"имя": "боря", "сила": 9, "жив": true, "оружие": null, "теги": ["воин", "север"]}\'\nhero = json.loads(text)\nprint(hero)\nprint(hero["имя"], hero["сила"] * 2)\nprint(hero["жив"], hero["оружие"])\nprint(type(hero).__name__, type(hero["теги"]).__name__)' },
    { h:"JSON в файл и обратно",
      p:"Читать и писать можно сразу файлом: <code>json.dump</code> и <code>json.load</code> — без буквы s на конце. Так хранят настройки, сохранения игр и всё, что должно пережить закрытие программы.",
      demo:'import json\n\nsave = {"уровень": 3, "герой": {"имя": "аня", "hp": 18}, "вещи": ["меч", "зелье"]}\nwith open("сейв.json", "w") as f:\n    json.dump(save, f, ensure_ascii=False, indent=2)\n\nwith open("сейв.json") as f:\n    loaded = json.load(f)\n\nprint(loaded == save)\nprint(loaded["герой"]["hp"], loaded["вещи"][0])' },
    { h:"Не всё превращается в JSON",
      p:"JSON знает только числа, строки, логические значения, списки, словари и <code>None</code>. Множество или свой объект он записать не умеет — придётся сначала превратить их в список или словарь.",
      demo:'import json\n\nprint(json.dumps({"числа": [1, 2, 3]}))\nprint(json.dumps({"набор": {1, 2, 3}}))',
      err:true }
  ],
  task:{
    type:"code",
    goal:"Прочитай сохранение игры из JSON, измени его и запиши обратно.",
    list:[
      "Прочитать сейв.json в переменную",
      "Прибавить герою 5 к hp и добавить в вещи «щит»",
      "Увеличить уровень на единицу",
      "Записать обратно в сейв.json с ensure_ascii=False и indent=2",
      "Отладочную печать print(save) из заготовки убрать: в выводе должен остаться только текст файла",
      "Чтение и запись в заготовке уже написаны"
    ],
    data:{ "сейв.json": '{\n  "уровень": 3,\n  "герой": {\n    "имя": "аня",\n    "hp": 18\n  },\n  "вещи": [\n    "меч",\n    "зелье"\n  ]\n}' },
    starter:'import json\n\nwith open("сейв.json") as f:\n    save = json.load(f)\n\nprint(save)\n\nwith open("сейв.json", "w") as f:\n    json.dump(save, f, ensure_ascii=False, indent=2)\n\nwith open("сейв.json") as f:\n    print(f.read())\n',
    solution:'import json\n\nwith open("сейв.json") as f:\n    save = json.load(f)\n\nsave["герой"]["hp"] += 5\nsave["вещи"].append("щит")\nsave["уровень"] += 1\n\nwith open("сейв.json", "w") as f:\n    json.dump(save, f, ensure_ascii=False, indent=2)\n\nwith open("сейв.json") as f:\n    print(f.read())\n',
    hints:[
      "После json.load это обычный словарь: save[\"герой\"][\"hp\"] += 5",
      "Вещи — список, у него есть append. Уровень — обычное число",
      "Порядок важен: сначала все изменения, потом запись, и только потом чтение"
    ],
    check:{ kind:"output", needCode:["json"],
            needMsg:"Работать нужно через модуль json, а не собирать текст руками." }
  }
},

"csv": {
  lede: "CSV — таблица в виде текста: строки таблицы, значения через запятую. Так отдают данные Excel, банки и почти любой сайт со статистикой.",
  theory: [
    { h:"Как это выглядит внутри",
      p:"Первая строка — обычно заголовки столбцов, дальше данные. Разделитель — запятая. Читать можно и обычным <code>split(\",\")</code>, но у CSV есть подвох: запятая внутри значения. Поэтому есть модуль.",
      data:{ "герои.csv": "имя,сила,класс\nаня,7,маг\nборя,9,воин\n" },
      demo:'with open("герои.csv") as f:\n    print(f.read())' },
    { h:"csv.reader — строки как списки",
      p:"Каждая строка превращается в список значений. Все значения — строки, числа надо превращать самому. Первую строку с заголовками обычно пропускают.",
      data:{ "герои.csv": "имя,сила,класс\nаня,7,маг\nборя,9,воин\n" },
      demo:'import csv\n\nwith open("герои.csv") as f:\n    rows = csv.reader(f)\n    for row in rows:\n        print(row)\n\nwith open("герои.csv") as f:\n    rows = list(csv.reader(f))\n\nhead = rows[0]\nprint("столбцы:", head)\nfor row in rows[1:]:\n    print(row[0], int(row[1]) * 2)' },
    { h:"DictReader — строки как словари",
      p:"Удобнее: заголовки становятся ключами, и в коде видно, что берёшь. Если столбцы в файле поменяются местами, такой код не сломается — в отличие от <code>row[1]</code>.",
      data:{ "герои.csv": "имя,сила,класс\nаня,7,маг\nборя,9,воин\n" },
      demo:'import csv\n\nwith open("герои.csv") as f:\n    for item in csv.DictReader(f):\n        print(item)\n        print(item["имя"], "->", item["класс"], int(item["сила"]))' },
    { h:"Запись таблицы",
      p:"<code>csv.writer</code> и его <code>writerow</code>; список строк сразу — <code>writerows</code>. Значение с запятой внутри модуль сам возьмёт в кавычки — вот зачем он нужен вместо ручной склейки. И два обязательных аргумента у <code>open</code>: <code>newline=\"\"</code>, иначе на Windows между строками появятся пустые, и <code>encoding=\"utf-8\"</code> для русского текста.",
      demo:'import csv\n\nwith open("вывод.csv", "w", encoding="utf-8", newline="") as f:\n    w = csv.writer(f)\n    w.writerow(["товар", "цена"])\n    w.writerows([["карандаш", 15], ["ручка, синяя", 30]])\n\nwith open("вывод.csv", encoding="utf-8", newline="") as f:\n    print(f.read())\n\nwith open("вывод.csv", encoding="utf-8", newline="") as f:\n    for row in csv.reader(f):\n        print(row)' }
  ],
  task:{
    type:"code",
    goal:"Посчитай итоги по таблице покупок и сохрани отчёт в новый CSV.",
    list:[
      "Прочитать покупки.csv через csv.DictReader",
      "Для каждой строки посчитать сумму: количество × цена",
      "Записать итог.csv со столбцами товар,сумма и строкой на каждый товар",
      "Последняя строка итога: «всего» и общая сумма",
      "Открытие файлов, заголовок и чтение в конце в заготовке уже есть"
    ],
    data:{ "покупки.csv": "товар,количество,цена\nкарандаш,3,15\nтетрадь,5,30\nластик,2,10\n" },
    starter:'import csv\n\nrows = []\ntotal = 0\n\nwith open("покупки.csv") as f:\n    for item in csv.DictReader(f):\n        print(item["товар"], item["количество"], item["цена"])\n\nwith open("итог.csv", "w") as f:\n    w = csv.writer(f)\n    w.writerow(["товар", "сумма"])\n\nwith open("итог.csv") as f:\n    for row in csv.reader(f):\n        print(row)\n',
    solution:'import csv\n\nrows = []\ntotal = 0\n\nwith open("покупки.csv") as f:\n    for item in csv.DictReader(f):\n        cost = int(item["количество"]) * int(item["цена"])\n        total += cost\n        rows.append([item["товар"], cost])\n\nrows.append(["всего", total])\n\nwith open("итог.csv", "w") as f:\n    w = csv.writer(f)\n    w.writerow(["товар", "сумма"])\n    w.writerows(rows)\n\nwith open("итог.csv") as f:\n    for row in csv.reader(f):\n        print(row)\n',
    hints:[
      "Значения из DictReader — строки: int(item[\"количество\"]) * int(item[\"цена\"])",
      "Складывай пары [товар, сумма] в список rows, а в конце добавь [\"всего\", total]",
      "Записать сразу все строки: w.writerows(rows)"
    ],
    check:{ kind:"output", needCode:["csv"],
            needMsg:"Читать и писать таблицу нужно через модуль csv." }
  }
},

"collections": {
  lede: "Два инструмента, которые заменяют самый частый скучный код: <code>Counter</code> считает повторы, <code>defaultdict</code> избавляет от проверки «а есть ли уже такой ключ».",
  theory: [
    { h:"Counter считает сам",
      p:"В Мире 2 словарь-счётчик приходилось собирать руками. <code>Counter</code> делает это одной строкой — и печатается сразу по убыванию количества.",
      demo:'from collections import Counter\n\nwords = ["да", "нет", "да", "может", "да", "нет"]\nc = Counter(words)\nprint(c)\nprint(c["да"], c["нет"], c["чего-то нет"])\nprint(len(c))' },
    { h:"most_common — готовый топ",
      p:"Отдаёт пары «значение, сколько раз» по убыванию. Число в скобках — сколько первых взять. Раньше для этого нужна была сортировка с ключом.",
      demo:'from collections import Counter\n\ntext = "мама мыла раму а рама мыла маму"\nc = Counter(text.split())\nprint(c.most_common())\nprint(c.most_common(2))\nletters = Counter(text.replace(" ", ""))\nprint(letters.most_common(3))' },
    { h:"defaultdict: ключ появляется сам",
      p:"Обычный словарь ругается на несуществующий ключ. <code>defaultdict(list)</code> при первом обращении создаёт пустой список, <code>defaultdict(int)</code> — ноль. Проверять больше не надо. Обёртка <code>dict(...)</code> в примере нужна только для печати: обычный словарь печатается короче.",
      demo:'from collections import defaultdict\n\nheroes = [("маг", "аня"), ("воин", "боря"), ("маг", "витя")]\n\ngroups = defaultdict(list)\nfor kind, name in heroes:\n    groups[kind].append(name)\nprint(dict(groups))\n\nscore = defaultdict(int)\nfor ch in "абракадабра":\n    score[ch] += 1\nprint(sorted(score.items()))' },
    { h:"update добавляет сразу много",
      p:"У <code>Counter</code> есть <code>update</code>: он не заменяет значения, как у обычного словаря, а <b>прибавляет</b>. Удобно, когда данные приходят порциями — например по строке за раз.",
      demo:'from collections import Counter\n\nc = Counter()\nc.update(["да", "нет"])\nc.update(["да", "да"])\nprint(c)\n\nplain = {"да": 1}\nplain.update({"да": 5})\nprint("у обычного словаря замена:", plain)' },
    { h:"Как это выглядело раньше",
      p:"Тот же результат обычным словарём — четыре строки вместо одной. Уметь так тоже надо: <code>get</code> с значением по умолчанию работает в любом словаре.",
      demo:'words = ["да", "нет", "да"]\n\ncounts = {}\nfor w in words:\n    counts[w] = counts.get(w, 0) + 1\nprint(counts)\n\ngroups = {}\nfor w in words:\n    if len(w) not in groups:\n        groups[len(w)] = []\n    groups[len(w)].append(w)\nprint(groups)' }
  ],
  task:{
    type:"code",
    goal:"Разбери файл <code>чат.txt</code>: кто сколько написал и какие слова встречаются чаще всего.",
    list:[
      "В файле строки вида «аня: привет всем»",
      "Файл чат.txt: строки вида «аня: привет всем»",
      "Сначала напечатать «сообщений: имя N» для каждого автора, по убыванию количества",
      "Потом «слов всего: N» — сколько слов во всех сообщениях",
      "Потом три самых частых слова парами: «привет 5»",
      "Считать через Counter, порядок вывода — как в требованиях"
    ],
    data:{ "чат.txt": "аня: привет всем\nборя: привет\nаня: как дела\nвитя: привет привет привет\nаня: всем пока\n" },
    starter:'from collections import Counter\n\nauthors = Counter()\nwords = Counter()\n\nwith open("чат.txt", encoding="utf-8") as f:\n    for line in f:\n        name, text = line.split(":")\n        print(name, "|", text.strip())\n',
    solution:'from collections import Counter\n\nauthors = Counter()\nwords = Counter()\n\nwith open("чат.txt", encoding="utf-8") as f:\n    for line in f:\n        name, text = line.split(":")\n        authors[name] += 1\n        words.update(text.split())\n\nfor name, n in authors.most_common():\n    print("сообщений:", name, n)\n\nprint("слов всего:", sum(words.values()))\n\nfor word, n in words.most_common(3):\n    print(word, n)\n',
    hints:[
      "Counter можно наполнять по одному: authors[name] += 1 — проверки не нужны",
      "Слова добавляются порцией — тем самым update из теории",
      "Для вывода: most_common() без числа даёт всех, most_common(3) — первых трёх. Общее число слов — sum(words.values())"
    ],
    check:{ kind:"output", needCode:["Counter"],
            needMsg:"По условию считать нужно через Counter из collections." }
  }
},

"itertools": {
  lede: "Модуль про перебор: все пары, все комбинации, бесконечные последовательности. Код, который иначе занимает несколько вложенных циклов.",
  theory: [
    { h:"product — все сочетания",
      p:"Вместо цикла в цикле. Даёт кортежи: каждый элемент первого списка с каждым элементом второго. Порядок такой же, как у вложенных циклов.",
      demo:'import itertools\n\ncolors = ["красный", "синий"]\nsizes = ["S", "M", "L"]\n\nfor pair in itertools.product(colors, sizes):\n    print(pair)\n\nprint(len(list(itertools.product(colors, sizes))))\nprint(list(itertools.product("аб", repeat=2)))' },
    { h:"combinations и permutations",
      p:"<code>combinations</code> — сочетания, где порядок не важен: «аня и боря» это то же, что «боря и аня». <code>permutations</code> — где важен. Это ровно то, чем отличаются «выбрать двоих в команду» и «выбрать первого и второго».",
      demo:'import itertools\n\nteam = ["аня", "боря", "витя"]\nprint("пары в команду:")\nfor pair in itertools.combinations(team, 2):\n    print(" ", pair)\nprint("призовые места:")\nfor pair in itertools.permutations(team, 2):\n    print(" ", pair)\nprint(len(list(itertools.combinations(team, 2))), len(list(itertools.permutations(team, 2))))' },
    { h:"chain — склеить последовательности",
      p:"Проходит по нескольким наборам подряд, как по одному. Новый список при этом не создаётся — значения выдаются по очереди. Работает и со строками, и с кортежами.",
      demo:'import itertools\n\nfirst = [1, 2]\nsecond = (3, 4)\nfor x in itertools.chain(first, second, "аб"):\n    print(x)\nprint(list(itertools.chain([1], [2, 3], [])))' },
    { h:"count и cycle — бесконечные",
      p:"<code>count</code> считает без остановки, <code>cycle</code> ходит по кругу. Целиком их в список не превратить: настоящий Python съест всю память и упадёт, а тренажёр остановит программу сам. Поэтому берут первые несколько через <code>islice</code> или выходят из цикла через <code>break</code>.",
      demo:'import itertools\n\nprint(list(itertools.islice(itertools.count(), 5)))\nprint(list(itertools.islice(itertools.count(10, 5), 4)))\nprint(list(itertools.islice(itertools.cycle("абв"), 7)))\n\nfor n in itertools.count(1):\n    if n * n > 50:\n        print("первый квадрат больше 50 у числа", n)\n        break' },
    { h:"islice — взять кусок",
      p:"Срез для того, что не список: файла, бесконечной последовательности. Как <code>[2:6]</code>, только работает по ходу перебора, не собирая всё заранее.",
      demo:'import itertools\n\nnums = itertools.count(1)\nprint(list(itertools.islice(nums, 3)))\nprint(list(itertools.islice(itertools.count(1), 2, 6)))\nprint(list(itertools.islice("абвгде", 1, 4)))' }
  ],
  task:{
    type:"code",
    goal:"Собери турнирную сетку и найди первое подходящее число.",
    list:[
      "pairs(team) возвращает список всех пар для матчей — порядок внутри пары не важен",
      "menu(dishes, drinks) возвращает список всех сочетаний «блюдо, напиток»",
      "first_over(limit) возвращает первое число, у которого куб больше limit",
      "Все три функции пишутся через itertools, без вложенных циклов",
      "Строки с print менять не нужно"
    ],
    starter:'import itertools\n\n\ndef pairs(team):\n    return []\n\n\ndef menu(dishes, drinks):\n    return []\n\n\ndef first_over(limit):\n    return 0\n\n\nprint(pairs(["аня", "боря", "витя"]))\nprint(len(pairs(["а", "б", "в", "г"])))\nprint(menu(["суп", "плов"], ["чай", "сок"]))\nprint(first_over(100), first_over(1000))\n',
    solution:'import itertools\n\n\ndef pairs(team):\n    return list(itertools.combinations(team, 2))\n\n\ndef menu(dishes, drinks):\n    return list(itertools.product(dishes, drinks))\n\n\ndef first_over(limit):\n    for n in itertools.count(1):\n        if n ** 3 > limit:\n            return n\n\n\nprint(pairs(["аня", "боря", "витя"]))\nprint(len(pairs(["а", "б", "в", "г"])))\nprint(menu(["суп", "плов"], ["чай", "сок"]))\nprint(first_over(100), first_over(1000))\n',
    hints:[
      "Разница простая: в матче «аня против бори» и «боря против ани» — одно и то же, а в меню «суп с чаем» и «чай с супом» — тоже, но перебирать надо каждое блюдо с каждым напитком. Значит нужны два разных инструмента",
      "Первый — combinations, второй — product. Оба должны вернуть список, поэтому list(...)",
      "В first_over иди по бесконечному счётчику и делай return, как только куб больше limit"
    ],
    check:{ kind:"output", needCode:["combinations","product","count"],
            needMsg:"По условию нужны именно готовые инструменты: combinations, product и count из itertools." }
  }
},

"generators": {
  lede: "Обычная функция считает всё и отдаёт список. Генератор отдаёт по одному значению и ждёт. Это позволяет работать с данными, которые в память не влезают — или вообще бесконечны.",
  theory: [
    { h:"yield вместо return",
      p:"Функция с <code>yield</code> при вызове ничего не считает — она возвращает генератор. Значения появляются, когда их просят: через <code>next</code> или циклом.",
      demo:'def three():\n    yield "раз"\n    yield "два"\n    yield "три"\n\n\ng = three()\nprint(type(g).__name__)\nprint(next(g))\nprint(next(g))\nprint(next(g))' },
    { h:"Когда значения кончились",
      p:"Генератор одноразовый: прошёл до конца — больше ничего не отдаст. Попытка взять ещё даёт <code>StopIteration</code>. Цикл <code>for</code> ловит это сам, поэтому в жизни пишут именно цикл.",
      demo:'def two():\n    yield 1\n    yield 2\n\n\ng = two()\nfor x in g:\n    print("получили", x)\n\nprint("второй проход:", list(g))\n\ng2 = two()\nprint(next(g2))\nprint(next(g2))\ntry:\n    next(g2)\nexcept StopIteration:\n    print("всё, значения кончились")' },
    { h:"Экономия памяти",
      p:"Список из миллиона чисел занимает память целиком. Генератор — только текущее значение. Когда данные нужны по одному разу и по порядку, генератор почти всегда лучше. Почти: у него нет длины, нет номеров элементов и он одноразовый — если нужно пройти дважды, придётся собирать список.",
      demo:'def squares(limit):\n    n = 1\n    while n <= limit:\n        yield n * n\n        n += 1\n\n\ntotal = 0\nfor sq in squares(5000):\n    total += sq\nprint("сумма квадратов до 5000:", total)\nprint("а в памяти лежало по одному числу за раз")' },
    { h:"Бесконечный генератор",
      p:"<code>while True</code> внутри генератора — не ошибка, а обычное дело: значения кончатся тогда, когда перестанут спрашивать. Главное — не пытаться превратить такой генератор в список.",
      demo:'def evens():\n    n = 0\n    while True:\n        yield n\n        n += 2\n\n\ng = evens()\nprint(next(g), next(g), next(g))\n\nfound = []\nfor n in evens():\n    if n > 12:\n        break\n    found.append(n)\nprint(found)' },
    { h:"Пустой return останавливает генератор",
      p:"Внутри генератора <code>return</code> без значения означает «всё, больше значений не будет» — как естественный конец функции. Вернуть значение через <code>return</code> в генераторе нельзя: значения отдаёт только <code>yield</code>.",
      demo:'def up_to(limit):\n    n = 1\n    while True:\n        if n > limit:\n            return\n        yield n\n        n += 1\n\n\nprint(list(up_to(4)))\nprint(list(up_to(0)))' },
    { h:"yield from — передать дальше",
      p:"Когда генератор должен отдать всё из другого набора, пишут <code>yield from</code> вместо цикла с <code>yield</code>. Так собирают один поток данных из нескольких источников.",
      demo:'def letters(word):\n    yield from word\n\n\ndef both(a, b):\n    yield from a\n    yield from b\n\n\nprint(list(letters("абв")))\nprint(list(both([1, 2], "хз")))\nprint(list(both(letters("ой"), [9])))' }
  ],
  task:{
    type:"code",
    goal:"Напиши три генератора для работы с большим файлом построчно.",
    list:[
      "lines(name) отдаёт строки файла по одной, уже без \\n на конце",
      "long_lines(name, n) отдаёт только строки длиннее n знаков",
      "first(gen, k) отдаёт первые k значений любого генератора",
      "Все три должны быть генераторами: внутри yield, а не список",
      "Строки с print менять не нужно"
    ],
    data:{ "письмо.txt": "привет\nэто довольно длинная строка письма\nкороткая\nещё одна очень длинная строка для проверки\nпока\n" },
    starter:'def lines(name):\n    return []\n\n\ndef long_lines(name, n):\n    return []\n\n\ndef first(gen, k):\n    return []\n\n\nprint(list(lines("письмо.txt")))\nprint(list(long_lines("письмо.txt", 10)))\nprint(list(first(lines("письмо.txt"), 2)))\nprint(list(first(long_lines("письмо.txt", 10), 1)))\n',
    solution:'def lines(name):\n    with open(name) as f:\n        for line in f:\n            yield line.strip()\n\n\ndef long_lines(name, n):\n    for line in lines(name):\n        if len(line) > n:\n            yield line\n\n\ndef first(gen, k):\n    taken = 0\n    for value in gen:\n        if taken >= k:\n            return\n        yield value\n        taken += 1\n\n\nprint(list(lines("письмо.txt")))\nprint(list(long_lines("письмо.txt", 10)))\nprint(list(first(lines("письмо.txt"), 2)))\nprint(list(first(long_lines("письмо.txt", 10), 1)))\n',
    hints:[
      "Функция с yield — уже генератор: список собирать не надо, значения отдаются по одному",
      "long_lines может ходить по твоему же генератору: for line in lines(name), а отдавать только подходящие",
      "В first считай отданные значения и останови генератор пустым return, когда хватит"
    ],
    check:{ kind:"output", needCode:["yield"], noCode:["islice","append"],
            needMsg:"По условию все три функции должны быть генераторами — внутри нужен yield.",
            noMsg:"Смысл урока — отдавать значения по одному через yield, а не собирать список через append и не брать готовый islice." }
  }
},

"decorators": {
  lede: "Декоратор — функция, которая берёт другую функцию и возвращает новую, с добавкой. Знак <code>@</code> из урока про dataclass наконец объясняется полностью.",
  theory: [
    { h:"Функция внутри функции",
      p:"Основа декоратора — вложенная функция и то, что функцию можно вернуть. Внутренняя помнит, что было снаружи: это называется замыканием.",
      demo:'def multiplier(k):\n    def inner(x):\n        return x * k\n    return inner\n\n\ndouble = multiplier(2)\ntriple = multiplier(3)\nprint(double(5), triple(5))\nprint(multiplier(10)(7))' },
    { h:"Обёртка вокруг чужой функции",
      p:"Декоратор принимает функцию, делает свою, которая вызывает первую и добавляет что-то своё, и возвращает эту новую. Внутри пишут <code>*args, **kwargs</code>, чтобы обёртка подошла к любой функции.",
      demo:'def announced(fn):\n    def inner(*args, **kwargs):\n        print("  вызываю", fn.__name__)\n        result = fn(*args, **kwargs)\n        print("  получилось", result)\n        return result\n    return inner\n\n\ndef add(a, b):\n    return a + b\n\n\nadd = announced(add)\nprint(add(2, 3))' },
    { h:"@ — это то же самое, но короче",
      p:"Строка <code>@announced</code> над функцией означает ровно <code>add = announced(add)</code>. Никакой магии, просто короткая запись. Именно так работал <code>@dataclass</code>.",
      demo:'def announced(fn):\n    def inner(*args, **kwargs):\n        result = fn(*args, **kwargs)\n        print(f"  {fn.__name__}{args} = {result}")\n        return result\n    return inner\n\n\n@announced\ndef add(a, b):\n    return a + b\n\n\n@announced\ndef power(a, b):\n    return a ** b\n\n\nprint(add(2, 3))\nprint(power(2, 10))' },
    { h:"Зачем это нужно",
      p:"Чтобы добавить одно и то же многим функциям, не копируя код: запись в журнал, проверку прав, подсчёт вызовов, запоминание результата. Обёртка одна, функций много.",
      demo:'calls = {}\n\n\ndef counted(fn):\n    def inner(*args, **kwargs):\n        calls[fn.__name__] = calls.get(fn.__name__, 0) + 1\n        return fn(*args, **kwargs)\n    return inner\n\n\n@counted\ndef hit():\n    return "удар"\n\n\n@counted\ndef heal():\n    return "лечение"\n\n\nhit()\nhit()\nheal()\nhit()\nprint(sorted(calls.items()))' },
    { h:"Осторожно: имя подменяется",
      p:"После декорирования <code>add</code> — это уже <code>inner</code>. Если обёртка не позаботится, настоящее имя функции потеряется. В настоящем Python это лечат декоратором <code>functools.wraps</code>, но принцип важнее названия.",
      demo:'def plain(fn):\n    def inner(*a, **k):\n        return fn(*a, **k)\n    return inner\n\n\n@plain\ndef greet():\n    return "привет"\n\n\nprint(greet())\nprint(greet.__name__)' }
  ],
  task:{
    type:"code",
    goal:"Напиши декоратор <code>remembers</code>, который запоминает уже посчитанные ответы.",
    list:[
      "remembers(fn) возвращает обёртку, которая хранит результаты в словаре",
      "Если такой аргумент уже считали — вернуть готовый ответ, не вызывая функцию",
      "Каждый настоящий вызов увеличивает calls[\"было\"] на единицу",
      "Декоратор ставится над функцией через @",
      "Строки с print менять не нужно"
    ],
    starter:'calls = {"было": 0}\n\n\ndef remembers(fn):\n    return fn\n\n\n@remembers\ndef slow_square(n):\n    return n * n\n\n\nprint(slow_square(4))\nprint(slow_square(4))\nprint(slow_square(5))\nprint(slow_square(4))\nprint("настоящих вызовов:", calls["было"])\n',
    solution:'calls = {"было": 0}\n\n\ndef remembers(fn):\n    known = {}\n\n    def inner(n):\n        if n in known:\n            return known[n]\n        calls["было"] += 1\n        known[n] = fn(n)\n        return known[n]\n    return inner\n\n\n@remembers\ndef slow_square(n):\n    return n * n\n\n\nprint(slow_square(4))\nprint(slow_square(4))\nprint(slow_square(5))\nprint(slow_square(4))\nprint("настоящих вызовов:", calls["было"])\n',
    hints:[
      "Словарь known создаётся в remembers, до inner — тогда он общий для всех вызовов обёртки",
      "Внутри inner: сначала проверь if n in known, и только потом считай",
      "Не забудь вернуть саму обёртку: return inner в конце remembers"
    ],
    check:{ kind:"output", needCode:["def inner","return inner"],
            needMsg:"Нужен настоящий декоратор: внутренняя функция inner и возврат её из remembers." }
  }
},

"context": {
  lede: "<code>with</code> уже встречался — в уроках про файлы. Теперь напишем свой объект, который умеет открываться и закрываться, и увидим, что там внутри.",
  theory: [
    { h:"Два особых метода",
      p:"<code>__enter__</code> срабатывает на входе в <code>with</code> и возвращает то, что попадёт после <code>as</code>. <code>__exit__</code> — на выходе, всегда. Больше ничего не нужно.",
      demo:'class Doors:\n    def __init__(self, name):\n        self.name = name\n\n    def __enter__(self):\n        print("открыли", self.name)\n        return self\n\n    def __exit__(self, a, b, c):\n        print("закрыли", self.name)\n\n    def look(self):\n        return "внутри " + self.name\n\n\nwith Doors("склад") as d:\n    print(d.look())' },
    { h:"__exit__ выполняется даже при ошибке",
      p:"В этом весь смысл. Что бы ни случилось внутри, закрытие произойдёт. Именно поэтому файлы открывают через <code>with</code>: забыть закрыть невозможно.",
      demo:'class Doors:\n    def __enter__(self):\n        print("открыли")\n        return self\n\n    def __exit__(self, a, b, c):\n        print("закрыли — несмотря ни на что")\n\n\ntry:\n    with Doors():\n        print("работаем")\n        raise ValueError("что-то сломалось")\nexcept ValueError as e:\n    print("ошибку поймали снаружи:", e)' },
    { h:"Зачем это в жизни",
      p:"Всё, что нужно освободить: файл, соединение с базой, замок, запись в журнале «начал — закончил». Пара «открыть — закрыть» просто не может разойтись.",
      demo:'class Section:\n    def __init__(self, title):\n        self.title = title\n\n    def __enter__(self):\n        print("=== " + self.title + " ===")\n        return self\n\n    def __exit__(self, a, b, c):\n        print("=== конец: " + self.title + " ===")\n\n\nwith Section("расчёты"):\n    print("2 + 2 =", 2 + 2)\nwith Section("итоги"):\n    print("всё сошлось")' },
    { h:"Несколько предметов сразу",
      p:"Можно перечислить через запятую — закроются в обратном порядке, от последнего к первому. Так копируют данные из одного файла в другой.",
      data:{ "вход.txt": "раз\nдва\nтри\n" },
      demo:'with open("вход.txt") as src, open("выход.txt", "w") as dst:\n    for line in src:\n        dst.write(line.upper())\n\nwith open("выход.txt") as f:\n    print(f.read())' }
  ],
  task:{
    type:"code",
    goal:"Напиши класс <code>Journal</code>, который сам пишет в файл начало и конец работы.",
    list:[
      "Journal(имя, путь) при входе дописывает в файл строку «начали: сборка»",
      "Метод write(текст) дописывает эту строку с двумя пробелами впереди",
      "При выходе дописывает «закончили: сборка» — даже если внутри случилась ошибка",
      "Файл открывать через open(..., \"a\") внутри самих методов",
      "Строки внизу менять не нужно"
    ],
    starter:'class Journal:\n    def __init__(self, name, path):\n        self.name = name\n        self.path = path\n\n    def __enter__(self):\n        return self\n\n    def __exit__(self, a, b, c):\n        pass\n\n    def write(self, text):\n        pass\n\n\nwith Journal("сборка", "журнал.txt") as j:\n    j.write("шаг один")\n    j.write("шаг два")\n\ntry:\n    with Journal("проверка", "журнал.txt") as j:\n        j.write("начал проверять")\n        raise ValueError("не сошлось")\nexcept ValueError:\n    pass\n\nwith open("журнал.txt") as f:\n    print(f.read())\n',
    data:{ "журнал.txt": "" },
    solution:'class Journal:\n    def __init__(self, name, path):\n        self.name = name\n        self.path = path\n\n    def __enter__(self):\n        with open(self.path, "a") as f:\n            f.write(f"начали: {self.name}\\n")\n        return self\n\n    def __exit__(self, a, b, c):\n        with open(self.path, "a") as f:\n            f.write(f"закончили: {self.name}\\n")\n\n    def write(self, text):\n        with open(self.path, "a") as f:\n            f.write(f"  {text}\\n")\n\n\nwith Journal("сборка", "журнал.txt") as j:\n    j.write("шаг один")\n    j.write("шаг два")\n\ntry:\n    with Journal("проверка", "журнал.txt") as j:\n        j.write("начал проверять")\n        raise ValueError("не сошлось")\nexcept ValueError:\n    pass\n\nwith open("журнал.txt") as f:\n    print(f.read())\n',
    hints:[
      "Открывать файл нужно в режиме дописывания. Если взять \"w\", каждая запись сотрёт предыдущие — и в журнале останется одна строка",
      "Вторая половина задания проверяется блоком try внизу: __exit__ обязан сработать и тогда, когда внутри with случилась ошибка",
      "В каждом методе своя короткая запись: with open(self.path, \"a\", encoding=\"utf-8\") as f, и не забудь \\n в конце строки"
    ],
    check:{ kind:"output", needCode:["__enter__","__exit__"],
            needMsg:"Нужны оба особых метода: __enter__ и __exit__." }
  }
},

"regex": {
  lede: "Регулярное выражение — шаблон для поиска в тексте. Выглядит страшно, но состоит из десятка значков, и половину задач закрывают три из них.",
  theory: [
    { h:"Буква r перед кавычками",
      p:"Шаблоны пишут так: <code>r\"\\d+\"</code>. Буква <code>r</code> означает «сырая строка»: обратный слеш остаётся слешем, а не превращается в спецсимвол. Без неё <code>\"\\d\"</code> Python попробует понять по-своему, и шаблон сломается. Правило простое: шаблон всегда с <code>r</code>.",
      demo:'print(len(r"\\d"), len("\\n"))\nprint(repr(r"\\d+"))\nprint(repr(r"путь\\новый"))\nprint(repr("путь\\новый"))' },
    { h:"Основные значки",
      p:"<code>\\d</code> цифра, <code>\\w</code> буква или цифра, <code>\\s</code> пробел. <code>+</code> «один или больше», <code>*</code> «сколько угодно, можно ноль», <code>?</code> «ноль или один», <code>{3}</code> «ровно три», <code>{2,4}</code> «от двух до четырёх». Точка — любой знак.",
      demo:'import re\n\ntext = "аня 7, боря 12, витя 5"\nprint(re.findall(r"\\d+", text))\nprint(re.findall(r"\\w+", text))\nprint(re.findall(r"\\d", text))\nprint(re.findall(r"\\d{2}", text))\nprint(re.findall(r"б.ря", text))' },
    { h:"Свой набор знаков в квадратных скобках",
      p:"<code>[абв]</code> — любой из этих знаков. Через дефис задают диапазон: <code>[а-я]</code> русская буква, <code>[a-z]</code> латинская маленькая, <code>[0-9]</code> цифра. Со значком количества это читается как «три латинские буквы»: <code>[a-z]{3}</code>.",
      demo:'import re\n\ncodes = "abc-1234 хзч-99 xyz-0007"\nprint(re.findall(r"[a-z]{3}", codes))\nprint(re.findall(r"[а-я]{3}", codes))\nprint(re.findall(r"[a-z]{3}-[0-9]{4}", codes))\nprint(re.findall(r"[;,]", "а;б,в"))' },
    { h:"search находит первое совпадение",
      p:"Возвращает объект совпадения или <code>None</code>, если ничего нет. Поэтому результат всегда проверяют. <code>group(0)</code> — что нашлось целиком.",
      demo:'import re\n\ntext = "заказ 4512 от 26.08.2026"\nm = re.search(r"\\d+", text)\nprint(m.group(0), m.start(), m.end())\n\nnothing = re.search(r"[а-я]{20}", text)\nprint(nothing)\nif nothing is None:\n    print("такого тут нет")' },
    { h:"Группы в скобках",
      p:"Круглые скобки выделяют части шаблона. <code>group(1)</code> — первая часть, <code>group(2)</code> — вторая. Так из строки достают именно то, что нужно, а не всё подряд.",
      demo:'import re\n\nm = re.search(r"(\\d+)\\.(\\d+)\\.(\\d+)", "дата 26.08.2026 точно")\nprint(m.group(0))\nprint(m.group(1), m.group(2), m.group(3))\nprint(m.groups())\n\nfor name, power in re.findall(r"(\\w+) (\\d+)", "аня 7, боря 12"):\n    print(name, "->", int(power) * 2)' },
    { h:"sub заменяет, split разрезает",
      p:"<code>sub</code> — замена по шаблону: удобно вычищать мусор. <code>split</code> — разрез по шаблону, а не по одному знаку, как у строк.",
      demo:'import re\n\nprint(re.sub(r"\\d+", "N", "аня 7, боря 12"))\nprint(re.sub(r"\\s+", " ", "много    пробелов   тут"))\nprint(re.split(r",\\s*", "аня, боря,витя"))\nprint(re.split(r"[;,]", "а;б,в"))' },
    { h:"Начало, конец и точное совпадение",
      p:"<code>^</code> значит «начало строки», <code>$</code> — «конец». <code>match</code> проверяет только начало, <code>fullmatch</code> — строку целиком. Так проверяют, годится ли введённое значение.",
      demo:'import re\n\nprint(re.findall(r"^аня", "аня и боря"))\nprint(re.findall(r"^боря", "аня и боря"))\nprint(re.findall(r"боря$", "аня и боря"))\n\n\ndef looks_like_code(text):\n    return re.fullmatch(r"[a-z]{3}-\\d{4}", text) is not None\n\n\nfor value in ["abc-1234", "ab-1234", "abc-1234x", "xyz-0007"]:\n    print(value, "->", looks_like_code(value))' }
  ],
  task:{
    type:"code",
    goal:"Разбери журнал сервера: вытащи из него даты и коды заказов, а потом очисти текст.",
    list:[
      "dates(text) возвращает список всех дат вида 26.08.2026",
      "codes(text) возвращает список всех кодов вида abc-1234 (три маленькие латинские буквы, дефис, четыре цифры)",
      "clean(text) заменяет все числа на «N» и лишние пробелы на один",
      "Все три — через модуль re",
      "Строки с print менять не нужно"
    ],
    starter:'import re\n\ntext = "26.08.2026 заказ abc-1234 ошибка 500;  27.08.2026 заказ xyz-0007 ошибка   404"\n\n\ndef dates(t):\n    return []\n\n\ndef codes(t):\n    return []\n\n\ndef clean(t):\n    return t\n\n\nprint(dates(text))\nprint(codes(text))\nprint(clean(text))\n',
    solution:'import re\n\ntext = "26.08.2026 заказ abc-1234 ошибка 500;  27.08.2026 заказ xyz-0007 ошибка   404"\n\n\ndef dates(t):\n    return re.findall(r"\\d{2}\\.\\d{2}\\.\\d{4}", t)\n\n\ndef codes(t):\n    return re.findall(r"[a-z]{3}-\\d{4}", t)\n\n\ndef clean(t):\n    return re.sub(r"\\s+", " ", re.sub(r"\\d+", "N", t))\n\n\nprint(dates(text))\nprint(codes(text))\nprint(clean(text))\n',
    hints:[
      "Точное количество знаков задаётся фигурными скобками: \\d{2} это ровно две цифры",
      "Точка в шаблоне значит «любой знак», поэтому настоящую точку пишут как \\.",
      "В clean замены можно вложить одну в другую: сначала числа, потом пробелы"
    ],
    check:{ kind:"output", needCode:["findall"],
            needMsg:"По условию искать нужно через re.findall, а не разбирать строку руками." }
  }
},

"typing": {
  lede: "Подсказки типов — записки для человека и для программ-проверялок. Python их не проверяет, но код с ними понятнее, а ошибки находятся до запуска.",
  theory: [
    { h:"Как это выглядит",
      p:"После имени параметра — двоеточие и тип. После скобок — стрелка и тип результата. Python эти записи читает и не мешает: они ничего не меняют при работе.",
      demo:'def total(price: int, count: int) -> int:\n    return price * count\n\n\ndef greet(name: str) -> str:\n    return "привет, " + name\n\n\nprint(total(120, 3))\nprint(greet("аня"))' },
    { h:"Python всё равно не проверяет",
      p:"Это важно понимать честно: подсказка — не защита. Передашь строку вместо числа — программа спокойно попробует работать. Проверяют отдельные программы вроде mypy, а в жизни — ещё и тесты.",
      demo:'def double(n: int) -> int:\n    return n * 2\n\n\nprint(double(5))\nprint(double("ха"))\nprint(double([1, 2]))' },
    { h:"Зачем тогда писать",
      p:"Через месяц этого не помнит никто, включая автора: что функция принимает и что отдаёт. Подсказка отвечает быстрее, чем чтение кода. А редактор по ним подсказывает методы и находит опечатки.",
      demo:'def first_word(text: str) -> str:\n    return text.split()[0]\n\n\ndef sum_all(numbers: list) -> int:\n    return sum(numbers)\n\n\ndef ratio(a: int, b: int) -> float:\n    return a / b\n\n\nprint(first_word("два слова"))\nprint(sum_all([1, 2, 3]))\nprint(ratio(1, 4))' },
    { h:"Строка документации",
      p:"Ещё одна записка для человека — текст в тройных кавычках сразу после <code>def</code>. Там пишут, что функция делает, что принимает и что возвращает. Вместе с подсказками типов это и есть «понятный код».",
      demo:'def clamp(value: int, low: int, high: int) -> int:\n    """Возвращает value, но не меньше low и не больше high."""\n    if value < low:\n        return low\n    if value > high:\n        return high\n    return value\n\n\nprint(clamp(5, 1, 10), clamp(-3, 1, 10), clamp(99, 1, 10))' }
  ],
  task:{
    type:"code",
    goal:"Допиши функции и снабди их подсказками типов и строкой документации.",
    list:[
      "initials(name: str) -> str: «иван петров» → «И.П.»",
      "average(marks: list) -> float: среднее, округлённое до двух знаков",
      "У обеих функций должны быть подсказки типов для параметров и для результата",
      "У обеих — строка документации в тройных кавычках первой строкой",
      "Строки с print менять не нужно"
    ],
    starter:'def initials(name):\n    return ""\n\n\ndef average(marks):\n    return 0\n\n\nprint(initials("иван петров"))\nprint(initials("Пётр"))\nprint(average([5, 4, 5, 3]))\nprint(average([3]))\n',
    solution:'def initials(name: str) -> str:\n    """Первые буквы слов заглавными, каждая с точкой."""\n    parts = name.split()\n    return "".join([w[0].upper() + "." for w in parts])\n\n\ndef average(marks: list) -> float:\n    """Среднее значение списка, округлённое до двух знаков."""\n    return round(sum(marks) / len(marks), 2)\n\n\nprint(initials("иван петров"))\nprint(initials("Пётр"))\nprint(average([5, 4, 5, 3]))\nprint(average([3]))\n',
    hints:[
      "Подсказка пишется так: def initials(name: str) -> str:",
      "Строка документации — первая строка тела, в тройных кавычках",
      "Такие функции в курсе уже были: split и join для инициалов, sum и len для среднего"
    ],
    check:{ kind:"output", needText:["-> str", "-> float", '"""'],
            needMsg:"По условию нужны и подсказки типов со стрелкой, и строка документации в тройных кавычках." }
  }
},

"pip-venv": {
  lede: "Стандартной библиотеки хватает не всегда. Чужие библиотеки ставят программой <code>pip</code>, а чтобы они не мешали друг другу — держат в отдельном окружении.",
  theory: [
    { h:"pip ставит библиотеки",
      p:"В настоящем Python на компьютере это команда в терминале. Она скачивает библиотеку из хранилища PyPI и кладёт в папку того Python, которым запущена. Писать лучше <code>python -m pip install</code>, а не просто <code>pip install</code>: так точно понятно, какому Python достанется библиотека — а их на компьютере обычно несколько.",
      demo:'# Так это выглядит в терминале, а не в Python:\n#   python -m pip install requests\n#   python -m pip list\n#   python -m pip uninstall requests\n\nprint("pip — отдельная программа, её запускают в терминале")\nprint("а в коде потом просто: import requests")' },
    { h:"Окружение — своя папка библиотек",
      p:"У каждого проекта свои библиотеки и свои версии. Чтобы они не путались, создают <b>виртуальное окружение</b>: <code>python -m venv .venv</code>. Внутри — отдельный Python со своим набором.",
      demo:'# python -m venv .venv                 создать окружение\n# source .venv/bin/activate            включить на macOS и Linux\n# .venv\\\\Scripts\\\\activate.bat          включить в cmd на Windows\n# .venv\\\\Scripts\\\\Activate.ps1         включить в PowerShell на Windows\n# deactivate                           выключить\n\nprint("окружение — просто папка, её можно удалить и создать заново")\nprint("в PowerShell может понадобиться разрешить запуск скриптов")' },
    { h:"requirements.txt — список нужного",
      p:"Файл со списком библиотек и версий. По нему любой человек одной командой поставит ровно то же самое: <code>python -m pip install -r requirements.txt</code>. Версия после двух равно — «именно эта». А сам файл обычно не пишут руками, а получают командой <code>python -m pip freeze &gt; requirements.txt</code>: она выписывает всё, что стоит в окружении сейчас.",
      data:{ "requirements.txt": "requests==2.31.0\npandas==2.2.0\nflask\npytest==8.0.1\n" },
      demo:'with open("requirements.txt") as f:\n    print(f.read())' },
    { h:"Зачем фиксировать версию",
      p:"Библиотеки меняются. Программа, написанная под старую версию, на новой может сломаться. Записанная версия означает «у меня работало именно так» — и через год, скорее всего, соберётся так же. Гарантии нет: версию могут снять с PyPI, а новый Python может не подойти старой библиотеке. Но ты хотя бы будешь знать, с чего начинать разбираться.",
      demo:'print("requests==2.31.0 — только эта версия")\nprint("requests>=2.31   — эта или новее")\nprint("requests         — любая, какая поставится")\nprint()\nprint("В работе почти всегда пишут точную версию.")' }
  ],
  task:{
    type:"code",
    goal:"Разбери <code>requirements.txt</code> и напечатай отчёт по зависимостям.",
    list:[
      "Прочитать файл и разобрать каждую строку",
      "Если версия указана через ==, напечатать «requests: версия 2.31.0»",
      "Если версия не указана, напечатать «flask: любая версия»",
      "В конце напечатать «всего: 4, с точной версией: 3»",
      "Пустые строки в файле пропускать"
    ],
    data:{ "requirements.txt": "requests==2.31.0\npandas==2.2.0\n\nflask\npytest==8.0.1\n" },
    starter:'total = 0\npinned = 0\n\nwith open("requirements.txt") as f:\n    for line in f:\n        line = line.strip()\n        print(repr(line))\n\nprint(f"всего: {total}, с точной версией: {pinned}")\n',
    solution:'total = 0\npinned = 0\n\nwith open("requirements.txt") as f:\n    for line in f:\n        line = line.strip()\n        if not line:\n            continue\n        total += 1\n        if "==" in line:\n            name, version = line.split("==")\n            pinned += 1\n            print(f"{name}: версия {version}")\n        else:\n            print(f"{line}: любая версия")\n\nprint(f"всего: {total}, с точной версией: {pinned}")\n',
    hints:[
      "Пустую строку пропускают так: if not line: continue",
      "Проверка «есть ли версия» — знакомый оператор in: if \"==\" in line",
      "Разделить на имя и версию поможет split(\"==\") — он даёт два куска"
    ],
    check:{ kind:"output" }
  }
},

"read-code": {
  lede: "Половина работы программиста — читать чужой код. Навык отдельный: понять, что делает незнакомая функция, не спрашивая автора.",
  theory: [
    { h:"Порядок чтения: снаружи внутрь",
      p:"Сначала имена: как называется функция и что она принимает. Потом — что она вернёт в самом простом случае: на пустом списке, на одном элементе. Только потом середина. Читать сверху вниз построчно — самый медленный способ.",
      files:{ "sekret.py": 'def f(xs):\n    r = {}\n    for x in xs:\n        k = x[0]\n        if k not in r:\n            r[k] = []\n        r[k].append(x)\n    return r\n' },
      demo:'import sekret\n\n# имя ни о чём не говорит — значит смотрим, что оно делает\nprint(sekret.f(["аня", "боря", "алла", "вова"]))\nprint(sekret.f([]))\nprint(sekret.f(["один"]))' },
    { h:"Пробовать на маленьких данных",
      p:"Лучший способ понять код — запустить его на трёх примерах: пустом, самом простом и обычном. Так становится видно и назначение, и края.",
      files:{ "sekret.py": 'def g(text, n):\n    out = []\n    for i in range(0, len(text), n):\n        out.append(text[i:i + n])\n    return out\n' },
      demo:'import sekret\n\nprint(sekret.g("абвгде", 2))\nprint(sekret.g("абвгде", 4))\nprint(sekret.g("", 3))\nprint(sekret.g("аб", 5))' },
    { h:"Переименовать про себя",
      p:"Когда стало понятно — дай нормальные имена. <code>f</code> из первого примера это «сгруппировать по первой букве», <code>g</code> — «разрезать на куски». Понятное имя и есть результат чтения.",
      files:{ "sekret.py": 'def group_by_first_letter(words):\n    groups = {}\n    for word in words:\n        letter = word[0]\n        if letter not in groups:\n            groups[letter] = []\n        groups[letter].append(word)\n    return groups\n' },
      demo:'import sekret\n\nprint(sekret.group_by_first_letter(["аня", "боря", "алла"]))' },
    { h:"Искать края",
      p:"Чужой код почти всегда где-то ломается. Проверь пустой ввод, ноль, отрицательное число, один элемент. Найденный край — либо ошибка, либо то, что автор считал невозможным.",
      files:{ "sekret.py": 'def middle(items):\n    return items[len(items) // 2]\n' },
      demo:'import sekret\n\nprint(sekret.middle([1, 2, 3]))\nprint(sekret.middle(["один"]))\nprint(sekret.middle([]))',
      err:true }
  ],
  task:{
    type:"code",
    goal:"В файле <code>zagadka.py</code> три функции с бессмысленными именами. Разберись, что они делают, и подбери такие аргументы, чтобы получился нужный вывод.",
    list:[
      "Файл zagadka.py менять не нужно — только читать",
      "Программа должна напечатать ровно три строки: 15, затем АНЯ, затем [1, 3, 5]",
      "Аргументы подбери сам: что подать каждой функции, чтобы вышло именно это",
      "Первой функции можно давать любой список, лишь бы ответ сошёлся",
      "Способ разобраться один: читать код и пробовать на маленьких значениях"
    ],
    mainName:"main.py",
    files:[
      { name:"zagadka.py",
        starter:'def a(xs):\n    t = 0\n    for x in xs:\n        t = t + x\n    return t\n\n\ndef b(s):\n    return s.upper()\n\n\ndef c(xs):\n    out = []\n    for i in range(len(xs)):\n        if i % 2 == 0:\n            out.append(xs[i])\n    return out\n' }
    ],
    starter:'import zagadka\n\nprint(zagadka.a([]))\nprint(zagadka.b(""))\nprint(zagadka.c([]))\n',
    solution:'import zagadka\n\nprint(zagadka.a([1, 2, 3, 4, 5]))\nprint(zagadka.b("аня"))\nprint(zagadka.c([1, 2, 3, 4, 5, 6]))\n',
    hints:[
      "Начни с того, что каждая функция возвращает на пустом списке и на одном элементе — это быстрее, чем читать построчно",
      "Первая складывает, вторая меняет регистр. Значит для первой подойдёт любой список с нужной суммой",
      "Третья берёт элементы с чётными номерами: 0, 2, 4. Чтобы получить [1, 3, 5], подай подряд идущие числа"
    ],
    check:{ kind:"output", lines:["15","АНЯ","[1, 3, 5]"] }
  }
},

"pep8": {
  lede: "PEP 8 — соглашение о том, как выглядит код на Python. Оно не про красоту: одинаковый вид кода означает, что чужой файл читается как свой.",
  theory: [
    { h:"Имена",
      p:"Переменные и функции — маленькими буквами через подчёркивание: <code>read_file</code>, <code>item_count</code>. Классы — с большой без подчёркиваний: <code>SpellCard</code>. Постоянные значения — заглавными: <code>MAX_LEVEL</code>. Отдельно PEP 8 запрещает имена <code>l</code>, <code>O</code> и <code>I</code>: их путают с единицей и нулём. А то, что однобуквенные имена вообще стоит держать для счётчиков, — не правило, а общая привычка.",
      demo:'MAX_LEVEL = 50\n\n\ndef next_level(level):\n    return min(level + 1, MAX_LEVEL)\n\n\nclass SpellCard:\n    def __init__(self, spell_name):\n        self.spell_name = spell_name\n\n\nprint(next_level(7), next_level(50), SpellCard("огонь").spell_name)' },
    { h:"Пробелы",
      p:"По умолчанию вокруг знаков действия ставят пробел: <code>a + b</code>, а не <code>a+b</code>. После запятой пробел, перед — нет. Внутри скобок пробелов нет. Отступ — ровно четыре пробела. Есть и исключение: когда в строке действия разного старшинства, PEP 8 разрешает прижать более сильное — <code>x*2 - 1</code>.",
      demo:'nums = [1, 2, 3]\ntotal = sum(nums) + len(nums)\ntext = f"оценка: {total}"\nprint(total, text)\nprint({"а": 1, "б": 2})\nprint([n * 2 for n in nums])' },
    { h:"Пустые строки",
      p:"Между функциями — две пустые строки, между методами внутри класса — одна. Внутри функции пустой строкой отделяют смысловые части. Так глаз находит границы без чтения.",
      demo:'def first():\n    return 1\n\n\ndef second():\n    value = first()\n\n    doubled = value * 2\n    return doubled\n\n\nprint(second())' },
    { h:"Длина строки и комментарии",
      p:"PEP 8 просит строку не длиннее 79 знаков, а комментарии и описания — не длиннее 72: так текст читается на узком экране и в сравнении версий. А вот правило «комментарий объясняет <b>зачем</b>, а не <b>что</b>» — это не PEP 8, а общая привычка: «# складываем a и b» бесполезен, «# скидка только для постоянных» полезен.",
      demo:'PRICE = 120\nCOUNT = 3\nLOYAL_DISCOUNT = 10  # процент для постоянных покупателей\n\n# скидку даём только при заказе от трёх штук\nif COUNT >= 3:\n    total = PRICE * COUNT * (100 - LOYAL_DISCOUNT) / 100\nelse:\n    total = PRICE * COUNT\n\nprint(round(total, 2))' }
  ],
  task:{
    type:"code",
    goal:"Перепиши код по PEP 8, ничего не меняя в его работе. Проверка смотрит и на вывод, и на сам код.",
    list:[
      "Имена переменных и функций — маленькими через подчёркивание",
      "Класс — с большой буквы",
      "Число 100 встречается дважды: вынеси его в постоянную MAX_HP заглавными",
      "Пробелы вокруг знаков действия, после запятых и вокруг «=» вне скобок",
      "Две пустые строки между функциями и классом, одна — между методами",
      "Вывод должен остаться точно таким же: 360 и «аня: 18/100»"
    ],
    starter:'def calcTotal(a,b):\n    return a*b\n\nclass heroCard:\n    def __init__(self,n,hp=100):\n        self.n=n\n        self.hp=hp\n    def card(self):\n        return self.n+": "+str(self.hp)+"/"+str(100)\n\nprint(calcTotal(120,3))\nh=heroCard("аня",18)\nprint(h.card())\n',
    solution:'MAX_HP = 100\n\n\ndef calc_total(price, count):\n    return price * count\n\n\nclass HeroCard:\n    def __init__(self, name, hp=MAX_HP):\n        self.name = name\n        self.hp = hp\n\n    def card(self):\n        return f"{self.name}: {self.hp}/{MAX_HP}"\n\n\nprint(calc_total(120, 3))\nhero = HeroCard("аня", 18)\nprint(hero.card())\n',
    hints:[
      "Начни с имён: в них ошибка видна сразу. Потом пробелы, потом пустые строки",
      "Однобуквенные n и h тоже переименуй — по ним не понять, что внутри",
      "Склейку через + и str() удобнее заменить f-строкой — так короче и читается лучше"
    ],
    check:{ kind:"custom", fn:"pep8style" }
  }
},

"perf": {
  lede: "Программа может работать правильно и всё равно быть непригодной — если ждать приходится минуту. Разберёмся, отчего это зависит, и научимся считать шаги.",
  theory: [
    { h:"Считаем шаги, а не секунды",
      p:"Секунды зависят от компьютера, а число шагов — только от кода. Поэтому скорость обсуждают в шагах: сколько раз программа что-то сравнила или сложила.",
      demo:'names = ["аня", "боря", "витя", "галя", "дима"]\n\nsteps = 0\nfor name in names:\n    steps += 1\n    if name == "дима":\n        break\nprint("нашли за шагов:", steps)\n\nsteps = 0\nfor name in names:\n    steps += 1\n    if name == "аня":\n        break\nprint("а этого за шагов:", steps)' },
    { h:"Цикл в цикле — это умножение",
      p:"Один цикл по списку из 100 элементов — 100 шагов. Цикл внутри цикла — уже 10 000. Вырастет список в десять раз — шагов станет в сто раз больше. Отсюда правило: вложенных циклов по большим данным стоит избегать.",
      demo:'nums = list(range(1, 21))\n\nsteps = 0\nfor a in nums:\n    steps += 1\nprint("один цикл:", steps)\n\nsteps = 0\nfor a in nums:\n    for b in nums:\n        steps += 1\nprint("цикл в цикле:", steps)' },
    { h:"Список ищет перебором, множество — сразу",
      p:"Проверка <code>x in список</code> идёт по элементам подряд. У множества и словаря так не работает: они находят значение сразу, не перебирая. Замена списка на множество — самое частое ускорение в жизни.",
      demo:'known_list = ["аня", "боря", "витя"]\nknown_set = {"аня", "боря", "витя"}\n\nsteps = 0\nfor name in known_list:\n    steps += 1\n    if name == "витя":\n        break\nprint("в списке шагов:", steps)\nprint("во множестве: один, сколько бы элементов ни было")\nprint("витя" in known_set, "гриша" in known_set)' },
    { h:"Запоминание вместо пересчёта",
      p:"Если функция считает одно и то же по многу раз, ответ можно запомнить — как в уроке про декораторы. Это превращает долгие вычисления в мгновенные, но занимает память: обмен одного на другое.",
      demo:'calls = {"было": 0}\nknown = {}\n\n\ndef square(n):\n    if n in known:\n        return known[n]\n    calls["было"] += 1\n    known[n] = n * n\n    return known[n]\n\n\nfor n in [4, 4, 5, 4, 5, 6]:\n    square(n)\nprint("запросов: 6, настоящих вычислений:", calls["было"])' }
  ],
  task:{
    type:"code",
    goal:"Найди повторяющиеся числа двумя способами и сравни число шагов.",
    list:[
      "slow(nums) ищет повторы циклом в цикле и возвращает (список повторов, число шагов)",
      "fast(nums) делает то же за один проход, считая встреченные числа",
      "Повторы в обоих случаях возвращать через sorted(...)",
      "Шаг — это одно сравнение в slow и один элемент в fast",
      "Строки с print менять не нужно"
    ],
    starter:'def slow(nums):\n    return [], 0\n\n\ndef fast(nums):\n    return [], 0\n\n\ndata = [3, 7, 1, 7, 9, 3, 4, 8, 3]\nprint(slow(data))\nprint(fast(data))\nprint(slow(list(range(50))))\nprint(fast(list(range(50))))\n',
    solution:'def slow(nums):\n    steps = 0\n    found = set()\n    for i in range(len(nums)):\n        for j in range(i + 1, len(nums)):\n            steps += 1\n            if nums[i] == nums[j]:\n                found.add(nums[i])\n    return sorted(found), steps\n\n\ndef fast(nums):\n    steps = 0\n    seen = set()\n    found = set()\n    for n in nums:\n        steps += 1\n        if n in seen:\n            found.add(n)\n        seen.add(n)\n    return sorted(found), steps\n\n\ndata = [3, 7, 1, 7, 9, 3, 4, 8, 3]\nprint(slow(data))\nprint(fast(data))\nprint(slow(list(range(50))))\nprint(fast(list(range(50))))\n',
    hints:[
      "В slow два цикла по номерам: for i in range(len(nums)) и for j in range(i + 1, len(nums))",
      "Повторы удобно собирать в множество — оно само выбросит дубликаты, а sorted сделает список",
      "В fast храни уже встреченные в множестве seen: если число там есть, значит это повтор"
    ],
    check:{ kind:"output" }
  }
},

"boss-package": {
  lede: "Босс мира. Соберём настоящий модуль: функции по спецификации, файл с данными и программа, которая всем этим пользуется. Проверю скрытыми тестами — их ты не увидишь.",
  theory: [
    { h:"Что такое пакет по-человечески",
      p:"Строго говоря, пакет в Python — это папка с модулями, а один файл называется модулем. Сегодня собираем именно модуль, но по правилам пакета: понятное имя, понятные функции, описанное поведение. Настоящую папку из нескольких модулей соберём в Мире 5.",
      files:{ "stats.py": 'def total(nums):\n    return sum(nums)\n' },
      demo:'import stats\n\nprint(stats.total([1, 2, 3]))' },
    { h:"Разные задачи — разные функции",
      p:"Одна функция — одно дело. Читать файл, считать среднее и печатать отчёт — три разных дела. Тогда каждую можно проверить отдельно и переиспользовать.",
      files:{ "stats.py": 'def first_number(path):\n    with open(path, encoding="utf-8") as f:\n        return int(f.readline())\n\n\ndef spread(nums):\n    return max(nums) - min(nums)\n' },
      data:{ "числа.txt": "4\n8\n6\n" },
      demo:'import stats\n\nprint(stats.first_number("числа.txt"))\nprint(stats.spread([4, 8, 6]))' },
    { h:"Пустой ввод — часть договора",
      p:"Что делает функция подсчёта среднего на пустом списке? Деление на ноль. Значит выбор надо сделать заранее: либо возвращать ноль, либо возбуждать понятную ошибку. Главное, чтобы это было написано в спецификации, а не оставлено на удачу — иначе тот, кто берёт твой модуль, узнает ответ падением программы.",
      demo:'def longest(words):\n    if not words:\n        raise ValueError("список слов пустой")\n    return max(words, key=len)\n\n\nprint(longest(["раз", "полтора"]))\ntry:\n    longest([])\nexcept ValueError as e:\n    print("отказ:", e)' },
    { h:"Модуль не печатает",
      p:"Печать — дело того, кто пользуется модулем. Если модуль печатает сам, его нельзя вставить в другую программу: он будет мусорить в вывод. Правило: модуль возвращает, программа печатает.",
      files:{ "stats.py": 'def report(nums):\n    return f"{len(nums)} чисел, сумма {sum(nums)}"\n' },
      demo:'import stats\n\nline = stats.report([1, 2, 3])\nprint(line)\nprint(len(line) > 0)' }
  ],
  task:{
    type:"code",
    goal:"Собери пакет <code>marks.py</code> из четырёх функций по спецификации. Файл <code>main.py</code> его показывает, менять его не нужно.",
    list:[
      "read_marks(path): прочитать файл строк вида «аня 5 4 3» и вернуть словарь {имя: [оценки числами]}",
      "average(nums): среднее, округлённое до двух знаков. Для пустого списка — 0",
      "best(data): имя с самым высоким средним. При равенстве — первое по алфавиту. Для пустого словаря — пустая строка",
      "report(data): список строк вида «аня: 4.0», отсортированных по имени",
      "Модуль ничего не печатает — только возвращает",
      "Файл читать с encoding=\"utf-8\"",
      "Тесты скрыты, в том числе на пустых данных"
    ],
    mainName:"main.py",
    data:{ "оценки.txt": "аня 5 4 3\nборя 3 3 4\nвитя 5 5 5\n" },
    files:[
      { name:"marks.py",
        starter:'def read_marks(path):\n    return {}\n\n\ndef average(nums):\n    return 0\n\n\ndef best(data):\n    return ""\n\n\ndef report(data):\n    return []\n',
        solution:'def read_marks(path):\n    data = {}\n    with open(path, encoding="utf-8") as f:\n        for line in f:\n            parts = line.split()\n            if not parts:\n                continue\n            data[parts[0]] = [int(x) for x in parts[1:]]\n    return data\n\n\ndef average(nums):\n    if not nums:\n        return 0\n    return round(sum(nums) / len(nums), 2)\n\n\ndef best(data):\n    if not data:\n        return ""\n    names = sorted(data.keys())\n    return max(names, key=lambda name: average(data[name]))\n\n\ndef report(data):\n    return [f"{name}: {average(data[name])}" for name in sorted(data.keys())]\n' }
    ],
    starter:'import marks\n\ndata = marks.read_marks("оценки.txt")\nprint(data)\nfor line in marks.report(data):\n    print(line)\nprint("лучший:", marks.best(data))\n',
    solution:'import marks\n\ndata = marks.read_marks("оценки.txt")\nprint(data)\nfor line in marks.report(data):\n    print(line)\nprint("лучший:", marks.best(data))\n',
    hints:[
      "В read_marks первое слово строки — имя, остальные превращай в числа: [int(x) for x in parts[1:]]",
      "В best отсортируй имена по алфавиту, а потом возьми max с ключом по среднему — тогда при равенстве победит первое по алфавиту",
      "report — одно включение по sorted(data.keys()) с f-строкой внутри"
    ],
    check:{ kind:"tests", calls:[
      'marks.read_marks("оценки.txt")',
      'marks.average([5, 4, 3])',
      'marks.average([4])',
      'marks.average([])',
      'marks.best(marks.read_marks("оценки.txt"))',
      'marks.best({"аня": [5], "боря": [5]})',
      'marks.best({})',
      'marks.report(marks.read_marks("оценки.txt"))',
      'marks.report({})'
    ] }
  }
}

};
