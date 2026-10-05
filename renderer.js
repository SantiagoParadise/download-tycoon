/* =========================================================
   DOWNLOAD TYCOON v3 — renderer.js (часть 1)
   ========================================================= */

/* ==================== 1. УТИЛИТЫ ==================== */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const fmt = n => Math.round(n).toLocaleString('ru-RU');
const fmtSize = mb => mb >= 1024 ? (mb / 1024).toFixed(2) + ' ГБ' : Math.round(mb) + ' МБ';
const GAME_VERSION = '3.0.0';

/* ==================== 2. ЗВУК ==================== */
const Sound = (() => {
  let ctx = null, muted = false;
  function ac() {
    if (!ctx) try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    return ctx;
  }
  function beep(freq=440, dur=.06, type='sine', vol=.05) {
    if (muted) return;
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  }
  return {
    click: () => beep(880, .03, 'square', .03),
    ok:    () => { beep(660, .07); setTimeout(() => beep(990, .09), 60); },
    error: () => beep(200, .12, 'sawtooth', .06),
    money: () => { beep(1200, .05); setTimeout(() => beep(1600, .08), 50); },
    alert: () => { beep(500, .08, 'triangle'); setTimeout(() => beep(700, .1, 'triangle'), 90); },
    achv:  () => [880,1100,1320,1760].forEach((f,i) => setTimeout(() => beep(f,.09,'sine',.05), i*70)),
    bsod:  () => beep(120, .5, 'sawtooth', .08),
    toggleMute: v => { muted = v; },
    isMuted: () => muted
  };
})();

/* ==================== 3. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ЦИКЛА ==================== */
let widgetTickTimer = 0;
let speechRec = null;
const SpeechAvailable = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);

/* ==================== 4. КАТАЛОГ ==================== */
const SLOTS = ['cpu','gpu','ram','storage','wifi','battery','screen','cooling'];
const SLOT_INFO = {
  cpu:     { label:'Процессор',       icon:'🧠', hint:'Скорость загрузки' },
  gpu:     { label:'Видеокарта',      icon:'🎮', hint:'Графика, майнинг, ИИ' },
  ram:     { label:'ОЗУ',             icon:'📊', hint:'Число загрузок' },
  storage: { label:'Накопитель',      icon:'💾', hint:'Место на диске' },
  wifi:    { label:'Wi-Fi модуль',    icon:'📶', hint:'Скорость сети' },
  battery: { label:'Батарея/БП',      icon:'🔋', hint:'Защита от скачков' },
  screen:  { label:'Экран',           icon:'🖥️', hint:'+опыт за загрузки' },
  cooling: { label:'Охлаждение',      icon:'❄️', hint:'Снижает температуру' }
};
const TIER_NAMES = ['Базовый','Стандарт','Про','Ультра','Прототип'];

const CATALOG = {
  cpu: [
    { id:'cpu0', name:'CPU Celeron-Calc', tier:0, price:0,      stats:{ power:1 } },
    { id:'cpu1', name:'CPU Core Duo',     tier:1, price:750,    stats:{ power:3 } },
    { id:'cpu2', name:'CPU Ryzen Pro',    tier:2, price:4200,   stats:{ power:7 } },
    { id:'cpu3', name:'CPU Xtreme 9',     tier:3, price:26000,  stats:{ power:13 } },
    { id:'cpu4', name:'CPU Quantum Core', tier:4, price:180000, stats:{ power:24 } }
  ],
  gpu: [
    { id:'gpu0', name:'GPU OnBoard',   tier:0, price:0,      stats:{ power:1 } },
    { id:'gpu1', name:'GPU GT-1030',   tier:1, price:620,    stats:{ power:3 } },
    { id:'gpu2', name:'GPU RTX-4060',  tier:2, price:3800,   stats:{ power:7 } },
    { id:'gpu3', name:'GPU RTX-5090',  tier:3, price:24000,  stats:{ power:13 } },
    { id:'gpu4', name:'GPU Photon-X',  tier:4, price:160000, stats:{ power:24 } }
  ],
  ram: [
    { id:'ram0', name:'ОЗУ 2 ГБ DDR3',  tier:0, price:0,     stats:{ gb:2 } },
    { id:'ram1', name:'ОЗУ 8 ГБ DDR4',  tier:1, price:520,   stats:{ gb:8 } },
    { id:'ram2', name:'ОЗУ 16 ГБ DDR5', tier:2, price:2600,  stats:{ gb:16 } },
    { id:'ram3', name:'ОЗУ 64 ГБ DDR5', tier:3, price:15000, stats:{ gb:64 } },
    { id:'ram4', name:'ОЗУ 256 ГБ XRAM',tier:4, price:95000, stats:{ gb:256 } }
  ],
  storage: [
    { id:'st0', name:'HDD 80 ГБ',    tier:0, price:0,     stats:{ gb:80 } },
    { id:'st1', name:'HDD 500 ГБ',   tier:1, price:480,   stats:{ gb:500 } },
    { id:'st2', name:'SSD 1 ТБ',     tier:2, price:2400,  stats:{ gb:1024 } },
    { id:'st3', name:'NVMe 4 ТБ',    tier:3, price:14000, stats:{ gb:4096 } },
    { id:'st4', name:'Квант-диск',   tier:4, price:85000, stats:{ gb:32768 } }
  ],
  wifi: [
    { id:'wifi0', name:'Wi-Fi 802.11g', tier:0, price:0,      stats:{ net:54 } },
    { id:'wifi1', name:'Wi-Fi 5 (AC)',  tier:1, price:640,    stats:{ net:400 } },
    { id:'wifi2', name:'Wi-Fi 6E',      tier:2, price:3000,   stats:{ net:1200 } },
    { id:'wifi3', name:'Wi-Fi 7',       tier:3, price:18000,  stats:{ net:4000 } },
    { id:'wifi4', name:'Оптический',    tier:4, price:110000, stats:{ net:12000 } }
  ],
  battery: [
    { id:'bat0', name:'Батарея 2000 мАч',   tier:0, price:0,     stats:{ mah:2000 } },
    { id:'bat1', name:'Батарея 5000 мАч',   tier:1, price:420,   stats:{ mah:5000 } },
    { id:'bat2', name:'Батарея 8000 мАч',   tier:2, price:2100,  stats:{ mah:8000 } },
    { id:'bat3', name:'Графен-аккумулятор', tier:3, price:13000, stats:{ mah:16000 } },
    { id:'bat4', name:'Ядерная ячейка',     tier:4, price:78000, stats:{ mah:90000 } }
  ],
  screen: [
    { id:'scr0', name:'Экран 60 Гц',       tier:0, price:0,     stats:{ hz:60 } },
    { id:'scr1', name:'Экран 90 Гц',       tier:1, price:460,   stats:{ hz:90 } },
    { id:'scr2', name:'Экран 144 Гц',      tier:2, price:2300,  stats:{ hz:144 } },
    { id:'scr3', name:'OLED 240 Гц',       tier:3, price:14000, stats:{ hz:240 } },
    { id:'scr4', name:'Голограмма 480 Гц', tier:4, price:84000, stats:{ hz:480 } }
  ],
  cooling: [
    { id:'cool0', name:'Штатный кулер',   tier:0, price:0,      stats:{ cool:1 } },
    { id:'cool1', name:'Башня 2 вент.',   tier:1, price:620,    stats:{ cool:3 } },
    { id:'cool2', name:'СВО 240 мм',      tier:2, price:3200,   stats:{ cool:6 } },
    { id:'cool3', name:'СВО 360 мм',      tier:3, price:17000,  stats:{ cool:10 } },
    { id:'cool4', name:'Жидкий азот',     tier:4, price:105000, stats:{ cool:18 } }
  ]
};
const ALL_ITEMS = {};
for (const [slot, arr] of Object.entries(CATALOG))
  for (const it of arr) ALL_ITEMS[it.id] = { ...it, slot };

const DEVICES = [
  { id:'dev_pc0',  name:'Старый ПК из гаража', os:'Windows', osVer:7,  price:0,      kind:'pc',
    slots:{ cpu:'cpu0', gpu:'gpu0', ram:'ram0', storage:'st0', wifi:'wifi0', battery:'bat0', screen:'scr0', cooling:'cool0' } },
  { id:'dev_and1', name:'Android «Droid X»',   os:'Android', osVer:9,  price:9000,   kind:'mobile',
    slots:{ cpu:'cpu1', gpu:'gpu1', ram:'ram1', storage:'st1', wifi:'wifi1', battery:'bat1', screen:'scr1', cooling:'cool0' } },
  { id:'dev_tab1', name:'Планшет «Slate Pad»', os:'Android', osVer:12, price:22000,  kind:'tablet',
    slots:{ cpu:'cpu2', gpu:'gpu1', ram:'ram2', storage:'st2', wifi:'wifi2', battery:'bat2', screen:'scr2', cooling:'cool0' } },
  { id:'dev_pc1',  name:'Ноутбук «ProBook»',   os:'Windows', osVer:11, price:65000,  kind:'pc',
    slots:{ cpu:'cpu2', gpu:'gpu2', ram:'ram2', storage:'st2', wifi:'wifi2', battery:'bat2', screen:'scr2', cooling:'cool1' } },
  { id:'dev_ios1', name:'iPhone «iFruit 15»',  os:'iOS',     osVer:17, price:210000, kind:'mobile',
    slots:{ cpu:'cpu3', gpu:'gpu3', ram:'ram3', storage:'st3', wifi:'wifi3', battery:'bat3', screen:'scr3', cooling:'cool1' } },
  { id:'dev_srv1', name:'Сервер «Rack-1U»',    os:'Linux',   osVer:5,  price:320000, kind:'server',
    slots:{ cpu:'cpu3', gpu:'gpu1', ram:'ram3', storage:'st3', wifi:'wifi4', battery:'bat4', screen:'scr0', cooling:'cool2' } },
  { id:'dev_pc2',  name:'Станция «Titan»',     os:'Windows', osVer:12, price:520000, kind:'pc',
    slots:{ cpu:'cpu4', gpu:'gpu4', ram:'ram4', storage:'st4', wifi:'wifi4', battery:'bat4', screen:'scr4', cooling:'cool3' } }
];

const ORDER_TYPES = [
  { n:'Документ',   i:'📄', min:2,   max:18,   mult:9,  lvl:1 },
  { n:'Музыка',     i:'🎵', min:5,   max:45,   mult:8,  lvl:1 },
  { n:'Программа',  i:'📦', min:40,  max:400,  mult:10, lvl:1 },
  { n:'Обновление', i:'🧩', min:100, max:1500, mult:11, lvl:2 },
  { n:'Игра',       i:'🎮', min:300, max:4000, mult:13, lvl:3 },
  { n:'Фильм 4K',   i:'🎬', min:600, max:7000, mult:12, lvl:4 },
  { n:'Датасет',    i:'📊', min:400, max:9000, mult:14, lvl:5 },
  { n:'ISO-образ',  i:'💿', min:800, max:9000, mult:13, lvl:6 },
  { n:'Архив',      i:'🗜️', min:200, max:5000, mult:12, lvl:4 },
  { n:'Нейромодель',i:'🤖', min:900, max:9000, mult:15, lvl:8 },
  { n:'Ром-пак',    i:'🕹️', min:200, max:3500, mult:13, lvl:5 }
];
const NAME_PARTS = ['final','v2','setup','pack','update','beta','hd','pro','lite','x64','archive','dump','nightly','r2'];
const APP_POOL = [
  { id:'browser',   name:'TurboBrowser', size:140,  desc:'Быстрый браузер' },
  { id:'player',    name:'MediaPlayer',  size:90,   desc:'Универсальный плеер' },
  { id:'office',    name:'OfficeLite',   size:320,  desc:'Офисный пакет' },
  { id:'antivirus', name:'ShieldAV',     size:260,  desc:'Антивирус' },
  { id:'editor',    name:'PixelEditor',  size:480,  desc:'Графический редактор' },
  { id:'game',      name:'MiniCraft',    size:1200, desc:'Игра' },
  { id:'miner',     name:'CryptoMiner',  size:180,  desc:'Майнер крипты' },
  { id:'cloud',     name:'CloudSync',    size:210,  desc:'Облачная синхронизация' }
];

/* ==================== 5. ДОСТИЖЕНИЯ ==================== */
const ACHIEVEMENTS = [
  { id:'first_dl',    ico:'⬇️', name:'Первый шаг',        desc:'Скачать первый файл',        check:s=>s.totalDownloads>=1,  reward:100 },
  { id:'dl10',        ico:'📥', name:'Загрузчик',         desc:'10 загрузок',                check:s=>s.totalDownloads>=10, reward:500 },
  { id:'dl100',       ico:'📦', name:'Коллекционер',      desc:'100 загрузок',               check:s=>s.totalDownloads>=100,reward:3000 },
  { id:'dl1000',      ico:'🏆', name:'1000 загрузок',     desc:'1000 загрузок',              check:s=>s.totalDownloads>=1000,reward:50000 },
  { id:'lvl10',       ico:'⭐', name:'Опытный',           desc:'Уровень 10',                 check:s=>s.level>=10,          reward:2000 },
  { id:'lvl25',       ico:'🌟', name:'Мастер',            desc:'Уровень 25',                 check:s=>s.level>=25,          reward:15000 },
  { id:'lvl50',       ico:'💫', name:'Легенда',           desc:'Уровень 50',                 check:s=>s.level>=50,          reward:80000 },
  { id:'os_upd',      ico:'🪟', name:'Свежая система',    desc:'Обновить ОС',                check:s=>s.totalOS>=1,         reward:400 },
  { id:'os10',        ico:'🔄', name:'10 обновлений ОС',  desc:'10 обновлений ОС',           check:s=>s.totalOS>=10,        reward:8000 },
  { id:'drv_all_ok',  ico:'🔧', name:'Чистые драйвера',   desc:'Все драйвера актуальны',     check:s=>SLOTS.every(x=>s.drivers[x]&&s.drivers[x].status==='ok'), reward:1500 },
  { id:'bsod',        ico:'💙', name:'Синий экран',       desc:'Получить BSOD',              check:s=>s.stats.bsods>=1,     reward:300 },
  { id:'virus',       ico:'🦠', name:'Заражение',         desc:'Поймать вирус',              check:s=>s.stats.viruses>=1,   reward:200 },
  { id:'scan10',      ico:'🛡️', name:'Санитар',           desc:'10 сканирований',            check:s=>s.stats.scans>=10,    reward:1200 },
  { id:'backup1',     ico:'💽', name:'Бэкапер',           desc:'Создать бэкап',              check:s=>s.stats.backups>=1,   reward:300 },
  { id:'company',     ico:'🏢', name:'Основатель',        desc:'Открыть компанию',           check:s=>!!s.company,          reward:5000 },
  { id:'prod1',       ico:'🧩', name:'Производитель',     desc:'Выпустить продукт',          check:s=>s.company&&s.company.products.length>=1, reward:8000 },
  { id:'prod10',      ico:'🚀', name:'Промышленник',      desc:'10 продуктов',               check:s=>s.company&&s.company.products.length>=10,reward:60000 },
  { id:'own_os',      ico:'💿', name:'Своя ОС',           desc:'Выпустить свою ОС',          check:s=>s.ownOS&&s.ownOS.released, reward:100000 },
  { id:'stock',       ico:'📈', name:'Инвестор',          desc:'Купить акцию',               check:s=>s.stats.stocksBought>=1, reward:500 },
  { id:'stockprofit', ico:'💰', name:'Спекулянт',         desc:'50 000 ₮ на бирже',          check:s=>s.stats.stockProfit>=50000, reward:12000 },
  { id:'branch',      ico:'🌍', name:'Глобалист',         desc:'Открыть филиал',             check:s=>s.stats.branchesOpened>=1, reward:25000 },
  { id:'branch_all',  ico:'🗺️', name:'Транснационал',     desc:'Филиалы во всех странах',    check:s=>s.stats.branchesOpened>=5, reward:200000 },
  { id:'oc',          ico:'🔥', name:'Оверклокер',        desc:'Разгон CPU на максимум',     check:s=>s.overclock.cpu>=5,  reward:4000 },
  { id:'heat',        ico:'🌡️', name:'Горячо!',           desc:'Температура выше 95°',       check:s=>s.stats.maxTemp>=95, reward:500 },
  { id:'money1m',     ico:'💎', name:'Миллионер',         desc:'1 000 000 ₮',                check:s=>s.money>=1000000,    reward:100000 },
  { id:'chapter_all', ico:'📖', name:'Легенда IT',        desc:'Пройти все главы',           check:s=>s.campaign.chapter>CAMPAIGN.length, reward:500000 },
  { id:'ai_first',     ico:'🤖', name:'AI-пионер',         desc:'Создать первую ИИ-модель',   check:s=>s.ai && s.ai.models.length>=1, reward:10000 },
  { id:'ai_users_1k',  ico:'👥', name:'Первые пользователи', desc:'1 000 пользователей ИИ',    check:s=>s.ai && s.ai.totalUsers>=1000, reward:5000 },
  { id:'ai_users_100k',ico:'🌍', name:'Популярный ИИ',      desc:'100 000 пользователей',      check:s=>s.ai && s.ai.totalUsers>=100000, reward:50000 },
  { id:'ai_users_1m',  ico:'🌟', name:'Миллионник',         desc:'1 000 000 пользователей ИИ', check:s=>s.ai && s.ai.totalUsers>=1000000, reward:300000 },
  { id:'ai_quality90', ico:'💎', name:'Качество 90+',       desc:'Качество модели ≥ 90',       check:s=>s.ai && s.ai.models.some(m=>m.quality>=90), reward:40000 },
  { id:'ai_5versions', ico:'📈', name:'Серийный релиз',     desc:'5-я версия одной модели',    check:s=>s.ai && s.ai.models.some(m=>m.version>=5), reward:60000 },
  { id:'ai_3models',   ico:'🧠', name:'AI-портфель',        desc:'3 разных модели в портфеле', check:s=>s.ai && s.ai.models.length>=3, reward:35000 },
  { id:'ai_revenue_1m',ico:'💰', name:'AI-магнат',          desc:'1 000 000 ₮ от ИИ',          check:s=>s.ai && s.ai.lifetimeRevenue>=1000000, reward:100000 },

  /* PROVIDER */
  { id:'prv_create',   ico:'📡', name:'Провайдер',           desc:'Основать интернет-провайдера', check:s=>s.provider && s.provider.created, reward:20000 },
  { id:'prv_1k',       ico:'👥', name:'Первая тысяча',       desc:'1 000 абонентов',              check:s=>s.provider && s.provider.subscribers>=1000, reward:8000 },
  { id:'prv_100k',     ico:'🌍', name:'Региональный гигант', desc:'100 000 абонентов',            check:s=>s.provider && s.provider.subscribers>=100000, reward:80000 },
  { id:'prv_1m',       ico:'🌟', name:'Мировой провайдер',   desc:'1 000 000 абонентов',          check:s=>s.provider && s.provider.subscribers>=1000000, reward:500000 },
  { id:'prv_gigabit',  ico:'🚀', name:'Гигабит',             desc:'Тариф «Гигабит»',              check:s=>s.provider && s.provider.tariffId==='gigabit', reward:40000 },
  { id:'prv_global',   ico:'🌐', name:'Глобальное покрытие', desc:'Регион «Мир» открыт',          check:s=>s.provider && s.provider.regionId==='global', reward:300000 },
  { id:'prv_rev_10m',  ico:'💎', name:'Телеком-магнат',      desc:'10 000 000 ₮ от провайдера',   check:s=>s.provider && s.provider.lifetimeRevenue>=10000000, reward:1000000 }
];

/* ==================== 6. ТЕХНОЛОГИИ ==================== */
const TECHS = [
  { id:'net_boost',   ico:'📶', name:'Ускорение сети',      desc:'+15% скорости',        cost:3,  req:[] },
  { id:'cache',       ico:'🗄️', name:'Кэширование',         desc:'+10% скорости',        cost:4,  req:['net_boost'] },
  { id:'oc_unlock',   ico:'🔥', name:'Разблокировка OC',    desc:'Разгон в диспетчере',  cost:5,  req:[] },
  { id:'cool_eff',    ico:'❄️', name:'Эффект. охлаждение',  desc:'-20% к нагреву',       cost:6,  req:['oc_unlock'] },
  { id:'ram_opt',     ico:'📊', name:'Оптимизация ОЗУ',     desc:'+2 слота загрузок',    cost:5,  req:[] },
  { id:'backup_auto', ico:'💽', name:'Автобэкап',           desc:'Каждые 5 минут',       cost:6,  req:[] },
  { id:'av_pro',      ico:'🛡️', name:'PRO-антивирус',       desc:'+30% к сканам',        cost:5,  req:[] },
  { id:'mining',      ico:'⛏️', name:'Майнинг-ферма',       desc:'Доход от GPU',         cost:8,  req:[] },
  { id:'rd_fast',     ico:'🔬', name:'Ускоренное R&D',      desc:'-30% времени',         cost:10, req:['mining'] },
  { id:'os_dev',      ico:'💿', name:'Разработка ОС',       desc:'Своя ОС',              cost:15, req:['rd_fast'] },
  { id:'stock_api',   ico:'📈', name:'Биржевой API',        desc:'Больше тикеров',       cost:4,  req:[] },
  { id:'mods',        ico:'🧩', name:'Поддержка модов',     desc:'Загрузка JSON-модов',  cost:3,  req:[] },
  { id:'usb4',        ico:'🔌', name:'USB 4.0',             desc:'+8% ко всему',         cost:8,  req:['cache'] },
  { id:'quantum',     ico:'⚛️', name:'Квантовые вычисления', desc:'+25% ко всему',        cost:20, req:['usb4'] },
  { id:'ai_lab',      ico:'🤖', name:'AI Framework',        desc:'Открывает AI Lab',     cost:12, req:['rd_fast'] },
  { id:'ai_nn',       ico:'🧬', name:'Нейросети+',          desc:'+15 к качеству ИИ',    cost:8,  req:['ai_lab'] },
  { id:'ai_safety',   ico:'🛡️', name:'AI Safety',           desc:'-50% инцидентов',      cost:10, req:['ai_lab'] },
  { id:'ai_scale',    ico:'📡', name:'Распределённые сервера', desc:'×2 ёмкость серверов', cost:15, req:['ai_lab','ai_nn'] },

  /* PROVIDER */
  { id:'prv_open',     ico:'📡', name:'Internet Provider',     desc:'Открывает раздел «Провайдер»', cost:14, req:['rd_fast'] },
  { id:'prv_optic',    ico:'🔦', name:'Оптоволокно',           desc:'+50% к скорости сети',         cost:8,  req:['prv_open'] },
  { id:'prv_5g',       ico:'📶', name:'5G-сети',               desc:'+30% к покрытию',              cost:10, req:['prv_open'] },
  { id:'prv_dc',       ico:'🏢', name:'Дата-центр',            desc:'+50% ёмкости абонентов',       cost:12, req:['prv_open'] },
  { id:'prv_sat',      ico:'🛰️', name:'Спутниковая сеть',      desc:'Глобальное покрытие',          cost:20, req:['prv_5g','prv_dc'] }
];

