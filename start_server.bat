@echo off
echo NASA POWER プロキシサーバーを起動しています...
echo.
echo 必要なパッケージをインストール中...
pip install -r requirements.txt
echo.
echo サーバーを起動しています...
echo ブラウザで index.html を開いてください。
echo サーバーを停止するには Ctrl+C を押してください。
echo.
python server.py






