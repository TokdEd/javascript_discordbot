const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const schedule = require('node-schedule');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();

// Discord客户端设置
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 数据库设置
const db = new sqlite3.Database('./finances.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to the finances database.');
        // 创建表格（如果尚不存在）
        db.run(`CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user TEXT,
            type TEXT,
            amount REAL,
            category TEXT,
            date TEXT
        )`);
    }
});

// 辅助函数：解析日期
function parseDate(dateString) {
    const parts = dateString.split('-');
    if (parts.length !== 3) return null;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 月份从0开始
    const day = parseInt(parts[2], 10);

    const date = new Date(year, month, day);

    // 验证日期是否有效
    if (isNaN(date.getTime())) return null;

    return date;
}

// 辅助函数：获取随机颜色
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// 生成图表
function generateChart(startDate, endDate) {
    return new Promise((resolve, reject) => {
        const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 800, height: 600 });

        // 查询数据库获取数据
        db.all(`
            SELECT date, type, amount 
            FROM transactions 
            WHERE date BETWEEN ? AND ? 
            ORDER BY date`, [startDate, endDate], (err, rows) => {
            if (err) {
                return reject(err);
            }

            // 准备图表数据
            const labels = [];
            const data = {
                'Entertainment & Shopping': [],
                'Dining': [],
                'Transportation': [],
                'Daily Necessities': [],
                'Shipping Cost': [],
                'Gambling': [],
                'Sell Price': [],
                'Pocket Money': [],
                'Gambling (Friends)': []
            };

            rows.forEach(row => {
                if (!labels.includes(row.date)) {
                    labels.push(row.date);
                }
                if (!data[row.type]) {
                    data[row.type] = Array(labels.length).fill(0);
                }
                const index = labels.indexOf(row.date);
                data[row.type][index] = (data[row.type][index] || 0) + row.amount;
            });

            const datasets = Object.keys(data).map(type => ({
                label: type,
                data: data[type],
                backgroundColor: getRandomColor(),
                borderColor: getRandomColor(),
                borderWidth: 1
            }));

            const configuration = {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    scales: {
                        x: {
                            stacked: true,
                            title: {
                                display: true,
                                text: 'Date'
                            }
                        },
                        y: {
                            stacked: true,
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Amount'
                            }
                        }
                    }
                }
            };

            chartJSNodeCanvas.renderToBuffer(configuration)
                .then(buffer => {
                    const imagesDir = path.join(__dirname, 'images');
                    if (!fs.existsSync(imagesDir)) {
                        fs.mkdirSync(imagesDir);
                    }
                    const filePath = path.join(imagesDir, 'chart.png');
                    fs.writeFileSync(filePath, buffer);
                    resolve(filePath);
                })
                .catch(err => reject(err));
        });
    });
}

// 处理交易记录
function handleTransaction(message, type) {
    const [command, amount, ...category] = message.content.split(' ');
    const categoryText = category.join(' ');
    const user = message.author.username;
    const date = new Date().toISOString();

    db.run(`INSERT INTO transactions (user, type, amount, category, date) VALUES (?, ?, ?, ?, ?)`,
        [user, type, amount, categoryText, date], (err) => {
            if (err) {
                console.error(err.message);
                return message.channel.send('发生错误，无法记录交易。');
            }
            message.channel.send(`${type === 'expense' ? '支出' : '收入'}已记录：$${amount}，类型：${categoryText}`);
        });
}

// 显示交易记录
function showTransactions(message, type) {
    const user = message.author.username;

    db.all(`SELECT * FROM transactions WHERE user = ? AND type = ?`, [user, type], (err, rows) => {
        if (err) {
            console.error(err.message);
            return message.channel.send('获取记录时发生错误。');
        }
        if (rows.length === 0) {
            message.channel.send(`${user}, 你没有记录任何${type === 'expense' ? '支出' : '收入'}。`);
        } else {
            let response = `${user} 的${type === 'expense' ? '支出' : '收入'}记录：\n`;
            rows.forEach((row) => {
                response += `${row.date}: $${row.amount} - ${row.category}\n`;
            });
            message.channel.send(response);
        }
    });
}
function getDateTotals(date, callback) {
    // 将输入的日期转换为开始时间和结束时间
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    db.all(`SELECT type, SUM(amount) as total 
            FROM transactions 
            WHERE date >= ? AND date <= ?
            GROUP BY type`, 
        [startDateStr, endDateStr], 
        (err, rows) => {
            if (err) {
                return callback(err, null);
            }
            const totals = {income: 0, expense: 0};
            rows.forEach(row => {
                if (row.type === 'income') {
                    totals.income = row.total;
                } else if (row.type === 'expense') {
                    totals.expense = row.total;
                }
            });
            callback(null, totals);
        }
    );
}