/* ==================== 7. КАМПАНИЯ ==================== */
const CAMPAIGN = [
  { id:1, title:'Пролог: Гараж', text:'Ты нашёл старый ПК в гараже. Он включается. Уже неплохо.',
    tasks:[
      { id:'t1', text:'Скачать 5 файлов', check:s=>s.totalDownloads>=5 },
      { id:'t2', text:'Купить любой апгрейд', check:s=>Object.values(s.slots).some(x=>!x.endsWith('0')) }
    ]},
  { id:2, title:'Глава 2: Мастерская', text:'Клиенты заметили тебя. Наведи порядок с драйверами.',
    tasks:[
      { id:'t1', text:'Все драйвера актуальны', check:s=>SLOTS.every(x=>s.drivers[x]&&s.drivers[x].status==='ok') },
      { id:'t2', text:'Обновить ОС',            check:s=>s.totalOS>=1 }
    ]},
  { id:3, title:'Глава 3: Цифровой детектив', text:'В сети вирус. Защити свои данные.',
    tasks:[
      { id:'t1', text:'Купить антивирус',      check:s=>s.apps.some(a=>a.id==='antivirus') },
      { id:'t2', text:'3 сканирования',        check:s=>s.stats.scans>=3 }
    ]},
  { id:4, title:'Глава 4: Первый бизнес', text:'500 000 ₮ — и ты в игре. Пора основать компанию.',
    tasks:[
      { id:'t1', text:'Основать компанию',       check:s=>!!s.company },
      { id:'t2', text:'Выпустить продукт',       check:s=>s.company&&s.company.products.length>=1 }
    ]},
  { id:5, title:'Глава 5: Биржевой волк', text:'Деньги должны работать.',
    tasks:[
      { id:'t1', text:'Купить акцию',           check:s=>s.stats.stocksBought>=1 },
      { id:'t2', text:'20 000 ₮ на бирже',      check:s=>s.stats.stockProfit>=20000 }
    ]},
  { id:6, title:'Глава 6: Глобальный охват', text:'Открой филиалы по всему миру.',
    tasks:[
      { id:'t1', text:'Открыть филиал',         check:s=>s.stats.branchesOpened>=1 },
      { id:'t2', text:'Выпустить 5 продуктов',  check:s=>s.company&&s.company.products.length>=5 }
    ]},
  { id:7, title:'Финал: Своя ОС', text:'Пора выпустить свою собственную ОС.',
    tasks:[
      { id:'t1', text:'Исследовать «Разработка ОС»', check:s=>s.tech.includes('os_dev') },
      { id:'t2', text:'Выпустить свою ОС',            check:s=>s.ownOS&&s.ownOS.released }
    ]}
];

/* ==================== 8. БИРЖА / КОНКУРЕНТЫ / СТРАНЫ / СЕЗОНЫ ==================== */
const STOCKS_BASE = [
  { id:'NVX',  name:'NovaX Graphics', price:340,  vol:0.05 },
  { id:'Chip', name:'ChipCore Corp',  price:210,  vol:0.04 },
  { id:'Srv',  name:'ServerTech',     price:890,  vol:0.06 },
  { id:'OSft', name:'OldSoft',        price:150,  vol:0.03 },
  { id:'QBit', name:'QuantumBits',    price:1240, vol:0.09 },
  { id:'Wifi', name:'NetLink',        price:95,   vol:0.05 },
  { id:'AIcr', name:'AICore',         price:2050, vol:0.12 },
  { id:'MemX', name:'MemoryX',        price:410,  vol:0.04 },
  { id:'Rkt',  name:'RocketOS',       price:620,  vol:0.07 }
];
const COMPETITORS_BASE = [
  { name:'MegaChip',    share:26, power:8 },
  { name:'iWare',       share:22, power:7 },
  { name:'QuantumSoft', share:16, power:6 },
  { name:'OldBit',      share:12, power:5 },
  { name:'PixelWorks',  share:8,  power:4 }
];
const COUNTRIES = [
  { id:'ua', name:'Украина',     flag:'🇺🇦', taxRate:0.05, cost:120000, mult:1.0 },
  { id:'de', name:'Германия',    flag:'🇩🇪', taxRate:0.15, cost:260000, mult:1.4 },
  { id:'us', name:'США',         flag:'🇺🇸', taxRate:0.12, cost:400000, mult:1.8 },
  { id:'jp', name:'Япония',      flag:'🇯🇵', taxRate:0.10, cost:320000, mult:1.5 },
  { id:'kr', name:'Южная Корея', flag:'🇰🇷', taxRate:0.09, cost:280000, mult:1.4 }
];
const SEASONS = [
  { id:'black_friday', name:'Чёрная пятница', ico:'🛍️', desc:'-25% в магазине',      multi:{ shopDiscount:0.25 } },
  { id:'halloween',    name:'Хэллоуин',       ico:'🎃', desc:'+50% опыта',           multi:{ xpMult:1.5 } },
  { id:'newyear',      name:'Новый год',      ico:'🎄', desc:'+30% доход за заказы', multi:{ moneyMult:1.3 } },
  { id:'easter',       name:'Пасха',          ico:'🐣', desc:'-15% к нагреву',       multi:{ heatMult:0.85 } },
  { id:'summer',       name:'Лето',           ico:'☀️', desc:'+20% скорости сети',   multi:{ speedMult:1.2 } },
  { id:'none',         name:'Обычные дни',    ico:'📅', desc:'Без бонусов',          multi:{} }
];

/* ==================== 9. AI LAB КОНСТАНТЫ ==================== */
const AI_TYPES = [
  { id:'chat',  name:'Chat AI',   ico:'💬', desc:'Разговорный ассистент',        dataCost:200, unlockLvl:1 },
  { id:'image', name:'Image AI',  ico:'🎨', desc:'Генерация изображений',        dataCost:350, unlockLvl:3 },
  { id:'voice', name:'Voice AI',  ico:'🎙️', desc:'Синтез и распознавание речи',  dataCost:400, unlockLvl:5 },
  { id:'code',  name:'Code AI',   ico:'💻', desc:'Помощник программиста',        dataCost:500, unlockLvl:8 },
  { id:'video', name:'Video AI',  ico:'🎬', desc:'Генерация видео',              dataCost:800, unlockLvl:12 }
];
const AI_NAMES_PREFIX = ['Tycoon','Nova','Quantum','Pixel','Cyber','Deep','Neo','Mega','Alpha','Omega','Hyper','Ultra'];
const AI_NAMES_SUFFIX = ['GPT','Net','Core','Mind','Brain','Model','AI','Bot','Assistant','Gen','Flow','Core'];
const AI_INCIDENTS = [
  { id:'outage',    ico:'🔌', name:'Сбой серверов',    desc:'Часть пользователей потеряна из-за перегрузки', usersLoss:0.10, moneyPct:0,    repLoss:2,  bugAdd:0,  weight:3 },
  { id:'leak',      ico:'🔓', name:'Утечка данных',    desc:'Хакеры получили доступ к данным',              usersLoss:0.05, moneyPct:0.02, repLoss:15, bugAdd:0,  weight:1 },
  { id:'badcontent',ico:'⚠️', name:'Спорный контент',  desc:'Модель сгенерировала неприемлемое изображение',usersLoss:0.03, moneyPct:0,    repLoss:8,  bugAdd:15, weight:2 },
  { id:'rival',     ico:'⚔️', name:'Атака конкурента', desc:'Конкурент выпустил более качественную модель', usersLoss:0.08, moneyPct:0,    repLoss:3,  bugAdd:0,  weight:3 },
  { id:'ddos',      ico:'⏱️', name:'DDoS-атака',       desc:'Модель недоступна несколько часов',            usersLoss:0.06, moneyPct:0,    repLoss:5,  bugAdd:5,  weight:2 },
  { id:'hype',      ico:'📰', name:'Хайп в прессе',    desc:'О вас написали крупные СМИ!',                  usersLoss:-0.15,moneyPct:0,    repLoss:-8, bugAdd:0,  weight:1 }
];
/* ==================== PROVIDER КОНСТАНТЫ ==================== */
const PROVIDER_REGIONS = [
  { id:'home',   name:'Родной город',  flag:'🏠', baseCost:80000,  usersMax:15000,  taxRate:0.05 },
  { id:'oblast', name:'Область',        flag:'🗺️', baseCost:220000, usersMax:60000,  taxRate:0.08 },
  { id:'country',name:'Страна',         flag:'🏳️', baseCost:600000, usersMax:300000, taxRate:0.12 },
  { id:'continent',name:'Континент',    flag:'🌍', baseCost:1800000,usersMax:1500000,taxRate:0.15 },
  { id:'global', name:'Мир',            flag:'🌐', baseCost:5000000,usersMax:8000000,taxRate:0.18 }
];

const PROVIDER_TARIFFS = [
  { id:'eco',      name:'Эконом',    ico:'🐢', pricePerUser:1,  baseSpeed:30,  unlockLvl:1,  costMult:1.0, churnRate:0.008 },
  { id:'home',     name:'Домашний',  ico:'🏠', pricePerUser:3,  baseSpeed:100, unlockLvl:1,  costMult:1.4, churnRate:0.005 },
  { id:'premium',  name:'Премиум',   ico:'⚡', pricePerUser:8,  baseSpeed:300, unlockLvl:5,  costMult:2.0, churnRate:0.003 },
  { id:'gigabit',  name:'Гигабит',   ico:'🚀', pricePerUser:18, baseSpeed:1000,unlockLvl:10, costMult:3.0, churnRate:0.002 },
  { id:'ultra',    name:'Ультра+',   ico:'💎', pricePerUser:35, baseSpeed:5000,unlockLvl:20, costMult:5.0, churnRate:0.001 }
];

const PROVIDER_INFRA = [
  { id:'servers', ico:'🖥️', name:'Сервер',       desc:'+2000 к ёмкости абонентов', price:8000,  icon:'🖥️' },
  { id:'towers',  ico:'📡', name:'Вышка/кабель', desc:'+1% покрытия региона',       price:12000, icon:'📡' },
  { id:'routers', ico:'📶', name:'Роутер',       desc:'+25 Мбит/с средней скорости',price:5000,  icon:'📶' }
];

const PROVIDER_INCIDENTS = [
  { id:'outage',    ico:'🔌', name:'Авария на линии',  desc:'Массовое отключение абонентов', subsLoss:0.12, repLoss:8,  speedDrop:0, weight:3 },
  { id:'ddos',      ico:'⏱️', name:'DDoS-атака',       desc:'Сеть недоступна несколько часов',subsLoss:0.06, repLoss:5,  speedDrop:20,weight:3 },
  { id:'rival',     ico:'⚔️', name:'Акция конкурента', desc:'Конкурент снизил цены',         subsLoss:0.10, repLoss:3,  speedDrop:0, weight:2 },
  { id:'complaints',ico:'😡', name:'Жалобы абонентов', desc:'Скорость ниже обещанной',       subsLoss:0.04, repLoss:10, speedDrop:0, weight:2 },
  { id:'hack',      ico:'🔓', name:'Взлом биллинга',   desc:'Утечка данных абонентов',       subsLoss:0.08, repLoss:20, speedDrop:0, weight:1 },
  { id:'viral',     ico:'📰', name:'Хайп в соцсетях',  desc:'О вас написали блогеры',        subsLoss:-0.15,repLoss:-10,speedDrop:0, weight:1 }
];

const PROVIDER_NAMES_PREFIX = ['Net','Fiber','Link','Cyber','Tele','Sky','Grid','Data','Hyper','Ultra'];
const PROVIDER_NAMES_SUFFIX = ['Net','Link','Com','Line','Wave','Stream','Com','Soft','Online'];

/* ==================== 10. СОСТОЯНИЕ ==================== */
const SAVE_KEY = 'download_tycoon_save_v3';

function defaultState() {
  return {
    version: GAME_VERSION,
    money: 250,
    level: 1,
    xp: 0,
    techPoints: 0,
    tech: [],
    totalDownloads: 0,
    totalOS: 0,
    temp: 34,
    deviceId: 'dev_pc0',
    deviceName: 'Старый ПК из гаража',
    slots: { cpu:'cpu0', gpu:'gpu0', ram:'ram0', storage:'st0', wifi:'wifi0', battery:'bat0', screen:'scr0', cooling:'cool0' },
    drivers: {
      cpu:     { ver:1, latest:3, status:'outdated' },
      gpu:     { ver:0, latest:3, status:'none' },
      ram:     { ver:1, latest:2, status:'outdated' },
      storage: { ver:1, latest:1, status:'ok' },
      wifi:    { ver:0, latest:4, status:'none' },
      battery: { ver:0, latest:2, status:'none' },
      screen:  { ver:1, latest:1, status:'ok' },
      cooling: { ver:0, latest:2, status:'none' }
    },
    usedMB: 12000,
    os: { name:'Windows', ver:7, latest:7, missed:0 },
    apps: [
      { id:'browser', name:'TurboBrowser', ver:1, latest:2, size:140 },
      { id:'player',  name:'MediaPlayer',  ver:1, latest:1, size:90 }
    ],
    hasAntivirus: false,
    autoUpdate: false,
    downloads: [],
    orders: [],
    orderSeq: 1,
    virus: { infected:false, threats:0, dbVer:1, dbLatest:1, activeScans:0 },
    backups: [],
    stocks: STOCKS_BASE.map(s => ({ ...s, history:[s.price], owned:0, avgPrice:0 })),
    competitors: COMPETITORS_BASE.map(c => ({ ...c })),
    company: null,
    branches: [],
    ownOS: { name:'', ver:0, progress:0, released:false, target:300 },
    overclock: { cpu:0, gpu:0, ram:0 },
    achievements: [],
    campaign: { chapter:1, shown:{} },
    season: { id:'none', daysLeft:0, nextIn:60 },
    stats: { bsods:0, viruses:0, scans:0, backups:0, stocksBought:0, stockProfit:0, branchesOpened:0, maxTemp:34 },
    eventTimer: 50,
    driverTimer: 80,
    osTimer: 150,
    slowTimer: 0,
    autoBackupTimer: 300,
    seasonTimer: 60,
    stockTimer: 5,
    competitorTimer: 40,
    miningAccum: 0,
    playTime: 0,
    theme: 'dark',
    wallpaper: 'space',
    weather: { type: 'clear', temp: 15, nextChange: 300 },
    assistant: { enabled: false, listening: false, log: [] },
    clan: null,
    chat: [],
    chatTimer: 8,
    news: [],
    newsTimer: 30,
    widgets: { clock: true, weather: true, currency: true, news: true, stocks: true },
    certificates: [],
    locale: 'ru',
    ai: {
      unlocked: false,
      models: [],
      data: 50,
      marketingBudget: 0,
      totalUsers: 0,
      subscribers: 0,
      hourlyRevenue: 0,
      revenueHistory: [],
      incidents: [],
      nextIncident: 240,
      lifetimeRevenue: 0,
      lifetimeUsers: 0,
      dataAccum: 0
    },
    provider: {
      created: false,
      name: '',
      regionId: '',
      subscribers: 0,
      lifetimeSubscribers: 0,
      reputation: 50,
      tariffId: 'home',
      price: 30,
      hourlyRevenue: 0,
      lifetimeRevenue: 0,
      marketingBudget: 0,
      infrastructure: {
        servers: 0,
        towers: 0,
        routers: 0
      },
      coverage: 0,
      avgSpeed: 50,
      incidents: [],
      nextIncident: 300,
      speedBoost: 0
    }
  };
}

let state = loadGame();

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultState();
    const p = JSON.parse(raw);
    const b = defaultState();
    const m = { ...b, ...p };
    m.drivers    = { ...b.drivers, ...(p.drivers||{}) };
    m.os         = { ...b.os, ...(p.os||{}) };
    m.virus      = { ...b.virus, ...(p.virus||{}) };
    m.stats      = { ...b.stats, ...(p.stats||{}) };
    m.overclock  = { ...b.overclock, ...(p.overclock||{}) };
    m.campaign   = { ...b.campaign, ...(p.campaign||{}) };
    m.season     = { ...b.season, ...(p.season||{}) };
    m.ownOS      = { ...b.ownOS, ...(p.ownOS||{}) };
    m.ai         = { ...b.ai, ...(p.ai||{}) };
    if (p.ai && Array.isArray(p.ai.models)) m.ai.models = p.ai.models;
    m.provider   = { ...b.provider, ...(p.provider||{}) };
    if (p.provider && p.provider.infrastructure)
      m.provider.infrastructure = { ...b.provider.infrastructure, ...p.provider.infrastructure };
    return m;
  } catch (e) { return defaultState(); }
}

function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
}

/* ==================== 11. РАСЧЁТЫ ==================== */
const slotItem = slot => ALL_ITEMS[state.slots[slot]] || { name:'—', tier:0, stats:{} };
const stat = (slot, key) => slotItem(slot).stats[key] || 0;
const hasTech = id => state.tech.includes(id);

const totalStorageMB = () => stat('storage','gb') * 1024;
const freeMB = () => totalStorageMB() - state.usedMB;

function driverMult() {
  let s = 0;
  for (const x of SLOTS) {
    const d = state.drivers[x];
    if (!d) { s += 0.6; continue; }
    if (d.status === 'ok') s += 1.2;
    else if (d.status === 'outdated') s += 0.9;
    else if (d.status === 'broken') s += 0.35;
    else s += 0.6;
  }
  return s / SLOTS.length;
}

function maxConcurrent() {
  let n = 1 + Math.floor(stat('ram','gb') / 8);
  if (hasTech('ram_opt')) n += 2;
  return n;
}

function seasonActive() {
  return SEASONS.find(s => s.id === state.season.id) || SEASONS[SEASONS.length - 1];
}

function currentSpeed() {
  const netMBs = stat('wifi','net') / 8;
  const cpuF = 0.6 + stat('cpu','power') * 0.05;
  const ramF = 0.7 + Math.min(stat('ram','gb'), 128) * 0.01;
  const scrF = 1 + (stat('screen','hz') - 60) / 600;
  const ocF  = 1 + (state.overclock.cpu + state.overclock.gpu + state.overclock.ram) * 0.05;
  let sp = netMBs * cpuF * ramF * scrF * driverMult() * ocF;
  if (hasTech('net_boost')) sp *= 1.15;
  if (hasTech('cache')) sp *= 1.10;
  if (hasTech('usb4')) sp *= 1.08;
  if (hasTech('quantum')) sp *= 1.25;
  sp *= seasonActive().multi.speedMult || 1;
  if (state.temp > 78) sp *= clamp(1 - (state.temp - 78) / 90, .35, 1);
  if (state.slowTimer > 0) sp *= .5;
  if (state.os.latest - state.os.ver >= 3) sp *= .75;
  if (state.virus.infected) sp *= .7;
  // Бонус от собственного провайдера
  if (state.provider && state.provider.created) {
    sp *= 1 + (state.provider.speedBoost || 0) / 100;
  }
  return Math.max(.05, sp);
}

const xpNeeded = () => Math.round(50 * Math.pow(state.level, 1.35));

function addXp(v) {
  const scrBonus = 1 + (stat('screen','hz') - 60) / 300;
  const seasonMult = seasonActive().multi.xpMult || 1;
  state.xp += Math.round(v * scrBonus * seasonMult);
  let lvled = false;
  while (state.xp >= xpNeeded()) {
    state.xp -= xpNeeded();
    state.level++;
    state.techPoints++;
    lvled = true;
  }
  if (lvled) { toast(`⭐ Уровень ${state.level}! +1 ОТ`, 'good'); Sound.ok(); }
}

const currentLoad = () => {
  const a = state.downloads.filter(d => !d.paused).length;
  return a ? clamp(a / maxConcurrent(), 0, 1) : 0;
};
const ramUsage = () => clamp(18 + state.downloads.filter(d=>!d.paused).length * (12 + stat('cpu','power')*.8) + state.apps.length * 4 + (state.virus.infected?15:0), 0, 100);
const cpuUsage = () => clamp(4 + currentLoad() * 70 + (state.overclock.cpu + state.overclock.gpu + state.overclock.ram) * 3 + (state.virus.activeScans > 0 ? 30 : 0), 0, 100);

/* ==================== 12. ЗАКАЗЫ / СОБЫТИЯ ==================== */
function genOrder() {
  const pool = ORDER_TYPES.filter(t => state.level >= t.lvl);
  const t = pool[Math.floor(Math.random() * pool.length)];
  const size = Math.round(rnd(t.min, t.max));
  let money = Math.round(size * t.mult * (1 + state.level * 0.06));
  money = Math.round(money * (seasonActive().multi.moneyMult || 1));
  return {
    id: 'o' + (state.orderSeq++),
    name: `${t.n.toLowerCase()}_${NAME_PARTS[Math.floor(Math.random()*NAME_PARTS.length)]}_${Math.floor(rnd(100,999))}`,
    icon: t.i, size, money, xp: Math.round(size/2) + 5
  };
}
function refillOrders() { while (state.orders.length < 6) state.orders.push(genOrder()); }

function triggerEvent() {
  const r = Math.random();
  if (r < 0.20) {
    if (state.hasAntivirus && state.virus.dbVer >= state.virus.dbLatest) toast('🛡️ Антивирус блокировал угрозу', 'good');
    else { state.virus.infected = true; state.virus.threats++; state.stats.viruses++; Sound.error(); toast('🦠 Вирус проник! Запустите сканирование', 'bad'); }
  } else if (r < 0.38) {
    if (stat('battery','mah') >= 8000) toast('🔋 Батарея сгладила скачок', 'good');
    else {
      const s = SLOTS[Math.floor(Math.random()*SLOTS.length)];
      if (state.drivers[s]) { state.drivers[s].status = 'broken'; Sound.error(); toast(`⚡ Драйвер «${SLOT_INFO[s].label}» повреждён`, 'bad'); }
    }
  } else if (r < 0.55) { state.slowTimer = 20; toast('📉 Потеря пакетов: -50% скорости 20 сек', 'warn'); }
  else if (r < 0.72) {
    const s = SLOTS[Math.floor(Math.random()*SLOTS.length)];
    if (state.drivers[s]) {
      state.drivers[s].latest++;
      if (state.drivers[s].status === 'ok') state.drivers[s].status = 'outdated';
      toast(`🔔 Новый драйвер для «${SLOT_INFO[s].label}»`, 'info');
    }
  } else if (r < 0.82) { state.virus.dbLatest++; toast('🛡️ Новые базы антивируса', 'info'); }
  else if (r < 0.92) {
    const o = genOrder(); o.money = Math.round(o.money * 2.5);
    state.orders.unshift(o); toast('💎 Премиум-заказ!', 'good');
  } else {
    const act = state.downloads.filter(d => !d.paused);
    if (act.length) {
      const d = act[Math.floor(Math.random()*act.length)];
      d.dropTimer = 8;
      toast(`🌐 Обрыв сети: ${d.name}`, 'warn');
    }
  }
  state.eventTimer = rnd(45, 85);
}

