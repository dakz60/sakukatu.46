(() => {
  // js/collectionModel.js
  function photoCount(item) {
    const count = Number(item.count);
    return Number.isSafeInteger(count) && count >= 0 && item.count !== "" && item.count != null ? count : ["未所持", "購入予定"].includes(item.status) ? 0 : 1;
  }
  var offerCount = (item) => item.inventory ? item.inventory === "offer" ? photoCount(item) : 0 : Math.min(photoCount(item), Math.max(0, Number(item.offer) || 0));
  var keepCount = (item) => item.inventory ? item.inventory === "collection" ? photoCount(item) : 0 : photoCount(item) - offerCount(item);
  var wantCount = (item) => item.inventory ? item.inventory === "want" ? photoCount(item) : 0 : Math.max(0, Number(item.want) || 0);
  function applyTrade(photos, lines) {
    if (photos.every((item) => item.inventory)) return applySeparatedTrade(photos, lines);
    const result = photos.map((item) => ({ ...item }));
    let given = 0, received = 0;
    for (const item of result) {
      const line = lines.find((line2) => String(line2.id) === String(item.id));
      if (!line) continue;
      const give = Number(line.give), receive = Number(line.receive);
      if (![give, receive].every((value) => Number.isSafeInteger(value) && value >= 0 && value <= 99999) || give > offerCount(item)) throw new Error("提供できる枚数を超えています");
      item.count = photoCount(item) - give + receive;
      if (item.count > 99999) throw new Error("所持枚数の上限を超えています");
      item.offer = Math.min(item.count, offerCount(photos.find((photo) => photo.id === item.id)) - give);
      item.want = Math.max(0, wantCount(item) - receive);
      item.status = item.count ? "所持" : "未所持";
      given += give;
      received += receive;
    }
    if (!given || !received) throw new Error("渡す写真ともらう写真をそれぞれ選んでください");
    return result;
  }
  function anniversaryInfo(date, now = /* @__PURE__ */ new Date()) {
    const start = /* @__PURE__ */ new Date(`${date}T00:00:00`);
    if (Number.isNaN(start.getTime())) return "";
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 864e5);
    if (days < 0) return `あと${-days}日`;
    let year = Math.max(today.getFullYear(), start.getFullYear() + 1);
    let next = new Date(year, start.getMonth(), start.getDate());
    if (next < today) next = new Date(++year, start.getMonth(), start.getDate());
    const until = Math.round((Date.UTC(next.getFullYear(), next.getMonth(), next.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 864e5);
    return `${days}日目${until <= 30 ? ` · ${year - start.getFullYear()}周年まであと${until}日` : ""}`;
  }
  function daysToAnniversary(date, now = /* @__PURE__ */ new Date()) {
    const start = /* @__PURE__ */ new Date(`${date}T00:00:00`);
    if (Number.isNaN(start.getTime())) return Infinity;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (start > today) return Infinity;
    let year = Math.max(today.getFullYear(), start.getFullYear() + 1);
    let next = new Date(year, start.getMonth(), start.getDate());
    if (next < today) next = new Date(++year, start.getMonth(), start.getDate());
    return Math.round((Date.UTC(next.getFullYear(), next.getMonth(), next.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 864e5);
  }
  function supportingDays(date, now = /* @__PURE__ */ new Date()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return null;
    const [year, month, day] = date.split("-").map(Number);
    const start = new Date(year, month - 1, day);
    if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) return null;
    const elapsed = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(year, month - 1, day)) / 864e5);
    return elapsed >= 0 ? elapsed + 1 : null;
  }
  function migratePhotos(photos) {
    return photos.flatMap((item) => {
      if (item.inventory) return [{ ...item }];
      const imageId = item.imageId || item.id;
      const base = { ...item, imageId };
      delete base.offer;
      delete base.want;
      delete base.keep;
      const result = [];
      if (keepCount(item) || !offerCount(item) && !wantCount(item)) result.push({ ...base, inventory: "collection", count: keepCount(item) });
      if (offerCount(item)) result.push({ ...base, id: `${item.id}:offer`, inventory: "offer", count: offerCount(item) });
      if (wantCount(item)) result.push({ ...base, id: `${item.id}:want`, inventory: "want", count: wantCount(item) });
      return result;
    });
  }
  function applySeparatedTrade(photos, lines) {
    const result = photos.map((item) => ({ ...item }));
    let given = 0, received = 0;
    const incoming = [];
    for (const line of lines) {
      const item = result.find((item2) => String(item2.id) === String(line.id));
      const give = Number(line.give), receive = Number(line.receive);
      if (!item || ![give, receive].every((value) => Number.isSafeInteger(value) && value >= 0 && value <= 99999) || give > offerCount(item) || receive && item.inventory !== "want") throw new Error("交換する写真と枚数を確認してください");
      if (give) item.count -= give;
      if (receive) {
        item.count = Math.max(0, item.count - receive);
        incoming.push({ item, receive });
      }
      given += give;
      received += receive;
    }
    if (!given || !received) throw new Error("渡す写真ともらう写真をそれぞれ選んでください");
    for (const { item, receive } of incoming) {
      let owned = result.find((photo) => photo.inventory === "collection" && ["member", "series", "pose", "category"].every((key) => (photo[key] || "") === (item[key] || "")));
      if (!owned) {
        owned = { ...item, id: crypto.randomUUID(), inventory: "collection", count: 0 };
        result.push(owned);
      }
      owned.count = photoCount(owned) + receive;
      if (owned.count > 99999) throw new Error("枚数の上限を超えています");
    }
    return result;
  }

  // data/features.js
  var labels = {
    schedule: "スケジュール",
    tickets: "応募・チケット",
    goods: "グッズ管理",
    photos: "生写真コレクション",
    lives: "ライブ参戦記録",
    reports: "ミーグリレポ",
    money: "推し活家計簿",
    todos: "推し活ToDo",
    places: "推し活マップ",
    milestones: "メンバー別記念日"
  };
  var collections = Object.keys(labels);
  var members = [
    { name: "遠藤光莉", kana: "えんどうひかり", birthday: "1999-04-17" },
    { name: "大園玲", kana: "おおぞのれい", birthday: "2000-04-18" },
    { name: "大沼晶保", kana: "おおぬまあきほ", birthday: "1999-10-12" },
    { name: "幸阪茉里乃", kana: "こうさかまりの", birthday: "2002-12-19" },
    { name: "田村保乃", kana: "たむらほの", birthday: "1998-10-21" },
    { name: "藤吉夏鈴", kana: "ふじよしかりん", birthday: "2001-08-29" },
    { name: "松田里奈", kana: "まつだりな", birthday: "1999-10-13" },
    { name: "森田ひかる", kana: "もりたひかる", birthday: "2001-07-10" },
    { name: "守屋麗奈", kana: "もりやれな", birthday: "2000-01-02" },
    { name: "山﨑天", kana: "やまさきてん", birthday: "2005-09-28" },
    { name: "石森璃花", kana: "いしもりりか", birthday: "2002-01-13" },
    { name: "遠藤理子", kana: "えんどうりこ", birthday: "2006-01-09" },
    { name: "小田倉麗奈", kana: "おだくられいな", birthday: "2004-07-25" },
    { name: "小島凪紗", kana: "こじまなぎさ", birthday: "2005-07-07" },
    { name: "谷口愛季", kana: "たにぐちあいり", birthday: "2005-04-12" },
    { name: "中嶋優月", kana: "なかしまゆづき", birthday: "2003-02-17" },
    { name: "的野美青", kana: "まとのみお", birthday: "2006-11-08" },
    { name: "向井純葉", kana: "むかいいとは", birthday: "2006-05-09" },
    { name: "村井優", kana: "むらいゆう", birthday: "2004-08-18" },
    { name: "村山美羽", kana: "むらやまみう", birthday: "2005-02-15" },
    { name: "山下瞳月", kana: "やましたしづき", birthday: "2005-01-22" },
    { name: "浅井恋乃未", kana: "あさいこのみ", birthday: "2004-12-22" },
    { name: "稲熊ひな", kana: "いなぐまひな", birthday: "2006-03-09" },
    { name: "勝又春", kana: "かつまたはる", birthday: "2004-01-24" },
    { name: "佐藤愛桜", kana: "さとうねお", birthday: "2006-12-01" },
    { name: "中川智尋", kana: "なかがわちひろ", birthday: "2007-09-16" },
    { name: "松本和子", kana: "まつもとわこ", birthday: "2005-02-06" },
    { name: "目黒陽色", kana: "めぐろひいろ", birthday: "2006-01-24" },
    { name: "山川宇衣", kana: "やまかわうい", birthday: "2005-09-19" },
    { name: "山田桃実", kana: "やまだももみ", birthday: "2008-07-20" }
  ];
  var forms = {
    milestones: {
      title: "記念日を追加",
      fields: [
        ["members", "メンバー（複数選択可）", "members", true],
        ["date", "記念日", "date", true],
        ["title", "タイトル", "text", true],
        ["note", "思い出・メモ", "textarea", false],
        ["photo", "思い出の画像（任意）", "file", false]
      ]
    },
    schedule: {
      title: "予定を追加",
      fields: [
        ["title", "予定名", "text", true],
        ["date", "日付", "date", true],
        ["time", "時刻（任意）", "time", false],
        [
          "type",
          "種類",
          "select",
          true,
          ["ライブ", "リアミ", "オンミ", "トレ", "テレビ", "ラジオ", "雑誌", "配信", "発売日", "その他"]
        ],
        ["place", "場所・メモ", "text", false]
      ]
    },
    tickets: {
      title: "応募を追加",
      fields: [
        ["title", "イベント・応募名", "text", true],
        ["date", "締切・入金期限", "date", true],
        [
          "status",
          "状況",
          "select",
          true,
          ["応募前", "申込済み", "当選", "落選", "入金済み"]
        ],
        ["note", "メモ", "text", false]
      ]
    },
    goods: {
      title: "グッズを追加",
      fields: [
        ["title", "グッズ名", "text", true],
        [
          "type",
          "種類",
          "select",
          true,
          ["ペンライト", "アクリルスタンド", "タオル", "CD・書籍", "その他"]
        ],
        ["status", "所持状況", "select", true, ["所持", "購入予定", "未所持"]],
        ["price", "価格（円）", "number", false],
        ["note", "メモ", "text", false]
      ]
    },
    photos: {
      title: "生写真を追加",
      fields: [
        ["member", "メンバー", "member", true],
        ["category", "分類", "select", true, ["公式ランダム", "CD封入"]],
        ["series", "シリーズ・衣装", "text", true],
        ["pose", "ポーズ・種類", "select", true, ["スワリ", "ヨリ", "チュウ", "ヒキ", "その他"]],
        ["count", "枚数", "number", true],
        ["photo", "写真画像（任意）", "file", false],
        ["note", "メモ", "text", false]
      ]
    },
    lives: {
      title: "ライブ参戦記録を追加",
      fields: [
        ["title", "公演名", "text", true],
        ["date", "参加日", "date", true],
        ["venue", "会場", "text", false],
        ["seat", "座席", "text", false],
        ["setlist", "セットリスト・印象に残った曲", "textarea", false],
        ["note", "感想・思い出", "textarea", false]
      ]
    },
    reports: {
      title: "ミーグリレポを書く",
      fields: [
        ["date", "参加日", "date", true],
        ["member", "メンバー", "member", true],
        ["title", "イベント名", "text", false],
        ["part", "部（例：5部）", "text", false],
        ["tickets", "使用枚数（任意）", "number", false],
        ["memberAvatar", "メンバーのアイコン（任意）", "file", false],
        ["selfAvatar", "自分のアイコン（任意）", "file", false],
        ["note", "感想・メモ", "textarea", false]
      ]
    },
    money: {
      title: "支出を追加",
      fields: [
        ["title", "内容", "text", true],
        ["date", "日付", "date", true],
        ["amount", "金額（円）", "number", true],
        [
          "type",
          "カテゴリ",
          "select",
          true,
          ["チケット", "グッズ", "遠征", "CD・書籍", "その他"]
        ]
      ]
    },
    todos: {
      title: "ToDoを追加",
      fields: [
        ["title", "やること", "text", true],
        ["date", "期限", "date", false]
      ]
    },
    places: {
      title: "スポットを追加",
      fields: [
        ["title", "スポット名", "text", true],
        [
          "type",
          "種類",
          "select",
          true,
          ["ライブ会場", "聖地巡礼", "お店", "その他"]
        ],
        ["address", "住所・エリア", "text", false],
        ["url", "地図リンク", "url", false],
        ["note", "メモ", "textarea", false]
      ]
    }
  };

  // js/storage.js
  var STORAGE_KEY = "oshi-note-v1";
  var stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    stored = {};
  }
  var db = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  if (!Array.isArray(db.trades)) db.trades = [];
  for (const name of collections) {
    if (!Array.isArray(db[name])) {
      db[name] = [];
    }
  }
  if (!db.profile || typeof db.profile !== "object" || Array.isArray(db.profile)) {
    db.profile = {
      name: "推しメンバー",
      group: "櫻坂46",
      birthday: "",
      anniversary: ""
    };
  }
  db.profile.group = "櫻坂46";
  if (!db.profile.anniversary) {
    db.profile.anniversary = "";
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }
  if (db.profile.members != null && !Array.isArray(db.profile.members)) delete db.profile.members;
  db.photos = migratePhotos(db.photos);
  function imageInUse(id) {
    return [...db.photos, ...db.milestones].some((item) => String(item.imageId || item.id) === String(id)) || db.reports.some((item) => [item.memberAvatarId, item.selfAvatarId, ...(item.messages || []).map((message) => message.imageId)].includes(id));
  }

  // js/photoStorage.js
  var DB_NAME = "sakurazaka-oshi-note-photos";
  var STORE_NAME = "photos";
  var databasePromise;
  var urls = /* @__PURE__ */ new Map();
  function openDatabase() {
    if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return databasePromise;
  }
  async function savePhoto(id, file) {
    const database = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(file, String(id));
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    const oldURL = urls.get(String(id));
    if (oldURL) URL.revokeObjectURL(oldURL);
    urls.delete(String(id));
  }
  async function getPhotoURL(id) {
    const key = String(id);
    if (urls.has(key)) return urls.get(key);
    const database = await openDatabase();
    const file = await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME).objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!file) return "";
    const url = URL.createObjectURL(file);
    urls.set(key, url);
    return url;
  }
  async function deletePhoto(id) {
    const key = String(id);
    const oldURL = urls.get(key);
    if (oldURL) URL.revokeObjectURL(oldURL);
    urls.delete(key);
    const database = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // js/reports.js
  function reportImageIds(item) {
    return [item.memberAvatarId, item.selfAvatarId, ...(item.messages || []).map((message) => message.imageId)].filter(Boolean);
  }
  function createReportEditor(box, item) {
    const editor = document.createElement("div");
    editor.className = "field full conversation-editor";
    const heading = document.createElement("h4");
    heading.textContent = "会話の順番";
    const hint = document.createElement("p");
    hint.className = "field-hint";
    hint.textContent = "発言・動作メモ・画像を順番に追加できます。矢印で順番を変更できます。";
    const list = document.createElement("div");
    list.className = "conversation-lines";
    const toolbar = document.createElement("div");
    toolbar.className = "conversation-toolbar";
    const blocks = [];
    function update() {
      blocks.forEach((block, index) => {
        block.up.disabled = index === 0;
        block.down.disabled = index === blocks.length - 1;
        list.append(block.element);
      });
    }
    function add(kind, value = {}) {
      const element = document.createElement("fieldset");
      element.className = "conversation-block";
      const legend = document.createElement("legend");
      legend.textContent = { member: "メンバーの発言", self: "自分の発言", note: "動作・メモ", image: "途中の画像" }[kind];
      const input = document.createElement(kind === "image" ? "input" : "textarea");
      input.setAttribute("aria-label", legend.textContent);
      input.dataset.messageInput = kind;
      if (kind === "image") {
        input.type = "file";
        input.accept = "image/*";
        input.required = !value.imageId;
      } else {
        input.value = value.text || "";
        input.rows = 2;
        input.placeholder = kind === "note" ? "（用紙を出す）など" : "会話を入力";
      }
      const actions = document.createElement("div");
      actions.className = "conversation-toolbar";
      const block = { kind, value, element, input };
      for (const [label, action] of [["↑", -1], ["↓", 1], ["削除", 0]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary";
        button.textContent = label;
        button.setAttribute("aria-label", action === -1 ? "この会話を上へ" : action === 1 ? "この会話を下へ" : "この会話を削除");
        if (action === -1) block.up = button;
        if (action === 1) block.down = button;
        button.onclick = () => {
          const index = blocks.indexOf(block);
          if (!action) {
            blocks.splice(index, 1);
            element.remove();
          } else {
            const target = index + action;
            if (target < 0 || target >= blocks.length) return;
            [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
          }
          update();
        };
        actions.append(button);
      }
      element.append(legend, input);
      if (kind === "image" && value.imageId) {
        const image = document.createElement("img");
        image.className = "editor-image";
        image.alt = "現在の会話画像";
        getPhotoURL(value.imageId).then((url) => {
          if (url) image.src = url;
        }).catch(() => {
        });
        element.append(image);
      }
      element.append(actions);
      blocks.push(block);
      update();
    }
    for (const [kind, label] of [["member", "＋ メンバー"], ["self", "＋ 自分"], ["note", "＋ 動作メモ"], ["image", "＋ 画像"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary";
      button.textContent = label;
      button.dataset.addMessage = kind;
      button.onclick = () => add(kind);
      toolbar.append(button);
    }
    editor.append(heading, hint, list, toolbar);
    box.append(editor);
    (item.messages || []).forEach((message) => add(message.kind, message));
    return blocks;
  }
  async function prepareReport(item, form, blocks, created) {
    item.messages = [];
    async function store(file) {
      if (!file.type.startsWith("image/")) throw new Error("画像ファイルを選んでください");
      const id = `image-${crypto.randomUUID()}`;
      created.push(id);
      await savePhoto(id, file);
      return id;
    }
    for (const name of ["memberAvatar", "selfAvatar"]) {
      const file = form.elements[name].files[0];
      delete item[name];
      if (file) item[`${name}Id`] = await store(file);
    }
    for (const block of blocks) {
      if (block.kind === "image") {
        const file = block.input.files[0];
        const imageId = file ? await store(file) : block.value.imageId;
        if (imageId) item.messages.push({ kind: "image", imageId });
      } else if (block.input.value.trim()) item.messages.push({ kind: block.kind, text: block.input.value.trim() });
    }
  }
  var avatar = (id, name, large = false) => `<span class="report-avatar ${large ? "large" : ""}" ${id ? `data-report-image="${escapeHtml(id)}"` : ""}>${escapeHtml(name.slice(0, 1))}</span>`;
  function reportCard(item, index) {
    const messages = (item.messages || []).map((message) => {
      if (message.kind === "image") return `<div class="report-inline-image" data-report-image="${escapeHtml(message.imageId)}"></div>`;
      if (message.kind === "note") return `<p class="report-stage">${escapeHtml(message.text)}</p>`;
      const self = message.kind === "self";
      return `<div class="report-message ${self ? "from-self" : ""}">${avatar(self ? item.selfAvatarId : item.memberAvatarId, self ? "自分" : item.member)}<div class="report-bubble"><span class="sr-only">${self ? "自分" : escapeHtml(item.member)}：</span>${escapeHtml(message.text)}</div></div>`;
    }).join("");
    return `<article class="report-card"><header class="report-header">${avatar(item.memberAvatarId, item.member, true)}<h3>${escapeHtml(item.member)}</h3><time>${escapeHtml(item.date)}</time><div>${escapeHtml(item.part || "")}${item.tickets ? ` · ${escapeHtml(item.tickets)}枚` : ""}</div>${item.title ? `<p>${escapeHtml(item.title)}</p>` : ""}</header><div class="report-conversation">${messages}</div>${item.note ? `<div class="report-memo"><strong>${messages ? "感想・メモ" : "レポ"}</strong><p>${escapeHtml(item.note)}</p></div>` : ""}<footer class="report-actions"><button class="subtle" data-edit-report="${index}">編集</button><button class="subtle" data-create-milestone="reports" data-index="${index}">記念日に追加</button><button class="del" data-delete="reports" data-index="${index}">削除</button></footer></article>`;
  }
  function loadReportImages(container) {
    container.querySelectorAll("[data-report-image]").forEach(async (element) => {
      try {
        const url = await getPhotoURL(element.dataset.reportImage);
        if (url && element.isConnected) {
          const image = new Image();
          image.src = url;
          image.alt = element.classList.contains("report-avatar") ? "プロフィール画像" : "会話中の画像";
          element.replaceChildren(image);
        }
      } catch {
        if (element.isConnected) element.textContent = "画像を読み込めませんでした";
      }
    });
  }

  // js/ui.js
  var $ = (selector) => document.querySelector(selector);
  var escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var toastTimer;
  function toast(message) {
    $("#toast").textContent = message;
    $("#toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 2500);
  }
  function go(page, update = render) {
    document.querySelectorAll(".section").forEach((el) => el.classList.toggle("active", el.id === `page-${page}`));
    document.querySelectorAll("[data-page]").forEach((el) => el.classList.toggle("active", el.dataset.page === page));
    $("#crumb").textContent = labels[page] || (page === "home" ? "ホーム" : "メンバー別記念日");
    $("#sidebar").classList.remove("open");
    update();
  }
  var photoView = "owned";
  function setPhotoView(view) {
    photoView = view;
    ["#photoMember", "#photoSeries", "#photoCategory"].forEach((selector) => {
      $(selector).value = "";
    });
    $('[data-search="photos"]').value = "";
    render();
  }
  var empty = (message) => `<div class="empty">${escapeHtml(message)}</div>`;
  function options(selector, values, placeholder) {
    const select = $(selector);
    const previous = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>` + [...new Set(values)].filter(Boolean).map((value) => `<option>${escapeHtml(value)}</option>`).join("");
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  }
  function renderPhotos() {
    options("#photoMember", [...members.map((member) => member.name), ...db.photos.map((item) => item.member)], "すべてのメンバー");
    options("#photoSeries", db.photos.filter((item) => item.inventory === (photoView === "owned" ? "collection" : photoView)).map((item) => item.series), "すべてのシリーズ");
    const query = $('[data-search="photos"]').value.trim().toLowerCase();
    const items = db.photos.filter((item) => {
      const count = photoCount(item);
      return item.inventory === (photoView === "owned" ? "collection" : photoView) && (!$("#photoMember").value || item.member === $("#photoMember").value) && (!$("#photoSeries").value || item.series === $("#photoSeries").value) && (!$("#photoCategory").value || item.category === $("#photoCategory").value) && [item.member, item.series, item.pose, item.note].some((value) => String(value || "").toLowerCase().includes(query));
    });
    const inventory = photoView === "owned" ? "collection" : photoView;
    const all = db.photos.filter((item) => item.inventory === inventory);
    const title = { collection: "コレクション", offer: "提供用", want: "希望" }[inventory];
    $("#photoSummary").textContent = `${title}：${all.length}件`;
    document.querySelectorAll('[data-add="photos"]:not([data-wish])').forEach((button) => {
      button.textContent = `＋ ${title}を登録`;
    });
    document.querySelectorAll("[data-photo-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.photoView === photoView);
      button.setAttribute("aria-pressed", String(button.dataset.photoView === photoView));
    });
    $("#tradeHistory").innerHTML = db.trades.map((trade) => `<div class="data-row"><div><strong>${escapeHtml(new Date(trade.date).toLocaleString("ja-JP"))}</strong>${trade.lines.map((line) => `<p>${escapeHtml(line.member)} / ${escapeHtml(line.series)} / ${escapeHtml(line.pose || "")}：渡した ${line.give}枚・受け取った ${line.receive}枚</p>`).join("")}</div></div>`).join("") || empty("まだ交換の記録がありません");
    $("#photoResults").textContent = `${items.length}種類を表示`;
    const list = $("#list-photos");
    list.innerHTML = items.length ? items.map((item) => {
      const index = db.photos.indexOf(item);
      const count = photoCount(item);
      return `<article class="photo-card ${count === 0 ? "unowned" : ""}">
      <div class="photo-image" data-photo-id="${escapeHtml(item.imageId || item.id)}"><span>画像なし</span></div>
      <div class="photo-info"><span class="tag">${escapeHtml(item.category || "分類未設定")}</span>
      <h3>${escapeHtml(item.member)}</h3><p>${escapeHtml(item.series)}</p><p>${escapeHtml(item.pose || "ポーズ未設定")}</p>
      ${item.note ? `<p class="photo-note">${escapeHtml(item.note)}</p>` : ""}
      <div class="photo-counter"><button type="button" data-count="${index}" data-delta="-1" aria-label="${escapeHtml(item.member + " " + item.pose)}の所持枚数を減らす" ${count === 0 ? "disabled" : ""}>−</button><strong>${count}枚</strong><button type="button" data-count="${index}" data-delta="1" aria-label="${escapeHtml(item.member + " " + item.pose)}の所持枚数を増やす">＋</button></div>
      <div class="photo-actions"><button class="subtle" data-edit-photo="${index}">編集</button><button class="del" data-delete="photos" data-index="${index}">削除</button></div></div></article>`;
    }).join("") : empty(db.photos.length ? "条件に合う生写真がありません。" : "生写真は未登録です。画像・メンバー・シリーズ・枚数を登録できます。");
    list.querySelectorAll("[data-photo-id]").forEach(async (element) => {
      try {
        const url = await getPhotoURL(element.dataset.photoId);
        if (url && element.isConnected) {
          const image = new Image();
          image.src = url;
          image.alt = "登録した生写真";
          element.replaceChildren(image);
        }
      } catch {
        if (element.isConnected) element.textContent = "画像を読み込めませんでした";
      }
    });
  }
  function rows(collection, items) {
    return items.map((item) => `<div class="data-row"><div class="data-main"><strong>${escapeHtml(item.title || item.member || "")}</strong><small>${escapeHtml([item.date, collection === "schedule" ? item.time : "", item.type, item.status, item.venue, item.note, item.amount ? `¥${Number(item.amount).toLocaleString()}` : ""].filter(Boolean).join(" / "))}</small></div>${["reports", "lives"].includes(collection) ? `<button class="subtle" data-create-milestone="${collection}" data-index="${db[collection].indexOf(item)}">記念日に追加</button>` : ""}${collection === "todos" ? `<input type="checkbox" aria-label="完了" data-done="${item.id}" ${item.done ? "checked" : ""}>` : ""}<button class="del" data-delete="${collection}" data-index="${db[collection].indexOf(item)}">削除</button></div>`).join("") || empty("まだ記録がありません");
  }
  function render() {
    renderPhotos();
    for (const collection of Object.keys(labels).filter((name) => !["photos", "milestones", "reports"].includes(name))) {
      const query = $(`[data-search="${collection}"]`)?.value.toLowerCase() || "";
      const filter = $(`[data-filter="${collection}"]`)?.value || "";
      $(`#list-${collection}`).innerHTML = rows(collection, db[collection].filter((item) => Object.values(item).join(" ").toLowerCase().includes(query) && (!filter || item.type === filter || item.status === filter)));
    }
    const today = /* @__PURE__ */ new Date();
    const date = new Date(today.getTime() - today.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    const upcoming = db.schedule.filter((item) => item.date >= date).sort((a, b) => a.date.localeCompare(b.date) || (a.time || "99:99").localeCompare(b.time || "99:99"));
    $("#homeEvents").innerHTML = rows("schedule", upcoming.slice(0, 5));
    $("#homeTodos").innerHTML = rows("todos", db.todos.filter((item) => !item.done).slice(0, 5));
    $("#homeReports").innerHTML = rows("reports", db.reports.slice(0, 3));
    $("#statEvents").textContent = `${upcoming.filter((item) => new Date(item.date) < end).length}件`;
    $("#statDeadlines").textContent = `${db.tickets.filter((item) => item.date >= date && !["落選", "入金済み"].includes(item.status)).length}件`;
    $("#statReports").textContent = `${db.reports.length}件`;
    const spend = db.money.filter((item) => item.date?.startsWith(date.slice(0, 7))).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    $("#moneyTotal").textContent = $("#statSpend").textContent = `¥${spend.toLocaleString()}`;
    const favorites = (db.profile.members || [db.profile.name]).map((name) => members.find((member) => member.name === name)).filter(Boolean);
    $("#profileName").textContent = favorites.length ? favorites.map((member) => member.name).join("・") : "推しメンバー";
    $("#profileGroup").textContent = db.profile.group;
    $("#favoriteDays").innerHTML = favorites.map((member) => {
      const start = db.profile.startDates?.[member.name];
      const days = supportingDays(start);
      return `<div class="favorite-days"><span>${escapeHtml(member.name)}</span><strong>${days == null ? "推し始めた日：未登録" : `推して${days.toLocaleString()}日目`}</strong>${days == null ? "" : `<small>${escapeHtml(start.replaceAll("-", "/"))}から</small>`}</div>`;
    }).join("");
    $("#profileBirthdayText").textContent = favorites.length ? favorites.map((member) => `${member.name} ${member.birthday.slice(5).replace("-", "/")}`).join(" / ") : "未登録";
    $("#birthdayText").textContent = favorites.length ? favorites.map((member) => {
      const birthday = new Date(today.getFullYear(), Number(member.birthday.slice(5, 7)) - 1, Number(member.birthday.slice(8, 10)));
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (birthday < start) birthday.setFullYear(birthday.getFullYear() + 1);
      return `${member.name} あと${Math.round((birthday - start) / 864e5)}日`;
    }).join(" / ") : "未登録";
    const reportQuery = $('[data-search="reports"]').value.trim().toLowerCase();
    $("#list-reports").innerHTML = db.reports.filter((item) => [item.member, item.title, item.note, item.part, ...(item.messages || []).map((message) => message.text || "")].join(" ").toLowerCase().includes(reportQuery)).map((item) => reportCard(item, db.reports.indexOf(item))).join("") || empty("レポは未登録です");
    loadReportImages($("#list-reports"));
    renderMilestones();
  }
  function loadImages(container) {
    container.querySelectorAll("[data-memory-image]").forEach(async (element) => {
      try {
        const url = await getPhotoURL(element.dataset.memoryImage);
        if (url && element.isConnected) {
          const image = new Image();
          image.src = url;
          image.alt = "記念日の写真";
          element.replaceChildren(image);
        }
      } catch {
        if (element.isConnected) element.textContent = "画像を読み込めませんでした";
      }
    });
  }
  function milestoneCard(item, compact = false) {
    const index = db.milestones.indexOf(item);
    return `<article class="milestone-card"><time>${escapeHtml(item.date)}</time><h3>${escapeHtml(item.title)}</h3><p class="tag">${escapeHtml((item.members || []).join("・"))}</p><p class="anniversary">${escapeHtml(anniversaryInfo(item.date))}</p>${!compact && item.note ? `<p class="memory-note">${escapeHtml(item.note)}</p>` : ""}${!compact && item.imageId ? `<div class="memory-image" data-memory-image="${escapeHtml(item.imageId)}"></div>` : ""}<div class="photo-actions"><button class="subtle" data-edit-milestone="${index}">編集</button><button class="del" data-delete="milestones" data-index="${index}">削除</button></div></article>`;
  }
  function renderMilestones() {
    options("#milestoneMember", [...members.map((member) => member.name), ...db.milestones.flatMap((item) => item.members || [])], "すべてのメンバー");
    const query = $('[data-search="milestones"]').value.trim().toLowerCase();
    const filter = $("#milestoneMember").value;
    const items = [...db.milestones].sort((a, b) => b.date.localeCompare(a.date));
    $("#list-milestones").innerHTML = items.filter((item) => (!filter || (item.members || []).includes(filter)) && [item.title, item.note, ...item.members || []].join(" ").toLowerCase().includes(query)).map((item) => milestoneCard(item)).join("") || empty("記念日は未登録です");
    const favorites = db.profile.members || [db.profile.name];
    const home = items.filter((item) => (item.members || []).some((member) => favorites.includes(member))).sort((a, b) => {
      const aDays = daysToAnniversary(a.date), bDays = daysToAnniversary(b.date);
      return (aDays <= 30 ? aDays : Infinity) - (bDays <= 30 ? bDays : Infinity) || b.date.localeCompare(a.date);
    });
    $("#homeMilestones").innerHTML = home.slice(0, 3).map((item) => milestoneCard(item, true)).join("") || empty("推しメンの記念日を登録すると表示されます");
    loadImages($("#list-milestones"));
  }

  // js/appearance.js
  function initAppearance() {
    const modal = $("#appearanceModal"), form = $("#appearanceForm");
    const fileInput = $("#backgroundFile"), wash = $("#backgroundWash");
    const preview = $("#backgroundPreview");
    let temporaryURL = "", busy = false, generation = 0;
    const setPreview = (url) => {
      preview.style.backgroundImage = url ? `url("${url}")` : "none";
      preview.classList.toggle("has-image", !!url);
    };
    const updateWash = () => {
      $("#backgroundWashValue").textContent = `${wash.value}%`;
      preview.style.setProperty("--preview-wash", Number(wash.value) / 100);
    };
    function releasePreview() {
      if (temporaryURL) URL.revokeObjectURL(temporaryURL);
      temporaryURL = "";
    }
    async function apply() {
      const current = ++generation;
      const settings = db.appearance || {};
      document.body.style.setProperty("--background-wash", (settings.wash ?? 80) / 100);
      if (!settings.backgroundId) {
        document.body.style.removeProperty("--user-background");
        document.body.classList.remove("has-custom-background");
        return;
      }
      try {
        const url = await getPhotoURL(settings.backgroundId);
        if (current !== generation) return;
        if (!url) throw new Error();
        document.body.style.setProperty("--user-background", `url("${url}")`);
        document.body.classList.add("has-custom-background");
      } catch {
        toast("背景画像を読み込めませんでした。背景の設定から選び直せます");
      }
    }
    $("#appearanceBtn").onclick = async () => {
      form.reset();
      releasePreview();
      setPreview("");
      wash.value = db.appearance?.wash ?? 80;
      updateWash();
      $("#removeBackground").disabled = !db.appearance?.backgroundId;
      modal.classList.add("open");
      if (db.appearance?.backgroundId) {
        try {
          const url = await getPhotoURL(db.appearance.backgroundId);
          if (modal.classList.contains("open") && !fileInput.files.length) setPreview(url);
        } catch {
          toast("背景画像を読み込めませんでした");
        }
      }
    };
    const close = () => {
      if (!busy) {
        modal.classList.remove("open");
        releasePreview();
      }
    };
    $("#cancelAppearance").onclick = close;
    modal.onclick = (event) => {
      if (event.target === modal) close();
    };
    fileInput.onchange = () => {
      releasePreview();
      const file = fileInput.files[0];
      if (file && !file.type.startsWith("image/")) {
        fileInput.value = "";
        toast("画像ファイルを選んでください");
        return;
      }
      if (file) {
        temporaryURL = URL.createObjectURL(file);
        setPreview(temporaryURL);
      }
    };
    wash.oninput = updateWash;
    const setBusy = (value) => {
      busy = value;
      form.querySelectorAll("button,input").forEach((element) => {
        element.disabled = value;
      });
      if (!value) $("#removeBackground").disabled = !db.appearance?.backgroundId;
    };
    form.onsubmit = async (event) => {
      event.preventDefault();
      if (busy) return;
      const file = fileInput.files[0], previous = db.appearance;
      if (!file && !previous?.backgroundId) {
        toast("背景にする画像を選んでください");
        return;
      }
      let newId;
      setBusy(true);
      try {
        if (file) {
          if (!file.type.startsWith("image/")) throw new Error();
          const image = new Image();
          image.src = temporaryURL;
          await image.decode();
          newId = `background-${crypto.randomUUID()}`;
          await savePhoto(newId, file);
        }
        db.appearance = { backgroundId: newId || previous.backgroundId, wash: Number(wash.value) };
        try {
          save();
        } catch (error) {
          db.appearance = previous;
          throw error;
        }
        await apply();
        modal.classList.remove("open");
        releasePreview();
        if (newId && previous?.backgroundId) deletePhoto(previous.backgroundId).catch(() => {
        });
        toast("背景を保存しました");
      } catch {
        if (newId) deletePhoto(newId).catch(() => {
        });
        toast("背景を保存できませんでした。画像と空き容量を確認してください");
      } finally {
        setBusy(false);
      }
    };
    $("#removeBackground").onclick = async () => {
      if (busy) return;
      const previous = db.appearance;
      db.appearance = { wash: previous?.wash ?? 80 };
      try {
        save();
      } catch {
        db.appearance = previous;
        toast("背景の解除を保存できませんでした");
        return;
      }
      setBusy(true);
      await apply();
      modal.classList.remove("open");
      releasePreview();
      if (previous?.backgroundId) deletePhoto(previous.backgroundId).catch(() => {
      });
      setBusy(false);
      toast("背景を解除しました");
    };
    apply();
  }

  // js/memberAutocomplete.js
  function normalize(value) {
    return value.trim().replace(
      /[ァ-ン]/g,
      (char) => String.fromCharCode(char.charCodeAt(0) - 96)
    ).toLowerCase();
  }
  function isMember(value) {
    return members.some((member) => member.name === value);
  }
  function attachMemberAutocomplete(input) {
    if (!input || input.dataset.autocompleteReady) return;
    input.dataset.autocompleteReady = "true";
    input.autocomplete = "off";
    input.placeholder = "メンバー名を入力（例：た）";
    input.setAttribute("aria-autocomplete", "list");
    const picker = document.createElement("div");
    picker.className = "member-picker";
    input.parentNode.insertBefore(picker, input);
    picker.append(input);
    const list = document.createElement("div");
    list.className = "member-suggestions";
    list.hidden = true;
    picker.append(list);
    let activeIndex = -1;
    function closeSuggestions() {
      list.hidden = true;
      activeIndex = -1;
    }
    function chooseMember(member) {
      input.value = member.name;
      input.dataset.memberSelected = "true";
      closeSuggestions();
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function showMatches() {
      const query = normalize(input.value);
      input.dataset.memberSelected = String(isMember(input.value));
      if (!query) {
        closeSuggestions();
        return;
      }
      const matches = members.filter((member) => {
        return normalize(member.name).includes(query) || normalize(member.kana).includes(query);
      }).slice(0, 8);
      list.replaceChildren();
      if (matches.length === 0) {
        closeSuggestions();
        return;
      }
      matches.forEach((member, index) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "member-suggestion";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        const name = document.createElement("strong");
        name.textContent = member.name;
        const kana = document.createElement("small");
        kana.textContent = member.kana;
        option.append(name, kana);
        option.addEventListener("mousedown", (event) => {
          event.preventDefault();
        });
        option.addEventListener("click", () => {
          chooseMember(member);
        });
        list.append(option);
        if (index === activeIndex) {
          option.classList.add("active");
        }
      });
      list.hidden = false;
    }
    input.addEventListener("input", showMatches);
    input.addEventListener("focus", showMatches);
    input.addEventListener("blur", () => {
      setTimeout(closeSuggestions, 120);
    });
    input.addEventListener("keydown", (event) => {
      const options2 = [...list.querySelectorAll(".member-suggestion")];
      if (list.hidden || options2.length === 0) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        activeIndex = (activeIndex + direction + options2.length) % options2.length;
        options2.forEach((option, index) => {
          const isActive = index === activeIndex;
          option.classList.toggle("active", isActive);
          option.setAttribute("aria-selected", String(isActive));
        });
      } else if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        const selectedName = options2[activeIndex].querySelector("strong").textContent;
        const member = members.find((item) => item.name === selectedName);
        if (member) {
          chooseMember(member);
        }
      } else if (event.key === "Escape") {
        closeSuggestions();
      }
    });
  }

  // js/forms.js
  function initForms() {
    let collection = "", editing = null, busy = false, conversation = [];
    function open(name, item = null, defaults = {}) {
      if (!forms[name]) return;
      collection = name;
      editing = item;
      const values = item || defaults;
      $("#itemForm").dataset.inventory = item?.inventory || defaults.inventory || (photoView === "owned" ? "collection" : photoView);
      $("#modalTitle").textContent = item ? `${name === "photos" ? "生写真" : name === "reports" ? "ミーグリレポ" : "記念日"}を編集` : forms[name].title;
      if (name === "photos") $("#modalTitle").textContent = `${{ "collection": "コレクション", "offer": "提供用", "want": "希望" }[$("#itemForm").dataset.inventory]}を${item ? "編集" : "登録"}`;
      const box = $("#formFields");
      box.replaceChildren();
      for (const [key, label, kind, required, choices] of forms[name].fields) {
        const wrap = document.createElement("div");
        wrap.className = "field" + (["textarea", "members"].includes(kind) ? " full" : "");
        if (kind === "members") {
          const fieldset = document.createElement("fieldset");
          fieldset.className = "member-checkboxes";
          const legend = document.createElement("legend");
          legend.textContent = label;
          fieldset.append(legend);
          for (const member of members) {
            const row = document.createElement("label"), input2 = document.createElement("input");
            input2.type = "checkbox";
            input2.name = key;
            input2.value = member.name;
            input2.checked = (values.members || []).includes(member.name);
            row.append(input2, document.createTextNode(member.name));
            fieldset.append(row);
          }
          wrap.append(fieldset);
          box.append(wrap);
          continue;
        }
        const input = document.createElement(kind === "select" ? "select" : kind === "textarea" ? "textarea" : "input");
        if (kind === "select") for (const choice of choices) {
          const option = document.createElement("option");
          option.textContent = choice;
          input.append(option);
        }
        else if (kind !== "textarea") input.type = kind === "member" ? "text" : kind;
        input.id = `field-${key}`;
        input.name = key;
        input.required = required;
        if (kind === "file") input.accept = "image/*";
        else if (kind === "date") {
          const date = /* @__PURE__ */ new Date();
          input.value = values[key] || new Date(date.getTime() - date.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
        } else input.value = values[key] ?? (kind === "select" ? choices[0] : "");
        if (name === "reports" && key === "tickets") {
          input.min = "1";
          input.max = "9999";
          input.step = "1";
        }
        if (name === "photos" && key === "count") {
          input.min = "0";
          input.max = "99999";
          input.step = "1";
          input.value = item ? photoCount(item) : defaults.count ?? 1;
        }
        const caption = document.createElement("label");
        caption.htmlFor = input.id;
        caption.textContent = label + (required ? " *" : "");
        wrap.append(caption, input);
        if (key === "photo" && name === "photos") {
          const preview = document.createElement("img");
          preview.className = "editor-image";
          preview.alt = "登録する生写真";
          preview.hidden = true;
          if (item) getPhotoURL(item.imageId || item.id).then((url) => {
            if (url && preview.isConnected && !input.files.length) {
              preview.src = url;
              preview.hidden = false;
            }
          }).catch(() => {
          });
          let temporaryURL;
          input.addEventListener("change", () => {
            if (temporaryURL) URL.revokeObjectURL(temporaryURL);
            const file = input.files[0];
            if (file) {
              temporaryURL = URL.createObjectURL(file);
              preview.src = temporaryURL;
              preview.hidden = false;
              preview.onload = () => URL.revokeObjectURL(temporaryURL);
            }
          });
          wrap.append(preview);
        }
        if (key === "photo" && item) {
          const hint = document.createElement("small");
          hint.textContent = "画像を選ばなければ現在の画像を保持します";
          wrap.append(hint);
        }
        if (name === "photos" && key === "pose") {
          const custom = document.createElement("input");
          custom.type = "text";
          custom.name = "customPose";
          custom.id = "field-customPose";
          custom.placeholder = "例外のポーズ・種類を入力";
          const customLabel = document.createElement("label");
          customLabel.htmlFor = custom.id;
          customLabel.textContent = "その他のポーズ・種類 *";
          const known = choices.slice(0, -1);
          if (values.pose && !known.includes(values.pose)) {
            input.value = "その他";
            custom.value = values.pose;
          }
          const updateCustom = () => {
            const show = input.value === "その他";
            custom.hidden = customLabel.hidden = !show;
            custom.disabled = !show;
            custom.required = show;
          };
          input.addEventListener("change", updateCustom);
          updateCustom();
          wrap.append(customLabel, custom);
        }
        box.append(wrap);
        if (kind === "member") attachMemberAutocomplete(input);
      }
      conversation = name === "reports" ? createReportEditor(box, values) : [];
      $("#modalWrap").classList.add("open");
    }
    document.body.addEventListener("click", (event) => {
      if (busy) return;
      const edit = event.target.closest("[data-edit-photo], [data-edit-milestone], [data-edit-report]");
      if (edit) {
        const name = edit.hasAttribute("data-edit-photo") ? "photos" : edit.hasAttribute("data-edit-report") ? "reports" : "milestones";
        open(name, db[name][Number(name === "photos" ? edit.dataset.editPhoto : name === "reports" ? edit.dataset.editReport : edit.dataset.editMilestone)]);
        return;
      }
      const source = event.target.closest("[data-create-milestone]");
      if (source) {
        const record = db[source.dataset.createMilestone][Number(source.dataset.index)];
        const linked = db.milestones.find((item) => item.sourceId === String(record.id) && item.sourceCollection === source.dataset.createMilestone);
        if (linked) {
          open("milestones", linked);
          return;
        }
        open("milestones", null, { title: record.title || "初ミーグリ", date: record.date, note: [record.note, ...(record.messages || []).map((message) => message.kind === "image" ? "（画像）" : `${message.kind === "member" ? record.member : message.kind === "self" ? "自分" : "メモ"}：${message.text}`)].filter(Boolean).join("\n"), members: record.member ? [record.member] : [], sourceId: String(record.id), sourceCollection: source.dataset.createMilestone });
        $("#itemForm").dataset.sourceId = String(record.id);
        $("#itemForm").dataset.sourceCollection = source.dataset.createMilestone;
        return;
      }
      const add = event.target.closest("[data-add]");
      if (add) {
        delete $("#itemForm").dataset.sourceId;
        delete $("#itemForm").dataset.sourceCollection;
        open(add.dataset.add, null, add.hasAttribute("data-wish") ? { inventory: "want", count: 1 } : {});
      }
    });
    const close = () => {
      if (!busy) $("#modalWrap").classList.remove("open");
    };
    $("#cancelBtn").onclick = close;
    $("#modalWrap").onclick = (event) => {
      if (event.target.id === "modalWrap") close();
    };
    $("#itemForm").onsubmit = async (event) => {
      event.preventDefault();
      if (busy || !collection) return;
      const form = event.currentTarget, data = new FormData(form);
      const item = { ...editing, ...Object.fromEntries(data.entries()), id: editing?.id ?? crypto.randomUUID() };
      const file = data.get("photo");
      delete item.photo;
      if (["photos", "reports"].includes(collection) && !isMember(item.member)) {
        toast("候補からメンバーを選んでください");
        return;
      }
      if (collection === "photos") {
        item.count = Number(item.count);
        if (!Number.isSafeInteger(item.count) || item.count < 0 || item.count > 99999) {
          toast("枚数は0〜99999の整数で入力してください");
          return;
        }
        item.inventory = form.dataset.inventory;
        delete item.offer;
        delete item.keep;
        delete item.want;
        if (item.pose === "その他") item.pose = (item.customPose || "").trim();
        delete item.customPose;
        if (!item.pose) {
          toast("ポーズ・種類を入力してください");
          return;
        }
        item.series = item.series.trim();
        if (!item.series) {
          toast("シリーズを入力してください");
          return;
        }
        item.status = item.count ? "所持" : "未所持";
      }
      if (collection === "milestones") {
        item.members = data.getAll("members");
        if (!item.members.length) {
          toast("メンバーを1人以上選んでください");
          return;
        }
        item.title = item.title.trim();
        if (!item.title) {
          toast("タイトルを入力してください");
          return;
        }
        if (!editing && form.dataset.sourceId) {
          item.sourceId = form.dataset.sourceId;
          item.sourceCollection = form.dataset.sourceCollection;
        }
      }
      if (file instanceof File && file.size && !file.type.startsWith("image/")) {
        toast("画像ファイルを選んでください");
        return;
      }
      busy = true;
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      const previous = [...db[collection]];
      let newImage, persisted = false;
      const reportImages = [];
      try {
        if (collection === "reports") await prepareReport(item, form, conversation, reportImages);
        if (file instanceof File && file.size) {
          newImage = `image-${crypto.randomUUID()}`;
          await savePhoto(newImage, file);
          item.imageId = newImage;
        }
        if (editing) db[collection].splice(db[collection].indexOf(editing), 1, item);
        else db[collection].unshift(item);
        try {
          save();
        } catch (error) {
          db[collection] = previous;
          throw error;
        }
        persisted = true;
        if (collection === "reports" && editing) reportImageIds(editing).filter((id) => !reportImageIds(item).includes(id)).forEach((id) => deletePhoto(id).catch(() => {
        }));
        if (newImage && editing) {
          const oldId = editing.imageId || editing.id;
          if (!imageInUse(oldId)) deletePhoto(oldId).catch(() => {
          });
        }
        const targetView = item.inventory === "collection" ? "owned" : item.inventory;
        if (collection === "photos" && targetView !== photoView) setPhotoView(targetView);
        else render();
        $("#modalWrap").classList.remove("open");
        form.reset();
        toast("保存しました");
      } catch {
        if (!persisted) reportImages.forEach((id) => deletePhoto(id).catch(() => {
        }));
        if (newImage && !persisted) deletePhoto(newImage).catch(() => {
        });
        toast("保存できませんでした。空き容量と画像を確認してください");
      } finally {
        busy = false;
        submit.disabled = false;
      }
    };
  }

  // js/trades.js
  function initTrades() {
    const modal = $("#tradeModal");
    $("#openTrade").onclick = () => {
      const candidates = db.photos.filter((item) => offerCount(item) || wantCount(item));
      $("#tradeLines").innerHTML = candidates.length ? candidates.map((item) => `<fieldset class="trade-line" data-trade-id="${escapeHtml(item.id)}"><legend>${escapeHtml(item.member)} / ${escapeHtml(item.series)} / ${escapeHtml(item.pose || "種類未設定")}</legend>
      <label>渡す（提供 ${offerCount(item)}枚）<input type="number" name="give" min="0" max="${offerCount(item)}" step="1" value="0" required></label>
      <label>もらう（希望 ${wantCount(item)}枚）<input type="number" name="receive" min="0" max="${item.inventory === "want" ? 99999 : 0}" step="1" value="0" required></label></fieldset>`).join("") : "<p>提供用と希望の一覧に写真を登録してください。</p>";
      modal.classList.add("open");
    };
    $("#cancelTrade").onclick = () => modal.classList.remove("open");
    modal.onclick = (event) => {
      if (event.target === modal) modal.classList.remove("open");
    };
    $("#tradeForm").onsubmit = (event) => {
      event.preventDefault();
      const lines = [...$("#tradeLines").querySelectorAll("[data-trade-id]")].map((row) => ({ id: row.dataset.tradeId, give: Number(row.querySelector('[name="give"]').value), receive: Number(row.querySelector('[name="receive"]').value) }));
      try {
        const photos = applyTrade(db.photos, lines);
        if (!confirm("交換を確定して所持・提供・希望の枚数を更新しますか？")) return;
        const previous = db.photos;
        const record = { id: crypto.randomUUID(), date: (/* @__PURE__ */ new Date()).toISOString(), lines: lines.filter((line) => line.give || line.receive).map((line) => {
          const photo = previous.find((item) => String(item.id) === line.id);
          return { ...line, member: photo.member, series: photo.series, pose: photo.pose };
        }) };
        db.photos = photos;
        db.trades.unshift(record);
        try {
          save();
        } catch (error) {
          db.photos = previous;
          db.trades.shift();
          throw new Error("交換を保存できませんでした。空き容量を確認してください");
        }
        modal.classList.remove("open");
        render();
        toast("交換を記録しました");
      } catch (error) {
        toast(error.message || "交換を保存できませんでした");
      }
    };
  }

  // js/main.js
  initForms();
  initTrades();
  initAppearance();
  $("#nav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (button) {
      go(button.dataset.page, render);
    }
  });
  document.body.addEventListener("click", (event) => {
    const target = event.target.closest("[data-go]");
    if (target) {
      go(target.dataset.go, render);
    }
    const view = event.target.closest("[data-photo-view]");
    if (view) setPhotoView(view.dataset.photoView);
    const counter = event.target.closest("[data-count]");
    if (counter) {
      const item = db.photos[Number(counter.dataset.count)];
      const previous = photoCount(item);
      const previousStatus = item.status;
      item.count = Math.min(99999, Math.max(0, previous + Number(counter.dataset.delta)));
      item.status = item.count > 0 ? "所持" : "未所持";
      try {
        save();
        render();
      } catch {
        item.count = previous;
        item.status = previousStatus;
        toast("保存できませんでした。空き容量を確認してください");
      }
    }
    const remove = event.target.closest("[data-delete]");
    if (remove) {
      const collection = remove.dataset.delete;
      if (!confirm("この記録を削除しますか？")) return;
      const index = Number(remove.dataset.index);
      const [deleted] = db[collection].splice(index, 1);
      try {
        save();
      } catch {
        db[collection].splice(index, 0, deleted);
        toast("削除を保存できませんでした");
        return;
      }
      if (collection === "reports" && deleted) reportImageIds(deleted).forEach((id) => deletePhoto(id).catch(() => {
      }));
      if (["photos", "milestones"].includes(collection) && deleted && !imageInUse(deleted.imageId || deleted.id)) deletePhoto(deleted.imageId || deleted.id).catch(() => {
      });
      render();
      toast("削除しました");
    }
  });
  $("#menuBtn").onclick = () => {
    $("#sidebar").classList.toggle("open");
  };
  $("#todayBtn").onclick = () => {
    go("home", render);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  document.body.addEventListener("change", (event) => {
    if (event.target.matches("[data-done]")) {
      const item = db.todos.find(
        (todo) => String(todo.id) === event.target.dataset.done
      );
      if (item) {
        item.done = event.target.checked;
      }
      save();
      render();
      toast("ToDoを完了にしました");
    }
    if (event.target.matches("[data-filter], [data-photo-filter]")) {
      render();
    }
  });
  document.body.addEventListener("input", (event) => {
    if (event.target.matches("[data-search]")) {
      render();
    }
  });
  var profileModal = $("#profileModal");
  var profileMembers = $("#profileMembers");
  $("#editProfile").onclick = () => {
    const selected = new Set(db.profile.members || (members.some((member) => member.name === db.profile.name) ? [db.profile.name] : []));
    profileMembers.replaceChildren();
    const legend = document.createElement("legend");
    legend.textContent = "推しメンを選択";
    profileMembers.append(legend);
    members.forEach((member) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "members";
      input.value = member.name;
      input.checked = selected.has(member.name);
      label.append(input, document.createTextNode(`${member.name}（${member.birthday.slice(5).replace("-", "/")}）`));
      const row = document.createElement("div");
      row.className = "favorite-row";
      const dateLabel = document.createElement("label");
      dateLabel.className = "favorite-date";
      dateLabel.append(document.createTextNode("推し始めた日"));
      const since = document.createElement("input");
      since.type = "date";
      since.dataset.favoriteSince = member.name;
      since.setAttribute("aria-label", `${member.name}を推し始めた日`);
      const today = /* @__PURE__ */ new Date();
      since.max = new Date(today.getTime() - today.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
      since.value = db.profile.startDates?.[member.name] || "";
      const update = () => {
        dateLabel.hidden = !input.checked;
        since.disabled = !input.checked;
      };
      input.addEventListener("change", update);
      update();
      dateLabel.append(since);
      row.append(label, dateLabel);
      profileMembers.append(row);
    });
    profileModal.classList.add("open");
    profileMembers.querySelector("input")?.focus();
  };
  $("#profileCancel").onclick = () => {
    profileModal.classList.remove("open");
  };
  profileModal.onclick = (event) => {
    if (event.target === profileModal) {
      profileModal.classList.remove("open");
    }
  };
  $("#profileForm").onsubmit = (event) => {
    event.preventDefault();
    const selected = [...profileMembers.querySelectorAll("input:checked")].map((input) => input.value);
    const startDates = { ...db.profile.startDates };
    for (const field of profileMembers.querySelectorAll("[data-favorite-since]:not(:disabled)")) {
      if (field.value && supportingDays(field.value) == null) {
        toast("推し始めた日は今日以前の日付を指定してください");
        return;
      }
      if (field.value) startDates[field.dataset.favoriteSince] = field.value;
      else delete startDates[field.dataset.favoriteSince];
    }
    const previous = db.profile;
    const first = members.find((member) => member.name === selected[0]);
    db.profile = { ...db.profile, members: selected, startDates, name: first?.name || "推しメンバー", birthday: first?.birthday || "", group: "櫻坂46" };
    try {
      save();
    } catch {
      db.profile = previous;
      toast("保存できませんでした");
      return;
    }
    render();
    profileModal.classList.remove("open");
    toast("推しメンを保存しました");
  };
  go("home");
})();
