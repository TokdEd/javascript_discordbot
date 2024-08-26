# Discord 記帳機器人

這是一個基於 Discord.js 和 SQLite3 建構的 Discord 記帳機器人，使用者可以通過命令記錄日常的收入與支出，並生成圖表和財務報告。機器人還會定期發送每週的財務報告到指定的頻道。(由於機器人未拖管到雲端所以需要在本地端一直運行)

## 功能

- **記錄支出**：通過命令 `!addexpense` 來記錄支出。
- **記錄收入**：通過命令 `!addincome` 來記錄收入。
- **查看支出記錄**：使用 `!expense` 查看使用者的所有支出記錄。
- **查看收入記錄**：使用 `!income` 查看使用者的所有收入記錄。
- **生成財務報告**：通過命令 `!generateReport` 生成當前的收入與支出圖表。
- **查看指定日期的收支情況**：使用 `!datetotal YYYY-MM-DD` 查看指定日期的總收入、總支出和淨額。
- **每週自動報告**：每週自動生成並發送一份財務報告到指定頻道。

## 安裝

1. **克隆專案代碼**：
    ```bash
    git clone https://github.com/TokdEd/javascript_discordbot.git
    cd discord-finance-bot
    ```

2. **安裝依賴套件**：
    ```bash
    npm install
    ```

3. **配置環境變數**：

    - 將 `YOUR_BOT_TOKEN` 替換為你的 Discord 機器人 Token。
    - 將 `YOUR_CHANNEL_ID` 替換為你希望發送每週報告的 Discord 頻道 ID。

    ```javascript
    client.login('YOUR_BOT_TOKEN');
    ```
    ```javascript
    const channel = await client.channels.fetch('YOUR_CHANNEL_ID');
    ```

4. **設置資料庫**：

    首次啟動時會自動建立 SQLite 資料庫 `finances.db`，並創建所需的表格。

5. **啟動機器人**：

    ```bash
    node bot.js
    ```

## 使用

### 記錄支出

```bash
!addexpense <金額> <類型>
```
6. **定時任務**
機器人每週會自動生成一份財務報告，並發送到指定的 Discord 頻道。報告內容包括總收入、總支出和淨利潤。


8. **授權**
此專案依據 MIT 授權 發佈。