// 客户端准备就绪
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// 处理消息
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('!addexpense')) {
        handleTransaction(message, 'expense');
    } else if (message.content.startsWith('!addincome')) {
        handleTransaction(message, 'income');
    } else if (message.content.startsWith('!expense')) {
        showTransactions(message, 'expense');
    } else if (message.content.startsWith('!income')) {
        showTransactions(message, 'income');
    } else if (message.content.startsWith('!generateReport')) {
        try {
            const filePath = await generateChart();
            const attachment = new AttachmentBuilder(filePath);
            message.channel.send({ content: '这里是本周的收入与支出图表：', files: [attachment] });
        } catch (error) {
            console.error('Error generating report:', error);
            message.channel.send('生成报告时出错。');
        }
    } else if (message.content.startsWith('!datetotal')) {
        const args = message.content.split(' ');
        if (args.length !== 2) {
            return message.reply('请提供日期，格式为YYYY-MM-DD');
        }
    
        const dateStr = args[1];
        const date = new Date(dateStr + 'T00:00:00Z');
    
        if (isNaN(date.getTime())) {
            return message.reply('无效的日期格式。请使用YYYY-MM-DD');
        }
    
        getDateTotals(date, (err, totals) => {
            if (err) {
                console.error('Error getting date totals:', err);
                return message.reply('获取总额时发生错误。');
            }
            const response = `${dateStr}的收支情况：\n收入总额：$${totals.income.toFixed(2)}\n支出总额：$${totals.expense.toFixed(2)}\n净额：$${(totals.income - totals.expense).toFixed(2)}`;
            message.reply(response);
        });
    
    }
});

// 设置定时任务
schedule.scheduleJob('0 0 * * 0', async () => {
    const channel = await client.channels.fetch('');//YOUR_CHANNEL_ID
    db.all(`SELECT type, category, SUM(amount) as total FROM transactions GROUP BY type, category`, async (err, rows) => {
        if (err) {
            return console.error(err.message);
        }

        let incomeData = {};
        let expenseData = {};

        rows.forEach(row => {
            if (row.type === 'income') {
                incomeData[row.category] = row.total;
            } else if (row.type === 'expense') {
                expenseData[row.category] = row.total;
            }
        });

        const totalIncome = Object.values(incomeData).reduce((acc, val) => acc + val, 0);
        const totalExpense = Object.values(expenseData).reduce((acc, val) => acc + val, 0);
        const netProfit = totalIncome - totalExpense;

        const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 800, height: 600 });

        const colors = {
            "娱乐&购物": '#FF6384',
            "吃饭": '#36A2EB',
            "搭车": '#FFCE56',
            "日常用品": '#4BC0C0',
            "收货成本": '#9966FF',
            "博弈": '#FF9F40',
            "卖出价格（加成本）": '#FF6384',
            "零用钱": '#36A2EB',
            "博弈（跟朋友）": '#FFCE56',
        };

        const data = {
            labels: [...Object.keys(expenseData), ...Object.keys(incomeData)],
            datasets: [
                {
                    label: '支出',
                    data: Object.values(expenseData),
                    backgroundColor: Object.keys(expenseData).map(category => colors[category]),
                },
                {
                    label: '收入',
                    data: Object.values(incomeData),
                    backgroundColor: Object.keys(incomeData).map(category => colors[category]),
                }
            ]
        };

        const config = {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                scales: {
                    x: {
                        stacked: true,
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true
                    }
                }
            }
        };

        const image = await chartJSNodeCanvas.renderToBuffer(config);
        const attachment = new AttachmentBuilder(image, { name: 'weekly-report.png' });

        await channel.send({
            content: `每周財務報告：\n总收入：$${totalIncome}\n总支出：$${totalExpense}\n净利润：$${netProfit}`,
            files: [attachment]
        });
    });
});


// 登录Discord
client.login('');//dcbottoken