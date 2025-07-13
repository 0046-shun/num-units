// Firebase初期化
const firebaseConfig = {
  apiKey: "AIzaSyC2bVMZtEmB1WW64MbslJHGbg4cHi6IIRI",
  authDomain: "num-units.firebaseapp.com",
  projectId: "num-units",
  storageBucket: "num-units.firebasestorage.app",
  messagingSenderId: "825037800365",
  appId: "1:825037800365:web:71f4717c8beeff18c0d724",
  measurementId: "G-T2Q60WE98P"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 商品リストを取得
let products = {};
fetch('products.json')
  .then(res => res.json())
  .then(data => { products = data; });

function toSeireki(wareki) {
  // 例: 13/07/17 → 2013/07/17
  const [yy, mm, dd] = wareki.split('/');
  const year = parseInt(yy, 10);
  const seireki = (year < 50 ? 2000 : 1900) + year;
  return `${seireki}/${mm}/${dd}`;
}

function extractRow(line) {
  // 半角・全角スペースで区切る
  const parts = line.trim().split(/[\s　]+/);
  console.log('分割されたパーツ:', parts);
  console.log('パーツ数:', parts.length);
  
  if (parts.length < 6) {
    console.log('パーツ数が6未満のためnullを返す');
    return null;
  }
  
  const no = parts[0];
  const date = toSeireki(parts[1]);
  // 営業所名は4番目（例：明石営業、岡山支店など）
  let office = parts[3].replace(/(営業|支店|文店)$/, '');
  const amount = parseInt(parts[4].replace(/,/g, ''), 10);
  // 商品名は5番目以降を結合
  const productFull = parts.slice(5).join(' ');
  
  console.log('伝票No:', no);
  console.log('日付:', date);
  console.log('営業所:', office);
  console.log('金額:', amount);
  console.log('商品名（フル）:', productFull);
  
  // 属性語リスト
  const attrWords = ['買換', '下取', '買取', '再消毒', '消毒', '施工', '工事', '費', '料', '再消', '新規予', '（消）', '機器'];
  // 最初に現れる属性語を補足に、そこまでを商品名に
  let product = productFull;
  let note = 'なし';
  for (const word of attrWords) {
    const idx = productFull.indexOf(word);
    if (idx !== -1) {
      product = productFull.slice(0, idx).trim();
      note = word;
      console.log('属性語「' + word + '」を発見、商品名を「' + product + '」に、補足を「' + note + '」に設定');
      break;
    }
  }
  
  const result = { no, date, office, amount, product, note };
  console.log('最終的な行データ:', result);
  return result;
}

function analyze(text) {
  const lines = text.split(/\r?\n/);
  const result = [];
  console.log('入力テキスト:', text);
  console.log('行数:', lines.length);
  
  for (const line of lines) {
    console.log('処理中の行:', line);
    const row = extractRow(line);
    console.log('抽出された行データ:', row);
    
    if (!row) {
      console.log('行データがnullのためスキップ');
      continue;
    }
    
    // 商品名に「SO」「ツイン」「MC」「クリーン」が含まれるかチェック
    const productName = row.product.toUpperCase();
    const targetKeywords = ['SO', 'ＳＯ', 'ツイン', 'MC', 'ＭＣ','クリーン','よど','拡散','DC','ⅮＣ','コント','太陽電池モジュ'];
    const hasTargetKeyword = targetKeywords.some(keyword => 
      productName.includes(keyword.toUpperCase())
    );
    
    console.log('商品名:', row.product);
    console.log('大文字変換後:', productName);
    console.log('対象キーワード:', targetKeywords);
    console.log('キーワードマッチ:', hasTargetKeyword);
    
    // 対象商品のみを結果に追加
    if (hasTargetKeyword) {
      console.log('対象商品として追加');
    result.push(row);
    } else {
      console.log('対象外商品としてスキップ');
    }
  }
  
  console.log('最終結果:', result);
  return result;
}

// 商品名セレクト生成
function createProductSelect(options, selectedValue, className, dataNo, dataDate, dataProduct) {
  let html = `<select class="form-select ${className}" data-no="${dataNo}" data-date="${dataDate}" data-product="${dataProduct}" style="min-width:100px;">`;
  html += `<option value="">選択</option>`;
  options.forEach(opt => {
    const selected = (opt.value === selectedValue) ? 'selected' : '';
    html += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
  });
  html += `</select>`;
  return html;
}

function renderTable(rows) {
  const tbody = document.querySelector('#resultTable tbody');
  tbody.innerHTML = '';
  if (!cachedProducts) return;
  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-no', row.no);
    tr.setAttribute('data-date', row.date);
    tr.setAttribute('data-office', row.office);
    tr.setAttribute('data-amount', row.amount);
    tr.setAttribute('data-product', row.product); // ←必ず付与
    tr.setAttribute('data-note', row.note);

    // 日付をyyyy-mm-ddに
    const date = row.date.replace(/\//g, '-');
    // 電源・機器候補を販売期間でフィルタ
    const powerOptions = cachedProducts["電源"].filter(p =>
      (!p["販売開始"] || p["販売開始"] <= date) && (!p["販売終了"] || p["販売終了"] >= date)
    ).map(p => ({ value: p["商品名"], label: p["商品名"] }));
    const equipmentOptions = cachedProducts["機器"].filter(p =>
      (!p["販売開始"] || p["販売開始"] <= date) && (!p["販売終了"] || p["販売終了"] >= date)
    ).map(p => ({ value: p["商品名"], label: p["商品名"] }));

    // デフォルト選択値（柔軟マッチ）
    const normalizedInput = normalize(row.product);
    const defaultPower = powerOptions.find(opt => normalize(opt.value).includes(normalizedInput));
    const defaultEquipment = equipmentOptions.find(opt => normalize(opt.value).includes(normalizedInput));

    tr.innerHTML = `
      <td>${row.no}</td>
      <td>${row.date}</td>
      <td>${row.office}</td>
      <td>${row.amount.toLocaleString()}</td>
      <td>${row.product}</td>
      <td>${row.note}</td>
      <td>${createProductSelect(powerOptions, defaultPower ? defaultPower.value : '', 'power-product-select', row.no, row.date, row.product)}</td>
      <td><select class="form-select power-count-select" data-no="${row.no}" data-date="${row.date}" data-product="${row.product}" style="min-width:70px;"><option value="">選択</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></td>
      <td><input type="text" class="form-control power-capacity-input" data-no="${row.no}" data-date="${row.date}" data-product="${row.product}" placeholder="A" style="min-width:70px;"></td>
      <td>${createProductSelect(equipmentOptions, defaultEquipment ? defaultEquipment.value : '', 'equipment-product-select', row.no, row.date, row.product)}</td>
      <td><select class="form-select equipment-count-select" data-no="${row.no}" data-date="${row.date}" data-product="${row.product}" style="min-width:70px;"><option value="">選択</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></td>
      <td><input type="text" class="form-control equipment-capacity-input" data-no="${row.no}" data-date="${row.date}" data-product="${row.product}" placeholder="A" style="min-width:70px;"></td>
    `;
    tbody.appendChild(tr);
  }
  if (rows.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="12">該当データなし</td>';
    tbody.appendChild(tr);
  }
  // セレクトタグのイベントセット
  // setupRelationDiagramEvents(); // ←この関数とその呼び出しも削除
}

let cachedProducts = null;

// 全角→半角・スペース除去・小文字化
function normalize(str) {
  if (!str) return '';
  return str
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) // 全角→半角
    .replace(/[\s　]+/g, '') // スペース除去
    .toLowerCase();
}

