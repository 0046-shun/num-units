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

let db = null;

try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
} catch (error) {
  console.error('Firebase初期化エラー:', error);
}

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
  
  if (parts.length < 6) {
    return null;
  }
  
  const no = parts[0];
  const date = toSeireki(parts[1]);
  // 営業所名は4番目（例：明石営業、岡山支店など）
  let office = parts[3].replace(/(営業|支店|文店)$/, '');
  const amount = parseInt(parts[4].replace(/,/g, ''), 10);
  // 商品名は5番目以降を結合
  const productFull = parts.slice(5).join(' ');
  
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
      break;
    }
  }
  
  const result = { no, date, office, amount, product, note };
  return result;
}

function analyze(text) {
  const lines = text.split(/\r?\n/);
  const result = [];
  
  for (const line of lines) {
    const row = extractRow(line);
    
    if (!row) {
      continue;
    }
    
    // 商品名に「SO」「ツイン」「MC」「クリーン」が含まれるかチェック
    const productName = row.product.toUpperCase();
    const targetKeywords = ['SO', 'ＳＯ', 'ツイン', 'MC', 'ＭＣ','クリーン','よど','拡散','DC','ⅮＣ','コント','太陽電池モジュ'];
    const hasTargetKeyword = targetKeywords.some(keyword => 
      productName.includes(keyword.toUpperCase())
    );
    
    // 対象商品のみを結果に追加
    if (hasTargetKeyword) {
      result.push(row);
    }
  }
  
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
    tr.setAttribute('data-product', row.product);
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
      <td><input type="text" class="form-control power-capacity-input" data-no="${row.no}" data-date="${row.date}" data-product="${row.product}" placeholder="A" style="min-width:70px;" readonly></td>
      <td>${createProductSelect(equipmentOptions, defaultEquipment ? defaultEquipment.value : '', 'equipment-product-select', row.no, row.date, row.product)}</td>
      <td><select class="form-select equipment-count-select" data-no="${row.no}" data-date="${row.date}" data-product="${row.product}" style="min-width:70px;"><option value="">選択</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></td>
      <td><input type="text" class="form-control equipment-capacity-input" data-no="${row.no}" data-date="${row.date}" data-product="${row.product}" placeholder="A" style="min-width:70px;" readonly></td>
    `;
    tbody.appendChild(tr);
  }
  if (rows.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="12">該当データなし</td>';
    tbody.appendChild(tr);
  }
}

let cachedProducts = null;

// 全角→半角・スペース除去・小文字化＋補足語除去
function normalize(str) {
  if (!str) return '';
  let s = str
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[\s　]+/g, '')
    .toLowerCase();
  // 補足語・属性語を除去
  s = s.replace(/(機器|モジュール|コントローラ|ファン|ソーラー|クリーン|Ⅱ|II|（新）|（旧）|\(.*?\))/g, '');
  return s;
}

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
      
      if (res.ok) {
        estimate = await res.json();
      }
    } catch (e) {}
    
    const tr = document.querySelector(`tr[data-no='${no}'][data-date='${date}'][data-product='${originalProduct}']`);
    
    if (estimate.powerProduct || estimate.powerCount || estimate.powerAmp) {
      if (tr) {
        const tds = tr.querySelectorAll('td');
        if (tds[6]) tds[6].classList.add('matched-power');
        if (tds[7]) tds[7].classList.add('matched-power');
        if (tds[8]) tds[8].classList.add('matched-power');
      }
    }
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
}

// 商品選択後のアンペア自動計算機能
function calculateAmperage(productSelect, countSelect, capacityInput) {
  if (!cachedProducts) return;
  
  const selectedProduct = productSelect.value;
  const selectedCount = parseInt(countSelect.value) || 0;
  
  if (!selectedProduct || selectedCount === 0) {
    capacityInput.value = '';
    return;
  }
  
  // 電源商品か機器商品かを判定
  let productData = null;
  
  // 電源商品から検索
  productData = cachedProducts["電源"].find(p => p["商品名"] === selectedProduct);
  
  // 見つからない場合は機器商品から検索
  if (!productData) {
    productData = cachedProducts["機器"].find(p => p["商品名"] === selectedProduct);
  }
  
  if (productData && productData["動作電流"]) {
    const totalAmperage = productData["動作電流"] * selectedCount;
    capacityInput.value = totalAmperage.toFixed(2);
  } else {
    capacityInput.value = '';
  }
}

// セレクトボックスの変更イベントリスナーを設定
function setupAmperageCalculation() {
  // 電源商品選択時のアンペア計算
  document.addEventListener('change', function(e) {
    if (e.target.classList.contains('power-product-select')) {
      const tr = e.target.closest('tr');
      const countSelect = tr.querySelector('.power-count-select');
      const capacityInput = tr.querySelector('.power-capacity-input');
      calculateAmperage(e.target, countSelect, capacityInput);
    }
    
    if (e.target.classList.contains('power-count-select')) {
      const tr = e.target.closest('tr');
      const productSelect = tr.querySelector('.power-product-select');
      const capacityInput = tr.querySelector('.power-capacity-input');
      calculateAmperage(productSelect, e.target, capacityInput);
    }
    
    if (e.target.classList.contains('equipment-product-select')) {
      const tr = e.target.closest('tr');
      const countSelect = tr.querySelector('.equipment-count-select');
      const capacityInput = tr.querySelector('.equipment-capacity-input');
      calculateAmperage(e.target, countSelect, capacityInput);
    }
    
    if (e.target.classList.contains('equipment-count-select')) {
      const tr = e.target.closest('tr');
      const productSelect = tr.querySelector('.equipment-product-select');
      const capacityInput = tr.querySelector('.equipment-capacity-input');
      calculateAmperage(productSelect, e.target, capacityInput);
    }
  });
}

// 抽出ボタン押下時
document.getElementById('extractBtn').addEventListener('click', async () => {
  const text = document.getElementById('inputArea').value;
  const rows = analyze(text);
  renderTable(rows);
  
  // 保存されたデータとの照合を実行
  await checkExistingDataAndAutoFill(rows);
  
  await autoFillPowerAndEquipment(rows);
});

// 保存されたデータとの照合処理
async function checkExistingDataAndAutoFill(rows) {
  try {
    const snapshot = await db.collection('sales_data').get();
    const existingData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    
    rows.forEach((row) => {
      let matchingData = existingData.find(existing => 
        existing.no === row.no && 
        existing.date === row.date && 
        existing.originalProduct === row.product
      );
      
      if (!matchingData) {
        matchingData = existingData.find(existing => {
          const noMatch = existing.no === row.no;
          const dateMatch = existing.date === row.date;
          const normalizedExisting = normalize(existing.originalProduct || '');
          const normalizedRow = normalize(row.product || '');
          const productMatchExact = existing.originalProduct === row.product;
          const productMatchNormalized = normalizedExisting === normalizedRow;
          const productMatchPartial = normalizedExisting.includes(normalizedRow) || normalizedRow.includes(normalizedExisting);
          
          return noMatch && dateMatch && (productMatchExact || productMatchNormalized || productMatchPartial);
        });
      }
      
      if (matchingData) {
        const tr = document.querySelector(`tr[data-no='${row.no}'][data-date='${row.date}'][data-product='${row.product}']`);
        
        if (tr) {
          const powerProductSelect = tr.querySelector('select.power-product-select');
          const powerCountSelect = tr.querySelector('select.power-count-select');
          const powerCapacityInput = tr.querySelector('input.power-capacity-input');
          const equipmentProductSelect = tr.querySelector('select.equipment-product-select');
          const equipmentCountSelect = tr.querySelector('select.equipment-count-select');
          const equipmentCapacityInput = tr.querySelector('input.equipment-capacity-input');
          
          if (powerProductSelect && matchingData.powerProduct) powerProductSelect.value = matchingData.powerProduct;
          if (powerCountSelect && matchingData.powerCount) powerCountSelect.value = matchingData.powerCount;
          if (powerCapacityInput && matchingData.powerAmp) powerCapacityInput.value = matchingData.powerAmp;
          if (equipmentProductSelect && matchingData.equipmentProduct) equipmentProductSelect.value = matchingData.equipmentProduct;
          if (equipmentCountSelect && matchingData.equipmentCount) equipmentCountSelect.value = matchingData.equipmentCount;
          if (equipmentCapacityInput && matchingData.equipmentAmp) equipmentCapacityInput.value = matchingData.equipmentAmp;
          
          tr.style.backgroundColor = '#d4edda';
          tr.style.border = '2px solid #28a745';
          
          const noteCell = tr.querySelector('td:nth-child(6)');
          if (noteCell) {
            noteCell.innerHTML += '<br><small class="text-success">✓ 既存データと照合済み</small>';
          }
        }
      }
    });
    
  } catch (error) {
    console.error('照合処理エラー:', error);
  }
}

// データ確定ボタン押下時
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
  
  if (rows.length === 0) {
    alert('保存するデータがありません。');
    return;
  }
  
  try {
    for (const row of rows) {
      await db.collection('sales_data').add({
        ...row,
        timestamp: Date.now()
      });
    }
    alert(`${rows.length}件のデータをFirestoreに保存しました`);
  } catch (error) {
    console.error('Firestore保存エラー:', error);
    alert('データの保存に失敗しました: ' + error.message);
  }
});

// ストック一覧表示
async function fetchStockFromFirestore() {
  try {
    const snapshot = await db.collection('sales_data').get();
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  } catch (error) {
    console.error('Firestoreからのデータ取得エラー:', error);
    alert('データの取得に失敗しました: ' + error.message);
    return [];
  }
}

document.getElementById('showStockBtn').addEventListener('click', async () => {
  const stock = await fetchStockFromFirestore();
  
  if (stock.length === 0) {
    alert('保存されているデータがありません。');
    return;
  }
  
  renderStockTable(stock);
});

// 編集・削除
function renderStockTable(stock) {
  if (!stock || stock.length === 0) {
    alert('表示するデータがありません。');
    return;
  }
  
  let html = '<div class="stock-header">';
  html += '<h3>ストック一覧 (' + stock.length + '件)</h3>';
  html += '<button class="btn btn-outline-secondary btn-sm" id="closeStockBtn">閉じる</button>';
  html += '</div>';
  html += '<table class="table table-bordered table-striped align-middle" style="background:#fff;">';
  html += '<thead class="table-light"><tr>' +
    '<th>商品名</th><th>金額</th>' +
    '<th>電源商品</th><th>台数</th><th>容量</th>' +
    '<th>機器商品</th><th>台数</th><th>容量</th>' +
    '<th>操作</th>' +
    '</tr></thead><tbody>';
  
  stock.forEach((d) => {
    html += `<tr data-id="${d.id}">` +
      `<td>${d.originalProduct || '未設定'}</td>` +
      `<td>${d.originalAmount || '未設定'}</td>` +
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
    area.style.position = 'fixed';
    area.style.top = '50%';
    area.style.left = '50%';
    area.style.transform = 'translate(-50%, -50%)';
    area.style.backgroundColor = 'white';
    area.style.padding = '20px';
    area.style.border = '1px solid #ccc';
    area.style.borderRadius = '5px';
    area.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
    area.style.maxHeight = '80vh';
    area.style.overflowY = 'auto';
    area.style.zIndex = '1000';
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
      if (confirm('このデータを削除しますか？')) {
        try {
          const tr = this.closest('tr');
          const id = tr.getAttribute('data-id');
          await db.collection('sales_data').doc(id).delete();
          tr.remove();
          alert('削除しました');
        } catch (error) {
          console.error('削除エラー:', error);
          alert('削除に失敗しました: ' + error.message);
        }
      }
    });
  });
  
  // 編集ボタン
  document.querySelectorAll('.editStockBtn').forEach(btn => {
    btn.addEventListener('click', async function() {
      try {
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
        await db.collection('sales_data').doc(id).update(newData);
        alert('編集しました');
      } catch (error) {
        console.error('編集エラー:', error);
        alert('編集に失敗しました: ' + error.message);
      }
    });
  });
}

// 現役リストを判定しモーダルで表示
function showCurrentModal() {
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
  
  let productClassMap = {};
  if (cachedProducts) {
    cachedProducts["電源"].forEach(p => {
      productClassMap[p["商品名"]] = p["区分"];
    });
    cachedProducts["機器"].forEach(p => {
      productClassMap[p["商品名"]] = p["区分"];
    });
  }
  
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
  
  const groupedPower = {};
  powerList.forEach(obj => {
    const key = obj.pwClass;
    if (!groupedPower[key]) groupedPower[key] = [];
    groupedPower[key].push(obj);
  });
  const currentPowerList = [];
  Object.keys(groupedPower).forEach(key => {
    const group = groupedPower[key];
    group.sort((a, b) => new Date(a.date) - new Date(b.date));
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
        stack.push({date: item.date, product: item.pwProduct, remainCount: 1, obj: item});
      } else {
        stack.push({date: item.date, product: item.pwProduct, remainCount: 1, obj: item});
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
      currentPowerList.push(s.obj);
    });
  });
  
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
  
  const grouped = {};
  allList.forEach(obj => {
    const key = obj.eqClass;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(obj);
  });
  const currentList = [];
  Object.keys(grouped).forEach(key => {
    const group = grouped[key];
    group.sort((a, b) => new Date(a.date) - new Date(b.date));
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
  
  const kubunCurrentCount = {};
  currentList.forEach(obj => {
    if (obj.state.includes('現役')) {
      kubunCurrentCount[obj.eqClass] = (kubunCurrentCount[obj.eqClass] || 0) + 1;
    }
  });
  
  let html = '<h5>区分ごとの現役台数</h5>';
  html += '<table class="table table-bordered"><thead><tr><th>区分</th><th>現役台数</th></tr></thead><tbody>';
  Object.keys(kubunCurrentCount).forEach(kubun => {
    html += `<tr><td>${kubun}</td><td>${kubunCurrentCount[kubun]}</td></tr>`;
  });
  html += '</tbody></table>';
  
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

// ページ読み込み時にアンペア計算機能を初期化
document.addEventListener('DOMContentLoaded', function() {
  setupAmperageCalculation();
}); 