/* ==================== 13. ДЕЙСТВИЯ ==================== */
function startDownload(order, prio = 0) {
  const pending = state.downloads.reduce((a, d) => a + d.size * (1 - d.done / d.size), 0);
  if (freeMB() - pending < order.size) { toast('❌ Мало места', 'bad'); Sound.error(); return; }
  state.orders = state.orders.filter(o => o.id !== order.id);
  refillOrders();
  state.downloads.push({
    id: 'd' + Date.now() + Math.random().toString(36).slice(2,6),
    name: order.name, icon: order.icon,
    size: order.size, done: 0, type: 'file',
    money: order.money, xp: order.xp,
    paused: false, prio, dropTimer: 0
  });
  Sound.click();
  toast(`⬇️ ${order.name} в очереди`, 'info');
}
function pauseDownload(id) { const d = state.downloads.find(x => x.id === id); if (d) { d.paused = !d.paused; Sound.click(); } }
function cancelDownload(id) { const i = state.downloads.findIndex(x => x.id === id); if (i >= 0) { state.downloads.splice(i, 1); Sound.click(); } }
function setPriority(id, prio) { const d = state.downloads.find(x => x.id === id); if (d) { d.prio = prio; Sound.click(); } }

function startAppUpdate(appId) {
  const app = state.apps.find(a => a.id === appId);
  if (!app || app.ver >= app.latest) return;
  if (state.downloads.some(d => d.type === 'app' && d.appId === appId)) return;
  state.downloads.push({
    id: 'd' + Date.now() + Math.random().toString(36).slice(2,6),
    name: `Обновление ${app.name}`, icon: '🧩',
    size: Math.round(app.size * 0.35), done: 0, type: 'app',
    appId, money: 0, xp: 12, paused: false, prio: 0, dropTimer: 0
  });
}

function startOsUpdate() {
  if (state.os.ver >= state.os.latest) return;
  if (state.downloads.some(d => d.type === 'os')) return;
  const needMB = 220 + state.os.latest * 25;
  const pending = state.downloads.reduce((a, d) => a + d.size * (1 - d.done / d.size), 0);
  if (freeMB() - pending < needMB) { toast('❌ Мало места для ОС', 'bad'); return; }
  state.downloads.push({
    id: 'd' + Date.now() + Math.random().toString(36).slice(2,6),
    name: `${state.os.name} ${state.os.latest}`, icon: '🪟',
    size: needMB, done: 0, type: 'os',
    money: 800 + state.os.latest * 60, xp: 90,
    paused: false, prio: 1, dropTimer: 0
  });
  toast('🔄 Загрузка обновления ОС', 'info');
}

function finishDownload(d) {
  state.usedMB += Math.round(d.size * 0.6);
  if (d.type === 'file') {
    state.money += d.money;
    state.totalDownloads++;
    addXp(d.xp);
    Sound.money();
    toast(`✅ ${d.name} (+${fmt(d.money)} ₮)`, 'good');
  } else if (d.type === 'app') {
    const app = state.apps.find(a => a.id === d.appId);
    if (app) app.ver = app.latest;
    addXp(d.xp); Sound.ok();
    toast(`✅ ${d.name} установлено`, 'good');
  } else if (d.type === 'os') {
    state.os.ver = state.os.latest;
    state.os.missed = 0;
    state.totalOS++;
    state.money += d.money;
    addXp(d.xp); Sound.ok();
    toast(`✅ ОС обновлена до ${state.os.name} ${state.os.ver}`, 'good');
  }
}

const priceWithDiscount = p => Math.round(p * (1 - (seasonActive().multi.shopDiscount || 0)));

function buyComponent(itemId) {
  const item = ALL_ITEMS[itemId]; if (!item) return;
  const cur = slotItem(item.slot);
  if (item.tier <= cur.tier) { toast('❌ Не улучшение', 'bad'); return; }
  const price = priceWithDiscount(item.price);
  if (state.money < price) { toast('❌ Нет денег', 'bad'); Sound.error(); return; }
  state.money -= price;
  state.slots[item.slot] = itemId;
  const latest = state.drivers[item.slot] ? state.drivers[item.slot].latest + 1 : 3;
  state.drivers[item.slot] = { ver: 0, latest, status: 'none' };
  Sound.money();
  toast(`✅ Установлено: ${item.name}. Нужен драйвер!`, 'good');
}

function buyDevice(devId) {
  const dev = DEVICES.find(d => d.id === devId); if (!dev) return;
  if (state.deviceId === devId) return;
  const price = priceWithDiscount(dev.price);
  if (state.money < price) { toast('❌ Нет денег', 'bad'); return; }
  state.money -= price;
  state.deviceId = dev.id; state.deviceName = dev.name;
  state.slots = { ...dev.slots };
  state.os = { name: dev.os, ver: dev.osVer, latest: dev.osVer, missed: 0 };
  for (const s of SLOTS) state.drivers[s] = { ver:0, latest: Math.floor(rnd(2,5)), status:'none' };
  Sound.ok();
  toast(`🎉 Новое устройство: ${dev.name}`, 'good');
}

function buyApp(appId) {
  const proto = APP_POOL.find(a => a.id === appId); if (!proto) return;
  const price = priceWithDiscount(Math.round(proto.size * 3.5));
  if (state.money < price) { toast('❌ Нет денег', 'bad'); return; }
  if (state.apps.some(a => a.id === appId)) return;
  state.money -= price;
  state.apps.push({ id: proto.id, name: proto.name, ver:1, latest:1, size: proto.size });
  state.usedMB += proto.size;
  if (appId === 'antivirus') state.hasAntivirus = true;
  Sound.ok();
  toast(`✅ Установлено: ${proto.name}`, 'good');
}

function driverAction(slot, act) {
  const d = state.drivers[slot]; if (!d) return;
  if (act === 'install' || act === 'update') {
    const badChance = 0.06 + Math.max(0, d.latest - 3) * 0.02;
    if (Math.random() < badChance) {
      d.status = 'broken';
      d.ver = Math.max(1, d.latest - 1);
      triggerBSOD(`DRIVER_IRQL_NOT_LESS_OR_EQUAL (${slot.toUpperCase()})`);
      return;
    }
    d.ver = d.latest; d.status = 'ok';
    Sound.ok();
    toast(`🔧 Драйвер «${SLOT_INFO[slot].label}» v${d.ver}`, 'good');
  } else if (act === 'rollback') {
    d.ver = Math.max(1, d.ver - 1);
    d.status = d.ver === d.latest ? 'ok' : 'outdated';
    Sound.click(); toast(`↩️ Откат до v${d.ver}`, 'info');
  } else if (act === 'delete') {
    d.ver = 0; d.status = 'none';
    Sound.error(); toast('🗑️ Драйвер удалён', 'bad');
  }
}

function triggerBSOD(reason) {
  state.stats.bsods++;
  Sound.bsod();
  const b = $('#bsod'); if (!b) return;
  b.querySelector('.bsod-code').textContent = reason;
  b.classList.add('show');
  state.downloads.forEach(d => { d.done = Math.max(0, d.done - d.size * 0.15); });
  setTimeout(() => {
    b.classList.remove('show');
    for (const s of SLOTS) if (state.drivers[s] && state.drivers[s].status === 'broken') {
      state.drivers[s].status = 'outdated';
      state.drivers[s].ver = Math.max(1, state.drivers[s].latest - 1);
    }
    toast('💙 Система восстановлена', 'warn');
  }, 6200);
}

function scanForViruses() {
  if (state.virus.activeScans > 0) return;
  state.virus.activeScans = 1;
  state.stats.scans++;
  Sound.click();
  const pro = hasTech('av_pro');
  const dur = pro ? 3 : 5;
  toast(`🛡️ Сканирование (${dur} сек)...`, 'info');
  setTimeout(() => {
    state.virus.activeScans = 0;
    if (state.virus.threats > 0) {
      const n = state.virus.threats;
      state.virus.threats = 0; state.virus.infected = false;
      Sound.ok(); toast(`✅ Удалено угроз: ${n}`, 'good');
    } else toast('✅ Угроз не найдено', 'good');
  }, dur * 1000);
}

function updateVirusDb() {
  if (state.virus.dbVer >= state.virus.dbLatest) return;
  const cost = (state.virus.dbLatest - state.virus.dbVer) * 200;
  if (state.money < cost) { toast('❌ Нет денег', 'bad'); return; }
  state.money -= cost;
  state.virus.dbVer = state.virus.dbLatest;
  Sound.ok(); toast(`🛡️ Базы v${state.virus.dbVer}`, 'good');
}

function payForRemoval() {
  const cost = 1500 + state.virus.threats * 500;
  if (state.money < cost) { toast('❌ Нет денег', 'bad'); return; }
  state.money -= cost;
  state.virus.threats = 0; state.virus.infected = false;
  Sound.money(); toast(`💸 Удалено за ${fmt(cost)} ₮`, 'good');
}

function createBackup() {
  const snap = {
    time: Date.now(), usedMB: state.usedMB,
    apps: JSON.parse(JSON.stringify(state.apps)),
    drivers: JSON.parse(JSON.stringify(state.drivers)),
    os: JSON.parse(JSON.stringify(state.os)),
    slots: { ...state.slots }
  };
  state.backups.unshift(snap);
  if (state.backups.length > 6) state.backups.pop();
  state.stats.backups++;
  Sound.ok(); toast('💽 Бэкап создан', 'good');
}

function restoreBackup(i) {
  const s = state.backups[i]; if (!s) return;
  state.usedMB = s.usedMB;
  state.apps = JSON.parse(JSON.stringify(s.apps));
  state.drivers = JSON.parse(JSON.stringify(s.drivers));
  state.os = JSON.parse(JSON.stringify(s.os));
  state.slots = { ...s.slots };
  Sound.ok(); toast('✅ Восстановлено', 'good');
}

function researchTech(id) {
  const t = TECHS.find(x => x.id === id);
  if (!t || hasTech(id)) return;
  if (!t.req.every(r => hasTech(r))) { toast('❌ Нужны предыдущие', 'bad'); return; }
  if (state.techPoints < t.cost) { toast('❌ Мало ОТ', 'bad'); return; }
  state.techPoints -= t.cost;
  state.tech.push(id);
  if (id === 'ai_lab') state.ai.unlocked = true;
  Sound.achv(); toast(`🔬 Изучено: ${t.name}`, 'good');
}

function updateStocks(dt) {
  const api = hasTech('stock_api');
  for (const s of state.stocks) {
    if (!api && s.price > 1000) continue;
    const drift = rnd(-s.vol, s.vol) * dt;
    s.price = Math.max(10, s.price * (1 + drift));
    s.history.push(s.price);
    if (s.history.length > 30) s.history.shift();
  }
}

function buyStock(id, qty) {
  const s = state.stocks.find(x => x.id === id); if (!s) return;
  const cost = s.price * qty;
  if (state.money < cost) { toast('❌ Нет денег', 'bad'); return; }
  state.money -= cost;
  s.avgPrice = (s.avgPrice * s.owned + cost) / (s.owned + qty);
  s.owned += qty;
  state.stats.stocksBought++;
  Sound.money(); toast(`📈 Куплено ${qty} × ${s.id}`, 'good');
}

function sellStock(id, qty) {
  const s = state.stocks.find(x => x.id === id);
  if (!s || s.owned < qty) return;
  const gain = s.price * qty;
  const profit = gain - s.avgPrice * qty;
  state.money += gain;
  s.owned -= qty;
  if (s.owned === 0) s.avgPrice = 0;
  state.stats.stockProfit += profit;
  Sound.money();
  toast(`💸 Продано ${qty} × ${s.id} (${profit >= 0 ? '+' : ''}${fmt(profit)})`, 'good');
}

function updateCompetitors(dt) {
  for (const c of state.competitors) {
    c.share = clamp(c.share + rnd(-0.02, 0.03) * dt, 1, 60);
    c.power += rnd(0, 0.001) * dt;
  }
  if (state.company && state.company.products.length) {
    const steal = state.company.products.length * 0.003 * dt;
    state.competitors.sort((a, b) => b.share - a.share);
    state.competitors[0].share = Math.max(1, state.competitors[0].share - steal);
  }
}

function myMarketShare() {
  if (!state.company) return 0;
  const my = state.company.products.reduce((a, p) => a + p.gen, 0) * 0.6 + state.company.rep * 0.2;
  const total = state.competitors.reduce((a, c) => a + c.share, 0) + my;
  return total > 0 ? (my / total * 100) : 0;
}

function registerCompany(name, dir) {
  state.company = { name, dir, rep:0, employees:0, products:[], rnd:{ active:false, progress:0, target:70 }, income:0 };
  closeModal();
  Sound.achv();
  toast(`🏢 Компания «${name}» зарегистрирована!`, 'good');
}

function startRnD() {
  const c = state.company; if (!c || c.rnd.active) return;
  c.rnd.active = true; c.rnd.progress = 0;
  let target = Math.max(25, 70 - c.employees * 6);
  if (hasTech('rd_fast')) target *= 0.7;
  c.rnd.target = target;
  Sound.click(); toast('🔬 R&D начат', 'info');
}

function openBranch(id) {
  const c = COUNTRIES.find(x => x.id === id); if (!c) return;
  if (state.branches.includes(id)) return;
  if (state.money < c.cost) { toast('❌ Нет денег', 'bad'); return; }
  state.money -= c.cost;
  state.branches.push(id);
  state.stats.branchesOpened++;
  Sound.achv();
  toast(`🌍 Филиал: ${c.flag} ${c.name}`, 'good');
}

function startOwnOS() {
  if (!hasTech('os_dev')) { toast('❌ Нужна технология', 'bad'); return; }
  if (state.ownOS.released) return;
  if (state.ownOS.progress > 0) return;
  state.ownOS.progress = 1;
  Sound.click(); toast('💿 Разработка ОС начата', 'info');
}

function setOverclock(slot, level) {
  if (!hasTech('oc_unlock')) return;
  const old = state.overclock[slot];
  state.overclock[slot] = clamp(level, 0, 5);
  if (old !== state.overclock[slot]) Sound.click();
}
const coolingCapacity = () => stat('cooling','cool') + (hasTech('cool_eff') ? 4 : 0);
const heatFromOC = () => (state.overclock.cpu + state.overclock.gpu + state.overclock.ram) * 6;

function loadMod(json) {
  try {
    const data = JSON.parse(json);
    let added = 0;
    if (Array.isArray(data.components)) {
      for (const c of data.components) {
        if (!CATALOG[c.slot]) continue;
        CATALOG[c.slot].push(c);
        ALL_ITEMS[c.id] = { ...c, slot: c.slot };
        added++;
      }
    }
    if (Array.isArray(data.orders)) { for (const o of data.orders) ORDER_TYPES.push(o); added++; }
    Sound.achv(); toast(`🧩 Мод загружен: ${added} эл.`, 'good');
    return true;
  } catch (e) { toast('❌ Ошибка мода', 'bad'); return false; }
}

function exportSave() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `download-tycoon-save-${Date.now()}.json`;
  a.click(); URL.revokeObjectURL(url);
  toast('☁️ Экспорт', 'good');
}

function importSave(file) {
  const r = new FileReader();
  r.onload = e => {
    try {
      const p = JSON.parse(e.target.result);
      state = { ...defaultState(), ...p };
      state.ai = { ...defaultState().ai, ...(p.ai||{}) };
      saveGame();
      toast('☁️ Импорт', 'good');
      setTimeout(() => location.reload(), 400);
    } catch (err) { toast('❌ Неверный файл', 'bad'); }
  };
  r.readAsText(file);
}

function rollSeason() {
  const pool = SEASONS.filter(s => s.id !== state.season.id);
  const s = pool[Math.floor(Math.random() * pool.length)];
  state.season.id = s.id;
  state.season.daysLeft = 120;
  Sound.alert();
  toast(`${s.ico} Сезон: ${s.name} — ${s.desc}`, 'warn');
}

function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    if (state.achievements.includes(a.id)) continue;
    let got = false;
    try { got = a.check(state); } catch (e) {}
    if (got) {
      state.achievements.push(a.id);
      state.money += a.reward;
      Sound.achv();
      toast(`${a.ico} Достижение: ${a.name} (+${fmt(a.reward)} ₮)`, 'achv');
    }
  }
}

function checkCampaign() {
  const ch = CAMPAIGN.find(c => c.id === state.campaign.chapter);
  if (!ch) return;
  const all = ch.tasks.every(t => { try { return t.check(state); } catch (e) { return false; } });
  if (all) {
    state.campaign.chapter++;
    state.techPoints += 2;
    state.money += 5000 * ch.id;
    Sound.achv();
    toast(`📖 Глава пройдена: ${ch.title} (+2 ОТ)`, 'good');
  }
}

/* ==================== 14. AI LAB ФУНКЦИИ ==================== */
function aiServerCapacity() {
  const ram = stat('ram','gb');
  const cpu = stat('cpu','power');
  const st  = stat('storage','gb');
  let cap = Math.floor(ram * 50 + cpu * 500 + st * 5);
  if (hasTech('ai_scale')) cap *= 2;
  return cap;
}

function aiServerLoad() {
  const cap = aiServerCapacity();
  if (!cap) return 0;
  return clamp((state.ai.totalUsers / cap) * 100, 0, 150);
}

const AI_DATA_PRICE = 100;

function buyAIData(amount) {
  const cost = amount * AI_DATA_PRICE;
  if (state.money < cost) { toast('❌ Нет денег', 'bad'); Sound.error(); return; }
  state.money -= cost;
  state.ai.data += amount;
  Sound.money();
  toast(`💾 +${amount} данных за ${fmt(cost)} ₮`, 'good');
  refreshWindows();
}

function startAITraining(typeId) {
  const t = AI_TYPES.find(x => x.id === typeId);
  if (!t) return;
  if (!hasTech('ai_lab')) { toast('❌ Нужна технология «AI Framework»', 'bad'); return; }
  if (state.level < t.unlockLvl) { toast(`❌ Откроется с ${t.unlockLvl} уровня`, 'bad'); return; }
  if (state.ai.data < t.dataCost) { toast(`❌ Нужно ${t.dataCost} данных`, 'bad'); return; }
  if (state.ai.models.some(m => m.training.active)) { toast('⚠️ Уже идёт обучение', 'warn'); return; }
  if (state.ai.models.some(m => m.type === typeId)) { toast('ℹ️ Такая модель уже есть', 'info'); return; }

  state.ai.data -= t.dataCost;

  const prefix = AI_NAMES_PREFIX[Math.floor(Math.random() * AI_NAMES_PREFIX.length)];
  const suffix = AI_NAMES_SUFFIX[Math.floor(Math.random() * AI_NAMES_SUFFIX.length)];
  const model = {
    id: 'ai_' + Date.now().toString(36),
    type: t.id,
    name: prefix + suffix,
    version: 1,
    quality: 0,
    bugLevel: 0,
    users: 0,
    subscribers: 0,
    pricePerUser: 3,
    released: false,
    lifetimeUsers: 0,
    lifetimeRevenue: 0,
    training: { active: true, progress: 0, target: 45 + t.unlockLvl * 3 },
    created: Date.now()
  };
  state.ai.models.push(model);
  Sound.click();
  toast(`🤖 Обучение модели «${model.name}» начато`, 'info');
  refreshWindows();
}

function upgradeAI(id) {
  const m = state.ai.models.find(x => x.id === id);
  if (!m) return;
  const t = AI_TYPES.find(x => x.id === m.type);
  const dataCost = t.dataCost * (m.version + 1) * 0.5;
  if (state.ai.data < dataCost) { toast(`❌ Нужно ${Math.round(dataCost)} данных`, 'bad'); return; }
  if (state.ai.models.some(x => x.training.active)) { toast('⚠️ Уже идёт обучение', 'warn'); return; }
  state.ai.data -= dataCost;
  m.training = { active: true, progress: 0, target: 40 + m.version * 8, nextVersion: m.version + 1 };
  Sound.click();
  toast(`📈 Апгрейд «${m.name}» до v${m.version + 1}`, 'info');
  refreshWindows();
}

function releaseAI(id) {
  const m = state.ai.models.find(x => x.id === id);
  if (!m || m.released || m.training.active) return;
  m.released = true;
  Sound.achv();
  toast(`🚀 «${m.name}» выпущена!`, 'good');
  refreshWindows();
}

function setAIPrice(id, price) {
  const m = state.ai.models.find(x => x.id === id);
  if (!m) return;
  m.pricePerUser = clamp(price, 0.5, 50);
}

function fixAIBugs(id) {
  const m = state.ai.models.find(x => x.id === id);
  if (!m || m.bugLevel <= 0) return;
  const cost = Math.round(m.bugLevel * 200 + m.users * 0.05);
  if (state.money < cost) { toast('❌ Нет денег', 'bad'); return; }
  state.money -= cost;
  m.bugLevel = Math.max(0, m.bugLevel - 30);
  Sound.ok();
  toast(`🔧 Баги снижены (осталось ${Math.round(m.bugLevel)}%)`, 'good');
  refreshWindows();
}

function deleteAI(id) {
  const idx = state.ai.models.findIndex(x => x.id === id);
  if (idx < 0) return;
  const m = state.ai.models[idx];
  if (m.users > 0 && !confirm(`Удалить «${m.name}»? Пользователи потеряются (${fmt(m.users)}).`)) return;
  state.ai.models.splice(idx, 1);
  Sound.error();
  toast(`🗑️ Модель «${m.name}» удалена`, 'bad');
  refreshWindows();
}

