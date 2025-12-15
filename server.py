#!/usr/bin/env python3
"""
NASA POWER API プロキシサーバー
CORSの問題を回避するための簡単なバックエンドサーバー
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
from datetime import datetime, timedelta
import os

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)  # すべてのオリジンからのリクエストを許可

@app.route('/api/nasa-power', methods=['GET'])
def get_nasa_power_data():
    """
    NASA POWER APIから気象データを取得するプロキシエンドポイント
    
    パラメータ:
    - lat: 緯度
    - lng: 経度
    - date: 日付 (YYYY-MM-DD形式)
    """
    try:
        lat = request.args.get('lat', type=float)
        lng = request.args.get('lng', type=float)
        date_str = request.args.get('date')
        
        if not lat or not lng or not date_str:
            return jsonify({'error': '緯度、経度、日付が必要です'}), 400
        
        # 日付から5日前の日付を計算
        # 欠損値を考慮して、余裕を持たせて7日間取得する（有効な5日間を選ぶため）
        end_date = datetime.strptime(date_str, '%Y-%m-%d')
        start_date = end_date - timedelta(days=7)  # 7日間取得
        
        start_date_str = start_date.strftime('%Y%m%d')
        end_date_str = end_date.strftime('%Y%m%d')
        
        # NASA POWER APIエンドポイント
        # パラメータ: T2M (2m temperature in Kelvin), RH2M (2m relative humidity)
        # 正しいエンドポイント形式: point エンドポイントを使用
        
        # point エンドポイント形式（正しい形式）
        api_url = (
            f"https://power.larc.nasa.gov/api/temporal/daily/point"
            f"?parameters=T2M,RH2M"
            f"&community=AG"
            f"&longitude={lng}"
            f"&latitude={lat}"
            f"&start={start_date_str}"
            f"&end={end_date_str}"
            f"&format=JSON"
        )
        
        print(f"NASA POWER APIリクエスト: {api_url}")
        
        # NASA POWER APIからデータを取得
        response = requests.get(api_url, timeout=30)
        
        # エラーレスポンスの詳細を確認
        if response.status_code != 200:
            error_detail = f"Status: {response.status_code}"
            try:
                error_data = response.json()
                error_detail += f", Response: {error_data}"
            except:
                error_detail += f", Response text: {response.text[:200]}"
            print(f"エラーレスポンス: {error_detail}")
            response.raise_for_status()
        
        data = response.json()
        
        # デバッグ: データ構造を確認
        print(f"=== NASA POWER APIレスポンス構造の確認 ===")
        print(f"トップレベルのキー: {list(data.keys())}")
        
        # データを解析
        if 'properties' not in data:
            print(f"エラー: 'properties'キーが存在しません")
            print(f"取得したデータ（最初の1000文字）: {str(data)[:1000]}")
            return jsonify({'error': f'データ形式が正しくありません。レスポンス構造: {list(data.keys())}'}), 500
        
        if 'parameter' not in data.get('properties', {}):
            print(f"エラー: 'parameter'キーが存在しません")
            print(f"propertiesのキー: {list(data.get('properties', {}).keys())}")
            return jsonify({'error': f'パラメータデータが存在しません。properties: {list(data["properties"].keys())}'}), 500
        
        params = data['properties']['parameter']
        print(f"パラメータのキー: {list(params.keys())}")
        
        temp_data = params.get('T2M')
        humidity_data = params.get('RH2M')
        
        if not temp_data:
            return jsonify({'error': f'気温データ(T2M)が取得できませんでした。利用可能なパラメータ: {list(params.keys())}'}), 500
        
        if not humidity_data:
            return jsonify({'error': f'湿度データ(RH2M)が取得できませんでした。利用可能なパラメータ: {list(params.keys())}'}), 500
        
        print(f"気温データの型: {type(temp_data)}")
        print(f"湿度データの型: {type(humidity_data)}")
        
        # データ構造を確認
        if isinstance(temp_data, dict):
            dates = sorted(temp_data.keys())
            print(f"気温データのキー数: {len(dates)}")
            print(f"気温データの日付: {dates}")
        else:
            print(f"エラー: 気温データが辞書形式ではありません。型: {type(temp_data)}, 値: {temp_data}")
            return jsonify({'error': f'気温データの形式が予想と異なります: {type(temp_data)}'}), 500
        
        if len(dates) < 3:
            return jsonify({
                'error': f'データが不足しています（{len(dates)}日分）。最低3日間のデータが必要です。取得した日付: {dates}'
            }), 500
        
        # すべての日付のデータを確認して、有効なデータを持つ日付を選択
        # 最新5日間ではなく、有効なデータを持つ5日間を選択する
        print(f"取得したすべての日付: {dates}")
        
        # データを配列に変換
        # NASA POWERでは欠損値として -999, -6999 などの値が使われることがあるため、
        # 物理的にあり得ない値は欠損として扱う
        temperatures = []
        humidities = []
        
        print(f"=== すべての日付のデータ確認 ===")
        # まず、すべての日付のデータを確認して、有効なデータを持つ日付をリストアップ
        valid_dates = []
        
        for date in dates:
            temp_val = temp_data.get(date) if isinstance(temp_data, dict) else None
            hum_val = humidity_data.get(date) if isinstance(humidity_data, dict) else None
            
            print(f"日付 {date}:")
            print(f"  気温の生データ: {temp_val} (型: {type(temp_val)})")
            print(f"  湿度の生データ: {hum_val} (型: {type(hum_val)})")
            
            # 値が配列の場合、最初の要素を使用
            if isinstance(temp_val, list):
                temp_val = temp_val[0] if temp_val else None
                print(f"  気温が配列でした。最初の要素: {temp_val}")
            if isinstance(hum_val, list):
                hum_val = hum_val[0] if hum_val else None
                print(f"  湿度が配列でした。最初の要素: {hum_val}")
            
            # 温度の異常値をフィルタ（Kでも°Cでもあり得ない値を除外）
            temp_valid = None
            if temp_val is not None:
                try:
                    tv = float(temp_val)
                    # NaNチェック
                    if tv != tv:  # NaN
                        print(f"  温度値がNaNです")
                    # 温度範囲チェック: ケルビン（通常200-350K）、または摂氏（-60〜60°C）
                    # NASA POWERの欠損値は通常 -6999 または -999
                    if tv < -100 or tv > 400:  # 明らかに異常な値（欠損値の可能性）
                        print(f"  無効な温度値（欠損値の可能性）: {tv}")
                    elif 200 <= tv <= 350:  # ケルビンの可能性が高い
                        temp_valid = tv
                        print(f"  有効な温度（ケルビン）: {tv}K")
                    elif -80 <= tv <= 80:  # 摂氏の可能性（範囲を広げる）
                        temp_valid = tv
                        print(f"  有効な温度（摂氏）: {tv}°C")
                    else:
                        # それ以外の値もとりあえず記録（デバッグ用）
                        print(f"  不明な温度値（範囲外だが記録）: {tv}")
                        # とりあえず有効として扱う（後でフィルタリング）
                        if -150 < tv < 450:  # より広い範囲で許容
                            temp_valid = tv
                except (TypeError, ValueError) as e:
                    print(f"  温度値の変換エラー: {e}")
            
            # 湿度の異常値をフィルタ（0〜100%以外は欠損とみなす）
            # NASA POWERの欠損値は通常 -999 または -6999
            hum_valid = None
            if hum_val is not None:
                try:
                    hv = float(hum_val)
                    # NaNチェック
                    if hv != hv:  # NaN
                        print(f"  湿度値がNaNです")
                    # NASA POWERの欠損値チェック（-999や-6999など）
                    elif hv < 0 or hv > 100:  # 欠損値または範囲外
                        print(f"  無効な湿度値（欠損値または範囲外）: {hv}")
                    else:
                        hum_valid = hv
                        print(f"  有効な湿度: {hv}%")
                except (TypeError, ValueError) as e:
                    print(f"  湿度値の変換エラー: {e}")
            
            # この日付のデータが有効（気温と湿度の両方）の場合、有効な日付リストに追加
            if temp_valid is not None and hum_valid is not None:
                valid_dates.append(date)
                temperatures.append(temp_valid)
                humidities.append(hum_valid)
                print(f"  ✓ 有効なデータ: 気温={temp_valid}, 湿度={hum_valid}")
            else:
                print(f"  ✗ データが無効: 気温={temp_valid}, 湿度={hum_valid}")
        
        print(f"=== 処理結果 ===")
        print(f"有効な日付: {valid_dates} (数: {len(valid_dates)})")
        print(f"温度データ: {temperatures}")
        print(f"湿度データ: {humidities}")
        
        # 有効なデータが5日分未満の場合の処理
        if len(temperatures) < 5:
            if len(temperatures) >= 3:
                # 3日以上ある場合は、そのデータを使用して警告
                print(f"警告: 有効なデータが{len(temperatures)}日分のみです。5日間の平均には{len(temperatures)}日分を使用します。")
            else:
                return jsonify({
                    'error': f'有効なデータが不足しています（{len(temperatures)}日分）。最低3日間の有効なデータが必要です。有効な日付: {valid_dates}'
                }), 500
        
        # 最新5日間の有効なデータを使用（5日以上ある場合）
        if len(temperatures) > 5:
            # 最新5日間を選択
            temperatures = temperatures[-5:]
            humidities = humidities[-5:]
            valid_dates = valid_dates[-5:]
            print(f"最新5日間を選択: {valid_dates}")
        
        # 平均を計算
        avg_temp = sum(temperatures) / len(temperatures)
        avg_humidity = sum(humidities) / len(humidities)
        
        # 気温はケルビンから摂氏に変換（NASA POWERはケルビンで返す）
        # ただし、既に摂氏の場合もあるので、大きな値（>100）の場合は変換
        temp_celsius = avg_temp - 273.15 if avg_temp > 100 else avg_temp
        
        return jsonify({
            'success': True,
            'dates': valid_dates,
            'temperatures': temperatures,
            'humidities': humidities,
            'avgTemp': round(temp_celsius, 2),
            'avgHumidity': round(avg_humidity, 2),
            'dataDays': len(valid_dates)  # 実際に使用した日数
        })
        
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'APIリクエストエラー: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'サーバーエラー: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health():
    """ヘルスチェックエンドポイント"""
    return jsonify({'status': 'ok'})

@app.route('/')
def index():
    """メインのHTMLページを返す"""
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    """静的ファイル（CSS、JS等）を配信"""
    # APIエンドポイント以外の静的ファイルのみ配信
    if path.startswith('api/') or path == 'health':
        return jsonify({'error': 'Not found'}), 404
    # 安全のため、現在のディレクトリ内のファイルのみ配信
    if os.path.exists(path) and os.path.isfile(path):
        return send_from_directory('.', path)
    # ファイルが存在しない場合は404
    return jsonify({'error': 'File not found'}), 404

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    print("NASA POWER API プロキシサーバーを起動しています...")
    print(f"サーバーはポート {port} で実行されます")
    if not debug:
        print("終了するには Ctrl+C を押してください")
    app.run(debug=debug, host='0.0.0.0', port=port)