// 商品名・台数セレクト変更時のイベント
// function setupAmpCalcEvent(rows) { ... } // ←この関数とその呼び出しも削除

// 推定API呼び出し・自動入力処理
async function autoFillPowerAndEquipment(rows) {
  if (!cachedProducts) {
    const res = await fetch('products.json');
    cachedProducts = await res.json();
  }
  const products = cachedProducts;

  await Promise.all(rows.map(async (row) => {
    const no = row.no;
    const date = row.date;
    const originalProduct = row.product;
    const originalAmount = row.amount;
    let estimate = {};
    try {
      const res = await fetch('http://localhost:3001/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no, date, originalProduct, originalAmount })
      });
      estimate = await res.json();
    } catch (e) {}
    // data-no, data-date, data-productで一意に行を特定
    const tr = document.querySelector(`tr[data-no='${no}'][data-date='${date}'][data-product='${originalProduct}']`);
    // 電源欄(td: 7,8,9番目)
    if (estimate.powerProduct || estimate.powerCount || estimate.powerAmp) {
      if (tr) {
        // 電源欄のtd（7,8,9番目）にクラス付与
        const tds = tr.querySelectorAll('td');
        if (tds[6]) tds[6].classList.add('matched-power');
        if (tds[7]) tds[7].classList.add('matched-power');
        if (tds[8]) tds[8].classList.add('matched-power');
      }
    }
    // 機器欄(td: 10,11,12番目)
    if (estimate.equipmentProduct || estimate.equipmentCount || estimate.equipmentAmp) {
      if (tr) {
        const tds = tr.querySelectorAll('td');
        if (tds[9]) tds[9].classList.add('matched-equipment');
        if (tds[10]) tds[10].classList.add('matched-equipment');
        if (tds[11]) tds[11].classList.add('matched-equipment');
      }
    }
    const powerProductSelect = document.querySelector(`select.power-product-select[data-no='${no}'][data-date='${date}'][data-product='${originalProduct}']`);
    const powerCountSelect = document.querySelector(`select.power-count-select[data-no='${no}'][data-date='${date}'][data-product='${originalProduct}']`);
    const powerCapacityInput = document.querySelector(`input.power-capacity-input[data-no='${no}'][data-date='${date}'][data-product='${originalProduct}']`);
    if (powerProductSelect && estimate.powerProduct) powerProductSelect.value = estimate.powerProduct;
    if (powerCountSelect && estimate.powerCount) powerCountSelect.value = estimate.powerCount;
    if (powerCapacityInput && estimate.powerAmp) powerCapacityInput.value = estimate.powerAmp;

    const equipmentProductSelect = document.querySelector(`select.equipment-product-select[data-no='${no}'][data-date='${date}'][data-product='${originalProduct}']`);
    const equipmentCountSelect = document.querySelector(`select.equipment-count-select[data-no='${no}'][data-date='${date}'][data-product='${originalProduct}']`);
    const equipmentCapacityInput = document.querySelector(`input.equipment-capacity-input[data-no='${no}'][data-date='${date}'][data-product='${originalProduct}']`);
    if (equipmentProductSelect && estimate.equipmentProduct) equipmentProductSelect.value = estimate.equipmentProduct;
    if (equipmentCountSelect && estimate.equipmentCount) equipmentCountSelect.value = estimate.equipmentCount;
    if (equipmentCapacityInput && estimate.equipmentAmp) equipmentCapacityInput.value = estimate.equipmentAmp;
  }));
  // setupAmpCalcEvent(rows); // ←この関数とその呼び出しも削除
}