function finalizeAITraining(m) {
  const gpu = stat('gpu','power');
  const cpu = stat('cpu','power');
  const base = 20 + (gpu + cpu) * 2;
  const versionBonus = (m.version - 1) * 6;
  const techBonus = hasTech('ai_nn') ? 15 : 0;
  const noise = rnd(-5, 10);
  const newQuality = clamp(base + versionBonus + techBonus + noise, 10, 100);

  if (m.training.nextVersion) {
    m.version = m.training.nextVersion;
    m.quality = clamp(m.quality * 0.6 + newQuality * 0.4, 10, 100);
    m.bugLevel = Math.min(100, m.bugLevel + rnd(0, 15));
    toast(`✅ ${m.name} обновлён до v${m.version} (качество ${Math.round(m.quality)})`, 'good');
    delete m.training.nextVersion;
  } else {
    m.quality = newQuality;
    toast(`✅ ${m.name} обучена! Качество: ${Math.round(m.quality)}`, 'good');
  }
  m.training.active = false;
  m.training.progress = 0;
  Sound.achv();
}

function triggerAIIncident() {
  if (!state.ai.models.some(m => m.released)) return;
  const safe = hasTech('ai_safety');
  if (safe && Math.random() < 0.5) {
    toast('🛡️ AI Safety предотвратил инцидент', 'good');
    return;
  }
  const totalW = AI_INCIDENTS.reduce((a, x) => a + x.weight, 0);
  let roll = Math.random() * totalW;
  let inc = AI_INCIDENTS[0];
  for (const x of AI_INCIDENTS) {
    roll -= x.weight;
    if (roll <= 0) { inc = x; break; }
  }
  const released = state.ai.models.filter(m => m.released);
  const target = released[Math.floor(Math.random() * released.length)];

  if (inc.usersLoss > 0) {
    const lost = Math.round(target.users * inc.usersLoss);
    target.users = Math.max(0, target.users - lost);
  } else if (inc.usersLoss < 0) {
    const gain = Math.round(target.users * (-inc.usersLoss));
    target.users += gain;
  }
  if (inc.moneyPct > 0) state.money = Math.max(0, state.money - state.money * inc.moneyPct);
  if (inc.repLoss !== 0 && state.company) state.company.rep = Math.max(0, state.company.rep - inc.repLoss);
  if (inc.bugAdd) target.bugLevel = clamp(target.bugLevel + inc.bugAdd, 0, 100);

  state.ai.incidents.unshift({ ...inc, time: Date.now(), model: target.name });
  if (state.ai.incidents.length > 20) state.ai.incidents.pop();

  const type = inc.usersLoss > 0 ? 'bad' : 'good';
  Sound.alert();
  toast(`${inc.ico} ${inc.name}: ${inc.desc}`, type);
}

function updateAI(dt) {
  const ai = state.ai;
  if (!ai.unlocked) ai.unlocked = hasTech('ai_lab');

  for (const m of ai.models) {
    if (!m.training.active) continue;
    const speed = 1 + stat('gpu','power') * 0.1 + (hasTech('ai_nn') ? 0.5 : 0);
    m.training.progress += dt * speed;
    if (m.training.progress >= m.training.target) finalizeAITraining(m);
  }

  const released = ai.models.filter(m => m.released);
  if (released.length) {
    const gain = released.reduce((a, m) => a + m.users * 0.001, 0) * dt;
    ai.dataAccum += gain;
    while (ai.dataAccum >= 1) {
      ai.data += 1;
      ai.dataAccum -= 1;
    }
  }

  const cap = aiServerCapacity();
  let totalUsers = 0, totalSubs = 0, totalRevenue = 0;

  for (const m of ai.models) {
    if (!m.released) continue;
    const sat = clamp(1 - (m.users / Math.max(1, cap / released.length)), 0, 1);
    const qualityF = m.quality / 100;
    const priceF = Math.max(0.1, 1 - (m.pricePerUser - 3) / 30);
    const marketingF = 1 + (ai.marketingBudget / 200000);
    const bugF = 1 - (m.bugLevel / 200);
    const repF = state.company ? (1 + state.company.rep / 200) : 1;
    const rate = 25 * qualityF * priceF * marketingF * bugF * repF * sat;

    m.users += rate * dt;
    m.lifetimeUsers += rate * dt;
    m.subscribers = m.users * 0.05 * (m.quality / 100);
    const rev = m.subscribers * m.pricePerUser * dt;
    m.lifetimeRevenue += rev;
    totalRevenue += rev;
    m.bugLevel = clamp(m.bugLevel + rnd(0, 0.15) * dt * (1 + m.users / 50000), 0, 100);

    totalUsers += m.users;
    totalSubs += m.subscribers;
  }

  ai.totalUsers = Math.round(totalUsers);
  ai.subscribers = Math.round(totalSubs);
  ai.hourlyRevenue = totalRevenue * 3600;
  ai.lifetimeRevenue += totalRevenue;
  ai.lifetimeUsers = ai.models.reduce((a, m) => a + m.lifetimeUsers, 0);

  if (ai.marketingBudget > 0) {
    const spend = ai.marketingBudget * 0.05 * dt;
    state.money = Math.max(0, state.money - spend);
    ai.marketingBudget = Math.max(0, ai.marketingBudget - spend);
  }

  state.money += totalRevenue;

  if (released.length) {
    ai.nextIncident -= dt;
    if (ai.nextIncident <= 0) {
      triggerAIIncident();
      ai.nextIncident = rnd(180, 360);
    }
  }
}

/* ==================== 14.5. PROVIDER ФУНКЦИИ ==================== */

// Ёмкость абонентов зависит от инфраструктуры и региона
function providerCapacity() {
  const p = state.provider;
  const region = PROVIDER_REGIONS.find(r => r.id === p.regionId);
  const regionMax = region ? region.usersMax : 5000;
  let cap = p.infrastructure.servers * 2000 + regionMax * 0.1;
  if (hasTech('prv_dc')) cap *= 1.5;
  return Math.floor(cap);
}

// Максимальное покрытие региона (0–100%)
function providerMaxCoverage() {
  const p = state.provider;
  let cov = p.infrastructure.towers * 1;
  if (hasTech('prv_5g')) cov *= 1.3;
  if (hasTech('prv_sat')) cov = 100;
  return clamp(cov, 0, 100);
}

// Средняя скорость сети (Мбит/с)
function providerAvgSpeed() {
  const p = state.provider;
  const tariff = PROVIDER_TARIFFS.find(t => t.id === p.tariffId) || PROVIDER_TARIFFS[1];
  let speed = tariff.baseSpeed + p.infrastructure.routers * 25;
  if (hasTech('prv_optic')) speed *= 1.5;
  return Math.round(speed);
}

// Личный бонус игроку к скорости загрузки (%)
function providerPlayerBonus() {
  const p = state.provider;
  if (!p.created) return 0;
  // бонус = доля покрытия × качество скорости
  const coverage = p.coverage / 100;
  const speedFactor = clamp(providerAvgSpeed() / 1000, 0, 3);
  return Math.round(coverage * speedFactor * 50); // до +150%
}

// Создание провайдера
function createProvider(name, regionId) {
  if (!hasTech('prv_open')) { toast('❌ Нужна технология «Internet Provider»', 'bad'); return; }
  const region = PROVIDER_REGIONS.find(r => r.id === regionId);
  if (!region) return;
  if (state.money < region.baseCost) { toast('❌ Нет денег', 'bad'); return; }

  state.money -= region.baseCost;
  state.provider.created = true;
  state.provider.name = name || 'Мой Провайдер';
  state.provider.regionId = regionId;
  state.provider.subscribers = 0;
  state.provider.reputation = 50;
  state.provider.tariffId = 'home';
  state.provider.price = 30;
  state.provider.coverage = 5;
  state.provider.avgSpeed = 100;
  state.provider.infrastructure = { servers: 1, towers: 1, routers: 1 };

  Sound.achv();
  toast(`📡 Провайдер «${name}» создан в регионе ${region.flag} ${region.name}!`, 'good');
  refreshWindows();
}

// Смена тарифа
function setProviderTariff(tariffId) {
  const t = PROVIDER_TARIFFS.find(x => x.id === tariffId);
  if (!t || state.level < t.unlockLvl) return;
  state.provider.tariffId = tariffId;
  state.provider.price = t.pricePerUser * 10;
  Sound.click();
  toast(`📦 Тариф: ${t.ico} ${t.name}`, 'info');
  refreshWindows();
}

// Установка цены (ручная)
function setProviderPrice(price) {
  state.provider.price = clamp(price, 1, 500);
}

// Покупка инфраструктуры
function buildProviderInfra(typeId) {
  const infra = PROVIDER_INFRA.find(i => i.id === typeId);
  if (!infra) return;
  const p = state.provider;
  const owned = p.infrastructure[typeId] || 0;
  const price = Math.round(infra.price * (1 + owned * 0.15));
  if (state.money < price) { toast('❌ Нет денег', 'bad'); return; }
  state.money -= price;
  p.infrastructure[typeId] = owned + 1;
  Sound.money();
  toast(`🏗️ Куплено: ${infra.name} (${owned + 1} шт.)`, 'good');
  refreshWindows();
}

// Продвижение
function providerMarketing(amount) {
  if (state.money < amount) { toast('❌ Нет денег', 'bad'); return; }
  state.money -= amount;
  state.provider.marketingBudget += amount;
  Sound.money();
  toast(`📣 Бюджет рекламы: ${fmt(state.provider.marketingBudget)} ₮`, 'good');
  refreshWindows();
}

// Смена региона
function switchProviderRegion(regionId) {
  const r = PROVIDER_REGIONS.find(x => x.id === regionId);
  if (!r) return;
  if (state.provider.regionId === regionId) return;
  if (state.money < r.baseCost) { toast(`❌ Нужно ${fmt(r.baseCost)} ₮`, 'bad'); return; }
  // Проверка по уровню
  const requiredLvl = PROVIDER_REGIONS.indexOf(r) * 6 + 1;
  if (state.level < requiredLvl) { toast(`❌ Требуется уровень ${requiredLvl}`, 'bad'); return; }

  state.money -= r.baseCost;
  state.provider.regionId = regionId;
  // часть абонентов теряется при переезде
  state.provider.subscribers *= 0.5;
  state.provider.reputation = Math.max(20, state.provider.reputation - 10);
  Sound.achv();
  toast(`🌍 Переезд в регион ${r.flag} ${r.name}!`, 'good');
  refreshWindows();
}

// Инцидент провайдера
function triggerProviderIncident() {
  const p = state.provider;
  if (!p.created || p.subscribers < 10) return;

  const safe = hasTech('prv_dc');
  if (safe && Math.random() < 0.4) {
    toast('🏢 Дата-центр предотвратил инцидент', 'good');
    return;
  }

  const totalW = PROVIDER_INCIDENTS.reduce((a, x) => a + x.weight, 0);
  let roll = Math.random() * totalW;
  let inc = PROVIDER_INCIDENTS[0];
  for (const x of PROVIDER_INCIDENTS) {
    roll -= x.weight;
    if (roll <= 0) { inc = x; break; }
  }

  if (inc.subsLoss > 0) {
    const lost = Math.round(p.subscribers * inc.subsLoss);
    p.subscribers = Math.max(0, p.subscribers - lost);
  } else if (inc.subsLoss < 0) {
    const gain = Math.round(p.subscribers * (-inc.subsLoss));
    p.subscribers += gain;
  }
  if (inc.repLoss) p.reputation = clamp(p.reputation - inc.repLoss, 0, 100);

  p.incidents.unshift({ ...inc, time: Date.now() });
  if (p.incidents.length > 20) p.incidents.pop();

  const type = inc.subsLoss > 0 ? 'bad' : 'good';
  Sound.alert();
  toast(`${inc.ico} ${inc.name}: ${inc.desc}`, type);
}

// Обновление провайдера (вызывается из update)
function updateProvider(dt) {
  const p = state.provider;
  if (!p.created) return;

  // покрытие растёт к максимуму
  const maxCov = providerMaxCoverage();
  p.coverage += (maxCov - p.coverage) * clamp(dt * 0.05, 0, 1);

  // средняя скорость
  p.avgSpeed = providerAvgSpeed();

  // ёмкость
  const cap = providerCapacity();

  // цена → фактор привлекательности
  const tariff = PROVIDER_TARIFFS.find(t => t.id === p.tariffId) || PROVIDER_TARIFFS[1];
  const priceF = clamp(1 - (p.price - tariff.pricePerUser * 10) / 100, 0.1, 2);
  const speedF = clamp(p.avgSpeed / 200, 0.3, 3);
  const repF = clamp(p.reputation / 50, 0.2, 2);
  const coverF = clamp(p.coverage / 100, 0, 1);
  const marketingF = 1 + (p.marketingBudget / 100000);

  // сколько всего может быть абонентов
  const targetSubs = cap * coverF * 0.8;

  // рост / падение
  const saturation = 1 - clamp(p.subscribers / Math.max(1, targetSubs), 0, 1);
  const growRate = 25 * priceF * speedF * repF * marketingF * saturation;
  const churnRate = p.subscribers * tariff.churnRate * (1 - repF * 0.5);

  p.subscribers = Math.max(0, p.subscribers + growRate * dt - churnRate * dt);
  p.lifetimeSubscribers = Math.max(p.lifetimeSubscribers, p.subscribers);

  // репутация колеблется
  p.reputation = clamp(p.reputation + rnd(-0.05, 0.06) * dt, 0, 100);

  // доход: цена ₮/сек за абонента
  const revenue = p.subscribers * (p.price / 100) * dt;
  p.hourlyRevenue = p.subscribers * (p.price / 100) * 3600;
  p.lifetimeRevenue += revenue;
  state.money += revenue;

  // маркетинг сгорает
  if (p.marketingBudget > 0) {
    const spend = p.marketingBudget * 0.03 * dt;
    state.money = Math.max(0, state.money - spend);
    p.marketingBudget = Math.max(0, p.marketingBudget - spend);
  }

  // бонус к скорости игрока
  p.speedBoost = providerPlayerBonus();

  // инциденты
  if (p.subscribers >= 10) {
    p.nextIncident -= dt;
    if (p.nextIncident <= 0) {
      triggerProviderIncident();
      p.nextIncident = rnd(240, 480);
    }
  }
}

/* ==================== 15. ИГРОВОЙ ЦИКЛ ==================== */
function update(dt) {
  state.playTime += dt;

  const active = state.downloads.filter(d => !d.paused);
  if (active.length) {
    let sp = currentSpeed();
    const over = Math.max(0, active.length - maxConcurrent());
    sp *= 1 / (1 + over * 0.6);
    const each = sp / active.length;
    for (let i = state.downloads.length - 1; i >= 0; i--) {
      const d = state.downloads[i];
      if (d.paused) continue;
      if (d.dropTimer > 0) { d.dropTimer -= dt; continue; }
      const prioBonus = 1 + (d.prio || 0) * 0.15;
      d.done += each * dt * prioBonus;
      if (Math.random() < dt * 0.015) { d.dropTimer = 3; continue; }
      if (d.done >= d.size) { finishDownload(d); state.downloads.splice(i, 1); }
    }
  }

  const heatMult = seasonActive().multi.heatMult || 1;
  const target = (34 + currentLoad()*45 + (1-driverMult())*25 + heatFromOC() - coolingCapacity()*1.5) * heatMult;
  state.temp += (target - state.temp) * clamp(dt * 0.35, 0, 1);
  state.stats.maxTemp = Math.max(state.stats.maxTemp, state.temp);
  if (state.temp > 95 && Math.random() < dt * 0.15) triggerBSOD('THERMAL_OVERHEAT');

  if (state.slowTimer > 0) state.slowTimer -= dt;

  state.eventTimer -= dt;
  if (state.eventTimer <= 0) triggerEvent();

  state.driverTimer -= dt;
  if (state.driverTimer <= 0) {
    const s = SLOTS[Math.floor(Math.random()*SLOTS.length)];
    if (state.drivers[s]) {
      state.drivers[s].latest++;
      if (state.drivers[s].status === 'ok') state.drivers[s].status = 'outdated';
    }
    state.driverTimer = rnd(70, 130);
  }

  state.osTimer -= dt;
  if (state.osTimer <= 0) {
    state.os.latest++; state.os.missed++;
    toast(`🪟 Обновление ОС ${state.os.latest}`, 'warn');
    state.osTimer = rnd(180, 260);
  }

  if (state.autoUpdate) for (const app of state.apps)
    if (app.ver < app.latest && Math.random() < dt * 0.25) startAppUpdate(app.id);

  if (hasTech('backup_auto')) {
    state.autoBackupTimer -= dt;
    if (state.autoBackupTimer <= 0) { createBackup(); state.autoBackupTimer = 300; }
  }

  state.seasonTimer -= dt;
  if (state.seasonTimer <= 0) {
    if (state.season.id === 'none' || state.season.daysLeft <= 0) {
      rollSeason(); state.season.daysLeft = 120;
    } else {
      state.season.daysLeft--;
      if (state.season.daysLeft <= 0) { state.season.id = 'none'; toast('📅 Сезон завершён', 'info'); }
    }
    state.seasonTimer = 120;
  }

  state.stockTimer -= dt;
  if (state.stockTimer <= 0) { updateStocks(1); state.stockTimer = 5; }

  state.competitorTimer -= dt;
  if (state.competitorTimer <= 0) { updateCompetitors(4); state.competitorTimer = 40; }

  const c = state.company;
  if (c) {
    if (c.rnd.active) {
      c.rnd.progress += dt;
      if (c.rnd.progress >= c.rnd.target) {
        c.rnd.active = false; c.rnd.progress = 0;
        const gen = c.products.length + 1;
        c.products.push({ name: `${c.dir} ${c.name.split(' ')[0]} Gen-${gen}`, gen });
        c.rep += 6;
        Sound.achv();
        toast(`🚀 Продукт выпущен`, 'good');
      }
    }
    let income = c.products.reduce((a, p) => a + 90 * p.gen, 0) * (1 + c.rep / 100);
    for (const bid of state.branches) {
      const country = COUNTRIES.find(x => x.id === bid);
      if (country) income *= (1 + country.mult * 0.15);
    }
    c.income = income;
    state.money += c.income * dt;
  }

  if (hasTech('mining')) {
    state.miningAccum += stat('gpu','power') * 0.4 * dt;
    if (state.miningAccum >= 1) {
      const g = Math.floor(state.miningAccum);
      state.money += g;
      state.miningAccum -= g;
    }
  }

  if (state.ownOS.progress > 0 && !state.ownOS.released) {
    const rate = 1 + (state.company ? state.company.employees * 0.5 : 0) + (hasTech('rd_fast') ? 1 : 0);
    state.ownOS.progress += dt * rate;
    if (state.ownOS.progress >= state.ownOS.target) {
      state.ownOS.released = true;
      state.ownOS.ver = 1;
      state.ownOS.name = 'TycoonOS';
      Sound.achv();
      toast('🎉 Ваша ОС выпущена: TycoonOS!', 'good');
    }
  }

  updateAI(dt);
  updateProvider(dt);

  state.weather.nextChange -= dt;
  if (state.weather.nextChange <= 0) rollWeather();

  if (state.clan) {
    state.chatTimer -= dt;
    if (state.chatTimer <= 0) { genChatMessage(); state.chatTimer = rnd(6, 18); }
  }

  state.newsTimer -= dt;
  if (state.newsTimer <= 0) { genNews(); state.newsTimer = rnd(25, 60); }

  widgetTickTimer -= dt;
  if (widgetTickTimer <= 0) { renderWidgets(); widgetTickTimer = 2; }

  if (Math.random() < dt * 0.5) { checkAchievements(); checkCampaign(); }
}

let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  let dt = (now - lastTick) / 1000;
  lastTick = now;
  dt = Math.min(dt, 2);
  update(dt);
  renderHud();
}, 100);
setInterval(saveGame, 5000);
setInterval(refreshWindows, 800);
/* ==================== 16. ОКНА ==================== */
const WINDOWS = {
  files:       { title: '📁 Файлы',              render: renderFiles },
  shop:        { title: '🛒 Магазин',            render: renderShop },
  updates:     { title: '🔄 Обновления',         render: renderUpdates },
  devices:     { title: '🔧 Диспетчер устройств', render: renderDrivers },
  browser:     { title: '🌐 Браузер',            render: renderBrowser },
  company:     { title: '🏢 Компания',           render: renderCompany },
  antivirus:   { title: '🛡️ Безопасность',       render: renderSecurity },
  backups:     { title: '💽 Бэкапы',             render: renderBackups },
  tech:        { title: '🌳 Технологии',         render: renderTech },
  achv:        { title: '🏆 Достижения',         render: renderAchievements },
  stock:       { title: '📈 Биржа',              render: renderStock },
  rivals:      { title: '⚔️ Конкуренты',         render: renderRivals },
  campaign:    { title: '📖 Кампания',           render: renderCampaign },
  settings:    { title: '⚙️ Настройки',          render: renderSettings },
  assistant:   { title: '🎙️ Ассистент',          render: renderAssistant },
  clan:        { title: '🏰 Кланы и чат',        render: renderClan },
  viewer3d:    { title: '🧊 3D-просмотр',        render: render3DViewer },
  certs:       { title: '🏅 Сертификаты',        render: renderCertificates },
  ai:          { title: '🤖 AI Lab',             render: renderAI },
  provider:    { title: '📡 Провайдер',          render: renderProvider }
};
const DESKTOP_ICONS = [
  { id:'browser',   icon:'🌐', name:'Браузер' },
  { id:'files',     icon:'📁', name:'Файлы' },
  { id:'shop',      icon:'🛒', name:'Магазин' },
  { id:'updates',   icon:'🔄', name:'Обновления' },
  { id:'devices',   icon:'🔧', name:'Драйвера' },
  { id:'antivirus', icon:'🛡️', name:'Антивирус' },
  { id:'backups',   icon:'💽', name:'Бэкапы' },
  { id:'tech',      icon:'🌳', name:'Технологии' },
  { id:'ai',        icon:'🤖', name:'AI Lab' },
  { id:'provider',  icon:'📡', name:'Провайдер' },
  { id:'stock',     icon:'📈', name:'Биржа' },
  { id:'rivals',    icon:'⚔️', name:'Конкуренты' },
  { id:'company',   icon:'🏢', name:'Компания' },
  { id:'clan',      icon:'🏰', name:'Кланы' },
  { id:'campaign',  icon:'📖', name:'Кампания' },
  { id:'achv',      icon:'🏆', name:'Достижения' },
  { id:'certs',     icon:'🏅', name:'Сертификаты' },
  { id:'viewer3d',  icon:'🧊', name:'3D-просмотр' },
  { id:'assistant', icon:'🎙️', name:'Ассистент' },
  { id:'settings',  icon:'⚙️', name:'Настройки' }
];
let winZ = 10;

function buildDesktopIcons() {
  $('#icons').innerHTML = DESKTOP_ICONS.map(i =>
    `<div class="desk-icon" data-act="openWin" data-arg="${i.id}">
       <span class="di">${i.icon}</span><span class="dn">${i.name}</span></div>`).join('');
}

