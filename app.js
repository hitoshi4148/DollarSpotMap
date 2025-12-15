// Smith-Kerns Dollar Spot Model
// Reference: https://tdl.wisc.edu/dollar-spot-model/

// マップの初期化
let map;
let contourLayer;
let centerLat = 35.8607; // デフォルト
let centerLng = 140.5433;

// マップ初期化完了フラグ
let mapInitialized = false;

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', function() {
    try {
        setupEventListeners();
        initializeMap();
    } catch (error) {
        console.error('初期化エラー:', error);
        alert('アプリケーションの初期化に失敗しました。ブラウザのコンソールを確認してください。\nエラー: ' + error.message);
    }
});

// マップの初期化
function initializeMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        throw new Error('マップ要素が見つかりません。id="map"の要素が存在するか確認してください。');
    }
    
    // Leafletが利用可能か確認
    if (typeof L === 'undefined') {
        throw new Error('Leafletライブラリが読み込まれていません。');
    }
    
    // マップコンテナのサイズを確認し、必要に応じて待機
    function checkSizeAndInit() {
        const width = mapElement.offsetWidth;
        const height = mapElement.offsetHeight;
        
        console.log('マップ要素のサイズ確認:', {
            width: width,
            height: height,
            computedWidth: window.getComputedStyle(mapElement).width,
            computedHeight: window.getComputedStyle(mapElement).height
        });
        
        if (width === 0 || height === 0) {
            console.warn('マップコンテナのサイズが0です。待機してから再試行します...');
            // 少し待ってから再試行（最大3秒）
            setTimeout(checkSizeAndInit, 200);
            return;
        }
        
        // サイズが確定したらマップを初期化
        try {
            console.log('マップを初期化します...');
            map = L.map('map', {
                center: [centerLat, centerLng],
                zoom: 13,
                zoomControl: true
            });
            
            console.log('マップが作成されました。', {
                map: map,
                container: map.getContainer()
            });
            
            // マップコンテナのスタイルを確認
            const containerStyle = window.getComputedStyle(map.getContainer());
            console.log('マップコンテナのスタイル:', {
                width: containerStyle.width,
                height: containerStyle.height,
                display: containerStyle.display
            });
            
            // OpenStreetMapタイルレイヤーを追加
            const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19,
                errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
            });
            
            tileLayer.addTo(map);
            console.log('タイルレイヤーが追加されました。');
            
            // マップの読み込み完了イベント
            map.whenReady(function() {
                console.log('マップの読み込みが完了しました。');
                mapInitialized = true;
                
                // サイズを再計算
                setTimeout(function() {
                    map.invalidateSize();
                    console.log('マップサイズを再計算しました。');
                    
                    // マップが読み込まれたら初期計算を実行
                    setTimeout(function() {
                        if (map) {
                            console.log('初期計算を実行します。');
                            calculateAndDisplay();
                        }
                    }, 300);
                }, 100);
            });
            
            // 初期化時にクリックイベントを追加して中心を変更できるようにする
            map.on('click', function(e) {
                centerLat = e.latlng.lat;
                centerLng = e.latlng.lng;
                calculateAndDisplay();
            });
            
            // エラーイベント
            map.on('tileerror', function(error, tile) {
                console.warn('タイルの読み込みエラー:', error, tile);
            });
            
            // マップのリサイズイベント
            window.addEventListener('resize', function() {
                if (map) {
                    setTimeout(function() {
                        map.invalidateSize();
                    }, 100);
                }
            });
            
        } catch (error) {
            console.error('マップ初期化エラー:', error);
            throw error;
        }
    }
    
    // 初期サイズチェックを実行
    checkSizeAndInit();
}