// 抽出ボタン押下時に自動計算を呼び出す
document.getElementById('extractBtn').addEventListener('click', async () => {
  const text = document.getElementById('inputArea').value;
  const rows = analyze(text);
  renderTable(rows);
  await autoFillPowerAndEquipment(rows);
});

// --- 関連ツリー生成・描画・ロジック・HTMLの全削除 ---
// function renderRelationDiagram() { ... } // ←この関数とその呼び出し、関連ロジック・HTMLをすべて削除
// function setupRelationDiagramEvents() { ... } // ←この関数とその呼び出しも削除
// ...ツリー用の変数・データ構造・イベント・HTML生成も削除
// showCurrentModalやモーダル表示部分は残す

// データ確定ボタン押下時
// テーブルの各行から貼り付けデータの商品名・金額、ユーザー選択の電源・機器の商品名・数量・容量をFirestoreに保存

document.getElementById('confirmBtn').addEventListener('click', async () => {
  const rows = [];
  document.querySelectorAll('#resultTable tbody tr').forEach(tr => {
    if (tr.querySelector('td') && tr.querySelector('td').getAttribute('colspan')) return;
    const no = tr.getAttribute('data-no');
    const date = tr.getAttribute('data-date');
    const originalProduct = tr.getAttribute('data-product');
    const originalAmount = tr.getAttribute('data-amount');
    const powerProduct = tr.querySelector('select.power-product-select')?.value || '';
    const powerCount = tr.querySelector('select.power-count-select')?.value || '';
    const powerAmp = tr.querySelector('input.power-capacity-input')?.value || '';
    const equipmentProduct = tr.querySelector('select.equipment-product-select')?.value || '';
    const equipmentCount = tr.querySelector('select.equipment-count-select')?.value || '';
    const equipmentAmp = tr.querySelector('input.equipment-capacity-input')?.value || '';
    rows.push({
      no, date, originalProduct, originalAmount,
      powerProduct, powerCount, powerAmp,
      equipmentProduct, equipmentCount, equipmentAmp
    });
  });
  // Firestoreに保存
  for (const row of rows) {
    await db.collection('stocks').add(row);
  }
  alert('データをFirestoreに保存しました');
});