function openWindow(id) {
  const ex = document.querySelector(`.window[data-win="${id}"]`);
  if (ex) { ex.style.zIndex = ++winZ; return; }
  const def = WINDOWS[id]; if (!def) return;
  const idx = document.querySelectorAll('.window').length;
  const el = document.createElement('div');
  el.className = 'window'; el.dataset.win = id;
  el.style.left = (110 + (idx % 6) * 34) + 'px';
  el.style.top  = (40 + (idx % 6) * 28) + 'px';
  el.style.zIndex = ++winZ;
  el.innerHTML = `
    <div class="win-head">
      <span class="win-title">${def.title}</span>
      <button class="win-close" data-act="closeWin" data-arg="${id}">✕</button>
    </div>
    <div class="win-body">${def.render()}</div>`;
  $('#windows').appendChild(el);
  makeDraggable(el);
  el.addEventListener('mousedown', () => { el.style.zIndex = ++winZ; });
  Sound.click();
  renderTaskItems();
}
function closeWindow(id) {
  const el = document.querySelector(`.window[data-win="${id}"]`);
  if (el) el.remove();
  renderTaskItems();
}
function makeDraggable(el) {
  const head = el.querySelector('.win-head');
  let sx=0, sy=0, ox=0, oy=0, drag=false;
  head.addEventListener('mousedown', e => {
    if (e.target.closest('.win-close')) return;
    drag = true; sx = e.clientX; sy = e.clientY;
    ox = parseInt(el.style.left, 10) || 0;
    oy = parseInt(el.style.top, 10) || 0;
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!drag) return;
    el.style.left = clamp(ox + e.clientX - sx, -200, window.innerWidth - 120) + 'px';
    el.style.top  = clamp(oy + e.clientY - sy, 0, window.innerHeight - 100) + 'px';
  });
  window.addEventListener('mouseup', () => { drag = false; });
}
function refreshWindows() {
  // 1) Не пересоздавать окна, если пользователь только что кликнул
  if (Date.now() - lastInteraction < 350) return;

  // 2) Не пересоздавать, если активен ввод или слайдер
  const active = document.activeElement;
  const isInteractive = active && (
    active.tagName === 'INPUT' ||
    active.tagName === 'TEXTAREA' ||
    active.tagName === 'SELECT'
  );

  $$('.window').forEach(w => {
    const id = w.dataset.win;
    const body = w.querySelector('.win-body');

    // Пропускаем окно, в котором пользователь печатает/двигает ползунок
    if (isInteractive && body.contains(active)) return;

    const st = body.scrollTop;
    body.innerHTML = WINDOWS[id].render();
    body.scrollTop = st;
  });
}
function renderTaskItems() {
  const ids = $$('.window').map(w => w.dataset.win);
  $('#task-items').innerHTML = ids.map(id =>
    `<div class="task-item" data-act="openWin" data-arg="${id}">${WINDOWS[id].title}</div>`).join('');
}

/* ==================== 17. РЕНДЕРЫ ==================== */
function renderFiles() {
  const total = totalStorageMB(), used = state.usedMB;
  const pct = clamp(used / total * 100, 0, 100);
  let h = '';

  h += `<h3 class="sec">Очередь (${state.downloads.length})</h3>`;
  if (!state.downloads.length) {
    h += `<div class="row"><span class="ico">💤</span><div class="main"><div class="name">Нет загрузок</div><div class="sub">Откройте «Браузер»</div></div></div>`;
  } else for (const d of state.downloads) {
    const p = clamp(d.done / d.size * 100, 0, 100);
    const statusTxt = d.paused ? '⏸ пауза' : d.dropTimer > 0 ? '🌐 переподключение' : `${fmtSize(d.done)} / ${fmtSize(d.size)} — ${p.toFixed(1)}%`;
    h += `
      <div class="row">
        <span class="ico">${d.icon}</span>
        <div class="main">
          <div class="name">${d.name} <span class="prio-badge prio-${d.prio||0}">P${d.prio||0}</span></div>
          <div class="bar ${d.paused?'warn':''}" style="margin-top:6px"><i style="width:${p}%"></i></div>
          <div class="sub">${statusTxt}</div>
        </div>
        <div class="right" style="display:flex;flex-direction:column;gap:4px">
          <div style="display:flex;gap:4px;justify-content:flex-end">
            <button class="btn sm" data-act="pauseDl" data-arg="${d.id}">${d.paused ? '▶' : '⏸'}</button>
            <button class="btn sm red" data-act="cancelDl" data-arg="${d.id}">✕</button>
          </div>
          <div style="display:flex;gap:2px;justify-content:flex-end">
            <button class="btn sm" style="padding:2px 6px;font-size:10px" data-act="prioDl" data-arg="${d.id}:0">0</button>
            <button class="btn sm blue" style="padding:2px 6px;font-size:10px" data-act="prioDl" data-arg="${d.id}:1">1</button>
            <button class="btn sm acc" style="padding:2px 6px;font-size:10px" data-act="prioDl" data-arg="${d.id}:2">2</button>
          </div>
        </div>
      </div>`;
  }

  h += `<h3 class="sec" style="margin-top:14px">Накопитель</h3>
    <div class="row">
      <span class="ico">💾</span>
      <div class="main">
        <div class="name">${slotItem('storage').name}</div>
        <div class="bar ${pct>90?'bad':pct>70?'warn':''}" style="margin-top:6px"><i style="width:${pct}%"></i></div>
        <div class="sub">${fmtSize(used)} / ${fmtSize(total)} · свободно ${fmtSize(freeMB())}</div>
      </div>
    </div>`;

  h += `<h3 class="sec" style="margin-top:14px">Приложения</h3>`;
  if (!state.apps.length) h += `<div class="empty">Нет приложений</div>`;
  else for (const a of state.apps) {
    const out = a.ver < a.latest;
    h += `<div class="row">
      <span class="ico">📦</span>
      <div class="main"><div class="name">${a.name}</div>
      <div class="sub">v${a.ver}${out?` → v${a.latest}`:' · OK'}</div></div>
      <div class="right">${out
        ? `<button class="btn sm blue" data-act="updApp" data-arg="${a.id}">Обновить</button>`
        : `<span class="tag ok">OK</span>`}</div>
    </div>`;
  }

  h += `<h3 class="sec" style="margin-top:14px">Статистика</h3>
    <div class="grid2">
      <div class="row"><span class="ico">⬇️</span><div class="main"><div class="name">${fmt(state.totalDownloads)}</div><div class="sub">файлов</div></div></div>
      <div class="row"><span class="ico">🪟</span><div class="main"><div class="name">${fmt(state.totalOS)}</div><div class="sub">обновлений ОС</div></div></div>
      <div class="row"><span class="ico">💙</span><div class="main"><div class="name">${state.stats.bsods}</div><div class="sub">BSOD</div></div></div>
      <div class="row"><span class="ico">🦠</span><div class="main"><div class="name">${state.stats.viruses}</div><div class="sub">вирусов</div></div></div>
    </div>`;
  return h;
}

let shopTab = 'components';
function renderShop() {
  const season = seasonActive();
  let h = `<div class="tabs">
    <div class="tab ${shopTab==='components'?'active':''}" data-act="shopTab" data-arg="components">Компоненты</div>
    <div class="tab ${shopTab==='apps'?'active':''}" data-act="shopTab" data-arg="apps">Приложения</div>
    <div class="tab ${shopTab==='devices'?'active':''}" data-act="shopTab" data-arg="devices">Устройства</div>
  </div>`;
  if (season.multi.shopDiscount) h += `<div class="season-banner"><span>${season.ico} <b>${season.name}</b> — ${season.desc}</span></div>`;

  if (shopTab === 'components') {
    for (const slot of SLOTS) {
      const cur = slotItem(slot);
      h += `<h3 class="sec">${SLOT_INFO[slot].icon} ${SLOT_INFO[slot].label}</h3>`;
      for (const it of CATALOG[slot]) {
        const owned = state.slots[slot] === it.id;
        const worse = it.tier <= cur.tier;
        const price = priceWithDiscount(it.price);
        const afford = state.money >= price;
        h += `<div class="row">
          <span class="ico">${SLOT_INFO[slot].icon}</span>
          <div class="main">
            <div class="name">${it.name} <span class="tag dim">${TIER_NAMES[it.tier]}</span></div>
            <div class="sub">${Object.entries(it.stats).map(([k,v])=>`${k}:${v}`).join(' · ')}</div>
          </div>
          <div class="right">${owned
            ? `<span class="tag ok">УСТАНОВЛЕНО</span>`
            : `<button class="btn sm ${worse?'':'acc'}" ${worse||!afford?'disabled':''}
                 data-act="buyComp" data-arg="${it.id}">${fmt(price)} ₮</button>`}</div>
        </div>`;
      }
    }
  } else if (shopTab === 'apps') {
    for (const p of APP_POOL) {
      const owned = state.apps.some(a => a.id === p.id);
      const price = priceWithDiscount(Math.round(p.size * 3.5));
      h += `<div class="row">
        <span class="ico">📦</span>
        <div class="main"><div class="name">${p.name}</div><div class="sub">${p.desc} · ${fmtSize(p.size)}</div></div>
        <div class="right">${owned
          ? `<span class="tag ok">УСТАНОВЛЕНО</span>`
          : `<button class="btn sm acc" ${state.money<price?'disabled':''}
               data-act="buyApp" data-arg="${p.id}">${fmt(price)} ₮</button>`}</div>
      </div>`;
    }
  } else if (shopTab === 'devices') {
    for (const dev of DEVICES) {
      const owned = state.deviceId === dev.id;
      const price = priceWithDiscount(dev.price);
      h += `<div class="row">
        <span class="ico">${dev.kind==='mobile'?'📱':dev.kind==='tablet'?'📟':dev.kind==='server'?'🖥️':'💻'}</span>
        <div class="main"><div class="name">${dev.name}</div>
        <div class="sub">${dev.os} ${dev.osVer} · ${SLOTS.map(s=>SLOT_INFO[s].icon).join('')}</div></div>
        <div class="right">${owned
          ? `<span class="tag ok">ТЕКУЩЕЕ</span>`
          : `<button class="btn sm acc" ${state.money<price?'disabled':''}
               data-act="buyDev" data-arg="${dev.id}">${fmt(price)} ₮</button>`}</div>
      </div>`;
    }
  }
  return h;
}

function renderUpdates() {
  const osOut = state.os.ver < state.os.latest;
  let h = `<h3 class="sec">Операционная система</h3>
    <div class="row">
      <span class="ico">🪟</span>
      <div class="main"><div class="name">${state.os.name} ${state.os.ver}</div>
      <div class="sub">${osOut?`Доступна ${state.os.latest} · пропущено: ${state.os.missed}`:'Актуальна'}</div></div>
      <div class="right">${osOut
        ? `<button class="btn sm acc" data-act="updOS">Обновить</button>`
        : `<span class="tag ok">OK</span>`}</div>
    </div>`;

  if (osOut && state.os.latest - state.os.ver >= 3) {
    h += `<div class="row" style="border-color:rgba(255,92,92,.4)">
      <span class="ico">⚠️</span><div class="main">
      <div class="name" style="color:var(--bad)">Поддержка прекращена</div>
      <div class="sub">Скорость сети -25%</div></div></div>`;
  }

  h += `<h3 class="sec" style="margin-top:12px">Автообновление</h3>
    <div class="row">
      <span class="ico">⚙️</span>
      <div class="main"><div class="name">Автообновление приложений</div></div>
      <div class="right"><button class="btn sm ${state.autoUpdate?'acc':''}" data-act="toggleAuto">
        ${state.autoUpdate?'ВКЛ':'ВЫКЛ'}</button></div>
    </div>`;

  const outdated = state.apps.filter(a => a.ver < a.latest);
  h += `<h3 class="sec" style="margin-top:12px">Приложения</h3>`;
  if (!outdated.length) h += `<div class="empty">Все актуальны ✅</div>`;
  else for (const a of outdated) {
    h += `<div class="row">
      <span class="ico">📦</span>
      <div class="main"><div class="name">${a.name}</div>
      <div class="sub">v${a.ver} → v${a.latest} · ${fmtSize(Math.round(a.size*.35))}</div></div>
      <div class="right"><button class="btn sm blue" data-act="updApp" data-arg="${a.id}">Обновить</button></div>
    </div>`;
  }
  return h;
}

function renderDrivers() {
  const dm = driverMult();
  let h = `<div class="row">
    <span class="ico">📈</span>
    <div class="main">
      <div class="name">Эффективность драйверов: ${(dm*100).toFixed(0)}%</div>
      <div class="bar" style="margin-top:6px"><i style="width:${clamp(dm/1.2*100,0,100)}%"></i></div>
    </div>
  </div>`;

  if (hasTech('oc_unlock')) {
    h += `<h3 class="sec" style="margin-top:12px">🔥 Разгон</h3>
      <div class="sub" style="color:var(--dim);font-size:11px;margin-bottom:8px">
        Охлаждение: ${coolingCapacity()} · нагрев: +${heatFromOC()}°</div>`;
    for (const slot of ['cpu','gpu','ram']) {
      h += `<div class="slotcard">
        <div class="sc-head"><span>${SLOT_INFO[slot].icon}</span><span class="sc-name">Разгон ${SLOT_INFO[slot].label}</span>
        <span class="oc-val">+${state.overclock[slot]*5}%</span></div>
        <input type="range" min="0" max="5" value="${state.overclock[slot]}" class="oc-slider"
          data-act="setOC" data-arg="${slot}" />
      </div>`;
    }
  }

  h += `<h3 class="sec" style="margin-top:12px">Драйвера</h3>
    <table class="tbl">
    <tr><th>Компонент</th><th>Вер.</th><th>Статус</th><th></th></tr>`;
  for (const slot of SLOTS) {
    const d = state.drivers[slot] || { ver:0, latest:1, status:'none' };
    const map = { ok:['актуален','ok'], outdated:['устарел','warn'], none:['нет','bad'], broken:['повреждён','bad'] };
    const [txt, cls] = map[d.status] || map.none;
    let act = '';
    if (d.status === 'ok') act = `<button class="btn sm" data-act="drvRollback" data-arg="${slot}">Откат</button>
      <button class="btn sm red" data-act="drvDelete" data-arg="${slot}">Удал.</button>`;
    else if (d.status === 'outdated') act = `<button class="btn sm acc" data-act="drvUpdate" data-arg="${slot}">Обновить</button>`;
    else act = `<button class="btn sm acc" data-act="drvInstall" data-arg="${slot}">Установить</button>`;
    h += `<tr>
      <td>${SLOT_INFO[slot].icon} ${SLOT_INFO[slot].label}</td>
      <td>${d.ver?'v'+d.ver:'—'} / v${d.latest}</td>
      <td><span class="tag ${cls}">${txt}</span></td>
      <td style="text-align:right">${act}</td>
    </tr>`;
  }
  h += `</table>`;

  h += `<h3 class="sec" style="margin-top:14px">Конфигурация</h3>
    <div class="sub" style="color:var(--dim);margin-bottom:8px">${state.deviceName}</div>`;
  for (const slot of SLOTS) {
    const item = slotItem(slot);
    h += `<div class="slotcard">
      <div class="sc-head"><span>${SLOT_INFO[slot].icon}</span>
      <span class="sc-name">${item.name}</span>
      <span class="tag dim">${TIER_NAMES[item.tier]}</span></div>
      <div class="sub" style="font-size:11px;color:var(--dim)">
        ${Object.entries(item.stats).map(([k,v])=>`${k.toUpperCase()}:${v}`).join(' · ')}</div>
    </div>`;
  }
  return h;
}

function renderBrowser() {
  const speed = currentSpeed();
  let h = `<div class="row">
    <span class="ico">⚡</span>
    <div class="main">
      <div class="name">Скорость: ${speed.toFixed(2)} МБ/с</div>
      <div class="sub">Wi-Fi ${stat('wifi','net')} Мбит/с · драйвера ${(driverMult()*100).toFixed(0)}% · слотов ${maxConcurrent()}</div>
    </div>
    <div class="right"><button class="btn sm" data-act="refreshOrders">🔄</button></div>
  </div>
  <h3 class="sec" style="margin-top:12px">Заказы</h3>`;

  if (!state.orders.length) h += `<div class="empty">Заказов нет</div>`;
  else for (const o of state.orders) {
    const eta = o.size / Math.max(speed, .1);
    h += `<div class="row">
      <span class="ico">${o.icon}</span>
      <div class="main"><div class="name">${o.name}</div>
      <div class="sub">${fmtSize(o.size)} · ~${Math.round(eta)} сек · +${o.xp} XP</div></div>
      <div class="right">
        <div style="color:var(--acc);font-weight:700;font-size:12.5px;margin-bottom:4px">+${fmt(o.money)} ₮</div>
        <button class="btn sm acc" data-act="takeOrder" data-arg="${o.id}">Скачать</button>
      </div>
    </div>`;
  }
  return h;
}

function renderCompany() {
  if (!state.company) {
    if (state.money < 500000) {
      const pct = clamp(state.money / 500000 * 100, 0, 100);
      return `<div class="empty">
        🔒 Нужно 500 000 ₮<br><br>
        <div class="bar" style="max-width:320px;margin:0 auto"><i style="width:${pct}%"></i></div>
        <div style="margin-top:8px">${fmt(state.money)} / 500 000 ₮</div>
      </div>`;
    }
    return `<div class="empty">
      🏢 Готовы основать корпорацию?<br><br>
      <button class="btn acc" data-act="openCompanyModal">Зарегистрировать компанию</button>
    </div>`;
  }
  const c = state.company;
  const rndBar = c.rnd.active
    ? `<div class="bar" style="margin-top:6px"><i style="width:${clamp(c.rnd.progress/c.rnd.target*100,0,100)}%"></i></div>
       <div class="sub">${c.rnd.progress.toFixed(1)} / ${c.rnd.target} сек</div>` : '';

  let h = `<div class="row">
    <span class="ico">🏢</span>
    <div class="main"><div class="name">${c.name}</div>
    <div class="sub">${c.dir} · реп: ${c.rep} · сотр: ${c.employees} · доля: ${myMarketShare().toFixed(1)}%</div></div>
    <div class="right"><span class="tag ok">+${fmt(c.income)} ₮/с</span></div>
  </div>`;

  h += `<h3 class="sec" style="margin-top:12px">R&D</h3>
    <div class="row">
      <span class="ico">🔬</span>
      <div class="main"><div class="name">${c.rnd.active?'Разработка...':'Лаборатория свободна'}</div>${rndBar}</div>
      <div class="right"><button class="btn sm acc" ${c.rnd.active?'disabled':''} data-act="startRnd">Начать R&D</button></div>
    </div>`;

  h += `<h3 class="sec" style="margin-top:12px">Продукты (${c.products.length})</h3>`;
  if (!c.products.length) h += `<div class="empty" style="padding:14px">Пока нет</div>`;
  else for (const p of c.products) {
    h += `<div class="row">
      <span class="ico">🧩</span>
      <div class="main"><div class="name">${p.name}</div>
      <div class="sub">Gen ${p.gen} · +${fmt(90*p.gen)} ₮/с</div></div>
      <div class="right"><span class="tag ok">В ПРОДАЖЕ</span></div>
    </div>`;
  }

  h += `<h3 class="sec" style="margin-top:12px">Своя ОС</h3>`;
  if (state.ownOS.released) {
    h += `<div class="row"><span class="ico">💿</span>
      <div class="main"><div class="name">${state.ownOS.name} v${state.ownOS.ver}</div>
      <div class="sub">Продаётся по миру</div></div>
      <div class="right"><span class="tag ok">ВЫПУЩЕНА</span></div></div>`;
  } else if (state.ownOS.progress > 0) {
    const pct = clamp(state.ownOS.progress / state.ownOS.target * 100, 0, 100);
    h += `<div class="row"><span class="ico">💿</span>
      <div class="main"><div class="name">Разработка TycoonOS...</div>
      <div class="bar" style="margin-top:6px"><i style="width:${pct}%"></i></div>
      <div class="sub">${pct.toFixed(1)}%</div></div></div>`;
  } else {
    h += `<div class="row"><span class="ico">💿</span>
      <div class="main"><div class="name">Своя ОС</div>
      <div class="sub">${hasTech('os_dev')?'Технология разблокирована':'Нужна технология «Разработка ОС»'}</div></div>
      <div class="right"><button class="btn sm acc" ${!hasTech('os_dev')?'disabled':''} data-act="startOwnOS">Разработать</button></div>
    </div>`;
  }

  h += `<h3 class="sec" style="margin-top:12px">Филиалы (${state.branches.length}/${COUNTRIES.length})</h3>`;
  for (const country of COUNTRIES) {
    const has = state.branches.includes(country.id);
    h += `<div class="row">
      <span class="ico">${country.flag}</span>
      <div class="main"><div class="name">${country.name}</div>
      <div class="sub">налог ${(country.taxRate*100).toFixed(0)}% · ×${country.mult}</div></div>
      <div class="right">${has
        ? `<span class="tag ok">ОТКРЫТ</span>`
        : `<button class="btn sm acc" ${state.money<country.cost?'disabled':''}
             data-act="openBranch" data-arg="${country.id}">${fmt(country.cost)} ₮</button>`}</div>
    </div>`;
  }

  const empCost = 25000 * (c.employees + 1);
  h += `<h3 class="sec" style="margin-top:12px">Управление</h3>
    <div class="row"><span class="ico">👥</span>
      <div class="main"><div class="name">Найм сотрудника</div><div class="sub">-6 сек к R&D</div></div>
      <div class="right"><button class="btn sm ${state.money>=empCost?'acc':''}" ${state.money<empCost?'disabled':''}
        data-act="hire">${fmt(empCost)} ₮</button></div></div>
    <div class="row"><span class="ico">📣</span>
      <div class="main"><div class="name">Продвижение</div><div class="sub">+10 репутации</div></div>
      <div class="right"><button class="btn sm ${state.money>=60000?'acc':''}" ${state.money<60000?'disabled':''}
        data-act="promo">60 000 ₮</button></div></div>`;
  return h;
}

