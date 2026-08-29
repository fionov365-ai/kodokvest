/* ============================================================
   Мир 3 «Свой код» — содержание уроков.
   Ключ объекта = id из curriculum.js. Менять ключи нельзя.
   Схема урока описана в content/world1.js, новое — в README.

   Что появилось в этом мире по сравнению с Мирами 1–2:
     - задание из нескольких файлов: task.files + task.mainName
     - проверка скрытыми тестами: check:{ kind:"tests", calls:[...] }
     - пример теории со своими файлами: theory[i].files
   ============================================================ */
window.CONTENT = window.CONTENT || {};
CONTENT.world3 = {

"fn-args": {
  lede: "В Мире 1 функция была «своей командой». Теперь разберёмся, как в неё попадают данные и как из неё выходит результат.",
  theory: [
    { h:"Параметр и аргумент — разные слова",
      p:"<b>Параметр</b> — имя в объявлении, <code>def total(price, count)</code>. <b>Аргумент</b> — значение при вызове, <code>total(120, 3)</code>. Порядок аргументов важен: первый попадёт в первый параметр.",
      demo:'def total(price, count):\n    return price * count\n\n\nprint(total(120, 3))\nprint(total(3, 120))' },
    { h:"Аргумент можно назвать по имени",
      p:"Тогда порядок перестаёт значить, а код становится понятнее. Так делают, когда параметров много и по числам уже не угадать, что есть что.",
      demo:'def hit(damage, armor, crit):\n    return (damage - armor) * crit\n\n\nprint(hit(10, 3, 2))\nprint(hit(crit=2, damage=10, armor=3))\nprint(hit(10, crit=2, armor=3))' },
    { h:"Функция без return возвращает None",
      p:"Самая частая ошибка новичка: внутри функции стоит <code>print</code> вместо <code>return</code>. На экране всё правильно, а в переменной — <code>None</code>, и дальше считать нечем.",
      demo:'def bad(a, b):\n    print(a + b)\n\n\ndef good(a, b):\n    return a + b\n\n\nx = bad(2, 3)\ny = good(2, 3)\nprint("bad вернула:", x)\nprint("good вернула:", y)\nprint(y * 10)' },
    { h:"return выходит из функции сразу",
      p:"Строки после сработавшего <code>return</code> не выполняются. Это удобно: условие сошлось — сразу отдаём ответ, без длинных <code>else</code>.",
      demo:'def rank(score):\n    if score >= 90:\n        return "отлично"\n    if score >= 60:\n        return "нормально"\n    return "надо повторить"\n\n\nfor s in [95, 70, 20]:\n    print(s, "->", rank(s))' }
  ],
  task:{
    type:"code",
    goal:"Напиши функцию <code>total(price, count, discount)</code>: стоимость покупки со скидкой.",
    list:[
      "price — цена одной штуки, count — сколько штук, discount — скидка в процентах",
      "Вернуть итог, округлённый до двух знаков: round(значение, 2)",
      "Именно вернуть через return, не печатать внутри",
      "Заготовка уже содержит три вызова — не меняй их"
    ],
    starter:'def total(price, count, discount):\n    return 0\n\n\nprint(total(120, 3, 10))\nprint(total(50, 2, 0))\nprint(total(count=4, price=99.5, discount=25))\n',
    solution:'def total(price, count, discount):\n    return round(price * count * (100 - discount) / 100, 2)\n\n\nprint(total(120, 3, 10))\nprint(total(50, 2, 0))\nprint(total(count=4, price=99.5, discount=25))\n',
    hints:[
      "Сначала полная стоимость: price * count",
      "Скидка 10% значит, что платим 90%: умножить на (100 - discount) и разделить на 100",
      "Округление: return round(price * count * (100 - discount) / 100, 2)"
    ],
    check:{ kind:"output",
      needCode:["def "],
      needMsg:"Задание про функцию: её нужно объявить через def и позвать." }
  }
},

"fn-multi": {
  lede: "Функция умеет вернуть не одно значение, а сразу несколько. Секрета нет: это кортеж из Мира 2.",
  theory: [
    { h:"return через запятую — это кортеж",
      p:"Никакой особой возможности здесь нет: <code>return a, b</code> собирает кортеж и отдаёт его. Убедиться просто: <code>type(x)</code> показывает, что за значение перед тобой — печатается это как <code>&lt;class 'tuple'&gt;</code>.",
      demo:'def split_name(full):\n    parts = full.split()\n    return parts[0], parts[1]\n\n\nresult = split_name("Иван Петров")\nprint(result)\nprint(type(result))' },
    { h:"Распаковка на приёме",
      p:"Слева от <code>=</code> ставишь столько имён, сколько значений вернула функция. Так читать удобнее, чем <code>result[0]</code> и <code>result[1]</code>.",
      demo:'def split_name(full):\n    parts = full.split()\n    return parts[0], parts[1]\n\n\nfirst, last = split_name("Иван Петров")\nprint("имя:", first)\nprint("фамилия:", last)' },
    { h:"Три и больше — так же",
      p:"Количество имён слева должно совпадать с количеством значений. Если не совпадает, Python скажет об этом прямо. И заодно про запись <code>{avg:.2f}</code>: двоеточие в f-строке начинает формат, <code>.2f</code> значит «два знака после точки».",
      demo:'def stats(nums):\n    return min(nums), max(nums), sum(nums) / len(nums)\n\n\nlow, high, avg = stats([4, 9, 1, 7])\nprint(low, high, avg)\nprint(f"среднее: {avg:.2f}")' },
    { h:"Если имён не столько",
      p:"Этот пример падает — так и задумано. Прочитай сообщение: оно сразу говорит, сколько значений было и сколько имён ждали.",
      demo:'def stats(nums):\n    return min(nums), max(nums)\n\n\nlow, high, avg = stats([1, 2, 3])\nprint(low)',
      err:true }
  ],
  task:{
    type:"code",
    goal:"Напиши функцию <code>bounds(nums)</code>, которая возвращает три значения: минимум, максимум и разницу между ними.",
    list:[
      "Вернуть ровно три значения одним return",
      "Разница — это максимум минус минимум",
      "В основной программе распакуй результат в три переменные low, high, spread",
      "Печатать нужно так: <code>мин 1, макс 9, разброс 8</code>"
    ],
    starter:'def bounds(nums):\n    return 0\n\n\nnums = [4, 9, 1, 7, 3]\nlow = 0\nhigh = 0\nspread = 0\nprint(f"мин {low}, макс {high}, разброс {spread}")\n',
    solution:'def bounds(nums):\n    return min(nums), max(nums), max(nums) - min(nums)\n\n\nnums = [4, 9, 1, 7, 3]\nlow, high, spread = bounds(nums)\nprint(f"мин {low}, макс {high}, разброс {spread}")\n',
    hints:[
      "min(nums) и max(nums) были в Мире 1, в уроке про списки — их можно вызывать прямо в return",
      "На приёме одна строка вместо трёх: low, high, spread = bounds(nums)",
      "Целиком: return min(nums), max(nums), max(nums) - min(nums)"
    ],
    check:{ kind:"output",
      needCode:["def "],
      needMsg:"Задание про функцию: её нужно объявить через def и позвать." }
  }
},

"scope": {
  lede: "Переменная внутри функции — местная. Она рождается при вызове и исчезает, когда функция закончилась. Из этого правила растёт ошибка, на которую попадаются все.",
  theory: [
    { h:"Местная переменная не видна снаружи",
      p:"Всё, что создано внутри функции, живёт только внутри. Снаружи такого имени просто нет — и это хорошо: функции не мешают друг другу.",
      demo:'def calc():\n    secret = 42\n    return secret * 2\n\n\nprint(calc())\nprint(secret)',
      err:true },
    { h:"Читать внешнюю переменную можно",
      p:"Если внутри функции имя только читают, Python возьмёт его снаружи. Но полагаться на это не стоит: через месяц не поймёшь, откуда значение.",
      demo:'bonus = 10\n\n\ndef damage(base):\n    return base + bonus\n\n\nprint(damage(5))' },
    { h:"А присваивать — уже нет",
      p:"Как только в функции есть присваивание этому имени, оно становится местным во <b>всей</b> функции. Строка ниже ломает строку выше — вот это и удивляет.",
      demo:'score = 0\n\n\ndef add(points):\n    score = score + points\n    return score\n\n\nprint(add(5))',
      err:true },
    { h:"Как делать правильно",
      p:"Передать значение параметром и вернуть результат. Слово <code>global</code> тоже работает, но с ним функция тайком меняет чужие данные — в больших программах это источник путаницы.",
      demo:'score = 0\n\n\ndef add(current, points):\n    return current + points\n\n\nscore = add(score, 5)\nscore = add(score, 3)\nprint("через параметр:", score)\n\ntotal = 0\n\n\ndef add_global(points):\n    global total\n    total = total + points\n\n\nadd_global(5)\nadd_global(3)\nprint("через global:", total)' }
  ],
  task:{
    type:"code",
    goal:"Допиши две функции копилки так, чтобы они ничего не знали о внешних переменных.",
    list:[
      "add(current, amount) возвращает новую сумму копилки",
      "spend(current, amount) вычитает — но если денег не хватает, возвращает копилку без изменений",
      "Обе функции работают только со своими параметрами: слово global запрещено",
      "Вызовы и печать в заготовке менять не нужно"
    ],
    starter:'coins = 0\n\n\ndef add(current, amount):\n    return 0\n\n\ndef spend(current, amount):\n    return 0\n\n\ncoins = add(coins, 5)\ncoins = add(coins, 3)\ncoins = spend(coins, 2)\ncoins = spend(coins, 100)\nprint("В копилке:", coins)\n',
    solution:'coins = 0\n\n\ndef add(current, amount):\n    return current + amount\n\n\ndef spend(current, amount):\n    if amount > current:\n        return current\n    return current - amount\n\n\ncoins = add(coins, 5)\ncoins = add(coins, 3)\ncoins = spend(coins, 2)\ncoins = spend(coins, 100)\nprint("В копилке:", coins)\n',
    hints:[
      "add проще некуда: return current + amount",
      "В spend сначала проверь, хватает ли: if amount > current — тогда просто вернуть current",
      "Последний вызов тратит 100 из 6 — значит копилка должна остаться прежней"
    ],
    check:{ kind:"output", noCode:["global"],
            noMsg:"Смысл урока в том, чтобы обойтись без global: функция получает значение параметром и возвращает результат.",
      needCode:["def "],
      needMsg:"Задание про функцию: её нужно объявить через def и позвать." }
  }
},

"fn-default": {
  lede: "Параметру можно заранее дать значение — тогда аргумент необязателен. Удобно. И здесь же спрятана самая известная ловушка Python.",
  theory: [
    { h:"Значение по умолчанию",
      p:"Записывается прямо в объявлении. Если аргумент не передали, берётся то, что записано. Параметры со значением по умолчанию идут после обычных.",
      demo:'def greet(name, greeting="Привет"):\n    return f"{greeting}, {name}!"\n\n\nprint(greet("Аня"))\nprint(greet("Боря", "Здравствуй"))\nprint(greet("Витя", greeting="Салют"))' },
    { h:"Оно вычисляется один раз",
      p:"Это главное. Значение по умолчанию считается <b>в момент объявления функции</b>, а не при каждом вызове. Для числа и строки разницы не видно — они неизменяемые.",
      demo:'def stamp(text, mark="—"):\n    return mark + " " + text\n\n\nprint(stamp("раз"))\nprint(stamp("два"))' },
    { h:"А теперь список",
      p:"Список изменяемый. Он создан один раз — и остался один на все вызовы. Каждый вызов добавляет в тот же самый список. Смотри на вывод: он растёт.",
      demo:'def collect(item, box=[]):\n    box.append(item)\n    return box\n\n\nprint(collect("меч"))\nprint(collect("щит"))\nprint(collect("зелье"))' },
    { h:"Правильный приём",
      p:"По умолчанию ставят <code>None</code>, а внутри проверяют. Тогда новый список создаётся при каждом вызове — то есть тогда, когда он и нужен. Проверка пишется через <code>is</code>: он спрашивает «это тот же самый объект?», а не «равны ли значения». С <code>None</code> всегда пишут <code>is</code>.",
      demo:'def collect(item, box=None):\n    if box is None:\n        box = []\n    box.append(item)\n    return box\n\n\nprint(collect("меч"))\nprint(collect("щит"))\nmy = ["лук"]\nprint(collect("стрела", my))\nprint(collect("зелье"))' }
  ],
  task:{
    type:"fix",
    goal:"Функция должна собирать список покупок. Каждый вызов без второго аргумента начинает <b>новый</b> список.",
    symptom:"Списки склеиваются: во втором вызове появляется товар из первого, в третьем — из первых двух. Ожидалось по одному товару в каждом.",
    list:[
      "Исправь причину, а не следствие: строки с print оставь как есть",
      "Правильный приём был в теории — примени его",
      "Каждый print должен показать список ровно из одного товара"
    ],
    starter:'def buy(item, cart=[]):\n    cart.append(item)\n    return cart\n\n\nprint(buy("хлеб"))\nprint(buy("молоко"))\nprint(buy("сыр"))\n',
    solution:'def buy(item, cart=None):\n    if cart is None:\n        cart = []\n    cart.append(item)\n    return cart\n\n\nprint(buy("хлеб"))\nprint(buy("молоко"))\nprint(buy("сыр"))\n',
    hints:[
      "Пустой список в объявлении создаётся один раз на всю жизнь функции — вот он и накапливает",
      "Поставь cart=None вместо cart=[]",
      "И первыми строками внутри функции: if cart is None: cart = []"
    ],
    check:{ kind:"output", fixBudget:4 }
  }
},

"fn-varargs": {
  lede: "Иногда заранее неизвестно, сколько аргументов будет. Для этого есть звёздочка: <code>*args</code> собирает лишние по порядку, <code>**kwargs</code> — лишние по имени.",
  theory: [
    { h:"Пустое — это ложь",
      p:"Пригодится через минуту. В условии пустой список, пустой кортеж, пустой словарь, пустая строка и ноль считаются ложью, а всё непустое — правдой. Проверить можно функцией <code>bool</code>: она показывает, чем значение окажется в условии. Поэтому <code>if not nums</code> читается как «если ничего не передали».",
      demo:'print(bool([]), bool([1]))\nprint(bool(""), bool("а"))\nprint(bool(()), bool((1,)))\nprint(bool({}), bool({"а": 1}))\nprint(bool(0), bool(7))\n\nnums = []\nif not nums:\n    print("ничего не передали")' },
    { h:"*args — сколько угодно значений",
      p:"Звёздочка перед именем параметра означает «всё остальное сюда». Внутри функции это обычный кортеж, по нему можно пройти циклом. Имя <code>args</code> — просто договорённость, можно любое.",
      demo:'def total(*nums):\n    return sum(nums)\n\n\nprint(total())\nprint(total(5))\nprint(total(1, 2, 3, 4))\n\n\ndef show(*nums):\n    print(nums, type(nums), len(nums))\n\n\nshow(1, 2, 3)' },
    { h:"**kwargs — сколько угодно именованных",
      p:"Две звёздочки собирают аргументы, переданные по имени, в словарь: имя параметра становится ключом. Если ничего не передали, словарь пустой — и это как раз тот случай, когда пригодится <code>if not</code>.",
      demo:'def card(name, **props):\n    if not props:\n        return name\n    parts = [f"{k}={props[k]}" for k in sorted(props)]\n    return name + ": " + ", ".join(parts)\n\n\nprint(card("Аня"))\nprint(card("Боря", hp=10, mp=3))\nprint(card("Витя", level=7, hp=20, mp=1))' },
    { h:"Всё вместе — строго по порядку",
      p:"Обычный порядок такой: сначала простые параметры, потом со значением по умолчанию, потом <code>*args</code>, в самом конце <code>**kwargs</code>. Он не единственный возможный, но самый частый и самый понятный — на нём и остановимся.",
      demo:'def log(event, level="инфо", *extra, **fields):\n    line = f"[{level}] {event}"\n    if extra:\n        line += " " + " ".join([str(e) for e in extra])\n    for k in sorted(fields):\n        line += f" {k}={fields[k]}"\n    return line\n\n\nprint(log("вход"))\nprint(log("ошибка", "важно", "код", 500, user="аня"))' },
    { h:"Звёздочка работает и при вызове",
      p:"Там она делает обратное: разбирает готовый список или словарь на отдельные аргументы. Это тот же значок, но смысл зеркальный.",
      demo:'def total(*nums):\n    return sum(nums)\n\n\nnums = [1, 2, 3, 4]\nprint(total(nums[0], nums[1], nums[2], nums[3]))\nprint(total(*nums))\n\n\ndef hit(damage, armor):\n    return damage - armor\n\n\nsettings = {"damage": 10, "armor": 3}\nprint(hit(**settings))' }
  ],
  task:{
    type:"code",
    goal:"Напиши две функции: <code>stats(*nums)</code> и <code>tag(name, **props)</code>.",
    list:[
      "stats без аргументов возвращает строку «нет данных»",
      "stats с числами возвращает «N шт, сумма S, максимум M» — например «3 шт, сумма 12, максимум 7»",
      "tag возвращает «имя [ключ:значение; ключ:значение]», ключи по алфавиту",
      "tag без именованных аргументов возвращает просто «имя», без скобок",
      "Вызовы в заготовке менять не нужно"
    ],
    starter:'def stats(*nums):\n    return "нет данных"\n\n\ndef tag(name, **props):\n    return name\n\n\nprint(stats())\nprint(stats(7, 2, 3))\nprint(tag("щит"))\nprint(tag("меч", урон=7, вес=3))\n',
    solution:'def stats(*nums):\n    if not nums:\n        return "нет данных"\n    return f"{len(nums)} шт, сумма {sum(nums)}, максимум {max(nums)}"\n\n\ndef tag(name, **props):\n    if not props:\n        return name\n    parts = [f"{k}:{props[k]}" for k in sorted(props)]\n    return name + " [" + "; ".join(parts) + "]"\n\n\nprint(stats())\nprint(stats(7, 2, 3))\nprint(tag("щит"))\nprint(tag("меч", урон=7, вес=3))\n',
    hints:[
      "Про пустоту было в теории: if not nums значит «ничего не передали»",
      "len(nums), sum(nums), max(nums) — всё, что нужно для строки. Собери её f-строкой",
      "Для tag: sorted(props) даёт ключи по алфавиту, пары собираются включением, а склеивает их \"; \".join([...])"
    ],
    check:{ kind:"output",
      needCode:["def "],
      needMsg:"Задание про функции: их нужно объявить через def." }
  }
},

"recursion": {
  lede: "Функция имеет право позвать саму себя. Звучит как трюк, но это обычный приём для задач, которые сами состоят из своих уменьшенных копий.",
  theory: [
    { h:"База и шаг",
      p:"В любой рекурсии две части: <b>база</b> — когда пора остановиться, и <b>шаг</b> — вызов себя с задачей поменьше. Без базы функция не остановится никогда.",
      demo:'def countdown(n):\n    if n == 0:\n        print("пуск!")\n        return\n    print(n)\n    countdown(n - 1)\n\n\ncountdown(5)' },
    { h:"Классика: факториал",
      p:"Факториал 5 — это 5 умножить на факториал 4. Вот и всё определение: задача сводится к такой же, но меньше. База — единица.",
      demo:'def fact(n):\n    if n <= 1:\n        return 1\n    return n * fact(n - 1)\n\n\nfor i in range(1, 8):\n    print(i, "! =", fact(i))' },
    { h:"Без базы — обрыв",
      p:"Каждый вызов занимает память, и глубина не бесконечна. Тренажёр остановит программу на 220-м вложенном вызове и скажет, в чём дело. Настоящий Python делает то же самое около тысячного.",
      demo:'def forever(n):\n    return forever(n + 1)\n\n\nprint(forever(1))',
      err:true },
    { h:"Когда рекурсия удобнее цикла",
      p:"Когда данные вложены сами в себя: папки в папках, ветки дерева, список внутри списка. Циклом такое разворачивать больно, а рекурсией — одна строка.",
      demo:'def deep_sum(items):\n    total = 0\n    for x in items:\n        if type(x) is list:\n            total += deep_sum(x)\n        else:\n            total += x\n    return total\n\n\nprint(deep_sum([1, 2, 3]))\nprint(deep_sum([1, [2, 3], [4, [5, 6]]]))' }
  ],
  task:{
    type:"code",
    goal:"Напиши функцию <code>digit_sum(n)</code>: сумма цифр числа — рекурсией, без циклов.",
    list:[
      "digit_sum(7) → 7, digit_sum(123) → 6, digit_sum(9999) → 36",
      "База: если число меньше 10, оно само и есть ответ",
      "Шаг: последняя цифра это n % 10, остальное число — n // 10",
      "Циклы for и while в этом задании запрещены"
    ],
    starter:'def digit_sum(n):\n    return n\n\n\nprint(digit_sum(7))\nprint(digit_sum(123))\nprint(digit_sum(9999))\nprint(digit_sum(100))\n',
    solution:'def digit_sum(n):\n    if n < 10:\n        return n\n    return n % 10 + digit_sum(n // 10)\n\n\nprint(digit_sum(7))\nprint(digit_sum(123))\nprint(digit_sum(9999))\nprint(digit_sum(100))\n',
    hints:[
      "Сначала база: if n < 10: return n — иначе функция не остановится",
      "n % 10 отрезает последнюю цифру, n // 10 — всё число без неё",
      "return n % 10 + digit_sum(n // 10)"
    ],
    check:{ kind:"output", noCode:["for","while"],
            noMsg:"Задание про рекурсию: цифры нужно перебрать вызовами самой функции, а не циклом. Убери for и while.",
      needCode:["def "],
      needMsg:"Задание про рекурсию: функцию нужно объявить через def." }
  }
},

"fn-as-value": {
  lede: "Функция — такое же значение, как число или строка. Её можно положить в переменную, в список, в словарь и передать другой функции.",
  theory: [
    { h:"Имя без скобок — сама функция",
      p:"Со скобками — вызов, без скобок — сама функция как значение. Отсюда правило: <code>double</code> это функция, <code>double(4)</code> это число. Значение можно положить в переменную — и звать уже через неё.",
      demo:'def double(x):\n    return x * 2\n\n\nprint(type(double))\nprint(double(4))\naction = double\nprint(action(10))' },
    { h:"Функцию можно передать в функцию",
      p:"Тогда одна функция описывает <b>что делать</b>, а другая — <b>с чем</b>. Такое уже было в Мире 2: <code>max(words, key=len)</code> — как раз передача функции.",
      demo:'def apply_all(fn, items):\n    return [fn(x) for x in items]\n\n\ndef double(x):\n    return x * 2\n\n\nprint(apply_all(double, [1, 2, 3]))\nprint(apply_all(len, ["аб", "в", "гдеё"]))\nprint(apply_all(str, [1, 2, 3]))' },
    { h:"Словарь функций вместо длинного if",
      p:"Когда действие выбирается по названию, словарь короче и понятнее цепочки <code>if</code>. Ключ — название, значение — функция.",
      demo:'def add(a, b):\n    return a + b\n\n\ndef sub(a, b):\n    return a - b\n\n\nops = {"+": add, "-": sub}\nfor sign in ["+", "-"]:\n    print(sign, "->", ops[sign](10, 4))' },
    { h:"lambda — та же функция, короче",
      p:"<code>lambda</code> из Мира 2 — это просто функция без имени. В словарь её кладут так же, как обычную. Годится, когда тело — одно выражение.",
      demo:'formulas = {\n    "площадь": lambda a, b: a * b,\n    "периметр": lambda a, b: 2 * (a + b),\n    "сторона побольше": max,\n}\nfor name in ["площадь", "периметр", "сторона побольше"]:\n    print(name, "->", formulas[name](6, 7))' }
  ],
  task:{
    type:"code",
    goal:"Собери маленький калькулятор на словаре функций.",
    list:[
      "Сделай словарь ops с четырьмя ключами: «+», «-», «*», «max»",
      "Первые три — свои функции или lambda, «max» — встроенная функция max",
      "Функция apply(table, sign, a, b) должна найти нужную и вернуть результат",
      "Если знака в словаре нет, apply возвращает строку «не знаю такой знак»",
      "Строки с print менять не нужно"
    ],
    starter:'ops = {}\n\n\ndef apply(table, sign, a, b):\n    return 0\n\n\nfor sign in ["+", "-", "*", "max", "?"]:\n    print(sign, "->", apply(ops, sign, 12, 5))\n',
    solution:'ops = {\n    "+": lambda a, b: a + b,\n    "-": lambda a, b: a - b,\n    "*": lambda a, b: a * b,\n    "max": max,\n}\n\n\ndef apply(table, sign, a, b):\n    if sign not in table:\n        return "не знаю такой знак"\n    return table[sign](a, b)\n\n\nfor sign in ["+", "-", "*", "max", "?"]:\n    print(sign, "->", apply(ops, sign, 12, 5))\n',
    hints:[
      "Значение в словаре — функция без скобок: \"max\": max, а не \"max\": max()",
      "Проверка «есть ли ключ» — знакомый оператор in: if sign not in table",
      "Достали функцию — сразу вызвали: return table[sign](a, b)"
    ],
    check:{ kind:"output",
      needCode:["def "],
      needMsg:"Задание про функции как значения: их нужно объявить через def." }
  }
},

"modules-own": {
  lede: "Когда файл разрастается, его делят на части. Каждый файл — <b>модуль</b>: набор функций, которым можно пользоваться из другого файла.",
  theory: [
    { h:"Два файла вместо одного",
      p:"Слева над редактором появились вкладки: <code>main.py</code> и <code>tools.py</code>. Программа запускается всегда из <code>main.py</code>. Второй файл сам по себе ничего не делает — он ждёт, когда его подключат.",
      files:{ "tools.py": 'def greet(name):\n    return "привет, " + name\n' },
      demo:'import tools\n\nprint(tools.greet("Аня"))' },
    { h:"import берёт модуль целиком",
      p:"После <code>import tools</code> все функции из файла доступны через точку: <code>tools.greet(...)</code>. Имя модуля — это имя файла без <code>.py</code>.",
      files:{ "tools.py": 'PREFIX = "→ "\n\n\ndef greet(name):\n    return "привет, " + name\n\n\ndef frame(text):\n    return PREFIX + text + " " + PREFIX\n' },
      demo:'import tools\n\nprint(tools.greet("Аня"))\nprint(tools.frame("важное"))\nprint(tools.PREFIX + "и переменные тоже")' },
    { h:"from ... import берёт по имени",
      p:"Если нужна одна функция, её забирают отдельно — тогда точка не нужна. Так короче, но по коду труднее понять, откуда взялось имя.",
      files:{ "tools.py": 'def trim(text):\n    return text.strip()\n\n\ndef repeat(text, times):\n    return text * times\n' },
      demo:'from tools import trim, repeat\n\nprint(trim("   тише   ") + "|")\nprint(repeat("ха", 3))' },
    { h:"В модуль попадает всё, что объявлено в файле",
      p:"Функции, переменные, классы — всё, что записано в файле на верхнем уровне. Поэтому модуль стоит держать «чистым»: только определения, без лишних <code>print</code>.",
      files:{ "tools.py": 'print("этот print сработает при import — так делать не надо")\n\n\ndef hello():\n    return "привет"\n' },
      demo:'import tools\n\nprint(tools.hello())' }
  ],
  task:{
    type:"code",
    goal:"Собери свой первый модуль. Файл <code>main.py</code> уже готов и менять его не нужно — работать надо в <code>tools.py</code>.",
    list:[
      "Открой вкладку tools.py",
      "Функция clean(text) должна убрать пробелы по краям и сделать текст маленькими буквами",
      "Функция shout(text) должна вернуть текст ЗАГЛАВНЫМИ и добавить в конец восклицательный знак",
      "main.py не трогай"
    ],
    mainName:"main.py",
    files:[
      { name:"tools.py",
        starter:'def clean(text):\n    return text          # пока просто отдаёт как было\n\n\ndef shout(text):\n    return text          # и тут тоже\n',
        solution:'def clean(text):\n    return text.strip().lower()\n\n\ndef shout(text):\n    return text.upper() + "!"\n' }
    ],
    starter:'import tools\n\nprint(tools.clean("   ДоБрОе УтРо   "))\nprint(tools.shout("подъём"))\n',
    solution:'import tools\n\nprint(tools.clean("   ДоБрОе УтРо   "))\nprint(tools.shout("подъём"))\n',
    hints:[
      "Убрать пробелы по краям — strip(). Сделать маленькими — lower(). Их можно вызвать подряд: text.strip().lower()",
      "Заглавные — upper(). Восклицательный знак приклеивается сложением: text.upper() + \"!\"",
      "Не забудь return: функция без return возвращает None, и в выводе появится None"
    ],
    check:{ kind:"output" }
  }
},

"try-except": {
  lede: "Ошибка не обязана убивать программу. Её можно поймать, разобраться и работать дальше — этим и занимается <code>try</code>.",
  theory: [
    { h:"try — попробовать, except — если не вышло",
      p:"Код, который может упасть, кладут в <code>try</code>. Если он падает, управление прыгает в <code>except</code>, и программа продолжает жить.",
      demo:'text = "сто"\ntry:\n    n = int(text)\n    print("получилось число", n)\nexcept ValueError:\n    print("это не число, беру 0")\n    n = 0\n\nprint("работаем дальше, n =", n)' },
    { h:"Ловить нужно конкретную ошибку",
      p:"<code>except ValueError</code> ловит только неподходящее значение. Голый <code>except</code> ловит вообще всё — вместе с твоими опечатками, и тогда настоящая причина прячется. Так делать не надо.",
      demo:'def to_int(text):\n    try:\n        return int(text)\n    except ValueError:\n        return 0\n\n\nprint(to_int("42"), to_int("сорок два"), to_int("-7"))' },
    { h:"as e — посмотреть, что случилось",
      p:"Сама ошибка — это значение, его можно положить в переменную и напечатать. Текст будет по-английски: так пишет сам Python, и в жизни ты будешь читать именно его.",
      demo:'for text in ["10", "три", ""]:\n    try:\n        print(text, "->", int(text))\n    except ValueError as e:\n        print(text, "-> ошибка:", e)' },
    { h:"Разные ошибки — разные ответы",
      p:"Обработчиков можно поставить несколько, а если ответ одинаковый — перечислить типы в скобках. Тип ошибки узнаётся так: <code>type(e).__name__</code>.",
      demo:'data = {"а": 1}\nitems = [10, 20]\n\nfor action in ["ключ", "номер", "деление"]:\n    try:\n        if action == "ключ":\n            print(data["б"])\n        elif action == "номер":\n            print(items[5])\n        else:\n            print(10 / 0)\n    except (KeyError, IndexError) as e:\n        print(action, "-> нет такого:", type(e).__name__)\n    except ZeroDivisionError as e:\n        print(action, "->", e)' },
    { h:"else и finally",
      p:"<code>else</code> выполняется, если ошибки не было. <code>finally</code> — всегда, даже если была: там закрывают то, что открыли.",
      demo:'def read(text):\n    try:\n        n = int(text)\n    except ValueError:\n        print("  не разобрал:", text)\n        return None\n    else:\n        print("  разобрал:", n)\n        return n\n    finally:\n        print("  проверку закончил")\n\n\nprint(read("5"))\nprint(read("пять"))' }
  ],
  task:{
    type:"code",
    goal:"Разбери список ответов: числа сложи, а всё остальное посчитай отдельно.",
    list:[
      "Пройди по списку answers",
      "Если строку удалось превратить в число — прибавь к total",
      "Если нет — увеличь bad на единицу",
      "Обязательно через try / except ValueError, а не через isdigit",
      "В конце напечатать: «Сумма: 37» и «Испорчено: 3»"
    ],
    starter:'answers = ["10", "7", "нет", "25", "", "-5", "пять"]\ntotal = 0\nbad = 0\n\nfor a in answers:\n    pass\n\nprint("Сумма:", total)\nprint("Испорчено:", bad)\n',
    solution:'answers = ["10", "7", "нет", "25", "", "-5", "пять"]\ntotal = 0\nbad = 0\n\nfor a in answers:\n    try:\n        total += int(a)\n    except ValueError:\n        bad += 1\n\nprint("Сумма:", total)\nprint("Испорчено:", bad)\n',
    hints:[
      "Внутри цикла: try, потом попытка int(a), потом except ValueError",
      "В try достаточно одной строки: total += int(a). Если int упадёт, прибавления не случится",
      "В except увеличиваем счётчик испорченных: bad += 1"
    ],
    check:{ kind:"output", needCode:["except"],
            needMsg:"В этом задании нужен именно try/except — по условию проверяем через попытку, а не через isdigit." }
  }
},

"raise": {
  lede: "Ошибку можно не только ловить, но и создавать самому. Это способ честно сказать: данные негодные, дальше считать нельзя.",
  theory: [
    { h:"raise вместо тихой чуши",
      p:"Функция получила ерунду. Вернуть 0 — плохо: вызвавший решит, что всё в порядке. Напечатать и продолжить — тоже плохо. Правильно — возбудить ошибку и остановиться.",
      demo:'def set_age(n):\n    if n < 0:\n        raise ValueError("возраст не бывает отрицательным")\n    return n\n\n\nprint(set_age(12))\nprint(set_age(-3))',
      err:true },
    { h:"Кто вызвал — тот и решает",
      p:"Смысл в том, что решение принимает вызывающий код: он знает, что делать. Одному нужно спросить заново, другому — записать в журнал и идти дальше.",
      demo:'def set_age(n):\n    if n < 0:\n        raise ValueError("возраст не бывает отрицательным")\n    return n\n\n\nfor value in [12, -3, 40]:\n    try:\n        print("принято:", set_age(value))\n    except ValueError as e:\n        print("отказ:", e)' },
    { h:"Выбирай подходящий тип",
      p:"<code>ValueError</code> — значение не годится. <code>TypeError</code> — не тот тип. <code>KeyError</code> — нет такого ключа. Тип ошибки — это половина сообщения.",
      demo:'def repeat(text, times):\n    if type(text) is not str:\n        raise TypeError("первым аргументом нужна строка")\n    if times < 1:\n        raise ValueError("повторить нужно хотя бы один раз")\n    return text * times\n\n\nfor args in [("ха", 3), (5, 3), ("ха", 0)]:\n    try:\n        print(repeat(args[0], args[1]))\n    except (TypeError, ValueError) as e:\n        print(type(e).__name__, "->", e)' },
    { h:"Своя ошибка — свой класс",
      p:"Когда встроенные типы не подходят по смыслу, объявляют свой: одна строка, наследник <code>Exception</code>. Дальше он работает как остальные. Слово <code>class</code> здесь забегает вперёд — классы разбираются в уроках 14–19 этого мира. Пока достаточно запомнить эти две строки как готовый приём.",
      demo:'class TooLoud(Exception):\n    pass\n\n\ndef say(text):\n    if text.isupper():\n        raise TooLoud("не кричи: " + text)\n    return text\n\n\nfor phrase in ["привет", "АААА"]:\n    try:\n        print(say(phrase))\n    except TooLoud as e:\n        print("поймали свою ошибку:", e)' }
  ],
  task:{
    type:"code",
    goal:"Функция <code>register(name, age)</code> должна отказываться от негодных данных через <code>raise</code>.",
    list:[
      "Если имя короче двух букв — raise ValueError(\"имя слишком короткое\")",
      "Если возраст меньше 5 или больше 120 — raise ValueError(\"возраст вне разумных границ\")",
      "Если всё в порядке — вернуть строку «Аня, 12»",
      "Цикл с проверками в заготовке менять не нужно"
    ],
    starter:'def register(name, age):\n    return f"{name}, {age}"\n\n\nfor person in [("Аня", 12), ("Я", 12), ("Боря", 200), ("Витя", 40)]:\n    try:\n        print(register(person[0], person[1]))\n    except ValueError as e:\n        print("отказ:", e)\n',
    solution:'def register(name, age):\n    if len(name) < 2:\n        raise ValueError("имя слишком короткое")\n    if age < 5 or age > 120:\n        raise ValueError("возраст вне разумных границ")\n    return f"{name}, {age}"\n\n\nfor person in [("Аня", 12), ("Я", 12), ("Боря", 200), ("Витя", 40)]:\n    try:\n        print(register(person[0], person[1]))\n    except ValueError as e:\n        print("отказ:", e)\n',
    hints:[
      "Проверки идут первыми строками функции, до return",
      "Длина имени — len(name). Условие: if len(name) < 2",
      "Границы возраста в одном условии: if age < 5 or age > 120"
    ],
    check:{ kind:"output", needCode:["raise"],
            needMsg:"Условие задания: о негодных данных нужно сообщать через raise, а не возвращать текст об ошибке." }
  }
},

"debug": {
  lede: "Баг — это не «программа сломалась». Это «программа делает не то, что задумано». Искать причину нужно приёмами, а не наугад.",
  theory: [
    { h:"Шаг первый: что ожидал и что получил",
      p:"Пока оба ответа не названы точно, искать нечего. «Не работает» — не описание. «Надо 28, вышло 10» — уже описание, и оно почти показывает, где смотреть.",
      demo:'nums = [4, 8, 6, 10]\ntotal = 0\nfor n in nums:\n    total = n\nprint("надо 28, вышло", total)' },
    { h:"Шаг второй: печатать промежуточное",
      p:"Самый быстрый способ — вставить <code>print</code> внутрь цикла и посмотреть, что там на каждом шаге. Не гадай: смотри.",
      demo:'nums = [4, 8, 6, 10]\ntotal = 0\nfor n in nums:\n    total = n\n    print("  шаг: n =", n, "total =", total)\nprint("итог:", total)' },
    { h:"Шаг третий: сузить участок",
      p:"Если программа длинная, отрежь половину. Работает — виновата вторая половина. Не работает — первая. Пять таких делений хватает почти всегда. В примере пригодится <code>repr</code>: он печатает строку с кавычками, и тогда видно пробелы и пустоту.",
      demo:'def tidy(line):\n    line = line.strip()\n    line = line.replace(",", "")\n    line = line.replace("  ", " ")\n    return line\n\n\n# проверяем по одному шагу, а не всю цепочку сразу\nprint(repr("  раз, два  ".strip()))\nprint(repr("  раз, два  ".strip().replace(",", "")))\nprint(repr(tidy("  раз,  два  ")))' },
    { h:"Частые причины",
      p:"Перепутаны <code>=</code> и <code>==</code>. Промах на единицу в <code>range</code>. Присваивание вместо накопления, как в примерах выше. Изменение списка прямо в цикле по нему. Сравнение строки с числом: <code>\"5\" == 5</code> — это ложь.",
      demo:'print("5" == 5)\nprint(int("5") == 5)\nprint(list(range(1, 5)))\nprint(list(range(1, 6)))\n\nitems = [1, 2, 3, 4]\nfor x in items[:]:\n    if x % 2 == 0:\n        items.remove(x)\nprint("копия спасла:", items)' }
  ],
  task:{
    type:"fix",
    goal:"Программа проверяет ответы теста. Правильный ответ — 5, и его дали дважды, значит должно напечататься «Верных: 2».",
    symptom:"Печатается «Верных: 0», хотя два ответа в списке — пятёрки. Программа не падает и ничего не подчёркивает: просто считает не то.",
    list:[
      "Найди одну строку с ошибкой и исправь её",
      "Список ответов и печать не трогай, count() и готовое число не годятся",
      "Помогает приём из урока: напечатать внутри цикла то, что сравнивается"
    ],
    starter:'answers = ["5", "3", "5", "7"]\nright = 0\n\nfor a in answers:\n    if a == 5:\n        right = right + 1\n\nprint("Верных:", right)\n',
    solution:'answers = ["5", "3", "5", "7"]\nright = 0\n\nfor a in answers:\n    if int(a) == 5:\n        right = right + 1\n\nprint("Верных:", right)\n',
    hints:[
      "Вставь в цикл строку print(repr(a), a == 5) и посмотри, что сравнивается с чем",
      "В списке лежат строки — «5» в кавычках. Строка никогда не равна числу, об этом было в теории",
      "Либо сравнивай с числом после превращения: int(a) == 5, либо со строкой: a == \"5\""
    ],
    check:{ kind:"output" }
  }
},

"assert": {
  lede: "Проверять свою функцию вручную скучно и легко забыть. <code>assert</code> делает это за тебя: пока всё сходится, он молчит.",
  theory: [
    { h:"assert — утверждение",
      p:"<code>assert условие</code> означает «я утверждаю, что это правда». Если правда — ничего не происходит. Если нет — программа падает с <code>AssertionError</code> ровно на этой строке.",
      demo:'def double(x):\n    return x * 2\n\n\nassert double(2) == 4\nassert double(0) == 0\nassert double(-3) == -6\nprint("все проверки прошли")' },
    { h:"С сообщением понятнее",
      p:"После условия через запятую можно добавить текст. Он попадёт в ошибку — и через месяц не придётся вспоминать, что именно проверялось.",
      demo:'def double(x):\n    return x * 2\n\n\nassert double(3) == 7, "double(3) должно быть 6"\nprint("до этой строки дело не дойдёт")',
      err:true },
    { h:"Набор проверок — это уже тест",
      p:"Несколько <code>assert</code> внизу файла — простейший тест. Меняешь функцию, запускаешь файл: молчит — значит ничего не сломано. Так работают и настоящие тесты, только их запускает отдельная программа.",
      demo:'def clamp(value, low, high):\n    if value < low:\n        return low\n    if value > high:\n        return high\n    return value\n\n\nassert clamp(5, 1, 10) == 5\nassert clamp(-3, 1, 10) == 1\nassert clamp(99, 1, 10) == 10\nassert clamp(1, 1, 10) == 1\nprint("4 проверки прошли")' },
    { h:"Что проверять",
      p:"Обычный случай, край и пустоту. Хорошее правило: на каждую строчку условия в функции — одна проверка. И ещё: <code>assert</code> нужен для проверки себя, а не данных от пользователя — для них есть <code>raise</code> из урока про свои исключения.",
      demo:'def rank(score):\n    if score >= 90:\n        return "отлично"\n    if score >= 60:\n        return "нормально"\n    return "надо повторить"\n\n\nassert rank(100) == "отлично"\nassert rank(90) == "отлично"\nassert rank(89) == "нормально"\nassert rank(60) == "нормально"\nassert rank(59) == "надо повторить"\nassert rank(0) == "надо повторить"\nprint("границы проверены")' }
  ],
  task:{
    type:"code",
    goal:"Напиши функцию <code>strong(password)</code> и проверь её набором <code>assert</code>.",
    list:[
      "Пароль сильный, если в нём не меньше 8 знаков и есть хотя бы одна цифра",
      "Функция возвращает True или False",
      "Ниже напиши не меньше четырёх assert: сильный пароль, короткий, без цифр, пустой",
      "Строку с print внизу менять не нужно: она печатает четыре ответа, и по ним проверка увидит, права ли функция"
    ],
    starter:'def strong(password):\n    return True\n\n\n# твои проверки через assert:\n\nprint(strong("abcd1234"), strong("ab1"), strong("abcdefgh"), strong(""))\n',
    solution:'def strong(password):\n    if len(password) < 8:\n        return False\n    for ch in password:\n        if ch.isdigit():\n            return True\n    return False\n\n\nassert strong("abcd1234") == True\nassert strong("ab1") == False\nassert strong("abcdefgh") == False\nassert strong("") == False\n\nprint(strong("abcd1234"), strong("ab1"), strong("abcdefgh"), strong(""))\n',
    hints:[
      "Сначала длина: if len(password) < 8: return False",
      "Потом цифра: пройти циклом по знакам и проверить ch.isdigit()",
      "Проверки пишутся так: assert strong(\"abcd1234\") == True и assert strong(\"ab1\") == False"
    ],
    check:{ kind:"output", needCode:["assert"],
            needMsg:"Условие задания: проверки нужно написать через assert — не меньше четырёх, по одной на каждый случай." }
  }
},

"spec-tests": {
  lede: "На работе задачу дают текстом, а проверяют тестами, которых не видно. Этот урок — ровно про такую ситуацию.",
  theory: [
    { h:"Спецификация — это точное описание",
      p:"«Сделай красиво» — не спецификация. Спецификация говорит: что приходит на вход, что должно получиться на выходе и что делать в неудобных случаях.",
      demo:'# Спецификация функции short(text):\n#   вход  — строка\n#   выход — не длиннее 8 знаков\n#   если строка длиннее, обрезать и приклеить "…"\n\n\ndef short(text):\n    if len(text) <= 8:\n        return text\n    return text[:7] + "…"\n\n\nprint(short("привет"))\nprint(short("очень длинное название"))' },
    { h:"Неудобные случаи важнее обычных",
      p:"Обычный случай работает почти всегда сам. Ломается на краях: пустая строка, ноль, одно слово вместо двух, отрицательное число. Проверять надо именно их.",
      demo:'def middle(items):\n    if not items:\n        return None\n    return items[len(items) // 2]\n\n\nprint(middle([1, 2, 3]))\nprint(middle([]))\nprint(middle(["один"]))' },
    { h:"Свои проверки — до чужих",
      p:"Пока тесты скрыты, напиши свои. Если <code>assert</code> молчит — всё сходится. Если ругается — ошибка нашлась сама, ещё до проверки.",
      demo:'def short(text):\n    if len(text) <= 8:\n        return text\n    return text[:7] + "…"\n\n\nassert short("привет") == "привет"\nassert short("") == ""\nassert short("двенадцать") == "двенадц…"\nassert len(short("очень длинное название")) == 8\nprint("свои проверки прошли")' },
    { h:"Где такие функции ломаются",
      p:"Почти всегда — на пустом входе. Если брать первый знак напрямую, у пустой строки его нет, и программа падает. Такие места и надо искать заранее: пустая строка, ноль, один элемент вместо двух.",
      demo:'def first_letter(text):\n    return text[0].upper()\n\n\nprint(first_letter("аня"))\nprint(first_letter(""))',
      err:true }
  ],
  task:{
    type:"code",
    goal:"Напиши функцию <code>initials(name)</code> по спецификации. Тесты ты не увидишь — их запустит проверка.",
    list:[
      "Вход: строка с именем и фамилией через пробел. Лишние пробелы возможны",
      "Выход: первая буква каждого слова, заглавная, после каждой точка. «иван петров» → «И.П.»",
      "Если слово одно: «Пётр» → «П.»",
      "Если строка пустая или в ней только пробелы: вернуть пустую строку",
      "Функция должна возвращать значение, а не печатать его"
    ],
    starter:'def initials(name):\n    return name[0] + "."\n\n\nprint(initials("иван петров"))\n',
    solution:'def initials(name):\n    parts = name.split()\n    if not parts:\n        return ""\n    return "".join([w[0].upper() + "." for w in parts])\n\n\nprint(initials("иван петров"))\n',
    hints:[
      "split() без аргументов сам выбрасывает лишние пробелы: \"  а   б  \".split() даёт ['а', 'б']",
      "Пустой список — это ложь: if not parts означает «слов нет»",
      "Первая буква слова — w[0], заглавная — w[0].upper(). Склеить всё вместе поможет \"\".join([...])"
    ],
    check:{ kind:"tests", calls:[
      'initials("иван петров")',
      'initials("  анна   каренина  ")',
      'initials("Пётр")',
      'initials("")',
      'initials("   ")'
    ] }
  }
},

"class-first": {
  lede: "До сих пор данные жили в списках и словарях. Класс — способ собрать данные и действия в одну вещь и дать ей имя.",
  theory: [
    { h:"Класс — заготовка, объект — экземпляр",
      p:"<code>class</code> описывает, что это за вещь. Чтобы получить саму вещь, класс вызывают как функцию: <code>Hero()</code>. Так можно сделать сколько угодно объектов по одной заготовке.",
      demo:'class Hero:\n    pass\n\n\na = Hero()\nb = Hero()\nprint(type(a))\nprint(a is b)' },
    { h:"У объекта свои поля",
      p:"Поле дописывается через точку. У каждого объекта поля свои: изменение у одного не задевает второго. У словаря то же самое, но у объекта есть класс: по <code>type(a)</code> сразу видно, что это <code>Hero</code>, а не «какой-то словарь».",
      demo:'class Hero:\n    pass\n\n\nanya = Hero()\nanya.name = "Аня"\nanya.hp = 10\n\nborya = Hero()\nborya.name = "Боря"\nborya.hp = 7\n\nprint(anya.name, anya.hp)\nprint(borya.name, borya.hp)' },
    { h:"Поле класса — общее значение",
      p:"Записанное прямо в классе достаётся всем объектам сразу. Пока объект не завёл своё поле с тем же именем, он видит общее.",
      demo:'class Hero:\n    team = "синие"\n\n\na = Hero()\nb = Hero()\nprint(a.team, b.team)\n\nb.team = "красные"\nprint(a.team, b.team)\nprint(Hero.team)' },
    { h:"Чего у объекта нет — того нет",
      p:"Обращение к несуществующему полю — ошибка, а не пустота. Это к лучшему: опечатка находится сразу, а не превращается в тихий <code>None</code>.",
      demo:'class Hero:\n    pass\n\n\nh = Hero()\nh.name = "Аня"\nprint(h.nmae)',
      err:true }
  ],
  task:{
    type:"code",
    goal:"Опиши класс <code>Item</code> и сделай два предмета.",
    list:[
      "Меч в заготовке уже готов — это образец",
      "Сделай второй предмет shield: name «щит», damage 0, owner «Аня»",
      "Мечу поле owner не задавай: он должен взять общее из класса",
      "Добавь щит в список внизу, чтобы напечатались обе строки"
    ],
    starter:'class Item:\n    owner = "никто"\n\n\nsword = Item()\nsword.name = "меч"\nsword.damage = 7\n\n# сделай здесь щит по образцу\n\nfor it in [sword]:\n    print(f"{it.name}: урон {it.damage}, владелец {it.owner}")\n',
    solution:'class Item:\n    owner = "никто"\n\n\nsword = Item()\nsword.name = "меч"\nsword.damage = 7\n\nshield = Item()\nshield.name = "щит"\nshield.damage = 0\nshield.owner = "Аня"\n\nfor it in [sword, shield]:\n    print(f"{it.name}: урон {it.damage}, владелец {it.owner}")\n',
    hints:[
      "Щит создаётся так же, как меч: shield = Item(), потом три строки с точкой",
      "owner у щита своё — оно перекроет общее поле класса только для него",
      "Не забудь список внизу: for it in [sword, shield]"
    ],
    check:{ kind:"output", needCode:["class"],
            needMsg:"Задание про классы: нужен именно class Item, а не словарь." }
  }
},

"class-methods": {
  lede: "Объект умеет не только хранить, но и действовать. Функция внутри класса называется методом, и первым аргументом ей всегда достаётся сам объект.",
  theory: [
    { h:"Метод — функция внутри класса",
      p:"Объявляется тем же <code>def</code>, только с отступом внутри класса. Вызывается через точку у объекта. Первый параметр по договорённости зовут <code>self</code> — это и есть тот объект, у которого метод позвали.",
      demo:'class Dog:\n    def bark(self):\n        return "гав!"\n\n\nd = Dog()\nprint(d.bark())' },
    { h:"self даёт доступ к полям",
      p:"Через <code>self</code> метод читает и меняет поля своего объекта. Без <code>self</code> он о них не знает: <code>name</code> и <code>self.name</code> — разные вещи.",
      demo:'class Dog:\n    name = "без имени"\n\n    def bark(self):\n        return self.name + ": гав!"\n\n\na = Dog()\na.name = "Рекс"\nb = Dog()\nprint(a.bark())\nprint(b.bark())' },
    { h:"Метод с аргументами",
      p:"После <code>self</code> идут обычные параметры. При вызове <code>self</code> передавать не нужно — Python подставляет объект сам.",
      demo:'class Dog:\n    hp = 10\n\n    def hit(self, damage):\n        self.hp = self.hp - damage\n        return self.hp\n\n\nd = Dog()\nprint(d.hit(3))\nprint(d.hit(4))\nprint(d.hp)' },
    { h:"Метод может звать другой метод",
      p:"Через тот же <code>self</code>. Так из мелких понятных методов собираются большие — и не приходится повторять код.",
      demo:'class Fighter:\n    hp = 20\n\n    def alive(self):\n        return self.hp > 0\n\n    def hit(self, damage):\n        self.hp = self.hp - damage\n        if self.alive():\n            return f"осталось {self.hp}"\n        return "выбит"\n\n\nf = Fighter()\nprint(f.hit(8))\nprint(f.hit(8))\nprint(f.hit(8))' }
  ],
  task:{
    type:"code",
    goal:"Опиши класс <code>Purse</code> — ту же копилку, что была в уроке про область видимости, но теперь на классе. Сравни, где удобнее.",
    list:[
      "Общее поле coins со значением 0",
      "add(self, amount) прибавляет к копилке и возвращает новую сумму",
      "spend(self, amount) вычитает и возвращает сумму, но если денег не хватает — оставляет копилку как была",
      "Строки с print менять не нужно"
    ],
    starter:'class Purse:\n    coins = 0\n\n    def add(self, amount):\n        return 0\n\n    def spend(self, amount):\n        return 0\n\n\np = Purse()\nprint(p.add(5))\nprint(p.add(3))\nprint(p.spend(2))\nprint(p.spend(100))\nprint("итого:", p.coins)\n',
    solution:'class Purse:\n    coins = 0\n\n    def add(self, amount):\n        self.coins = self.coins + amount\n        return self.coins\n\n    def spend(self, amount):\n        if amount > self.coins:\n            return self.coins\n        self.coins = self.coins - amount\n        return self.coins\n\n\np = Purse()\nprint(p.add(5))\nprint(p.add(3))\nprint(p.spend(2))\nprint(p.spend(100))\nprint("итого:", p.coins)\n',
    hints:[
      "Внутри метода к полю обращаются через self: self.coins",
      "add: сначала self.coins = self.coins + amount, потом return self.coins",
      "spend: если amount > self.coins — сразу return self.coins, ничего не меняя"
    ],
    check:{ kind:"output",
      needCode:["class "],
      needMsg:"Задание про класс: его нужно объявить через class." }
  }
},

"class-init": {
  lede: "Дописывать поля по одной строке снаружи — неудобно и легко забыть. <code>__init__</code> задаёт их сразу при создании, а <code>__repr__</code> учит объект показывать себя.",
  theory: [
    { h:"__init__ срабатывает при создании",
      p:"Это метод с особым именем: Python зовёт его сам, когда объект создаётся. Аргументы из <code>Hero(\"Аня\", 10)</code> попадают прямо в него, а он раскладывает их по полям.",
      demo:'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n\nanya = Hero("Аня", 10)\nborya = Hero("Боря", 7)\nprint(anya.name, anya.hp)\nprint(borya.name, borya.hp)' },
    { h:"Значения по умолчанию работают и здесь",
      p:"Обычные правила из урока про значения по умолчанию: необязательные параметры идут последними. И та же ловушка со списком — поэтому список создают внутри, а не в объявлении.",
      demo:'class Hero:\n    def __init__(self, name, hp=10, items=None):\n        self.name = name\n        self.hp = hp\n        self.items = items if items is not None else []\n\n\na = Hero("Аня")\nb = Hero("Боря", 7)\na.items.append("меч")\nprint(a.name, a.hp, a.items)\nprint(b.name, b.hp, b.items)' },
    { h:"__repr__ — как объект выглядит",
      p:"Без него печать объекта показывает служебную запись, из которой ничего не понять. <code>__repr__</code> обязан вернуть строку — и её видно и при <code>print</code>, и внутри списка. Запись <code>{self.name!r}</code> в f-строке означает «покажи со кавычками, как в repr» — так сразу видно, что это текст.",
      demo:'class Hero:\n    def __init__(self, name, hp=10):\n        self.name = name\n        self.hp = hp\n\n    def __repr__(self):\n        return f"Hero({self.name!r}, hp={self.hp})"\n\n\nteam = [Hero("Аня"), Hero("Боря", 7)]\nprint(team[0])\nprint(team)' },
    { h:"Проверки прямо в __init__",
      p:"Хорошее место для <code>raise</code> из прошлых уроков: объект не должен рождаться с негодными данными. Проверка на входе — и дальше полям можно доверять.",
      demo:'class Hero:\n    def __init__(self, name, hp=10):\n        if len(name) < 2:\n            raise ValueError("имя слишком короткое")\n        if hp < 1:\n            raise ValueError("здоровье должно быть больше нуля")\n        self.name = name\n        self.hp = hp\n\n    def __repr__(self):\n        return f"Hero({self.name!r}, hp={self.hp})"\n\n\nprint(Hero("Аня"))\ntry:\n    Hero("Я")\nexcept ValueError as e:\n    print("отказ:", e)' }
  ],
  task:{
    type:"code",
    goal:"Перепиши класс <code>Book</code> так, чтобы поля задавались при создании, а объект показывал себя сам.",
    list:[
      "__init__ должен разложить по полям все три аргумента, а не одно название",
      "__repr__ возвращает строку вида Book('Муму', 'Тургенев', 1852)",
      "Если title пустой — raise ValueError(\"название не может быть пустым\")",
      "Строки внизу менять не нужно"
    ],
    starter:'class Book:\n    def __init__(self, title, author, year=2020):\n        self.title = title\n\n    def __repr__(self):\n        return "какая-то книга"\n\n\nshelf = [Book("Муму", "Тургенев", 1852), Book("Тайна", "Никитин")]\nprint(shelf[0])\nprint(shelf)\ntry:\n    Book("", "никто")\nexcept ValueError as e:\n    print("отказ:", e)\n',
    solution:'class Book:\n    def __init__(self, title, author, year=2020):\n        if not title:\n            raise ValueError("название не может быть пустым")\n        self.title = title\n        self.author = author\n        self.year = year\n\n    def __repr__(self):\n        return f"Book({self.title!r}, {self.author!r}, {self.year})"\n\n\nshelf = [Book("Муму", "Тургенев", 1852), Book("Тайна", "Никитин")]\nprint(shelf[0])\nprint(shelf)\ntry:\n    Book("", "никто")\nexcept ValueError as e:\n    print("отказ:", e)\n',
    hints:[
      "В __init__ не хватает двух строк: self.author = author и self.year = year",
      "Пустая строка — это ложь, поэтому проверка короткая: if not title",
      "В __repr__ кавычки вокруг строк ставит !r: f\"Book({self.title!r}, {self.author!r}, {self.year})\""
    ],
    check:{ kind:"output", needCode:["__init__","__repr__"],
            needMsg:"По условию нужны оба особых метода: __init__ и __repr__." }
  }
},

"inherit": {
  lede: "Когда у нескольких классов много общего, общее выносят в один класс, а особенное оставляют в потомках. Это наследование.",
  theory: [
    { h:"Класс в скобках — родитель",
      p:"Потомок получает все методы родителя бесплатно. Своего кода в нём столько, сколько нужно на отличия — иногда одна строка. Последняя строка примера — про <code>isinstance(объект, Класс)</code>: он отвечает, того ли объект рода. Для потомка ответ <b>True и про свой класс, и про родительский</b> — в этом весь смысл наследования: где ждут родителя, подойдёт любой потомок. <code>type()</code> так не умеет, он называет ровно один класс.",
      demo:'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    def card(self):\n        return f"{self.name}: {self.hp} hp"\n\n\nclass Mage(Hero):\n    pass\n\n\nm = Mage("Аня", 8)\nprint(m.card())\nprint(isinstance(m, Mage), isinstance(m, Hero))' },
    { h:"Переопределение: свой метод вместо родительского",
      p:"Если у потомка есть метод с тем же именем, он побеждает. Родительский при этом не портится — у других потомков он работает как раньше.",
      demo:'class Hero:\n    def hit(self):\n        return 1\n\n\nclass Mage(Hero):\n    def hit(self):\n        return 3\n\n\nclass Warrior(Hero):\n    def hit(self):\n        return 2\n\n\nfor who in [Hero(), Mage(), Warrior()]:\n    print(type(who).__name__, "->", who.hit())' },
    { h:"super() — позвать родителя",
      p:"Часто нужно не заменить родительский метод, а дополнить: сделай как раньше, а потом ещё вот это. <code>super()</code> и означает «тот же метод у родителя».",
      demo:'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    def card(self):\n        return f"{self.name}: {self.hp} hp"\n\n\nclass Mage(Hero):\n    def __init__(self, name):\n        super().__init__(name, 8)\n        self.mana = 5\n\n    def card(self):\n        return "маг " + super().card()\n\n\nprint(Hero("Боря", 12).card())\nprint(Mage("Аня").card())' },
    { h:"Зачем это нужно",
      p:"Один список — разные объекты, а код один. Каждый отвечает за себя сам: цикл не спрашивает, кто перед ним, просто зовёт метод. Это главная выгода наследования.",
      demo:'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    def hit(self):\n        return 1\n\n    def __repr__(self):\n        return f"{type(self).__name__}({self.name})"\n\n\nclass Mage(Hero):\n    def __init__(self, name):\n        super().__init__(name, 8)\n\n    def hit(self):\n        return 3\n\n\nclass Warrior(Hero):\n    def __init__(self, name):\n        super().__init__(name, 15)\n\n    def hit(self):\n        return 2\n\n\nteam = [Mage("Аня"), Warrior("Боря"), Hero("Витя", 10)]\nprint(team)\nfor who in team:\n    print(who.name, "бьёт на", who.hit())\nprint("всего урона:", sum([w.hit() for w in team]))' }
  ],
  task:{
    type:"code",
    goal:"Сделай базовый класс <code>Animal</code> и двух потомков.",
    list:[
      "Animal уже готов — его не трогай",
      "Dog(Animal): voice() возвращает «гав»",
      "Cat(Animal): voice() возвращает «мяу», а __init__ ещё задаёт поле lives = 9",
      "У Cat метод card() добавляет в конец «, жизней 9» — через super()",
      "Цикл внизу менять не нужно"
    ],
    starter:'class Animal:\n    def __init__(self, name):\n        self.name = name\n\n    def voice(self):\n        return "..."\n\n    def card(self):\n        return f"{self.name} говорит: {self.voice()}"\n\n\nclass Dog(Animal):\n    pass\n\n\nclass Cat(Animal):\n    pass\n\n\nfor a in [Animal("Кто-то"), Dog("Рекс"), Cat("Мурка")]:\n    print(a.card())\n',
    solution:'class Animal:\n    def __init__(self, name):\n        self.name = name\n\n    def voice(self):\n        return "..."\n\n    def card(self):\n        return f"{self.name} говорит: {self.voice()}"\n\n\nclass Dog(Animal):\n    def voice(self):\n        return "гав"\n\n\nclass Cat(Animal):\n    def __init__(self, name):\n        super().__init__(name)\n        self.lives = 9\n\n    def voice(self):\n        return "мяу"\n\n    def card(self):\n        return super().card() + f", жизней {self.lives}"\n\n\nfor a in [Animal("Кто-то"), Dog("Рекс"), Cat("Мурка")]:\n    print(a.card())\n',
    hints:[
      "Псу хватит одного метода voice — всё остальное он получает от Animal",
      "У кота свой __init__: сначала super().__init__(name), потом self.lives = 9",
      "И свой card: super().card() возвращает строку родителя, к ней прибавляем хвост"
    ],
    check:{ kind:"output", needCode:["super"],
            needMsg:"По условию у Cat метод card должен звать родительский через super(), а не повторять его текст." }
  }
},

"dataclass": {
  lede: "Класс, который только хранит данные, каждый раз пишется одинаково: <code>__init__</code>, <code>__repr__</code>, сравнение. <code>@dataclass</code> пишет это за тебя.",
  theory: [
    { h:"Сколько кода уходит на хранение",
      p:"Вот честный класс-хранилище на три поля. Ничего лишнего — и всё равно десяток строк, из которых половина повторяется в любом таком классе.",
      demo:'class Point:\n    def __init__(self, x, y=0):\n        self.x = x\n        self.y = y\n\n    def __repr__(self):\n        return f"Point(x={self.x}, y={self.y})"\n\n    def __eq__(self, other):\n        return isinstance(other, Point) and self.x == other.x and self.y == other.y\n\n\nprint(Point(1, 2))\nprint(Point(1, 2) == Point(1, 2))' },
    { h:"То же самое через @dataclass",
      p:"Строка <code>@dataclass</code> над классом — это <b>декоратор</b>: он берёт класс и дописывает в него <code>__init__</code>, <code>__repr__</code> и сравнение. Поля перечисляются с подсказкой типа: <code>x: int</code>. Как писать свои декораторы, разберём в Мире 4 — сейчас важно уметь применять готовый.",
      demo:'from dataclasses import dataclass\n\n\n@dataclass\nclass Point:\n    x: int\n    y: int = 0\n\n\nprint(Point(1, 2))\nprint(Point(1))\nprint(Point(1, 2) == Point(1, 2))\nprint(Point(1, 2) == Point(2, 1))' },
    { h:"Порядок полей — порядок аргументов",
      p:"Поля со значением по умолчанию идут после обычных, как у функций. Аргументы можно передавать и по имени. Поля дальше меняются как обычные — <code>@dataclass</code> ничего не запирает.",
      demo:'from dataclasses import dataclass\n\n\n@dataclass\nclass Hero:\n    name: str\n    hp: int = 100\n    team: str = "синие"\n\n\na = Hero("Аня")\nb = Hero("Боря", team="красные", hp=30)\nprint(a)\nprint(b)\nb.hp = 5\nprint(b)' },
    { h:"Сравнение по значениям — вот что меняется",
      p:"У обычного класса два объекта с одинаковыми полями — разные. У <code>@dataclass</code> — равные. Отсюда работает и <code>in</code>, и поиск в списке.",
      demo:'from dataclasses import dataclass\n\n\n@dataclass\nclass Card:\n    name: str\n    cost: int\n\n\ndeck = [Card("меч", 3), Card("щит", 2), Card("лук", 3)]\nprint(Card("щит", 2) in deck)\nprint(Card("щит", 9) in deck)\nprint(sorted(deck, key=lambda c: c.cost))' },
    { h:"Методы никуда не делись",
      p:"<code>@dataclass</code> избавляет только от повторяющегося кода. Свои методы пишутся как обычно — и это правильное место для правил, которые касаются этих данных.",
      demo:'from dataclasses import dataclass\n\n\n@dataclass\nclass Hero:\n    name: str\n    hp: int = 10\n\n    def alive(self):\n        return self.hp > 0\n\n    def hit(self, damage):\n        self.hp = max(0, self.hp - damage)\n        return self.hp\n\n\nh = Hero("Аня")\nprint(h.hit(4), h.alive())\nprint(h.hit(9), h.alive())\nprint(h)' }
  ],
  task:{
    type:"code",
    goal:"Класс <code>Track</code> написан руками и работает. Перепиши его через <code>@dataclass</code>, ничего не потеряв.",
    list:[
      "Поля те же: title (строка), artist (строка), seconds (число, по умолчанию 0)",
      "Метод length() оставь как есть — декоратор его не трогает",
      "Убери __init__ и __repr__: их должен сделать декоратор",
      "Последняя строка сейчас печатает False. После переделки должна печатать True — это и есть работа @dataclass",
      "Строки с print менять не нужно"
    ],
    starter:'from dataclasses import dataclass\n\n\nclass Track:\n    def __init__(self, title, artist, seconds=0):\n        self.title = title\n        self.artist = artist\n        self.seconds = seconds\n\n    def __repr__(self):\n        return f"Track(title={self.title!r}, artist={self.artist!r}, seconds={self.seconds})"\n\n    def length(self):\n        return f"{self.seconds // 60}:{self.seconds % 60:02d}"\n\n\nplaylist = [Track("Кукушка", "Кино", 185), Track("Звезда", "Кино", 245), Track("Тишина", "Никто")]\nfor t in playlist:\n    print(t, t.length())\nprint(Track("Кукушка", "Кино", 185) == playlist[0])\n',
    solution:'from dataclasses import dataclass\n\n\n@dataclass\nclass Track:\n    title: str\n    artist: str\n    seconds: int = 0\n\n    def length(self):\n        return f"{self.seconds // 60}:{self.seconds % 60:02d}"\n\n\nplaylist = [Track("Кукушка", "Кино", 185), Track("Звезда", "Кино", 245), Track("Тишина", "Никто")]\nfor t in playlist:\n    print(t, t.length())\nprint(Track("Кукушка", "Кино", 185) == playlist[0])\n',
    hints:[
      "Поставь @dataclass над строкой class Track и удали оба особых метода",
      "Поля перечисляются с типами вместо __init__: title: str, artist: str, seconds: int = 0",
      "Вывод repr должен остаться прежним — @dataclass печатает именно так: Track(title='…', artist='…', seconds=…)"
    ],
    check:{ kind:"output", needCode:["dataclass"], noCode:["__init__","__repr__"],
            needMsg:"Условие задания: __init__ и __repr__ должен написать декоратор @dataclass, а не ты.",
            noMsg:"Смысл урока — избавиться от ручного __init__. Удали его и перечисли поля с типами." }
  }
},

"proj-game-oop": {
  lede: "Собираем всё вместе: классы, наследование, методы и цикл боя. Проект небольшой, но устроен как настоящая игра.",
  theory: [
    { h:"Кто здесь есть",
      p:"Базовый боец умеет держать удар и бить. Потомки отличаются только числами и названием — остальное достаётся по наследству.",
      demo:'class Fighter:\n    def __init__(self, name, hp, damage):\n        self.name = name\n        self.hp = hp\n        self.damage = damage\n\n    def alive(self):\n        return self.hp > 0\n\n    def take(self, amount):\n        self.hp = max(0, self.hp - amount)\n\n    def __repr__(self):\n        return f"{self.name}({self.hp} hp)"\n\n\na = Fighter("Аня", 20, 5)\na.take(7)\nprint(a, a.alive())' },
    { h:"Один удар",
      p:"Начинать надо с самого мелкого действия: один боец бьёт другого. Функция меняет здоровье и возвращает строку для журнала боя. Никакой случайности — значит бой всегда одинаковый, и результат можно проверить.",
      demo:'class Fighter:\n    def __init__(self, name, hp, damage):\n        self.name = name\n        self.hp = hp\n        self.damage = damage\n\n    def alive(self):\n        return self.hp > 0\n\n    def take(self, amount):\n        self.hp = max(0, self.hp - amount)\n\n\ndef strike(a, b):\n    b.take(a.damage)\n    return f"{a.name} -> {b.name}: -{a.damage}, осталось {b.hp}"\n\n\nanya = Fighter("Аня", 20, 6)\nborya = Fighter("Боря", 18, 5)\nprint(strike(anya, borya))\nprint(strike(borya, anya))\nprint(anya.hp, borya.hp)' },
    { h:"Ходят по очереди",
      p:"Бой — это удары, пока оба живы. Обмен местами одной строкой <code>a, b = b, a</code> избавляет от «а теперь наоборот»: бьёт всегда тот, кто в <code>a</code>. Считать шаги и решать, кто победил, — уже твоя задача в этом уроке.",
      demo:'class Runner:\n    def __init__(self, name, steps):\n        self.name = name\n        self.steps = steps\n\n\ndef swap_demo(a, b):\n    for i in range(4):\n        print(i + 1, "ход:", a.name)\n        a, b = b, a\n\n\nswap_demo(Runner("Аня", 0), Runner("Боря", 0))' },
    { h:"Особенность потомка",
      p:"Отличие бойца — это изменение одного метода, всё остальное достаётся по наследству. Целитель после каждого удара залечивает единицу — но только пока жив.",
      demo:'class Fighter:\n    def __init__(self, name, hp, damage):\n        self.name = name\n        self.hp = hp\n        self.damage = damage\n\n    def take(self, amount):\n        self.hp = max(0, self.hp - amount)\n\n\nclass Healer(Fighter):\n    def take(self, amount):\n        super().take(amount)\n        if self.hp > 0:\n            self.hp = self.hp + 1\n\n\nh = Healer("Целитель", 10, 4)\nh.take(3)\nprint(h.hp)\nh.take(8)\nprint(h.hp)' }
  ],
  task:{
    type:"code",
    goal:"Допиши бой: класс <code>Knight</code> с бронёй и функцию <code>fight</code>.",
    list:[
      "Knight — потомок Fighter, переопределяет take: урон уменьшается на 3, но не меньше 1",
      "fight(a, b) проводит бой по шагам, пока оба живы, и возвращает победителя",
      "На каждом шаге печатать: «1: Аня -> Рыцарь: -6, осталось 19»",
      "Первым бьёт тот, кто передан первым аргументом",
      "Строки в конце менять не нужно"
    ],
    starter:'class Fighter:\n    def __init__(self, name, hp, damage):\n        self.name = name\n        self.hp = hp\n        self.damage = damage\n\n    def alive(self):\n        return self.hp > 0\n\n    def take(self, amount):\n        self.hp = max(0, self.hp - amount)\n\n    def __repr__(self):\n        return f"{self.name}({self.hp} hp)"\n\n\nclass Knight(Fighter):\n    pass\n\n\ndef fight(a, b):\n    return a\n\n\nanya = Fighter("Аня", 20, 6)\nknight = Knight("Рыцарь", 22, 5)\nwinner = fight(anya, knight)\nprint("победил:", winner.name)\nprint([anya, knight])\n',
    solution:'class Fighter:\n    def __init__(self, name, hp, damage):\n        self.name = name\n        self.hp = hp\n        self.damage = damage\n\n    def alive(self):\n        return self.hp > 0\n\n    def take(self, amount):\n        self.hp = max(0, self.hp - amount)\n\n    def __repr__(self):\n        return f"{self.name}({self.hp} hp)"\n\n\nclass Knight(Fighter):\n    def take(self, amount):\n        super().take(max(1, amount - 3))\n\n\ndef fight(a, b):\n    step = 0\n    while a.alive() and b.alive():\n        step += 1\n        b.take(a.damage)\n        print(f"{step}: {a.name} -> {b.name}: -{a.damage}, осталось {b.hp}")\n        a, b = b, a\n    return a if a.alive() else b\n\n\nanya = Fighter("Аня", 20, 6)\nknight = Knight("Рыцарь", 22, 5)\nwinner = fight(anya, knight)\nprint("победил:", winner.name)\nprint([anya, knight])\n',
    hints:[
      "У Knight хватит одного метода: def take(self, amount): super().take(max(1, amount - 3))",
      "В fight цикл while a.alive() and b.alive(): наносим удар, печатаем строку журнала, меняем бойцов местами",
      "Поменять бойцов местами можно одной строкой: a, b = b, a",
      "Осторожно с концовкой: после последнего обмена в a может лежать проигравший. Поэтому вернуть надо того, кто жив: return a if a.alive() else b"
    ],
    check:{ kind:"output", needCode:["while","super"],
            needMsg:"Условие проекта: бой идёт циклом while, а броня рыцаря сделана через super()." }
  }
},

"boss-lib": {
  lede: "Босс мира. Ты напишешь настоящую библиотеку — отдельный файл с функциями, которыми смогут пользоваться другие. Проверять её будут скрытыми тестами.",
  theory: [
    { h:"Библиотека — это файл с функциями и без действий",
      p:"В библиотеке нет <code>print</code> и нет вычислений на верхнем уровне: только определения. Всё, что она умеет, вызывается снаружи. Тогда её можно подключить куда угодно и ничего не сломать.",
      files:{ "textkit.py": 'def shout(text):\n    return text.strip().upper() + "!"\n' },
      demo:'import textkit\n\nprint(textkit.shout("  подъём  "))\nprint(textkit.shout("тише"))' },
    { h:"Функции библиотеки зовут друг друга",
      p:"Внутри файла они видят друг друга по имени — без точки и без импорта. Так из мелких функций собирается большая.",
      files:{ "textkit.py": 'def shout(text):\n    return text.strip().upper() + "!"\n\n\ndef twice(text):\n    return shout(text) + " " + shout(text)\n' },
      demo:'import textkit\n\nprint(textkit.twice("вперёд"))' },
    { h:"Словарь-счётчик — из Мира 2",
      p:"Считать повторы ты уже умеешь по Миру 2. Метод <code>get</code> со вторым аргументом отдаёт значение по умолчанию, если ключа ещё нет — это короче, чем проверять через <code>in</code>.",
      demo:'colors = ["синий", "красный", "синий"]\ncounts = {}\nfor c in colors:\n    counts[c] = counts.get(c, 0) + 1\nprint(counts)\nprint(counts.get("зелёный", 0))' },
    { h:"Сортировка по двум условиям сразу",
      p:"Ключом может быть кортеж: сравниваться будет сначала первое значение, потом второе. Минус перед числом переворачивает порядок — так «сначала самые частые, потом по алфавиту» пишется в одну строку.",
      demo:'heroes = {"аня": 7, "боря": 9, "витя": 7}\npairs = sorted(heroes.items(), key=lambda p: (-p[1], p[0]))\nprint(pairs)\nprint("сильнее всех:", pairs[0][0])' }
  ],
  task:{
    type:"code",
    goal:"Напиши библиотеку <code>textkit.py</code> из трёх функций по спецификации. Файл <code>main.py</code> её показывает и менять его не нужно.",
    list:[
      "clean(text): убрать пробелы по краям, сделать маленькими буквами, заменить «ё» на «е»",
      "words(text): список слов очищенного текста. Для пустого текста — пустой список",
      "top_word(text): самое частое слово. При равенстве — то, что раньше по алфавиту",
      "top_word от пустого текста возвращает пустую строку",
      "Тесты скрыты: их запустит проверка, в том числе на пустых строках"
    ],
    mainName:"main.py",
    files:[
      { name:"textkit.py",
        starter:'def clean(text):\n    return text\n\n\ndef words(text):\n    return []\n\n\ndef top_word(text):\n    return ""\n',
        solution:'def clean(text):\n    return text.strip().lower().replace("ё", "е")\n\n\ndef words(text):\n    return clean(text).split()\n\n\ndef top_word(text):\n    items = words(text)\n    if not items:\n        return ""\n    counts = {}\n    for w in items:\n        counts[w] = counts.get(w, 0) + 1\n    pairs = sorted(counts.items(), key=lambda p: (-p[1], p[0]))\n    return pairs[0][0]\n' }
    ],
    starter:'import textkit\n\nprint(textkit.clean("  Ёлка Растёт  "))\nprint(textkit.words("Ёж и ёлка"))\nprint(textkit.top_word("да нет да может да"))\nprint(textkit.top_word("аа бб аа бб"))\n',
    solution:'import textkit\n\nprint(textkit.clean("  Ёлка Растёт  "))\nprint(textkit.words("Ёж и ёлка"))\nprint(textkit.top_word("да нет да может да"))\nprint(textkit.top_word("аа бб аа бб"))\n',
    hints:[
      "clean — три метода подряд: text.strip().lower().replace(\"ё\", \"е\")",
      "words — вызови свою же clean, а потом split(): пробелы он разберёт сам",
      "top_word: сначала словарь-счётчик по словам, потом сортировка пар по двум условиям — сначала по количеству в обратную сторону, потом по слову, как в теории. Ответ — первое слово первой пары"
    ],
    check:{ kind:"tests", calls:[
      'textkit.clean("  Ёлка Растёт  ")',
      'textkit.clean("ЁЖ")',
      'textkit.words("Ёж и ёлка")',
      'textkit.words("   ")',
      'textkit.top_word("да нет да может да")',
      'textkit.top_word("аа бб аа бб")',
      'textkit.top_word("Ёлка ёлка ЕЛКА")',
      'textkit.top_word("")'
    ] }
  }
},


};