// ストック一覧表示
async function fetchStockFromFirestore() {
  const snapshot = await db.collection('stocks').get();
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}

document.getElementById('showStockBtn').addEventListener('click', async () => {
  const stock = await fetchStockFromFirestore();
  renderStockTable(stock);
});

// 編集・削除
function renderStockTable(stock) {
  let html = '<div class="stock-header">';
  html += '<h3>ストック一覧</h3>';
  html += '<button class="btn btn-outline-secondary btn-sm" id="closeStockBtn">閉じる</button>';
  html += '</div>';
  html += '<table class="table table-bordered table-striped align-middle" style="background:#fff;">';
  html += '<thead class="table-light"><tr>' +
    '<th>商品名</th><th>金額</th>' +
    '<th>電源商品</th><th>台数</th><th>容量</th>' +
    '<th>機器商品</th><th>台数</th><th>容量</th>' +
    '<th>操作</th>' +
    '</tr></thead><tbody>';
  stock.forEach(d => {
    html += `<tr data-id="${d.id}">` +
      `<td>${d.originalProduct}</td>` +
      `<td>${d.originalAmount}</td>` +
      `<td><input value="${d.powerProduct||''}" class="form-control form-control-sm edit-powerProduct"></td>` +
      `<td><input value="${d.powerCount||''}" class="form-control form-control-sm edit-powerCount" style="width:60px"></td>` +
      `<td><input value="${d.powerAmp||''}" class="form-control form-control-sm edit-powerAmp" style="width:80px"></td>` +
      `<td><input value="${d.equipmentProduct||''}" class="form-control form-control-sm edit-equipmentProduct"></td>` +
      `<td><input value="${d.equipmentCount||''}" class="form-control form-control-sm edit-equipmentCount" style="width:60px"></td>` +
      `<td><input value="${d.equipmentAmp||''}" class="form-control form-control-sm edit-equipmentAmp" style="width:80px"></td>` +
      `<td><button class="btn btn-sm btn-primary editStockBtn">編集</button> <button class="btn btn-sm btn-danger deleteStockBtn">削除</button></td>` +
      '</tr>';
  });
  html += '</tbody></table>';
  let area = document.getElementById('stockArea');
  if (!area) {
    area = document.createElement('div');
    area.id = 'stockArea';
    document.body.appendChild(area);
  }
  area.innerHTML = html;

  // 閉じるボタン
  document.getElementById('closeStockBtn').addEventListener('click', () => {
    area.innerHTML = '';
  });

  // 削除ボタン
  document.querySelectorAll('.deleteStockBtn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const tr = this.closest('tr');
      const id = tr.getAttribute('data-id');
      await db.collection('stocks').doc(id).delete();
      tr.remove();
    });
  });
  // 編集ボタン
  document.querySelectorAll('.editStockBtn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const tr = this.closest('tr');
      const id = tr.getAttribute('data-id');
      const newData = {
        powerProduct: tr.querySelector('.edit-powerProduct').value,
        powerCount: tr.querySelector('.edit-powerCount').value,
        powerAmp: tr.querySelector('.edit-powerAmp').value,
        equipmentProduct: tr.querySelector('.edit-equipmentProduct').value,
        equipmentCount: tr.querySelector('.edit-equipmentCount').value,
        equipmentAmp: tr.querySelector('.edit-equipmentAmp').value
      };
      await db.collection('stocks').doc(id).update(newData);
      alert('編集しました');
    });
  });
}