function renderSecurity() {
  const v = state.virus;
  if (!state.hasAntivirus) {
    return `<div class="empty">🛡️ Антивирус не установлен<br><br>Купите ShieldAV в магазине приложений.</div>`;
  }
  const dbPct = clamp(v.dbVer / v.dbLatest * 100, 0, 100);
  let h = `<div class="row">
    <span class="ico">🛡️</span>
    <div class="main">
      <div class="name">ShieldAV · v${v.dbVer} / v${v.dbLatest}</div>
      <div class="bar ${dbPct>60?'':'warn'}" style="margin-top:6px"><i style="width:${dbPct}%"></i></div>
      <div class="sub">${v.dbVer < v.dbLatest ? 'Базы устарели' : 'Актуально'}</div>
    </div>
    <div class="right">${v.dbVer < v.dbLatest
      ? `<button class="btn sm blue" data-act="updateVdb">Обновить (${fmt((v.dbLatest-v.dbVer)*200)} ₮)</button>`
      : `<span class="tag ok">OK</span>`}</div>
  </div>`;

  h += `<h3 class="sec" style="margin-top:14px">Сканирование</h3>
    <div class="row">
      <span class="ico">🔍</span>
      <div class="main">
        <div class="name">Статус: ${v.activeScans>0?'сканирование...':v.infected?'⚠️ заражено':'чисто'}</div>
        <div class="sub">Угроз в карантине: ${v.threats}</div>
      </div>
      <div class="right">
        <button class="btn sm acc" ${v.activeScans>0?'disabled':''} data-act="scan">Сканировать</button>
        ${v.threats>0?`<button class="btn sm red" data-act="payRemoval">Удалить за ${fmt(1500+v.threats*500)} ₮</button>`:''}
      </div>
    </div>`;
  return h;
}

function renderBackups() {
  let h = '';
  if (hasTech('backup_auto')) {
    h += `<div class="row"><span class="ico">♻️</span>
      <div class="main"><div class="name">Автобэкап активен</div><div class="sub">Каждые 5 минут</div></div>
      <div class="right"><span class="tag ok">ВКЛ</span></div></div>`;
  }
  h += `<h3 class="sec" style="margin-top:12px">Ручные бэкапы (${state.backups.length}/6)</h3>
    <div class="row">
      <span class="ico">💽</span>
      <div class="main"><div class="name">Создать бэкап</div>
      <div class="sub">Приложения, драйвера, ОС, конфигурация</div></div>
      <div class="right"><button class="btn sm acc" data-act="makeBackup">Создать</button></div>
    </div>`;
  if (!state.backups.length) h += `<div class="empty">Бэкапов нет</div>`;
  else for (let i = 0; i < state.backups.length; i++) {
    const b = state.backups[i];
    const time = new Date(b.time).toLocaleString('ru-RU');
    h += `<div class="row">
      <span class="ico">💾</span>
      <div class="main"><div class="name">${time}</div>
      <div class="sub">${b.os.name} ${b.os.ver} · ${b.apps.length} прил. · ${fmtSize(b.usedMB)}</div></div>
      <div class="right">
        <button class="btn sm blue" data-act="restoreB" data-arg="${i}">Восстановить</button>
        <button class="btn sm red" data-act="delB" data-arg="${i}">✕</button>
      </div>
    </div>`;
  }
  return h;
}

function renderTech() {
  let h = `<div class="row">
    <span class="ico">🌳</span>
    <div class="main"><div class="name">Очки технологий: ${state.techPoints}</div>
    <div class="sub">Даются за уровни и главы кампании</div></div>
  </div>
  <div class="tech-grid" style="margin-top:14px">`;
  for (const t of TECHS) {
    const done = hasTech(t.id);
    const locked = !t.req.every(r => hasTech(r));
    const cls = done ? 'done' : locked ? 'locked' : '';
    h += `<div class="tech-node ${cls}" ${!done&&!locked?`data-act="research" data-arg="${t.id}"`:''}>
      <div class="tn-ico">${t.ico}</div>
      <div class="tn-name">${t.name}</div>
      <div class="tn-desc">${t.desc}</div>
      <div class="tn-cost">${done?'✅ ИЗУЧЕНО':`Стоимость: ${t.cost} ОТ`}</div>
    </div>`;
  }
  h += `</div>`;
  return h;
}

function renderAchievements() {
  let h = `<h3 class="sec">Получено ${state.achievements.length} из ${ACHIEVEMENTS.length}</h3>
    <div class="ach-grid">`;
  for (const a of ACHIEVEMENTS) {
    const got = state.achievements.includes(a.id);
    h += `<div class="ach-card ${got?'got':''}">
      <div class="ac-top"><span class="ac-ico">${got?a.ico:'🔒'}</span>
      <span class="ac-name">${a.name}</span></div>
      <div class="ac-desc">${a.desc}</div>
      <div class="ac-desc" style="color:var(--acc)">+${fmt(a.reward)} ₮</div>
    </div>`;
  }
  h += `</div>`;
  return h;
}

function makeSparkline(arr) {
  if (!arr || arr.length < 2) return '';
  const min = Math.min(...arr), max = Math.max(...arr);
  const range = max - min || 1;
  const w = 60, hh = 18;
  const step = w / (arr.length - 1);
  const pts = arr.map((v,i) => `${i*step},${hh-((v-min)/range)*hh}`).join(' ');
  const up = arr[arr.length-1] >= arr[0];
  return `<svg class="spark" viewBox="0 0 ${w} ${hh}"><polyline fill="none" stroke="${up?'#35e0a1':'#ff5c5c'}" stroke-width="1.5" points="${pts}"/></svg>`;
}

function renderStock() {
  const api = hasTech('stock_api');
  let h = `<div class="sub" style="color:var(--dim);margin-bottom:8px">
    ${api?'✅ Биржевой API активен':'⚠️ Без API доступны только дешёвые акции'}</div>
    <table class="tbl"><tr><th>Тикер</th><th>Цена</th><th>График</th><th>У вас</th><th></th></tr>`;
  for (const s of state.stocks) {
    const prev = s.history[s.history.length-2] || s.price;
    const diff = s.price - prev;
    const cls = diff >= 0 ? 'stock-up' : 'stock-down';
    const arrow = diff >= 0 ? '▲' : '▼';
    h += `<tr>
      <td>${s.id} <span style="color:var(--dim);font-size:11px">${s.name}</span></td>
      <td class="${cls}">${s.price.toFixed(1)} ₮ <small>${arrow} ${Math.abs(diff).toFixed(1)}</small></td>
      <td>${makeSparkline(s.history)}</td>
      <td>${s.owned}${s.owned>0?`<br><small style="color:var(--dim)">ср. ${s.avgPrice.toFixed(1)}</small>`:''}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn sm acc" data-act="buyStock" data-arg="${s.id}:1">+1</button>
        <button class="btn sm acc" data-act="buyStock" data-arg="${s.id}:10">+10</button>
        ${s.owned>0?`<button class="btn sm red" data-act="sellStock" data-arg="${s.id}:${s.owned}">Продать</button>`:''}
      </td>
    </tr>`;
  }
  h += `</table>
    <h3 class="sec" style="margin-top:14px">Прибыль на бирже</h3>
    <div class="row"><span class="ico">📊</span>
      <div class="main"><div class="name">${fmt(state.stats.stockProfit)} ₮</div>
      <div class="sub">Всего заработано</div></div></div>`;
  return h;
}

function renderRivals() {
  const my = myMarketShare();
  let h = `<h3 class="sec">Доля рынка</h3>
    <div class="row">
      <span class="ico">🏢</span>
      <div class="main"><div class="name">Ваша компания (${state.company?state.company.name:'—'})</div>
      <div class="bar acc" style="margin-top:6px"><i style="width:${my}%"></i></div>
      <div class="sub">${my.toFixed(1)}%</div></div>
    </div>`;
  for (const c of state.competitors) {
    h += `<div class="row">
      <span class="ico">⚔️</span>
      <div class="main"><div class="name">${c.name}</div>
      <div class="bar" style="margin-top:6px"><i style="width:${c.share}%"></i></div>
      <div class="sub">${c.share.toFixed(1)}% · сила ${c.power.toFixed(1)}</div></div>
    </div>`;
  }
  return h;
}

function renderCampaign() {
  const ch = CAMPAIGN.find(c => c.id === state.campaign.chapter);
  if (!ch) return `<div class="empty">🎉 Все главы пройдены!<br><br>Вы построили мировую IT-корпорацию.</div>`;
  let h = `<div class="story-card">
    <h4>Глава ${ch.id}: ${ch.title}</h4>
    <p>${ch.text}</p>
    ${ch.tasks.map(t => {
      const done = (() => { try { return t.check(state); } catch (e) { return false; } })();
      return `<div class="story-task ${done?'done':''}">${done?'✅':'⏳'} ${t.text}</div>`;
    }).join('')}
  </div>
  <h3 class="sec" style="margin-top:14px">Прогресс</h3>
  <div class="bar"><i style="width:${(state.campaign.chapter-1)/CAMPAIGN.length*100}%"></i></div>`;
  return h;
}

function renderSettings() {
  const themes = [
    { id:'dark',  name:'🌑 Тёмная' },
    { id:'light', name:'☀️ Светлая' },
    { id:'neon',  name:'💜 Неон' },
    { id:'cyber', name:'⚡ Киберпанк' }
  ];
  const wallpapers = [
    { id:'space',    name:'🌌 Космос' },
    { id:'aurora',   name:'🌠 Сияние' },
    { id:'city',     name:'🏙️ Город' },
    { id:'mountains',name:'⛰️ Горы' },
    { id:'matrix',   name:'💊 Матрица' },
    { id:'solid',    name:'⬛ Сплошной' }
  ];
  const weathers = [
    { id:'clear',  name:'☀️ Ясно' },
    { id:'rain',   name:'🌧️ Дождь' },
    { id:'snow',   name:'❄️ Снег' },
    { id:'fog',    name:'🌫️ Туман' },
    { id:'stars',  name:'⭐ Звёзды' }
  ];

  let h = `<h3 class="sec">🎨 Тема</h3>
    <div class="tabs">${themes.map(t =>
      `<div class="tab ${state.theme===t.id?'active':''}" data-act="setTheme" data-arg="${t.id}">${t.name}</div>`
    ).join('')}</div>

    <h3 class="sec" style="margin-top:14px">🖼️ Обои</h3>
    <div class="tabs" style="flex-wrap:wrap">${wallpapers.map(w =>
      `<div class="tab ${state.wallpaper===w.id?'active':''}" data-act="setWallpaper" data-arg="${w.id}">${w.name}</div>`
    ).join('')}</div>

    <h3 class="sec" style="margin-top:14px">🌤️ Погода</h3>
    <div class="tabs" style="flex-wrap:wrap">${weathers.map(w =>
      `<div class="tab ${state.weather.type===w.id?'active':''}" data-act="setWeather" data-arg="${w.id}">${w.name}</div>`
    ).join('')}</div>

    <h3 class="sec" style="margin-top:14px">📊 Виджеты</h3>`;

  const widgetsInfo = [
    { id:'clock',    name:'Часы' },
    { id:'weather',  name:'Погода' },
    { id:'currency', name:'Курс валют' },
    { id:'news',     name:'Новости' },
    { id:'stocks',   name:'Тикер акций' }
  ];
  for (const w of widgetsInfo) {
    h += `<div class="row">
      <span class="ico">${state.widgets[w.id]?'👁️':'🚫'}</span>
      <div class="main"><div class="name">${w.name}</div></div>
      <div class="right"><button class="btn sm ${state.widgets[w.id]?'acc':''}"
        data-act="toggleWidget" data-arg="${w.id}">${state.widgets[w.id]?'ВКЛ':'ВЫКЛ'}</button></div>
    </div>`;
  }

  h += `<h3 class="sec" style="margin-top:14px">🔊 Звук</h3>
    <div class="row"><span class="ico">🔊</span>
      <div class="main"><div class="name">Звуковые эффекты</div></div>
      <div class="right"><button class="btn sm ${Sound.isMuted()?'':'acc'}" data-act="toggleSound">
        ${Sound.isMuted()?'ВЫКЛ':'ВКЛ'}</button></div>
    </div>

    <h3 class="sec" style="margin-top:14px">🎙️ Голосовой ассистент</h3>
    <div class="row"><span class="ico">🎙️</span>
      <div class="main"><div class="name">Ассистент</div>
      <div class="sub">${SpeechAvailable()?'Команды: «открой браузер», «AI Lab», «статус»':'Web Speech API недоступен'}</div></div>
      <div class="right"><button class="btn sm ${state.assistant.enabled?'acc':''}"
        ${!SpeechAvailable()?'disabled':''} data-act="toggleAssistant">
        ${state.assistant.enabled?'ВКЛ':'ВЫКЛ'}</button></div>
    </div>

    <h3 class="sec" style="margin-top:14px">🌍 Язык</h3>
    <div class="tabs">
      <div class="tab ${state.locale==='ru'?'active':''}" data-act="setLocale" data-arg="ru">🇷🇺 Русский</div>
      <div class="tab ${state.locale==='en'?'active':''}" data-act="setLocale" data-arg="en">🇬🇧 English</div>
    </div>

    <h3 class="sec" style="margin-top:14px">☁️ Сохранения</h3>
    <div class="row"><span class="ico">☁️</span>
      <div class="main"><div class="name">Экспорт сохранения</div></div>
      <div class="right"><button class="btn sm acc" data-act="exportSave">Экспорт</button></div>
    </div>
    <div class="row"><span class="ico">📥</span>
      <div class="main"><div class="name">Импорт сохранения</div></div>
      <div class="right">
        <input type="file" id="importFile" class="file-input-hidden" accept=".json" />
        <button class="btn sm blue" data-act="pickImport">Импорт</button>
      </div>
    </div>

    <h3 class="sec" style="margin-top:14px">🧩 Моды</h3>
    <div class="row"><span class="ico">🧩</span>
      <div class="main"><div class="name">Загрузить мод</div>
      <div class="sub">${hasTech('mods')?'Поддержка разблокирована':'Требуется технология'}</div></div>
      <div class="right">
        <input type="file" id="modFile" class="file-input-hidden" accept=".json" />
        <button class="btn sm ${hasTech('mods')?'acc':''}" ${!hasTech('mods')?'disabled':''} data-act="pickMod">Загрузить</button>
      </div>
    </div>

    <h3 class="sec" style="margin-top:14px">🗑️ Опасная зона</h3>
    <div class="row"><span class="ico">🗑️</span>
      <div class="main"><div class="name">Сброс прогресса</div></div>
      <div class="right"><button class="btn sm red" data-act="resetGame">Сбросить</button></div>
    </div>

    <h3 class="sec" style="margin-top:14px">ℹ️ О игре</h3>
    <div class="sub" style="color:var(--dim);font-size:12px;line-height:1.6">
      Download Tycoon v${GAME_VERSION}<br>
      Уровень: ${state.level} · Играете: ${Math.floor(state.playTime/60)} мин
    </div>`;
  return h;
}

/* ==================== 18. HUD ==================== */
function renderHud() {
  $('#hud-net').querySelector('.hud-val').textContent = currentSpeed().toFixed(1) + ' МБ/с';
  $('#hud-cpu').querySelector('.hud-val').textContent = Math.round(cpuUsage()) + '%';
  $('#hud-ram').querySelector('.hud-val').textContent = Math.round(ramUsage()) + '%';
  const t = Math.round(state.temp);
  const tEl = $('#hud-temp');
  tEl.querySelector('.hud-val').textContent = t + '°C';
  tEl.className = 'hud-item' + (t >= 85 ? ' hot' : t >= 70 ? ' warm' : '');
  $('#hud-money').querySelector('.hud-val').textContent = fmt(state.money) + ' ₮';
  $('#hud-level').querySelector('.hud-val').textContent = state.level;
  $('#xpfill').style.width = clamp(state.xp / xpNeeded() * 100, 0, 100) + '%';
  const now = new Date();
  $('#hud-clock').querySelector('.hud-val').textContent =
    String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
}

/* ==================== 19. ТОСТЫ / МОДАЛКИ ==================== */
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'info' ? '' : type);
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3200);
}

function openModal(title, html) {
  const root = $('#modal-root');
  root.style.display = 'block';
  root.innerHTML = `
    <div class="modal-bg">
      <div class="modal">
        <div class="modal-head">${title}<button data-act="closeModal">✕</button></div>
        <div class="modal-body">${html}</div>
      </div>
    </div>`;
}
function closeModal() {
  const root = $('#modal-root');
  root.innerHTML = '';
  root.style.display = 'none';
}

function openCompanyModal() {
  const dirs = ['CPU','GPU','ОЗУ','ПЗУ','Wi-Fi','Экраны','Батареи'];
  openModal('🏢 Регистрация компании', `
    <label class="lbl">НАЗВАНИЕ</label>
    <input class="fld" id="cmp-name" placeholder="QuantumSoft" maxlength="24" />
    <label class="lbl">НАПРАВЛЕНИЕ</label>
    <select class="fld" id="cmp-dir">
      ${dirs.map(d => `<option value="${d}">${d}</option>`).join('')}
    </select>
    <button class="btn acc" style="width:100%;padding:10px" data-act="createCompany">Основать компанию</button>
  `);
}

/* ==================== 20. ДЕЙСТВИЯ ==================== */
const ACTIONS = {
  openWin: id => openWindow(id),
  closeWin: id => closeWindow(id),
  shopTab: t => { shopTab = t; refreshWindows(); },
  takeOrder: id => { const o = state.orders.find(x => x.id === id); if (o) startDownload(o); refreshWindows(); },
  refreshOrders: () => { state.orders = []; refillOrders(); toast('🔄 Обновлено', 'info'); refreshWindows(); },
  buyComp: id => { buyComponent(id); refreshWindows(); },
  buyDev:  id => { buyDevice(id); refreshWindows(); },
  buyApp:  id => { buyApp(id); refreshWindows(); },
  updApp:  id => { startAppUpdate(id); refreshWindows(); },
  updOS:   () => { startOsUpdate(); refreshWindows(); },
  toggleAuto: () => { state.autoUpdate = !state.autoUpdate; toast(state.autoUpdate?'⚙️ ВКЛ':'⚙️ ВЫКЛ', 'info'); refreshWindows(); },
  drvInstall:  s => { driverAction(s, 'install');  refreshWindows(); },
  drvUpdate:   s => { driverAction(s, 'update');   refreshWindows(); },
  drvRollback: s => { driverAction(s, 'rollback'); refreshWindows(); },
  drvDelete:   s => { driverAction(s, 'delete');   refreshWindows(); },
  pauseDl: id => { pauseDownload(id); refreshWindows(); },
  cancelDl: id => { cancelDownload(id); refreshWindows(); },
  prioDl: arg => { const [id, p] = arg.split(':'); setPriority(id, +p); refreshWindows(); },
  scan: () => { scanForViruses(); refreshWindows(); },
  updateVdb: () => { updateVirusDb(); refreshWindows(); },
  payRemoval: () => { payForRemoval(); refreshWindows(); },
  makeBackup: () => { createBackup(); refreshWindows(); },
  restoreB: i => { restoreBackup(+i); refreshWindows(); },
  delB: i => { state.backups.splice(+i, 1); refreshWindows(); },
  research: id => { researchTech(id); refreshWindows(); },
  buyStock: arg => { const [id, q] = arg.split(':'); buyStock(id, +q); refreshWindows(); },
  sellStock: arg => { const [id, q] = arg.split(':'); sellStock(id, +q); refreshWindows(); },
  openBranch: id => { openBranch(id); refreshWindows(); },
  startOwnOS: () => { startOwnOS(); refreshWindows(); },
  openCompanyModal,
  closeModal,
  createCompany: () => {
    const name = ($('#cmp-name')?.value || '').trim() || 'Безымянная Corp';
    const dir = $('#cmp-dir')?.value || 'CPU';
    registerCompany(name, dir);
    refreshWindows();
  },
  startRnd: () => { startRnD(); refreshWindows(); },
  hire: () => {
    const c = state.company; if (!c) return;
    const cost = 25000 * (c.employees + 1);
    if (state.money < cost) return;
    state.money -= cost;
    c.employees++;
    toast(`👥 Сотрудник (${c.employees})`, 'good');
    refreshWindows();
  },
  promo: () => {
    const c = state.company; if (!c || state.money < 60000) return;
    state.money -= 60000;
    c.rep += 10;
    toast('📣 +10 репутации', 'good');
    refreshWindows();
  },
  toggleSound: () => { Sound.toggleMute(!Sound.isMuted()); refreshWindows(); },
  exportSave: () => exportSave(),
  pickImport: () => { $('#importFile')?.click(); },
  pickMod: () => { $('#modFile')?.click(); },
  resetGame: () => {
    if (!confirm('Удалить сохранение и начать заново?')) return;
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }
};

// Запоминаем время последнего взаимодействия
let lastInteraction = 0;

document.addEventListener('pointerdown', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  lastInteraction = Date.now();
  const act = btn.dataset.act;
  const arg = btn.dataset.arg;
  if (ACTIONS[act]) {
    e.preventDefault();
    ACTIONS[act](arg, btn);
  }
}, { passive: false });

document.addEventListener('input', e => {
  const oc = e.target.closest('[data-act="setOC"]');
  if (oc) {
    const slot = oc.dataset.arg;
    if (slot) setOverclock(slot, +oc.value);
    const span = oc.parentElement.querySelector('.oc-val');
    if (span) span.textContent = `+${state.overclock[slot]*5}%`;
    return;
  }
  const price = e.target.closest('[data-act="aiPrice"]');
  if (price) {
    const id = price.dataset.arg;
    setAIPrice(id, +price.value);
    const span = price.parentElement.querySelector('.oc-val');
    if (span) span.textContent = `${(+price.value).toFixed(1)} ₮/сек`;
    return;
  }
  const prvPrice = e.target.closest('[data-act="providerPrice"]');
  if (prvPrice) {
    setProviderPrice(+prvPrice.value);
    const span = prvPrice.parentElement.querySelector('.oc-val');
    if (span) span.textContent = `${(+prvPrice.value).toFixed(0)} ₮`;
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'importFile' && e.target.files[0]) { importSave(e.target.files[0]); e.target.value = ''; }
  if (e.target.id === 'modFile' && e.target.files[0]) {
    const r = new FileReader();
    r.onload = ev => { loadMod(ev.target.result); refreshWindows(); };
    r.readAsText(e.target.files[0]);
    e.target.value = '';
  }
});

$('#start-btn').addEventListener('click', () => {
  const menu = $('#task-items');
  if (menu.dataset.open === '1') { menu.dataset.open = '0'; renderTaskItems(); return; }
  menu.dataset.open = '1';
  menu.innerHTML = Object.keys(WINDOWS).map(id =>
    `<div class="task-item" data-act="openWin" data-arg="${id}">${WINDOWS[id].title}</div>`).join('');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.target.id === 'chatInput' && e.key === 'Enter') {
    sendChat(e.target.value);
    e.target.value = '';
    return;
  }
  if (e.ctrlKey && e.code === 'Space') {
    const t = e.target;
    const isTyping = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
    if (isTyping) return;
    e.preventDefault();
    if (state.assistant.enabled) startListening();
    else toast('🎙️ Включите ассистента в настройках', 'warn');
  }
});