// イベントリスナーの設定
function setupEventListeners() {
    document.getElementById('calculateBtn').addEventListener('click', calculateAndDisplay);
    document.getElementById('getLocationBtn').addEventListener('click', getCurrentLocation);
    document.getElementById('fetchDataBtn').addEventListener('click', fetchNASAPowerData);
    document.getElementById('avgTemp').addEventListener('input', calculateAndDisplay);
    document.getElementById('avgHumidity').addEventListener('input', calculateAndDisplay);
    
    // 日付フィールドを昨日に設定（NASA POWERは過去のデータのみ提供）
    const dateInput = document.getElementById('dataDate');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);  // 昨日の日付
    dateInput.value = yesterday.toISOString().split('T')[0];
    
    // 現在位置を取得したら緯度・経度も更新
    const getLocationBtn = document.getElementById('getLocationBtn');
    getLocationBtn.addEventListener('click', function() {
        getCurrentLocation().then(() => {
            document.getElementById('dataLat').value = centerLat.toFixed(4);
            document.getElementById('dataLng').value = centerLng.toFixed(4);
        });
    });
}

// 現在位置を取得
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    centerLat = position.coords.latitude;
                    centerLng = position.coords.longitude;
                    if (map) {
                        map.setView([centerLat, centerLng], 13);
                    }
                    calculateAndDisplay();
                    resolve({ lat: centerLat, lng: centerLng });
                },
                function(error) {
                    alert('位置情報の取得に失敗しました: ' + error.message);
                    reject(error);
                }
            );
        } else {
            alert('お使いのブラウザは位置情報をサポートしていません。');
            reject(new Error('Geolocation not supported'));
        }
    });
}