// セレクトタグの変更時にもツリー再構築
// function setupRelationDiagramEvents() { ... } // ←この関数とその呼び出しも削除

// 現役リストを判定しモーダルで表示
function showCurrentModal() {
  // テーブルからrowsを再構築
  const rows = [];
  document.querySelectorAll('#resultTable tbody tr').forEach(tr => {
    if (tr.querySelector('td') && tr.querySelector('td').getAttribute('colspan')) return;
    const date = tr.getAttribute('data-date');
    const no = tr.getAttribute('data-no');
    const powerProduct = tr.querySelector('select.power-product-select')?.value || '';
    const powerAmp = tr.querySelector('input.power-capacity-input')?.value || '';
    const powerCount = Number(tr.querySelector('select.power-count-select')?.value || '1');
    const equipmentProduct = tr.querySelector('select.equipment-product-select')?.value || '';
    const equipmentAmp = tr.querySelector('input.equipment-capacity-input')?.value || '';
    const equipmentCount = Number(tr.querySelector('select.equipment-count-select')?.value || '1');
    const note = tr.getAttribute('data-note') || '';
    rows.push({ date, no, powerProduct, powerAmp, powerCount, equipmentProduct, equipmentAmp, equipmentCount, note });
  });
  // 区分取得
  let productClassMap = {};
  if (cachedProducts) {
    cachedProducts["電源"].forEach(p => {
      productClassMap[p["商品名"]] = p["区分"];
    });
    cachedProducts["機器"].forEach(p => {
      productClassMap[p["商品名"]] = p["区分"];
    });
  }
  // --- 電源リスト ---
  const powerList = [];
  rows.forEach(r => {
    if (r.powerProduct) {
      for (let i = 0; i < r.powerCount; i++) {
        powerList.push({
          pwClass: productClassMap[r.powerProduct] || '',
          pwProduct: r.powerProduct,
          date: r.date,
          note: r.note,
          row: r
        });
      }
    }
  });
  // 区分ごとに設置日昇順でグループ化
  const groupedPower = {};
  powerList.forEach(obj => {
    const key = obj.pwClass;
    if (!groupedPower[key]) groupedPower[key] = [];
    groupedPower[key].push(obj);
  });
  const currentPowerList = [];
  Object.keys(groupedPower).forEach(key => {
    const group = groupedPower[key];
    group.sort((a, b) => new Date(a.date) - new Date(b.date)); // 古い順
    let stack = [];
    for (let i = 0; i < group.length; i++) {
      let item = group[i];
      if (item.note === '買換' || item.note === '下取') {
        let toReplace = 1; // 1台ずつ
        for (let j = 0; j < stack.length && toReplace > 0; j++) {
          if (stack[j].remainCount > 0) {
            let diff = Math.min(stack[j].remainCount, toReplace);
            stack[j].remainCount -= diff;
            toReplace -= diff;
          }
        }
        stack.push({date: item.date, product: item.pwProduct, remainCount: 1, obj: item});
      } else {
        stack.push({date: item.date, product: item.pwProduct, remainCount: 1, obj: item});
      }
    }
    // stack内でremainCount>0のものが現役
    stack.forEach(s => {
      if (s.remainCount > 0) {
        s.obj.color = '#d4edda';
        s.obj.state = '<span style="color:#218838;font-weight:bold;">現役</span>';
      } else {
        s.obj.color = '#e2e3e5';
        s.obj.state = '<span style="color:#6c757d;">過去</span>';
      }
      currentPowerList.push(s.obj);
    });
  });
  // --- 機器リスト ---
  const allList = [];
  rows.forEach(r => {
    if (r.equipmentProduct) {
      for (let i = 0; i < r.equipmentCount; i++) {
        allList.push({
          eqClass: productClassMap[r.equipmentProduct] || '',
          eqProduct: r.equipmentProduct,
          date: r.date,
          note: r.note,
          row: r
        });
      }
    }
  });
  // 区分ごとに設置日昇順でグループ化
  const grouped = {};
  allList.forEach(obj => {
    const key = obj.eqClass;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(obj);
  });
  const currentList = [];
  Object.keys(grouped).forEach(key => {
    const group = grouped[key];
    group.sort((a, b) => new Date(a.date) - new Date(b.date)); // 古い順
    let stack = [];
    for (let i = 0; i < group.length; i++) {
      let item = group[i];
      if (item.note === '買換' || item.note === '下取') {
        let toReplace = 1;
        for (let j = 0; j < stack.length && toReplace > 0; j++) {
          if (stack[j].remainCount > 0) {
            let diff = Math.min(stack[j].remainCount, toReplace);
            stack[j].remainCount -= diff;
            toReplace -= diff;
          }
        }
        stack.push({date: item.date, product: item.eqProduct, remainCount: 1, obj: item});
      } else {
        stack.push({date: item.date, product: item.eqProduct, remainCount: 1, obj: item});
      }
    }
    stack.forEach(s => {
      if (s.remainCount > 0) {
        s.obj.color = '#d4edda';
        s.obj.state = '<span style="color:#218838;font-weight:bold;">現役</span>';
      } else {
        s.obj.color = '#e2e3e5';
        s.obj.state = '<span style="color:#6c757d;">過去</span>';
      }
      currentList.push(s.obj);
    });
  });
  // 区分ごとの現役台数集計
  const kubunCurrentCount = {};
  currentList.forEach(obj => {
    if (obj.state.includes('現役')) {
      kubunCurrentCount[obj.eqClass] = (kubunCurrentCount[obj.eqClass] || 0) + 1;
    }
  });
  // 区分ごとの現役台数テーブルを追加
  let html = '<h5>区分ごとの現役台数</h5>';
  html += '<table class="table table-bordered"><thead><tr><th>区分</th><th>現役台数</th></tr></thead><tbody>';
  Object.keys(kubunCurrentCount).forEach(kubun => {
    html += `<tr><td>${kubun}</td><td>${kubunCurrentCount[kubun]}</td></tr>`;
  });
  html += '</tbody></table>';
  // モーダルHTML生成
  html += '<h5>現役電源</h5>';
  html += '<table class="table table-bordered"><thead><tr><th>区分</th><th>商品名</th><th>設置日</th><th>補足</th><th>状態</th></tr></thead><tbody>';
  currentPowerList.forEach(obj => {
    html += `<tr style="background:${obj.color};">\n      <td>${obj.pwClass}</td><td>${obj.pwProduct}</td><td>${obj.date}</td><td>${obj.note}</td><td>${obj.state}</td></tr>`;
  });
  html += '</tbody></table>';
  html += '<h5>現役機器</h5>';
  html += '<table class="table table-bordered"><thead><tr><th>区分</th><th>商品名</th><th>設置日</th><th>補足</th><th>状態</th></tr></thead><tbody>';
  currentList.forEach(obj => {
    html += `<tr style=\"background:${obj.color};\">\n      <td>${obj.eqClass}</td><td>${obj.eqProduct}</td><td>${obj.date}</td><td>${obj.note}</td><td>${obj.state}</td></tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('currentModalBody').innerHTML = html;
  // モーダル表示
  const modal = new bootstrap.Modal(document.getElementById('currentModal'));
  modal.show();
}
// ボタンイベント
if (document.getElementById('showCurrentBtn')) {
  document.getElementById('showCurrentBtn').addEventListener('click', showCurrentModal);
} 

document.getElementById('resetBtn').addEventListener('click', () => {
  document.getElementById('inputArea').value = '';
  const tbody = document.querySelector('#resultTable tbody');
  if (tbody) tbody.innerHTML = '';
}); 