/* ==================== 21. ПРИОРИТЕТ 3 ==================== */
function applyTheme() {
  document.body.setAttribute('data-theme', state.theme);
  document.body.setAttribute('data-wallpaper', state.wallpaper);
}
function setTheme(id) { state.theme = id; applyTheme(); Sound.click(); }
function setWallpaper(id) { state.wallpaper = id; applyTheme(); Sound.click(); }
function setWeather(id) { state.weather.type = id; state.weather.nextChange = 300; renderWeather(); Sound.click(); }
function setLocale(id) { state.locale = id; toast(id === 'ru' ? '🌍 Русский' : '🌍 English', 'good'); refreshWindows(); }

function renderWeather() {
  const layer = document.getElementById('weather-layer');
  if (!layer) return;
  layer.innerHTML = '';
  const type = state.weather.type;
  if (type === 'rain') {
    for (let i = 0; i < 80; i++) {
      const d = document.createElement('div');
      d.className = 'rain-drop';
      d.style.left = Math.random() * 100 + '%';
      d.style.animationDuration = (0.5 + Math.random() * 0.5) + 's';
      d.style.animationDelay = (Math.random() * 2) + 's';
      layer.appendChild(d);
    }
  } else if (type === 'snow') {
    for (let i = 0; i < 50; i++) {
      const f = document.createElement('div');
      f.className = 'snow-flake';
      f.style.left = Math.random() * 100 + '%';
      f.style.animationDuration = (5 + Math.random() * 5) + 's';
      f.style.animationDelay = (Math.random() * 5) + 's';
      const s = 3 + Math.random() * 5;
      f.style.width = s + 'px'; f.style.height = s + 'px';
      layer.appendChild(f);
    }
  } else if (type === 'fog') {
    const f = document.createElement('div'); f.className = 'fog-layer'; layer.appendChild(f);
  } else if (type === 'stars') {
    const s = document.createElement('div'); s.className = 'stars-layer'; layer.appendChild(s);
  }
}

function rollWeather() {
  const types = ['clear','rain','snow','fog','stars'];
  const t = types[Math.floor(Math.random() * types.length)];
  state.weather.type = t;
  state.weather.temp = Math.round(rnd(-5, 30));
  state.weather.nextChange = rnd(240, 420);
  renderWeather();
  const names = { clear:'☀️ Ясно', rain:'🌧️ Дождь', snow:'❄️ Снег', fog:'🌫️ Туман', stars:'⭐ Звёзды' };
  toast(`${names[t]} · ${state.weather.temp}°C`, 'info');
}

function renderWidgets() {
  const el = document.getElementById('widgets');
  if (!el) return;
  let h = '';
  const w = state.widgets;

  if (w.clock) {
    const now = new Date();
    const time = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    const days = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    h += `<div class="widget">
      <div class="wg-title">Часы</div>
      <div class="wg-big">${time}</div>
      <div class="wg-sub">${days[now.getDay()]}, ${now.getDate()}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}</div>
    </div>`;
  }

  if (w.weather) {
    const map = { clear:['☀️','Ясно'], rain:['🌧️','Дождь'], snow:['❄️','Снег'], fog:['🌫️','Туман'], stars:['⭐','Ясно'] };
    const [ico, txt] = map[state.weather.type] || ['☀️','Ясно'];
    h += `<div class="widget">
      <div class="wg-title">Погода</div>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:32px">${ico}</div>
        <div>
          <div class="wg-big" style="font-size:22px">${state.weather.temp}°C</div>
          <div class="wg-sub">${txt}</div>
        </div>
      </div>
    </div>`;
  }

  if (w.currency) {
    const usd = 41.2 + Math.sin(state.playTime / 60) * 0.5;
    const eur = 44.8 + Math.cos(state.playTime / 60) * 0.6;
    h += `<div class="widget">
      <div class="wg-title">Курс валют</div>
      <div class="wg-row"><span>USD</span><b>${usd.toFixed(2)} ₮</b></div>
      <div class="wg-row"><span>EUR</span><b>${eur.toFixed(2)} ₮</b></div>
      <div class="wg-row"><span>BTC</span><b>${(96000 + Math.sin(state.playTime/30)*1500).toFixed(0)} ₮</b></div>
    </div>`;
  }

  if (w.news && state.news.length) {
    const n = state.news[0];
    h += `<div class="widget">
      <div class="wg-title">📰 Новости</div>
      <div class="wg-news">${n.text}</div>
    </div>`;
  }

  if (w.stocks) {
    const top = state.stocks.slice(0, 4).map(s => {
      const prev = s.history[s.history.length-2] || s.price;
      const diff = s.price - prev;
      const color = diff >= 0 ? 'var(--acc)' : 'var(--bad)';
      return `<div class="wg-row"><span>${s.id}</span><b style="color:${color}">${s.price.toFixed(0)} ${diff>=0?'▲':'▼'}</b></div>`;
    }).join('');
    h += `<div class="widget"><div class="wg-title">📈 Биржа</div>${top}</div>`;
  }

  if (state.ai && state.ai.unlocked && state.ai.totalUsers > 0) {
    h += `<div class="widget">
      <div class="wg-title">🤖 AI Lab</div>
      <div class="wg-row"><span>Пользователи</span><b>${fmt(state.ai.totalUsers)}</b></div>
      <div class="wg-row"><span>Доход/час</span><b>${fmt(Math.round(state.ai.hourlyRevenue))} ₮</b></div>
    </div>`;
  }

  if (state.provider && state.provider.created && state.provider.subscribers > 0) {
    h += `<div class="widget">
      <div class="wg-title">📡 Провайдер</div>
      <div class="wg-row"><span>Абонентов</span><b>${fmt(state.provider.subscribers)}</b></div>
      <div class="wg-row"><span>Доход/час</span><b>${fmt(Math.round(state.provider.hourlyRevenue))} ₮</b></div>
      <div class="wg-row"><span>Бонус</span><b>+${state.provider.speedBoost}%</b></div>
    </div>`;
  }

  el.innerHTML = h;
}

function toggleWidget(id) {
  state.widgets[id] = !state.widgets[id];
  renderWidgets();
  Sound.click();
  refreshWindows();
}

const NEWS_TEMPLATES = [
  '📈 Рынок компонентов вырос на {n}% за неделю',
  '⚡ {n} новых драйверов выпущено сегодня',
  '🚀 Стартап {name} привлёк {n} млн ₮ инвестиций',
  '🦠 Новая волна вирусов атакует {n} устройств',
  '💎 Курс крипты вырос на {n}%',
  '🔧 {n}% пользователей не обновляют драйвера',
  '🏢 {name} купил конкурента за {n} млн ₮',
  '🌐 Средняя скорость интернета выросла до {n} Мбит/с',
  '🎮 Вышел новый драйвер для видеокарт +{n}% FPS',
  '🛡️ {n} новых угроз в базе антивируса',
  '🤖 Новая AI-модель {name} набрала {n} млн пользователей за неделю',
  '🧠 {name} представила ИИ с качеством {n}%'
];
const FAKE_COMPANIES = ['NovaX','MegaSoft','PixelCore','QuantumBit','SkyWorks','CyberLink','DataFlow','DeepThink','NeuralX'];
function genNews() {
  const t = NEWS_TEMPLATES[Math.floor(Math.random() * NEWS_TEMPLATES.length)];
  const n = Math.floor(rnd(2, 90));
  const name = FAKE_COMPANIES[Math.floor(Math.random() * FAKE_COMPANIES.length)];
  state.news.unshift({ text: t.replace('{n}', n).replace('{name}', name), time: Date.now() });
  if (state.news.length > 12) state.news.pop();
}

function startListening() {
  if (!SpeechAvailable() || !state.assistant.enabled) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!speechRec) {
    speechRec = new SR();
    speechRec.lang = state.locale === 'ru' ? 'ru-RU' : 'en-US';
    speechRec.continuous = false;
    speechRec.interimResults = false;
    speechRec.onresult = e => {
      const cmd = e.results[0][0].transcript.toLowerCase().trim();
      processVoiceCommand(cmd);
    };
    speechRec.onend = () => { state.assistant.listening = false; updateVoiceIndicator(); };
    speechRec.onerror = () => { state.assistant.listening = false; updateVoiceIndicator(); };
  }
  try {
    speechRec.lang = state.locale === 'ru' ? 'ru-RU' : 'en-US';
    speechRec.start();
    state.assistant.listening = true;
    updateVoiceIndicator();
    Sound.click();
  } catch (e) {}
}

function processVoiceCommand(cmd) {
  state.assistant.log.unshift({ cmd, time: Date.now() });
  if (state.assistant.log.length > 20) state.assistant.log.pop();
  toast(`🎙️ «${cmd}»`, 'info');

  if (/браузер|browser|заказ|order/.test(cmd)) { openWindow('browser'); say('Открываю браузер'); return; }
  if (/магазин|shop|store/.test(cmd))            { openWindow('shop'); say('Открываю магазин'); return; }
  if (/файл|file|загрузк/.test(cmd))             { openWindow('files'); say('Открываю файлы'); return; }
  if (/драйвер|driver/.test(cmd))                { openWindow('devices'); say('Открываю диспетчер устройств'); return; }
  if (/биржа|stock|акци/.test(cmd))              { openWindow('stock'); say('Открываю биржу'); return; }
  if (/компан|company/.test(cmd))                { openWindow('company'); say('Открываю компанию'); return; }
  if (/кампани|campaign|сюжет/.test(cmd))        { openWindow('campaign'); say('Открываю кампанию'); return; }
  if (/настрой|settings/.test(cmd))              { openWindow('settings'); say('Открываю настройки'); return; }
  if (/достижен|achiev/.test(cmd))               { openWindow('achv'); say('Открываю достижения'); return; }
  if (/ии|ai|нейросет|модель|model/.test(cmd))   { openWindow('ai'); say('Открываю AI Lab'); return; }
  if (/провайдер|интернет|провайдера|provider/.test(cmd)) { openWindow('provider'); say('Открываю провайдер'); return; }
  if (/технолог|tech|исследов/.test(cmd))        { openWindow('tech'); say('Открываю технологии'); return; }
  if (/клан|clan|чат|chat/.test(cmd))            { openWindow('clan'); say('Открываю клан'); return; }
  if (/статус|status|сколько|баланс|balance/.test(cmd)) {
    say(`У вас ${fmt(state.money)} тенге, уровень ${state.level}`);
    toast(`💰 ${fmt(state.money)} ₮ · ⭐ ур. ${state.level}`, 'info');
    return;
  }
  if (/пользовател|users/.test(cmd)) {
    say(`Пользователей ИИ: ${fmt(state.ai.totalUsers)}`);
    return;
  }
  if (/температур|temp/.test(cmd)) {
    say(`Температура ${Math.round(state.temp)} градусов`);
    return;
  }
  if (/скан|scan|вирус|virus/.test(cmd)) {
    if (state.hasAntivirus) { scanForViruses(); say('Запускаю сканирование'); }
    else say('Антивирус не установлен');
    return;
  }
  if (/бэкап|backup/.test(cmd)) { createBackup(); say('Бэкап создан'); return; }
  if (/тема|theme|обои|wallpaper/.test(cmd)) { setTheme(state.theme === 'dark' ? 'light' : 'dark'); say('Меняю тему'); return; }
  if (/помощь|help|команды/.test(cmd)) {
    say('Доступные команды: браузер, магазин, файлы, драйвера, биржа, AI Lab, статус, сканирование, бэкап, тема');
    return;
  }
  say('Не понял команду. Скажите «помощь».');
}

function say(text) {
  if (!state.assistant.enabled || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = state.locale === 'ru' ? 'ru-RU' : 'en-US';
    u.rate = 1; u.pitch = 1; u.volume = .7;
    speechSynthesis.speak(u);
  } catch (e) {}
}

function updateVoiceIndicator() {
  const el = document.getElementById('voice-indicator');
  if (!el) return;
  el.hidden = !state.assistant.listening;
}

function toggleAssistant() {
  if (!SpeechAvailable()) { toast('❌ Web Speech API недоступен', 'bad'); return; }
  state.assistant.enabled = !state.assistant.enabled;
  if (!state.assistant.enabled) {
    state.assistant.listening = false;
    updateVoiceIndicator();
    toast('🎙️ Ассистент выключен', 'info');
  } else {
    toast('🎙️ Ассистент включён. Нажмите Ctrl+Space', 'good');
  }
  refreshWindows();
}

function render3DViewer() {
  const slot = window.__viewerSlot || 'cpu';
  const item = slotItem(slot);
  return `
    <div class="tabs" style="flex-wrap:wrap">
      ${SLOTS.map(s => `<div class="tab ${slot===s?'active':''}" data-act="viewerSlot" data-arg="${s}">${SLOT_INFO[s].icon} ${SLOT_INFO[s].label}</div>`).join('')}
    </div>
    <div class="viewer-stage">
      <div class="viewer-cube">
        <div class="cube-face front">${SLOT_INFO[slot].icon}</div>
        <div class="cube-face back">${SLOT_INFO[slot].icon}</div>
        <div class="cube-face right">${SLOT_INFO[slot].icon}</div>
        <div class="cube-face left">${SLOT_INFO[slot].icon}</div>
        <div class="cube-face top">${SLOT_INFO[slot].icon}</div>
        <div class="cube-face bottom">${SLOT_INFO[slot].icon}</div>
      </div>
    </div>
    <h3 class="sec" style="margin-top:14px">Характеристики</h3>
    <div class="row"><span class="ico">${SLOT_INFO[slot].icon}</span>
      <div class="main"><div class="name">${item.name}</div>
      <div class="sub">Уровень: ${TIER_NAMES[item.tier]}</div></div>
    </div>
    ${Object.entries(item.stats).map(([k, v]) =>
      `<div class="row"><span class="ico">📊</span>
        <div class="main"><div class="name">${k.toUpperCase()}</div>
        <div class="sub">${v}</div></div>
      </div>`
    ).join('')}
    <div class="sub" style="color:var(--dim);font-size:11px;margin-top:8px">
      ${SLOT_INFO[slot].hint}
    </div>
  `;
}
function setViewerSlot(slot) { window.__viewerSlot = slot; refreshWindows(); Sound.click(); }

const NPC_MEMBERS_BASE = [
  { name:'NeoDroid',    role:'Лидер клана',  ico:'🤖' },
  { name:'Cyber_Kate',  role:'Инженер',      ico:'👩‍💻' },
  { name:'PixelWolf',   role:'Трейдер',      ico:'🐺' },
  { name:'ChipMaster',  role:'Оверклокер',   ico:'🔧' },
  { name:'NightHack',   role:'Хакер',        ico:'💀' },
  { name:'DataQueen',   role:'Аналитик',     ico:'👑' }
];
const CHAT_LINES = [
  'Привет всем! Кто-нибудь обучил свою AI-модель?',
  'Мой Chat AI набрал 10 000 пользователей за день!',
  'Мой GPU Photon-X даёт +25% на майнинге 🔥',
  'Кто знает, как убрать баги в ИИ? Постоянно ловлю.',
  'Продаю NVMe 4 ТБ, дёшево. Пишите в личку.',
  'Собрал сервер Rack-1U — скорость сети просто космос!',
  'Обновил TycoonOS до v1 — стабильно работает.',
  'У кого есть опыт с жидким азотом? Хочу разогнать CPU.',
  'Купил филиал в США — доход вырос в 1.8 раз!',
  'Новая технология «Нейросети+» — кто исследовал?',
  'AI Safety спасает от инцидентов, рекомендую.',
  'Биржа сегодня вверх, продал все акции с профитом 🚀'
];

function joinClan() {
  if (state.clan) return;
  const name = 'DigitalTitan';
  state.clan = {
    name,
    joined: Date.now(),
    contribution: 0,
    members: NPC_MEMBERS_BASE.map(m => ({ ...m, online: Math.random() > .3 }))
  };
  Sound.achv();
  toast(`🏰 Вы вступили в клан «${name}»!`, 'good');
  if (!state.chat.length) {
    state.chat.push({ author:'SYSTEM', text:`Вы вступили в клан «${name}». Добро пожаловать!`, system: true, time: Date.now() });
  }
  refreshWindows();
}
function leaveClan() { state.clan = null; Sound.click(); toast('🏰 Вы покинули клан', 'info'); refreshWindows(); }

function genChatMessage() {
  if (!state.clan) return;
  const m = state.clan.members[Math.floor(Math.random() * state.clan.members.length)];
  const text = CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)];
  state.chat.push({ author: m.name, ico: m.ico, text, time: Date.now() });
  if (state.chat.length > 60) state.chat.shift();
}

function sendChat(text) {
  if (!text.trim() || !state.clan) return;
  const me = state.company ? state.company.name : 'Вы';
  state.chat.push({ author: me, ico: '👤', text: text.trim(), time: Date.now(), self: true });
  setTimeout(() => {
    const m = state.clan.members[Math.floor(Math.random() * state.clan.members.length)];
    const replies = ['Согласен!', 'Интересно...', 'Попробую, спасибо!', 'Хорошая идея 💡', 'Это работает?', 'Круто!', 'Расскажи подробнее.'];
    state.chat.push({ author: m.name, ico: m.ico, text: replies[Math.floor(Math.random() * replies.length)], time: Date.now() });
    if (state.chat.length > 60) state.chat.shift();
    refreshWindows();
  }, 1500);
}

function renderClan() {
  if (!state.clan) {
    return `<div class="empty">
      🏰 Вы не в клане<br><br>
      Присоединяйтесь к клану «DigitalTitan».<br><br>
      <button class="btn acc" data-act="joinClan">Вступить в клан</button>
    </div>`;
  }
  const c = state.clan;
  let h = `<div class="row">
    <span class="ico">🏰</span>
    <div class="main"><div class="name">${c.name} <span class="clan-badge">ТОП-1</span></div>
    <div class="sub">Участников: ${c.members.length} · онлайн: ${c.members.filter(m=>m.online).length}</div></div>
    <div class="right"><button class="btn sm red" data-act="leaveClan">Покинуть</button></div>
  </div>

  <h3 class="sec" style="margin-top:12px">Участники</h3>`;
  for (const m of c.members) {
    h += `<div class="clan-member">
      <div class="cm-av">${m.ico}</div>
      <div class="cm-info">
        <div class="cm-name">${m.name}</div>
        <div class="cm-role">${m.role}</div>
      </div>
      <div>${m.online ? '<span class="tag ok">ОНЛАЙН</span>' : '<span class="tag dim">оффлайн</span>'}</div>
    </div>`;
  }
  h += `<h3 class="sec" style="margin-top:14px">💬 Чат клана</h3><div class="chat-log">`;
  for (const msg of state.chat.slice(-30)) {
    if (msg.system) {
      h += `<div class="chat-msg system"><span class="cm-author">SYSTEM</span>${msg.text}</div>`;
    } else {
      h += `<div class="chat-msg"><span class="cm-author">${msg.ico || '👤'} ${msg.author}</span>${msg.text}</div>`;
    }
  }
  h += `</div>
    <div class="chat-input">
      <input type="text" id="chatInput" placeholder="Написать сообщение..." maxlength="120" />
      <button class="btn acc" data-act="sendChatMsg">Отправить</button>
    </div>`;
  return h;
}

function renderCertificates() {
  const got = ACHIEVEMENTS.filter(a => state.achievements.includes(a.id));
  if (!got.length) {
    return `<div class="empty">🏅 У вас пока нет сертификатов<br><br>Получайте достижения.</div>`;
  }
  let h = `<div class="row">
    <span class="ico">🏅</span>
    <div class="main"><div class="name">Всего сертификатов: ${got.length}</div>
    <div class="sub">За достижения в игре</div></div>
    <div class="right"><button class="btn sm acc" data-act="exportCerts">📥 Экспорт</button></div>
  </div>`;
  for (const a of got) {
    const id = 'CERT-' + a.id.toUpperCase().slice(0, 8) + '-' + state.playTime.toString(36).toUpperCase().slice(0, 6);
    h += `<div class="cert-card">
      <div class="cert-title">${a.ico} ${a.name}</div>
      <div class="cert-sub">${a.desc}</div>
      <div class="cert-id">ID: ${id}</div>
    </div>`;
  }
  return h;
}

