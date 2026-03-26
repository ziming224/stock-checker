const { chromium } = require('playwright');
require('dotenv').config();

/**
 * 發送 LINE 通知 (使用 Messaging API)
 * 需要在 .env 或 GitHub Secrets 設定 LINE_ACCESS_TOKEN 與 LINE_USER_ID
 */
async function sendLineNotification(message) {
    // 加入 .trim() 去除可能不小心複製到的空白
    const token = process.env.LINE_ACCESS_TOKEN ? process.env.LINE_ACCESS_TOKEN.trim() : '';
    const userId = process.env.LINE_USER_ID ? process.env.LINE_USER_ID.trim() : '';

    if (!token || !userId) {
        console.log('⚠️ LINE 設定 (TOKEN 或 USER_ID) 缺失，跳過通知');
        return;
    }

    try {
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                to: userId,
                messages: [{ type: 'text', text: message }]
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API 回傳錯誤: ${response.status} - ${text}`);
        }
        console.log('✅ LINE 通知發送成功！');
    } catch (err) {
        console.error('❌ LINE 通知發送失敗:', err.message);
    }
}
const url = process.env.PRODUCT_URL ? process.env.PRODUCT_URL.trim() : '';

if (!url) {
    console.error('❌ 錯誤：找不到 PRODUCT_URL，請檢查環境變數設定。');
    process.exit(1); // 使用 exit(1) 讓 GitHub Actions 標記此執行為失敗
}

async function checkStock() {
    // [測試模式] 程式一啟動就先發送一則測試訊息，確認 LINE 設定沒問題
    // await sendLineNotification("✅ 這是測試訊息：LINE 通知功能正常！");

    // 啟動瀏覽器
    // const browser = await chromium.launch({ headless: false });
    // 改成 false，它會彈出瀏覽器視窗
    const browser = await chromium.launch({ headless: true });
    // 建立一個新的瀏覽器上下文，並設定 User-Agent，讓請求看起來更像真人
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        console.log(`[${new Date().toLocaleString()}] 正在開啟網頁...`);

        // 前往網址，並等待網路活動停止（代表 JavaScript 可能跑完了）
        await page.goto(url, { waitUntil: 'networkidle' });

        // 改用這個更寬鬆的寫法，要在進入網頁後才找
        // 加入 .first() 表示只要找到其中一個就好，避免因為網頁有多個按鈕而報錯
        const btn = page.getByText(/補貨中|加入購物車/).first();
        await btn.waitFor({ timeout: 10000 }); // 只等 10 秒，沒抓到就報錯

        // 這裡可以根據畫面上的文字來判斷
        const isOutOfStock = await page.getByText('補貨中').count() > 0;

        if (!isOutOfStock) {
            console.log('🔥 補貨了！準備發送通知...');
            await sendLineNotification(`🔥 補貨了！快去買！\n連結：${url}`);
        } else {
            console.log('ℹ️ 目前依然：補貨中');
        }

    } catch (err) {
        console.error('❌ 發生錯誤：', err.message);
    } finally {
        await context.close();
        await browser.close();
    }
}

checkStock();