// NASA POWER APIから気象データを取得
async function fetchNASAPowerData() {
    const statusDiv = document.getElementById('fetchStatus');
    const fetchBtn = document.getElementById('fetchDataBtn');
    
    try {
        const lat = parseFloat(document.getElementById('dataLat').value);
        const lng = parseFloat(document.getElementById('dataLng').value);
        const dateStr = document.getElementById('dataDate').value;
        
        // 入力値の検証
        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('緯度と経度を正しく入力してください。');
        }
        
        if (!dateStr) {
            throw new Error('日付を選択してください。');
        }
        
        // 日付から5日前の日付を計算
        const endDate = new Date(dateStr);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 5); // 5日前から開始（6日分のデータを取得）
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        // UIを更新
        fetchBtn.disabled = true;
        statusDiv.className = 'status-message loading';
        statusDiv.textContent = 'NASA POWERからデータを取得中...';
        
        // プロキシサーバーのURL
        // 同じホストからの相対パスを使用（ローカル開発時はlocalhost:5000、本番では同じドメイン）
        const baseUrl = window.location.origin;
        const proxyUrl = `${baseUrl}/api/nasa-power`;
        
        // プロキシサーバー経由でデータを取得
        const apiUrl = `${proxyUrl}?lat=${lat}&lng=${lng}&date=${dateStr}`;
        
        console.log('プロキシサーバーにリクエスト:', apiUrl);
        
        // APIからデータを取得
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `APIリクエストが失敗しました: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('プロキシサーバーからのレスポンス:', data);
        
        // エラーチェック
        if (!data.success) {
            throw new Error(data.error || 'データの取得に失敗しました');
        }
        
        // データを取得
        const tempCelsius = data.avgTemp;
        const avgHumidity = data.avgHumidity;
        
        console.log('取得したデータ:', {
            dates: data.dates,
            temperatures: data.temperatures,
            humidities: data.humidities,
            avgTemp: tempCelsius,
            avgHumidity: avgHumidity
        });
        
        // UIに反映
        document.getElementById('avgTemp').value = tempCelsius.toFixed(1);
        document.getElementById('avgHumidity').value = avgHumidity.toFixed(1);
        
        // マップの中心も更新
        centerLat = lat;
        centerLng = lng;
        if (map) {
            map.setView([centerLat, centerLng], 13);
        }
        
        // ステータスを更新
        statusDiv.className = 'status-message success';
        statusDiv.textContent = `データ取得成功！ 5日間平均: 気温 ${tempCelsius.toFixed(1)}°C, 湿度 ${avgHumidity.toFixed(1)}%`;
        
        // 自動的に計算を実行
        setTimeout(() => {
            calculateAndDisplay();
        }, 500);
        
    } catch (error) {
        console.error('NASA POWERデータ取得エラー:', error);
        statusDiv.className = 'status-message error';
        
        // ネットワークエラーの場合、サーバーが起動していない可能性がある
        if (error.message.includes('fetch') || error.message.includes('Failed')) {
            statusDiv.innerHTML = `エラー: サーバーに接続できません。<br>
                <strong>バックエンドサーバーが起動しているか確認してください。</strong><br>
                <code>python server.py</code> を実行してサーバーを起動してください。`;
        } else {
            statusDiv.textContent = `エラー: ${error.message}`;
        }
    } finally {
        fetchBtn.disabled = false;
    }
}

// Smith-Kernsモデルで確率を計算
function calculateProbability(meanRH, meanAT) {
    // 有効範囲チェック
    if (meanAT < 10 || meanAT > 35) {
        return 0; // モデルは無効
    }
    
    // Logit計算
    // const logit = -11.4041 + (0.0894 * meanRH) + (0.1932 * meanAT);
    const logit = -14.5 + (0.082 * meanRH) + (0.32 * meanAT);
    
    // 確率計算
    const eLogit = Math.exp(logit);
    const probability = (eLogit / (1 + eLogit)) * 100;
    
    return Math.max(0, Math.min(100, probability)); // 0-100%に制限
}

// シードベースの疑似乱数生成器（再現可能なデータ生成用）
let seed = 12345;
function seededRandom() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
}

// グリッドデータの生成（空間的な変動を再現）
function generateGridData(baseLat, baseLng, areaKm, baseTemp, baseHumidity) {
    const gridSize = 30; // グリッドサイズ（解像度を上げる）
    const step = areaKm / gridSize; // 1グリッドあたりのkm
    const latStep = step / 111; // 緯度1度 ≈ 111km
    const lngStep = step / (111 * Math.cos(baseLat * Math.PI / 180)); // 経度1度は緯度によって変わる
    
    const gridData = [];
    const tempVariation = 2; // 気温の変動範囲（±2°C）
    const humidityVariation = 8; // 湿度の変動範囲（±8%）
    
    // パーリンノイズ風のスムーズな変動を生成
    const noise = (x, y) => {
        const n1 = Math.sin(x * 0.1 + y * 0.1) * 0.5;
        const n2 = Math.sin(x * 0.05 + y * 0.15) * 0.3;
        const n3 = Math.sin(x * 0.02 + y * 0.08) * 0.2;
        return n1 + n2 + n3;
    };
    
    // 中心からの距離に基づいて気温と湿度を変化させる
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const lat = baseLat + (i - gridSize / 2) * latStep;
            const lng = baseLng + (j - gridSize / 2) * lngStep;
            
            // 中心からの距離を計算
            const dx = (j - gridSize / 2) * step;
            const dy = (i - gridSize / 2) * step;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxDistance = Math.sqrt(2) * areaKm / 2;
            
            // ノイズベースの変動
            const noiseValue = noise(i, j);
            const distanceFactor = 1 - (distance / maxDistance) * 0.3; // 距離による変動を軽減
            
            // スムーズな変動を生成
            const tempVariationFactor = noiseValue * tempVariation * distanceFactor;
            const humidityVariationFactor = noiseValue * humidityVariation * distanceFactor;
            
            const temp = baseTemp + tempVariationFactor;
            const humidity = Math.max(0, Math.min(100, baseHumidity + humidityVariationFactor));
            
            const probability = calculateProbability(humidity, temp);
            
            gridData.push({
                lat: lat,
                lng: lng,
                temp: temp,
                humidity: humidity,
                probability: probability
            });
        }
    }
    
    return gridData;
}

// Marching Squaresアルゴリズムを使った等値線生成
function generateContours(gridData, interval) {
    const contours = [];
    const gridSize = Math.sqrt(gridData.length);
    
    // グリッドを2次元配列に変換
    const grid = [];
    for (let i = 0; i < gridSize; i++) {
        grid[i] = [];
        for (let j = 0; j < gridSize; j++) {
            const idx = i * gridSize + j;
            grid[i][j] = gridData[idx];
        }
    }
    
    // 等値線レベルを生成
    for (let level = 0; level <= 100; level += interval) {
        const segments = [];
        
        // 各セルを処理
        for (let i = 0; i < gridSize - 1; i++) {
            for (let j = 0; j < gridSize - 1; j++) {
                const p1 = grid[i][j];
                const p2 = grid[i][j + 1];
                const p3 = grid[i + 1][j];
                const p4 = grid[i + 1][j + 1];
                
                if (!p1 || !p2 || !p3 || !p4) continue;
                
                const v1 = p1.probability >= level ? 1 : 0;
                const v2 = p2.probability >= level ? 1 : 0;
                const v3 = p3.probability >= level ? 1 : 0;
                const v4 = p4.probability >= level ? 1 : 0;
                
                const caseId = v1 + (v2 << 1) + (v4 << 2) + (v3 << 3);
                
                // 閾値との交点を計算
                const getInterpolation = (val1, val2, lat1, lat2, lng1, lng2) => {
                    if (Math.abs(val2 - val1) < 0.001) return null;
                    const ratio = (level - val1) / (val2 - val1);
                    return {
                        lat: lat1 + (lat2 - lat1) * ratio,
                        lng: lng1 + (lng2 - lng1) * ratio
                    };
                };
                
                const points = [];
                
                // Marching Squaresの各ケースに対応
                switch (caseId) {
                    case 1: case 14:
                        points.push(getInterpolation(p1.probability, p3.probability, p1.lat, p3.lat, p1.lng, p3.lng));
                        points.push(getInterpolation(p1.probability, p2.probability, p1.lat, p2.lat, p1.lng, p2.lng));
                        break;
                    case 2: case 13:
                        points.push(getInterpolation(p1.probability, p2.probability, p1.lat, p2.lat, p1.lng, p2.lng));
                        points.push(getInterpolation(p2.probability, p4.probability, p2.lat, p4.lat, p2.lng, p4.lng));
                        break;
                    case 3: case 12:
                        points.push(getInterpolation(p1.probability, p3.probability, p1.lat, p3.lat, p1.lng, p3.lng));
                        points.push(getInterpolation(p2.probability, p4.probability, p2.lat, p4.lat, p2.lng, p4.lng));
                        break;
                    case 4: case 11:
                        points.push(getInterpolation(p2.probability, p4.probability, p2.lat, p4.lat, p2.lng, p4.lng));
                        points.push(getInterpolation(p3.probability, p4.probability, p3.lat, p4.lat, p3.lng, p4.lng));
                        break;
                    case 6: case 9:
                        points.push(getInterpolation(p1.probability, p2.probability, p1.lat, p2.lat, p1.lng, p2.lng));
                        points.push(getInterpolation(p3.probability, p4.probability, p3.lat, p4.lat, p3.lng, p4.lng));
                        break;
                    case 7: case 8:
                        points.push(getInterpolation(p1.probability, p3.probability, p1.lat, p3.lat, p1.lng, p3.lng));
                        points.push(getInterpolation(p3.probability, p4.probability, p3.lat, p4.lat, p3.lng, p4.lng));
                        break;
                    case 5: case 10:
                        // 二重線の場合（サドル点）
                        const p1p2 = getInterpolation(p1.probability, p2.probability, p1.lat, p2.lat, p1.lng, p2.lng);
                        const p1p3 = getInterpolation(p1.probability, p3.probability, p1.lat, p3.lat, p1.lng, p3.lng);
                        const p2p4 = getInterpolation(p2.probability, p4.probability, p2.lat, p4.lat, p2.lng, p4.lng);
                        const p3p4 = getInterpolation(p3.probability, p4.probability, p3.lat, p4.lat, p3.lng, p4.lng);
                        if (p1p2 && p1p3 && p2p4 && p3p4) {
                            points.push(p1p2, p1p3);
                            segments.push([p2p4, p3p4]);
                        }
                        break;
                }
                
                // 有効な点があればセグメントを追加
                const validPoints = points.filter(p => p !== null);
                if (validPoints.length === 2) {
                    segments.push(validPoints);
                }
            }
        }
        
        // セグメントを連結して連続したラインにする
        const lines = connectSegments(segments);
        
        if (lines.length > 0) {
            contours.push({
                level: level,
                lines: lines
            });
        }
    }
    
    return contours;
}

// セグメントを連結して連続したラインを作成
function connectSegments(segments) {
    if (segments.length === 0) return [];
    
    const lines = [];
    const used = new Set();
    
    for (let i = 0; i < segments.length; i++) {
        if (used.has(i)) continue;
        
        const line = [segments[i][0], segments[i][1]];
        used.add(i);
        
        let changed = true;
        while (changed) {
            changed = false;
            for (let j = 0; j < segments.length; j++) {
                if (used.has(j)) continue;
                
                const seg = segments[j];
                const firstPoint = line[0];
                const lastPoint = line[line.length - 1];
                
                // 始点と接続
                if (distance(firstPoint, seg[0]) < 0.0001) {
                    line.unshift(seg[1]);
                    used.add(j);
                    changed = true;
                } else if (distance(firstPoint, seg[1]) < 0.0001) {
                    line.unshift(seg[0]);
                    used.add(j);
                    changed = true;
                }
                // 終点と接続
                else if (distance(lastPoint, seg[0]) < 0.0001) {
                    line.push(seg[1]);
                    used.add(j);
                    changed = true;
                } else if (distance(lastPoint, seg[1]) < 0.0001) {
                    line.push(seg[0]);
                    used.add(j);
                    changed = true;
                }
            }
        }
        
        if (line.length >= 2) {
            lines.push(line);
        }
    }
    
    return lines;
}

// 2点間の距離を計算
function distance(p1, p2) {
    const dx = p1.lat - p2.lat;
    const dy = p1.lng - p2.lng;
    return Math.sqrt(dx * dx + dy * dy);
}

// 確率値に基づいた色を返す
function getColor(probability) {
    if (probability < 20) return '#00ff00'; // 緑
    if (probability < 40) return '#ffff00'; // 黄
    if (probability < 60) return '#ff8800'; // オレンジ
    if (probability < 80) return '#ff0000'; // 赤
    return '#8b0000'; // 濃い赤
}

// RGBカラーを生成（グラデーション用）
function getColorRGB(probability) {
    if (probability < 20) return { r: 0, g: 255, b: 0 };
    if (probability < 40) {
        const ratio = (probability - 20) / 20;
        return { r: Math.round(255 * ratio), g: 255, b: 0 };
    }
    if (probability < 60) {
        const ratio = (probability - 40) / 20;
        return { r: 255, g: Math.round(255 * (1 - ratio)), b: 0 };
    }
    if (probability < 80) {
        const ratio = (probability - 60) / 20;
        return { r: 255, g: 0, b: 0 };
    }
    const ratio = (probability - 80) / 20;
    return { r: Math.round(139 + (116 * ratio)), g: 0, b: 0 };
}

// 等値線描画
function drawContours(gridData, interval) {
    if (!map) {
        console.error('マップが初期化されていません。');
        return;
    }
    
    // 既存のレイヤーを削除
    if (contourLayer) {
        try {
            map.removeLayer(contourLayer);
        } catch (e) {
            console.warn('レイヤーの削除に失敗:', e);
        }
    }
    
    contourLayer = L.layerGroup().addTo(map);
    
    try {
        const contours = generateContours(gridData, interval);
        
        // まず、等値線間の領域を塗りつぶし（背景レイヤー）
        // グリッドデータから領域を塗りつぶす
        const gridSize = Math.sqrt(gridData.length);
        if (gridData.length > 1) {
            // セルの半分の幅を計算
            let latHalf = 0.0005;
            let lngHalf = 0.0005;
            
            if (gridSize >= 2) {
                // 横方向の差（同じ行で隣接する点）
                const eastNeighbor = gridData[1];
                if (eastNeighbor) {
                    lngHalf = Math.abs(eastNeighbor.lng - gridData[0].lng) / 2;
                }
            }
            
            if (gridData.length > gridSize) {
                // 縦方向の差（次の行の同じ列）
                const southNeighbor = gridData[gridSize];
                if (southNeighbor) {
                    latHalf = Math.abs(southNeighbor.lat - gridData[0].lat) / 2;
                }
            }
            
            // フォールバック（万が一0のままなら適当な値）
            if (latHalf === 0) latHalf = 0.0005;
            if (lngHalf === 0) lngHalf = 0.0005;
            
            // 各グリッドセルを塗りつぶし
            gridData.forEach(point => {
                if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') return;
                
                try {
                    const colorRGB = getColorRGB(point.probability);
                    const colorHex = `rgb(${colorRGB.r}, ${colorRGB.g}, ${colorRGB.b})`;
                    
                    // セルをポリゴンとして描画
                    L.polygon([
                        [point.lat - latHalf, point.lng - lngHalf],
                        [point.lat - latHalf, point.lng + lngHalf],
                        [point.lat + latHalf, point.lng + lngHalf],
                        [point.lat + latHalf, point.lng - lngHalf]
                    ], {
                        fillColor: colorHex,
                        color: colorHex,
                        weight: 0,
                        fillOpacity: 0.35,  // 半透明
                        opacity: 0
                    }).addTo(contourLayer);
                } catch (e) {
                    console.warn('領域の塗りつぶしに失敗:', e);
                }
            });
        }
        
        // その上に等値線を描画（前面レイヤー）
        contours.forEach(contour => {
            if (!contour.lines || contour.lines.length === 0) return;
            
            const color = getColor(contour.level);
            const opacity = Math.max(0.4, Math.min(0.9, contour.level / 100));
            
            contour.lines.forEach(line => {
                if (!line || line.length < 2) return;
                
                try {
                    // ポリラインで等値線を描画
                    const polyline = L.polyline(
                        line.map(p => [p.lat, p.lng]),
                        {
                            color: color,
                            weight: 2,
                            opacity: opacity,
                            smoothFactor: 1.0
                        }
                    ).addTo(contourLayer);
                    
                    // 等値線ラベルを追加（中間点に）
                    if (line.length > 5) {
                        const midIdx = Math.floor(line.length / 2);
                        const midPoint = line[midIdx];
                        if (midPoint && midPoint.lat && midPoint.lng) {
                            const label = L.marker([midPoint.lat, midPoint.lng], {
                                icon: L.divIcon({
                                    className: 'contour-label-icon',
                                    html: `<div style="background: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; border: 1px solid ${color}; color: ${color};">${contour.level}%</div>`,
                                    iconSize: [50, 20]
                                })
                            }).addTo(contourLayer);
                        }
                    }
                } catch (e) {
                    console.warn('等値線の描画に失敗:', e);
                }
            });
        });
    } catch (error) {
        console.error('等値線描画エラー:', error);
    }
}

// 計算と表示を実行
function calculateAndDisplay() {
    try {
        // マップが初期化されているか確認
        if (!map) {
            console.error('マップが初期化されていません。');
            alert('マップが初期化されていません。ページを再読み込みしてください。');
            return;
        }
        
        // マップが完全に読み込まれるまで待つ
        if (!mapInitialized) {
            console.log('マップの初期化を待っています...');
            map.whenReady(function() {
                mapInitialized = true;
                calculateAndDisplay();
            });
            return;
        }
        
        const avgTemp = parseFloat(document.getElementById('avgTemp').value);
        const avgHumidity = parseFloat(document.getElementById('avgHumidity').value);
        
        // 固定値
        const interval = 10; // 等値線間隔 10%
        const areaKm = 2; // 表示範囲 2km
        
        // 入力値の検証
        if (isNaN(avgTemp) || isNaN(avgHumidity)) {
            alert('入力値が正しくありません。数値を入力してください。');
            return;
        }
        
        // 現在の確率を計算して表示
        const currentProb = calculateProbability(avgHumidity, avgTemp);
        const probElement = document.getElementById('probValue');
        if (probElement) {
            probElement.textContent = currentProb.toFixed(1);
        }
        
        // グリッドデータを生成
        const gridData = generateGridData(centerLat, centerLng, areaKm, avgTemp, avgHumidity);
        
        if (gridData.length === 0) {
            console.error('グリッドデータが生成されませんでした。');
            return;
        }
        
        // 等値線を描画
        drawContours(gridData, interval);
        
        // マップの中心とズームを調整
        const bounds = L.latLngBounds(
            gridData.map(p => [p.lat, p.lng])
        );
        
        // バウンドが有効な場合のみfitBoundsを実行
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [20, 20] });
        } else {
            // バウンドが無効な場合は中心を設定
            map.setView([centerLat, centerLng], 13);
        }
        
        // マップのサイズを再計算
        setTimeout(function() {
            map.invalidateSize();
        }, 100);
        
    } catch (error) {
        console.error('計算エラー:', error);
        alert('計算中にエラーが発生しました: ' + error.message);
    }
}