function exportCertificates() {
  const got = ACHIEVEMENTS.filter(a => state.achievements.includes(a.id)).map(a => ({
    id: 'CERT-' + a.id.toUpperCase(),
    name: a.name, desc: a.desc, icon: a.ico, reward: a.reward,
    unlocked: new Date().toISOString(),
    game: 'Download Tycoon', version: GAME_VERSION,
    level: state.level, playtime: Math.floor(state.playTime)
  }));
  const data = JSON.stringify({ certificates: got, exportedAt: new Date().toISOString() }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `download-tycoon-certificates-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`🏅 Экспортировано ${got.length} сертификатов`, 'good');
}

function renderAssistant() {
  if (!SpeechAvailable()) {
    return `<div class="empty">🎙️ Web Speech API недоступен.<br><br>Используйте Chrome/Edge.</div>`;
  }
  const log = state.assistant.log.slice(0, 10);
  let h = `<div class="row">
    <span class="ico">🎙️</span>
    <div class="main"><div class="name">Голосовой ассистент</div>
    <div class="sub">Статус: ${state.assistant.enabled ? '🟢 включён' : '⚪ выключен'}</div></div>
    <div class="right">
      <button class="btn sm ${state.assistant.enabled?'acc':''}" data-act="toggleAssistant">
        ${state.assistant.enabled?'ВКЛ':'ВЫКЛ'}
      </button>
      <button class="btn sm blue" ${!state.assistant.enabled?'disabled':''} data-act="listenOnce">🎤 Слушать</button>
    </div>
  </div>

  <h3 class="sec" style="margin-top:14px">Команды</h3>
  <div class="row"><span class="ico">🌐</span><div class="main"><div class="name">«открой браузер»</div><div class="sub">shop, files, drivers, AI Lab, stock, settings</div></div></div>
  <div class="row"><span class="ico">💰</span><div class="main"><div class="name">«статус»</div><div class="sub">баланс, уровень, температура</div></div></div>
  <div class="row"><span class="ico">👥</span><div class="main"><div class="name">«пользователи»</div><div class="sub">количество пользователей ИИ</div></div></div>
  <div class="row"><span class="ico">🛡️</span><div class="main"><div class="name">«сканирование»</div><div class="sub">запуск антивируса</div></div></div>
  <div class="row"><span class="ico">💽</span><div class="main"><div class="name">«бэкап»</div><div class="sub">резервная копия</div></div></div>
  <div class="row"><span class="ico">🎨</span><div class="main"><div class="name">«тема»</div><div class="sub">смена темы</div></div></div>

  <h3 class="sec" style="margin-top:14px">История команд</h3>`;
  if (!log.length) h += `<div class="empty" style="padding:16px">Ещё не было команд</div>`;
  else for (const e of log) {
    const t = new Date(e.time).toLocaleTimeString('ru-RU');
    h += `<div class="row"><span class="ico">🎙️</span>
      <div class="main"><div class="name">«${e.cmd}»</div><div class="sub">${t}</div></div>
    </div>`;
  }
  return h;
}

/* ==================== 22. AI LAB РЕНДЕР ==================== */
function renderAI() {
  if (!hasTech('ai_lab')) {
    return `<div class="empty">
      🤖 <b>AI Lab заблокирован</b><br><br>
      Исследуйте технологию «AI Framework» в разделе «Технологии».<br>
      Требуется: Ускоренное R&D → AI Framework.
    </div>`;
  }
  const ai = state.ai;
  const load = aiServerLoad();
  const loadCls = load > 90 ? 'bad' : load > 70 ? 'warn' : '';

  let h = `
    <div class="ai-stat-grid">
      <div class="row"><span class="ico">👥</span>
        <div class="main"><div class="name">${fmt(ai.totalUsers)}</div>
        <div class="sub">пользователей</div></div></div>
      <div class="row"><span class="ico">💎</span>
        <div class="main"><div class="name">${fmt(ai.subscribers)}</div>
        <div class="sub">подписчиков</div></div></div>
      <div class="row"><span class="ico">💰</span>
        <div class="main"><div class="name">${fmt(ai.hourlyRevenue)} ₮</div>
        <div class="sub">доход в час</div></div></div>
      <div class="row"><span class="ico">📈</span>
        <div class="main"><div class="name">${fmt(ai.lifetimeRevenue)} ₮</div>
        <div class="sub">всего заработано</div></div></div>
    </div>

    <h3 class="sec" style="margin-top:14px">🖥️ Нагрузка серверов</h3>
    <div class="row">
      <span class="ico">📡</span>
      <div class="main">
        <div class="name">${fmt(ai.totalUsers)} / ${fmt(aiServerCapacity())} пользователей</div>
        <div class="bar ${loadCls}" style="margin-top:6px"><i style="width:${Math.min(100, load)}%"></i></div>
        <div class="sub">${load.toFixed(1)}%${load > 100 ? ' — перегрузка!' : ''}</div>
      </div>
    </div>

    <h3 class="sec" style="margin-top:14px">💾 Данные для обучения</h3>
    <div class="row">
      <span class="ico">🧬</span>
      <div class="main">
        <div class="name">${fmt(ai.data)} единиц данных</div>
        <div class="sub">Собираются автоматически от пользователей ИИ</div>
      </div>
      <div class="right">
        <button class="btn sm acc" data-act="buyAIData" data-arg="100">+100 (${fmt(100*AI_DATA_PRICE)} ₮)</button>
        <button class="btn sm blue" data-act="buyAIData" data-arg="1000">+1000 (${fmt(1000*AI_DATA_PRICE)} ₮)</button>
      </div>
    </div>

    <h3 class="sec" style="margin-top:14px">📣 Маркетинг</h3>
    <div class="row">
      <span class="ico">📢</span>
      <div class="main">
        <div class="name">Бюджет: ${fmt(ai.marketingBudget)} ₮</div>
        <div class="sub">Ускоряет рост пользователей. Тратится 5%/сек.</div>
      </div>
      <div class="right" style="display:flex;flex-direction:column;gap:4px">
        <button class="btn sm acc" data-act="buyAIMarketing" data-arg="10000">+10 000 ₮</button>
        <button class="btn sm acc" data-act="buyAIMarketing" data-arg="50000">+50 000 ₮</button>
        <button class="btn sm red" data-act="clearAIMarketing">Сброс</button>
      </div>
    </div>
  `;

  h += `<h3 class="sec" style="margin-top:14px">🆕 Создать ИИ-модель</h3>`;
  const anyTraining = ai.models.some(m => m.training.active);

  for (const t of AI_TYPES) {
    const already = ai.models.some(m => m.type === t.id);
    const lvlOk = state.level >= t.unlockLvl;
    const dataOk = ai.data >= t.dataCost;
    const can = !already && lvlOk && dataOk && !anyTraining;

    let reason = '';
    if (already) reason = 'Уже есть';
    else if (!lvlOk) reason = `С ${t.unlockLvl} уровня`;
    else if (!dataOk) reason = `Нужно ${t.dataCost} данных`;

    h += `<div class="row">
      <span class="ico">${t.ico}</span>
      <div class="main">
        <div class="name">${t.name}</div>
        <div class="sub">${t.desc} · данные: ${t.dataCost}${reason ? ' · ' + reason : ''}</div>
      </div>
      <div class="right">${already
        ? `<span class="tag ok">СОЗДАНА</span>`
        : `<button class="btn sm ${can?'acc':''}" ${!can?'disabled':''}
             data-act="startAITraining" data-arg="${t.id}">Обучить</button>`}</div>
    </div>`;
  }

  h += `<h3 class="sec" style="margin-top:18px">🧠 Мои модели (${ai.models.length})</h3>`;

  if (!ai.models.length) {
    h += `<div class="empty" style="padding:20px">Пока нет моделей</div>`;
    return h + renderAIIncidents();
  }

  for (const m of ai.models) {
    const type = AI_TYPES.find(t => t.id === m.type);
    const training = m.training.active;
    const pct = training ? clamp(m.training.progress / m.training.target * 100, 0, 100) : 0;
    const dataCost = type.dataCost * (m.version + 1) * 0.5;

    const cardCls = training ? 'training' : m.released ? 'released' : '';

    h += `<div class="ai-model-card ${cardCls}">
      <div class="ai-model-head">
        <div class="am-ico">${type.ico}</div>
        <div class="am-info">
          <div class="am-name">${m.name} <span class="tag dim">v${m.version}</span></div>
          <div class="am-type">${type.name} · ${type.desc}</div>
        </div>
        ${m.released
          ? (training ? `<span class="tag warn">ОБУЧЕНИЕ</span>` : `<span class="tag ok">В РЕЛИЗЕ</span>`)
          : (training ? `<span class="tag warn">ОБУЧЕНИЕ</span>` : `<span class="tag dim">В РАЗРАБОТКЕ</span>`)}
      </div>`;

    if (training) {
      h += `
        <div class="bar" style="margin-top:8px"><i style="width:${pct}%"></i></div>
        <div class="sub" style="margin-top:5px">${pct.toFixed(1)}% — ${Math.round(m.training.target - m.training.progress)} сек</div>`;
    } else {
      h += `
        <div class="ai-metrics">
          <div class="am-cell">
            <div class="am-val">${fmt(m.users)}</div>
            <div class="am-lbl">Юзеров</div>
          </div>
          <div class="am-cell">
            <div class="am-val">${Math.round(m.quality)}</div>
            <div class="am-lbl">Качество</div>
          </div>
          <div class="am-cell">
            <div class="am-val" style="color:${m.bugLevel>50?'var(--bad)':'var(--acc)'}">${Math.round(m.bugLevel)}%</div>
            <div class="am-lbl">Баги</div>
          </div>
        </div>
        <div class="grid2" style="font-size:11px;color:var(--dim);margin-bottom:10px">
          <div>💎 Подписчиков: <b style="color:var(--acc2)">${fmt(m.subscribers)}</b></div>
          <div>💰 Доход/час: <b style="color:var(--acc)">${fmt(Math.round(m.subscribers * m.pricePerUser * 3600))} ₮</b></div>
        </div>
        <div>
          <label class="lbl">Цена подписки: <span class="oc-val">${m.pricePerUser.toFixed(1)} ₮/сек</span></label>
          <input type="range" min="0.5" max="20" step="0.5" value="${m.pricePerUser}"
            class="oc-slider" data-act="aiPrice" data-arg="${m.id}" />
        </div>
        <div class="ai-actions">`;

      if (!m.released) {
        h += `<button class="btn sm acc" data-act="releaseAI" data-arg="${m.id}">🚀 Выпустить</button>`;
      }
      h += `<button class="btn sm blue" ${anyTraining || ai.data < dataCost ? 'disabled' : ''}
              data-act="upgradeAI" data-arg="${m.id}">📈 v${m.version + 1} (${Math.round(dataCost)} данных)</button>`;
      if (m.bugLevel > 0) {
        h += `<button class="btn sm" data-act="fixBugsAI" data-arg="${m.id}">🔧 Починить баги</button>`;
      }
      h += `<button class="btn sm red" data-act="deleteAI" data-arg="${m.id}">🗑️ Удалить</button>`;
      h += `</div>`;
    }

    h += `</div>`;
  }

  return h + renderAIIncidents();
}

function renderAIIncidents() {
  const ai = state.ai;
  if (!ai.incidents.length) return '';
  let h = `<h3 class="sec" style="margin-top:18px">📜 История инцидентов</h3>`;
  for (const inc of ai.incidents.slice(0, 8)) {
    const t = new Date(inc.time).toLocaleTimeString('ru-RU');
    const cls = inc.usersLoss > 0 ? 'bad' : 'good';
    h += `<div class="ai-incident-row ${cls}">
      <span style="font-size:18px">${inc.ico}</span>
      <div style="flex:1">
        <div><b>${inc.name}</b> — ${inc.model}</div>
        <div style="color:var(--dim);font-size:10.5px">${inc.desc} · ${t}</div>
      </div>
    </div>`;
  }
  return h;
}

/* ==================== 22.5. PROVIDER РЕНДЕР ==================== */
function renderProvider() {
  if (!hasTech('prv_open')) {
    return `<div class="empty">
      📡 <b>Раздел «Провайдер» заблокирован</b><br><br>
      Исследуйте технологию «Internet Provider» в разделе «Технологии».<br>
      Требуется: Ускоренное R&D → Internet Provider.
    </div>`;
  }

  const p = state.provider;

  if (!p.created) {
    let h = `<div class="empty" style="padding:20px">
      📡 <b>Основать своего интернет-провайдера</b><br><br>
      Выберите регион для старта — каждый следующий даёт больше абонентов,<br>
      но требует более высокого уровня и денег.
    </div>

    <h3 class="sec">🌍 Регион</h3>`;

    for (const r of PROVIDER_REGIONS) {
      const requiredLvl = PROVIDER_REGIONS.indexOf(r) * 6 + 1;
      const lvlOk = state.level >= requiredLvl;
      const moneyOk = state.money >= r.baseCost;
      const can = lvlOk && moneyOk;

      h += `<div class="row">
        <span class="ico">${r.flag}</span>
        <div class="main">
          <div class="name">${r.name}</div>
          <div class="sub">до ${fmt(r.usersMax)} абонентов · налог ${(r.taxRate*100).toFixed(0)}% · ур. ${requiredLvl}</div>
        </div>
        <div class="right">
          <button class="btn sm ${can?'acc':''}" ${!can?'disabled':''}
            data-act="createProviderStart" data-arg="${r.id}">${fmt(r.baseCost)} ₮</button>
        </div>
      </div>`;
    }
    return h;
  }

  const load = clamp((p.subscribers / Math.max(1, providerCapacity())) * 100, 0, 150);
  const loadCls = load > 90 ? 'bad' : load > 70 ? 'warn' : '';
  const region = PROVIDER_REGIONS.find(r => r.id === p.regionId) || PROVIDER_REGIONS[0];
  const tariff = PROVIDER_TARIFFS.find(t => t.id === p.tariffId) || PROVIDER_TARIFFS[1];

  let h = `
    <div class="ai-stat-grid">
      <div class="row"><span class="ico">👥</span>
        <div class="main"><div class="name">${fmt(p.subscribers)}</div>
        <div class="sub">абонентов</div></div></div>
      <div class="row"><span class="ico">💰</span>
        <div class="main"><div class="name">${fmt(p.hourlyRevenue)} ₮</div>
        <div class="sub">доход в час</div></div></div>
      <div class="row"><span class="ico">📈</span>
        <div class="main"><div class="name">${fmt(p.lifetimeRevenue)} ₮</div>
        <div class="sub">всего заработано</div></div></div>
      <div class="row"><span class="ico">⚡</span>
        <div class="main"><div class="name">+${p.speedBoost}%</div>
        <div class="sub">к вашей скорости</div></div></div>
    </div>

    <div class="row">
      <span class="ico">📡</span>
      <div class="main">
        <div class="name">${p.name} · ${region.flag} ${region.name}</div>
        <div class="sub">тариф ${tariff.ico} ${tariff.name} · репутация ${Math.round(p.reputation)}/100</div>
      </div>
    </div>

    <h3 class="sec" style="margin-top:14px">📊 Показатели</h3>
    <div class="row">
      <span class="ico">🖥️</span>
      <div class="main">
        <div class="name">Загрузка сети: ${fmt(p.subscribers)} / ${fmt(providerCapacity())}</div>
        <div class="bar ${loadCls}" style="margin-top:6px"><i style="width:${Math.min(100, load)}%"></i></div>
        <div class="sub">${load.toFixed(1)}%${load > 100 ? ' — перегрузка!' : ''}</div>
      </div>
    </div>

    <div class="row">
      <span class="ico">🌍</span>
      <div class="main">
        <div class="name">Покрытие: ${p.coverage.toFixed(1)}% (макс. ${providerMaxCoverage()}%)</div>
        <div class="bar" style="margin-top:6px"><i style="width:${p.coverage}%"></i></div>
      </div>
    </div>

    <div class="row">
      <span class="ico">⚡</span>
      <div class="main">
        <div class="name">Средняя скорость: ${p.avgSpeed} Мбит/с</div>
        <div class="sub">влияет на рост абонентов и ваш бонус</div>
      </div>
    </div>
  `;

  /* ---- ТАРИФ ---- */
  h += `<h3 class="sec" style="margin-top:14px">📦 Тариф</h3>`;
  for (const t of PROVIDER_TARIFFS) {
    const active = p.tariffId === t.id;
    const lvlOk = state.level >= t.unlockLvl;
    h += `<div class="row">
      <span class="ico">${t.ico}</span>
      <div class="main">
        <div class="name">${t.name} ${active?'<span class="tag ok">АКТИВЕН</span>':''}</div>
        <div class="sub">скорость ${t.baseSpeed} Мбит/с · база ${t.pricePerUser*10} ₮ · ур. ${t.unlockLvl}</div>
      </div>
      <div class="right">
        ${active ? '' : `<button class="btn sm ${lvlOk?'acc':''}" ${!lvlOk?'disabled':''}
          data-act="setProviderTariff" data-arg="${t.id}">Выбрать</button>`}
      </div>
    </div>`;
  }

  /* ---- ЦЕНА ---- */
  h += `<div class="slotcard">
    <div class="sc-head"><span>💵</span>
      <span class="sc-name">Цена подписки</span>
      <span class="oc-val">${p.price} ₮</span>
    </div>
    <input type="range" min="5" max="200" step="1" value="${p.price}"
      class="oc-slider" data-act="providerPrice" data-arg="" />
    <div class="sub" style="color:var(--dim);font-size:11px">Выше цена → больше доход, но меньше рост абонентов</div>
  </div>`;

  /* ---- ИНФРАСТРУКТУРА ---- */
  h += `<h3 class="sec" style="margin-top:14px">🏗️ Инфраструктура</h3>`;
  for (const inf of PROVIDER_INFRA) {
    const owned = p.infrastructure[inf.id] || 0;
    const price = Math.round(inf.price * (1 + owned * 0.15));
    h += `<div class="row">
      <span class="ico">${inf.ico}</span>
      <div class="main">
        <div class="name">${inf.name} <span class="tag dim">${owned} шт.</span></div>
        <div class="sub">${inf.desc}</div>
      </div>
      <div class="right">
        <button class="btn sm ${state.money>=price?'acc':''}" ${state.money<price?'disabled':''}
          data-act="buildProviderInfra" data-arg="${inf.id}">${fmt(price)} ₮</button>
      </div>
    </div>`;
  }

  /* ---- РЕГИОН ---- */
  h += `<h3 class="sec" style="margin-top:14px">🌍 Сменить регион</h3>`;
  for (const r of PROVIDER_REGIONS) {
    if (r.id === p.regionId) continue;
    const requiredLvl = PROVIDER_REGIONS.indexOf(r) * 6 + 1;
    const lvlOk = state.level >= requiredLvl;
    const moneyOk = state.money >= r.baseCost;
    const can = lvlOk && moneyOk;
    h += `<div class="row">
      <span class="ico">${r.flag}</span>
      <div class="main">
        <div class="name">${r.name}</div>
        <div class="sub">до ${fmt(r.usersMax)} абонентов · ур. ${requiredLvl}</div>
      </div>
      <div class="right">
        <button class="btn sm ${can?'acc':''}" ${!can?'disabled':''}
          data-act="switchProviderRegion" data-arg="${r.id}">${fmt(r.baseCost)} ₮</button>
      </div>
    </div>`;
  }

  /* ---- МАРКЕТИНГ ---- */
  h += `<h3 class="sec" style="margin-top:14px">📣 Маркетинг</h3>
    <div class="row">
      <span class="ico">📢</span>
      <div class="main">
        <div class="name">Бюджет: ${fmt(p.marketingBudget)} ₮</div>
        <div class="sub">Ускоряет рост абонентов. Тратится 3%/сек.</div>
      </div>
      <div class="right" style="display:flex;flex-direction:column;gap:4px">
        <button class="btn sm acc" data-act="providerMarketing" data-arg="20000">+20 000 ₮</button>
        <button class="btn sm acc" data-act="providerMarketing" data-arg="100000">+100 000 ₮</button>
      </div>
    </div>`;

  /* ---- ИНЦИДЕНТЫ ---- */
  if (p.incidents.length) {
    h += `<h3 class="sec" style="margin-top:14px">📜 История инцидентов</h3>`;
    for (const inc of p.incidents.slice(0, 6)) {
      const t = new Date(inc.time).toLocaleTimeString('ru-RU');
      const cls = inc.subsLoss > 0 ? 'bad' : 'good';
      h += `<div class="ai-incident-row ${cls}">
        <span style="font-size:18px">${inc.ico}</span>
        <div style="flex:1">
          <div><b>${inc.name}</b></div>
          <div style="color:var(--dim);font-size:10.5px">${inc.desc} · ${t}</div>
        </div>
      </div>`;
    }
  }

  return h;
}

// Модалка создания провайдера
function openProviderModal(regionId) {
  const region = PROVIDER_REGIONS.find(r => r.id === regionId);
  if (!region) return;
  openModal('📡 Создание провайдера', `
    <p style="margin-bottom:12px;font-size:12.5px;line-height:1.6">
      Регион: <b>${region.flag} ${region.name}</b><br>
      Стоимость входа: <b>${fmt(region.baseCost)} ₮</b><br>
      Максимум абонентов: <b>${fmt(region.usersMax)}</b>
    </p>
    <label class="lbl">НАЗВАНИЕ</label>
    <input class="fld" id="prv-name" placeholder="NetWave" maxlength="24" />
    <button class="btn acc" style="width:100%;padding:10px"
      data-act="createProviderConfirm" data-arg="${regionId}">Основать провайдера</button>
  `);
}

/* ==================== 23. ДОП. ДЕЙСТВИЯ ==================== */
Object.assign(ACTIONS, {
  setTheme:      id => setTheme(id),
  setWallpaper:  id => setWallpaper(id),
  setWeather:    id => setWeather(id),
  setLocale:     id => setLocale(id),
  toggleWidget:  id => toggleWidget(id),
  toggleAssistant: () => toggleAssistant(),
  listenOnce:    () => startListening(),
  viewerSlot:    s  => setViewerSlot(s),
  joinClan:      () => joinClan(),
  leaveClan:     () => leaveClan(),
  sendChatMsg:   () => {
    const inp = document.getElementById('chatInput');
    if (inp) { sendChat(inp.value); inp.value = ''; refreshWindows(); }
  },
  exportCerts:   () => exportCertificates(),

  buyAIData:        amt => buyAIData(+amt),
  startAITraining:  id  => startAITraining(id),
  upgradeAI:        id  => { upgradeAI(id); refreshWindows(); },
  releaseAI:        id  => { releaseAI(id); refreshWindows(); },
  fixBugsAI:        id  => { fixAIBugs(id); refreshWindows(); },
  deleteAI:         id  => deleteAI(id),
  buyAIMarketing:   amt => {
    if (state.money < +amt) { toast('❌ Нет денег', 'bad'); return; }
    state.money -= +amt;
    state.ai.marketingBudget += +amt;
    Sound.money();
    toast(`📢 Бюджет рекламы: ${fmt(state.ai.marketingBudget)} ₮`, 'good');
    refreshWindows();
  },
  clearAIMarketing: () => { state.ai.marketingBudget = 0; refreshWindows(); },

  /* PROVIDER */
  createProviderStart:   rid => openProviderModal(rid),
  createProviderConfirm: rid => {
    const name = ($('#prv-name')?.value || '').trim() || 'NetWave';
    createProvider(name, rid);
  },
  setProviderTariff:  id => setProviderTariff(id),
  buildProviderInfra: id => buildProviderInfra(id),
  switchProviderRegion: rid => switchProviderRegion(rid),
  providerMarketing:  amt => providerMarketing(+amt)
});

/* ==================== 24. ИНИЦИАЛИЗАЦИЯ ==================== */
(function init() {
  applyTheme();
  renderWeather();
  renderWidgets();
  genNews();
  genNews();

  buildDesktopIcons();
  refillOrders();
  renderHud();
  renderTaskItems();

  setTimeout(() => {
    toast('👋 Добро пожаловать в Download Tycoon!', 'info');
    setTimeout(() => toast('🌐 Откройте «Браузер» и возьмите заказ', 'info'), 1200);
    setTimeout(() => toast('🔧 Не забудьте про драйвера', 'info'), 2400);
    setTimeout(() => toast('📖 «Кампания» следит за сюжетом', 'info'), 3600);
    setTimeout(() => toast('🎨 Настройки: темы, обои, погода, виджеты', 'info'), 4800);
    setTimeout(() => toast('🎙️ Ctrl+Space — голосовые команды', 'info'), 6000);
    setTimeout(() => toast('🤖 Исследуйте «AI Framework» для AI Lab', 'info'), 7200);
    setTimeout(() => toast('📡 Исследуйте «Internet Provider» для своего провайдера', 'info'), 8400);
  }, 500);

  openWindow('browser');
})();
