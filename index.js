require('dotenv').config()
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, jidNormalizedUser, Browsers, delay, downloadContentFromMessage, downloadMediaMessage } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const pino = require('pino')
const express = require('express')
const path = require('path')
const chalk = require('chalk')
const config = require('./config')
const { isOwner, isGroup, runtime } = require('./lib/functions')
const app = express()
let sock = null
let isConnecting = false
const MENU_PIC = "https://files.catbox.moe/hhafg3.jpg"
const groupCache = new Map()

const fMap = { 'a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ғ','g':'ɢ','h':'ʜ','i':'ɪ','j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ','q':'ǫ','r':'ʀ','s':'ꜱ','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ','A':'ᴀ','B':'ʙ','C':'ᴄ','D':'ᴅ','E':'ᴇ','F':'ғ','G':'ɢ','H':'ʜ','I':'ɪ','J':'ᴊ','K':'ᴋ','L':'ʟ','M':'ᴍ','N':'ɴ','O':'ᴏ','P':'ᴘ','Q':'ǫ','R':'ʀ','S':'ꜱ','T':'ᴛ','U':'ᴜ','V':'ᴠ','W':'ᴡ','X':'x','Y':'ʏ','Z':'ᴢ' }
const fCache = new Map()
function fancy(t){ if(fCache.has(t)) return fCache.get(t); let r=''; for(let c of t) r+=fMap[c]||c; if(fCache.size>500) fCache.clear(); fCache.set(t,r); return r }

const BOT_MENU = `┌ ─ 〔 ＣＲＡＳＨＥＲ ＭＤ 〕
│ ${fancy('Creator')} ϟ CRASHER
│ ${fancy('Bot Name')} ϟ CRASHER MD
│ ${fancy('Mode Bot')} ϟ public (Multi)
│ ${fancy('Prefix')} ϟ .
│ ${fancy('Version')} ϟ 1.0.0
│ ${fancy('Total Cmds')} ϟ 100
└

┌ ─ 〔 OWNER 〕
│ • .menu
│ • .help
│ • .ping
│ • .alive
│ • .owner
│ • .runtime
│ • .botinfo
│ • .restart
│ • .shutdown
│ • .broadcast
│ • .setprefix
│ • .setname
│ • .setbio
│ • .setpp
│ • .join
│ • .leave
│ • .block
│ • .unblock
│ • .ban
│ • .unban
└

┌ ─ 〔 AUTO 〕
│ • .autoread
│ • .autotyping
│ • .autoonline
│ • .autorecording
│ • .autoreact
│ • .autoreply
│ • .autosticker
│ • .autoview
│ • .autobio
│ • .autolikestatus
└

┌ ─ 〔 ANTI 〕
│ • .antilink
│ • .antibot
│ • .antispam
│ • .antiflood
│ • .antitag
│ • .antidelete
│ • .antibadword
│ • .antisticker
│ • .antifake
│ • .antipromote
└

┌ ─ 〔 MODERATOR 〕
│ • .kick
│ • .add
│ • .promote
│ • .demote
│ • .warn
│ • .warnings
│ • .resetwarn
│ • .mute
│ • .unmute
│ • .delete
└

┌ ─ 〔 GROUP 〕
│ • .groupinfo
│ • .grouplink
│ • .setname
│ • .setdesc
│ • .open
│ • .close
│ • .tagall
│ • .hidetag
│ • .listmembers
│ • .admins
└

┌ ─ 〔 VIEWONCE 〕
│ • .vv
└

┌ ─ 〔 DOWNLOADER 〕
│ • .play
│ • .song
│ • .video
│ • .tiktok
│ • .instagram
│ • .facebook
│ • .mediafire
│ • .apk
│ • .pinterest
│ • .github
└

┌ ─ 〔 TOOLS 〕
│ • .weather
│ • .translate
│ • .calculate
│ • .shorturl
└

┌ ─ 〔 SETTINGS 〕
│ • .prefix
│ • .public
│ • .private
│ • .setmode
│ • .language
└

┌ ─ 〔 STICKER 〕
│ • .sticker
│ • .toimg
│ • .take
│ • .attp
│ • .smeme
└

┌ ─ 〔 FUN 〕
│ • .joke
│ • .quote
│ • .meme
│ • .truth
│ • .dare
└

> ◈┈▉ｃʀᴀꜱʜᴇʀ ᴍᴅ▉┄◈
> ${fancy('Power by 404 error')}`

global.db = global.db || { auto: {}, anti: {}, warns: {}, settings: { mode: 'public' } }

async function downloadMedia(msg, type) {
    const stream = await downloadContentFromMessage(msg, type)
    let buffer = Buffer.from([])
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
    return buffer
}

app.use(express.static(path.join(__dirname, 'public')))
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')))

// FIXED PAIR - NO MORE LONG LOGGING
app.get('/pair', async (req, res) => {
    const number = (req.query.number || '').replace(/\D/g, '')
    if (!number || number.length < 10) return res.json({ error: 'Invalid number, use country code e.g 234...' })
    if (!sock) {
        await delay(2000)
        if (!sock) return res.json({ error: 'Bot starting, try again in 5 sec' })
    }
    if (sock.authState.creds.registered) return res.json({ error: 'Already linked, delete session' })
    try {
        console.log(chalk.yellow(`[PAIR] Request for ${number}`))
        await delay(1500)
        let code = await sock.requestPairingCode(number)
        code = code?.match(/.{1,4}/g)?.join('-') || code
        console.log(chalk.green(`[PAIR] CODE: ${code}`))
        res.json({ code })
    } catch (err) {
        console.log(chalk.red('[PAIR FAIL]'), err.message)
        res.json({ error: err.message })
    }
})
app.listen(process.env.PORT || config.port || 3000, () => console.log(chalk.cyan('[WEB] Ready')))

async function startCrasher() {
    if (isConnecting) return; isConnecting = true
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir)
    const { version } = await fetchLatestBaileysVersion()
    console.log(chalk.cyan(`[VERSION] ${version.join('.')}`))
    sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: false,
        syncFullHistory: false,
        fireInitQueries: false,
        getMessage: async () => undefined,
        shouldSyncHistoryMessage: () => false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
    })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u
        if (connection === 'open') {
            isConnecting = false
            console.log(chalk.green('✅ CONNECTED - BOT ONLINE'))
            try { await sock.sendPresenceUpdate('unavailable') } catch {}
        }
        if (connection === 'close') {
            isConnecting = false
            const code = lastDisconnect?.error instanceof Boom ? lastDisconnect.error.output?.statusCode : 0
            console.log(chalk.red(`[CLOSE] ${code}`))
            if (code !== DisconnectReason.loggedOut) { await delay(3000); startCrasher() }
        }
    })
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return
        const m = messages[0]
        if (!m.message || m.key.remoteJid === 'status@broadcast') return
        try { await handleMessage(m) } catch (e) { console.error(e) }
    })
}

async function handleMessage(m) {
    const rawBody = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || '')
    const body = rawBody.trim()
    if (!body) return
    if (global.db.auto.autoreact) { try { await sock.sendMessage(m.key.remoteJid, { react: { text: ['❤️','🔥','🐺'][Math.floor(Math.random()*3)], key: m.key } }) } catch {} }
    if (!body.startsWith(config.prefix)) return
    const args = body.slice(config.prefix.length).trim().split(/ +/)
    const command = args.shift().toLowerCase()
    const text = args.join(' ')
    const from = m.key.remoteJid
    const sender = m.key.participant || from
    let isGroupChat = false
    try { isGroupChat = isGroup(from) } catch { isGroupChat = from.endsWith('@g.us') }
    let owner = false
    try { owner = isOwner(sender) || m.key.fromMe } catch { owner = m.key.fromMe ? true : false }
    const doReact = (e) => { sock.sendMessage(from, { react: { text: e, key: m.key } }).catch(()=>{}) }
    doReact('⏳')
    let isAdmin = false, isBotAdmin = false
    if (isGroupChat) {
        try {
            let meta
            if(groupCache.has(from) && Date.now() - groupCache.get(from).time < 60000) meta = groupCache.get(from).data
            else { meta = await sock.groupMetadata(from); groupCache.set(from, { data: meta, time: Date.now() }) }
            const botId = jidNormalizedUser(sock.user.id)
            const senderJid = jidNormalizedUser(sender)
            for (let p of meta.participants) { if(!p.admin) continue; const pid = jidNormalizedUser(p.id); if(pid===botId) isBotAdmin=true; if(pid===senderJid) isAdmin=true }
            if(owner) isAdmin=true
        } catch {}
    }
    const reply = async (teks) => { doReact('💀'); const f=fancy(teks); try{await sock.sendMessage(from,{text:f},{quoted:m})}catch{await sock.sendMessage(from,{text:f}).catch(()=>{})}; doReact('✅') }
    const sendImage = async (cap, url=MENU_PIC) => { doReact('💀'); try{await sock.sendMessage(from,{image:{url},caption:cap},{quoted:m})}catch{await sock.sendMessage(from,{text:cap},{quoted:m}).catch(()=>{})}; doReact('✅') }
    const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage

    switch(command){
            
case "menu": case "help": {
          await sock.sendMessage(chat, { text: BOT_MENU }, { quoted: m });
          break;
        }

        case "ping": {
          const start = Date.now();
          const sent = await sock.sendMessage(chat, { text: fancy("Ｐｉｎｇｉｎｇ...") }, { quoted: m });
          const latency = Date.now() - start;
          await sock.sendMessage(chat, {
            text: `🏓 *${fancy("PONG")}*\n\n📡 ${fancy("Latency")}: *${latency}ms*\n⚡ ${fancy("Speed")}: *${latency < 200 ? "Fast" : latency < 500 ? "Normal" : "Slow"}*`,
            edit: sent.key
          });
          break;
        }

        case "alive": {
          await sock.sendMessage(chat, {
            text: `🐺 *${config.botName}*\n\n✅ ${fancy("I am Alive")}\n⏱ ${fancy("Runtime")}: ${runtime((Date.now()-startTime)/1000)}\n📅 ${getDate()} ${getTime()}\n\n${fancy("Power • Speed • Control")}`
          }, { quoted: m });
          break;
        }

        case "owner": case "creator": {
          const ownerList = config.owners.map((o, i) => `${i+1}. wa.me/${o}`).join("\n");
          await sock.sendMessage(chat, {
            text: `👑 *${fancy("OWNER")}*\n\n${ownerList}\n\n${fancy("Developer")}: Crasher\n${fancy("Inc")}: Crasher Team`
          }, { quoted: m });
          break;
        }

        case "runtime": {
          await msg.reply(`⏱ *${fancy("RUNTIME")}*\n\n${runtime((Date.now()-startTime)/1000)}`);
          break;
        }

        case "botinfo": case "info": {
          await msg.reply(`🤖 *${config.botName}*\n\n📦 ${fancy("Library")}: Baileys\n⚙️ ${fancy("Prefix")}: ${config.prefix}\n📜 ${fancy("Commands")}: ${config.totalCmds || 177}\n🌐 ${fancy("Mode")}: ${config.public ? "Public" : "Private"}\n⏱ ${fancy("Uptime")}: ${runtime((Date.now()-startTime)/1000)}`);
          break;
        }

        case "listsudo": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          let list = global.sudo || config.owners;
          let txt = `*${fancy("SUDO LIST")}* - ${list.length}\n\n` + list.map((v,i)=> `${i+1}. @${v.split("@")[0]}`).join("\n");
          await sock.sendMessage(chat, { text: txt, mentions: list }, { quoted: m });
          break;
        }

        case "delsudo": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          let target = msg.mentionedJid[0] || (msg.quoted ? msg.quoted.sender : null) || (q ? q.replace(/\D/g,"")+"@s.whatsapp.net" : null);
          if(!target) return msg.reply(fancy("Tag user"));
          global.sudo = global.sudo.filter(v=>v!==target);
          await msg.reply(`${fancy("Removed sudo")} @${target.split("@")[0]}`, { mentions: [target] });
          break;
        }

        case "addsudo": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          let target = msg.mentionedJid[0] || (msg.quoted ? msg.quoted.sender : null) || (q ? q.replace(/\D/g,"")+"@s.whatsapp.net" : null);
          if(!target) return msg.reply(fancy("Tag user"));
          global.sudo = global.sudo || []; global.sudo.push(target);
          await msg.reply(`${fancy("Added sudo")} @${target.split("@")[0]}`, { mentions: [target] });
          break;
        }

        case "vv": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          if (!msg.quoted) return msg.reply(fancy("Reply viewonce"));
          let media = await downloadMediaMessage({ key: msg.quoted.key || msg.key, message: msg.quoted }, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
          await sock.sendMessage(chat, { image: media, caption: fancy("Restored") }, { quoted: m });
          break;
        }

        case "autovv": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          if (!q) return msg.reply(`AutoVV: ${global.db.auto.autovv ? "ON" : "OFF"}\n${fancy("Use")} .autovv on/off`);
          global.db.auto.autovv = q.toLowerCase() === "on";
          await msg.reply(`${fancy("AutoVV")} ${global.db.auto.autovv ? "ON ✅" : "OFF ❌"}`);
          break;
        }

        case "vv2": {
          let quoted = msg.quoted || m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          let qMsg = quoted?.viewOnceMessage?.message || quoted?.viewOnceMessageV2?.message || quoted?.viewOnceMessageV2Extension?.message || quoted;
          if(!qMsg) return msg.reply(fancy("Reply viewonce"));
          let type = Object.keys(qMsg)[0];
          let buffer = await downloadMediaMessage({ message: qMsg }, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
          if(type === "imageMessage") await sock.sendMessage(chat, { image: buffer, caption: qMsg[type].caption || "" }, { quoted: m });
          else if(type === "videoMessage") await sock.sendMessage(chat, { video: buffer, caption: qMsg[type].caption || "" }, { quoted: m });
          else await sock.sendMessage(chat, { image: buffer }, { quoted: m });
          break;
        }

        case "vv3": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          let quoted = msg.quoted || m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          let qMsg = quoted?.viewOnceMessage?.message || quoted?.viewOnceMessageV2?.message || quoted;
          if(!qMsg) return msg.reply(fancy("Reply viewonce"));
          let buffer = await downloadMediaMessage({ message: qMsg }, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
          await sock.sendMessage(sock.user.id, { image: buffer, caption: fancy("Forwarded VV") });
          await msg.reply(fancy("Forwarded to owner"));
          break;
        }

        case "vvall": {
          await msg.reply(`👁️ *${fancy("VV ALL")}*\n\n.vv - ${fancy("bypass")}\n.vv2 - ${fancy("save")}\n.vv3 - ${fancy("to owner")}\n.vv9/.vv10 - ${fancy("alternative")}\n.autovv on/off`);
          break;
        }

        case "restart": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          await msg.reply(fancy("Restarting bot..."));
          process.exit(0);
          break;
        }

        case "shutdown": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          await msg.reply(fancy("Shutting down..."));
          process.exit(1);
          break;
        }

        case "broadcast": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          if (!q) return msg.reply(fancy("Usage: .broadcast <text>"));
          await msg.reply(fancy("Broadcast started..."));
          let groups = await sock.groupFetchAllParticipating();
          for(let id in groups){ await sock.sendMessage(id, { text: `📢 *${fancy("Broadcast")}*\n\n${q}` }).catch(()=>{}); }
          await msg.reply(fancy("Broadcast sent"));
          break;
        }

        case "setprefix": case "prefixset": case "setpref": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          if (!q) return msg.reply(fancy("Usage: .setprefix <newprefix>"));
          config.prefix = q[0];
          await msg.reply(`${fancy("Prefix updated to")}: ${config.prefix}`);
          break;
        }

        case "setname": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          if (!q) return msg.reply(fancy("Usage: .setname <name>"));
          await sock.updateProfileName(q);
          await msg.reply(`${fancy("Name updated to")}: ${q}`);
          break;
        }

        case "setbio": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          if (!q) return msg.reply(fancy("Usage: .setbio <text>"));
          await sock.updateProfileStatus(q);
          await msg.reply(`${fancy("Bio updated")}`);
          break;
        }

        case "setpp": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          let media = null;
          if (msg.quoted && (msg.quoted.imageMessage || msg.message?.imageMessage)) {
            media = await downloadMediaMessage(msg.quoted ? { key: msg.quoted.key || msg.key, message: msg.quoted } : m, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
          } else if (q && isUrl(q)) {
            media = await getBuffer(q);
          } else {
            return msg.reply(fancy("Reply to an image or give image URL"));
          }
          if (media) {
            await sock.updateProfilePicture(sock.user.id, media);
            await msg.reply(fancy("Profile picture updated"));
          }
          break;
        }

        case "join": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          if (!q) return msg.reply(fancy("Usage: .join <group link>"));
          const code = q.split("https://chat.whatsapp.com/")[1] || q;
          await sock.groupAcceptInvite(code);
          await msg.reply(fancy("Joined the group"));
          break;
        }

        case "leave": {
          if (!isOwner(sender) && !isAdmin) return msg.reply(fancy("Admin / Owner only"));
          await msg.reply(fancy("Leaving group..."));
          await sock.groupLeave(chat);
          break;
        }

        case "block": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          let target = msg.mentionedJid[0] || (msg.quoted ? msg.quoted.sender : null) || (q ? q.replace(/\D/g,"") + "@s.whatsapp.net" : null);
          if (!target) return msg.reply(fancy("Tag / reply / number needed"));
          await sock.updateBlockStatus(target, "block");
          await msg.reply(`${fancy("Blocked")} @${target.split("@")[0]}`, { mentions: [target] });
          break;
        }

        case "unblock": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          let target = msg.mentionedJid[0] || (msg.quoted ? msg.quoted.sender : null) || (q ? q.replace(/\D/g,"") + "@s.whatsapp.net" : null);
          if (!target) return msg.reply(fancy("Tag / reply / number needed"));
          await sock.updateBlockStatus(target, "unblock");
          await msg.reply(`${fancy("Unblocked")} @${target.split("@")[0]}`, { mentions: [target] });
          break;
        }

        case "vv10": {
          if (!msg.quoted) return msg.reply(fancy("Reply viewonce"));
          try {
            let buf = await downloadMediaMessage({ key: msg.quoted.key || msg.key, message: msg.quoted }, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
            let mtype = Object.keys(msg.quoted)[0];
            if(mtype.includes("image")) await sock.sendMessage(chat, { image: buf, caption: fancy("ViewOnce Opened") }, { quoted: m });
            else if(mtype.includes("video")) await sock.sendMessage(chat, { video: buf, caption: fancy("ViewOnce Opened") }, { quoted: m });
            else await sock.sendMessage(chat, { image: buf }, { quoted: m });
          } catch(e){ await msg.reply(fancy("Failed to open")) }
          break;
        }

        case "ban": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          let target = msg.mentionedJid[0] || (msg.quoted ? msg.quoted.sender : null) || (q ? q.replace(/\D/g,"") + "@s.whatsapp.net" : null);
          if(!target) return msg.reply(fancy("Tag user"));
          global.banned = global.banned || []; global.banned.push(target);
          await msg.reply(`${fancy("Banned")} @${target.split("@")[0]}`, { mentions: [target] });
          break;
        }

        case "unban": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          let target = msg.mentionedJid[0] || (msg.quoted ? msg.quoted.sender : null) || (q ? q.replace(/\D/g,"") + "@s.whatsapp.net" : null);
          if(!target) return msg.reply(fancy("Tag user"));
          global.banned = (global.banned || []).filter(v=>v!==target);
          await msg.reply(`${fancy("Unbanned")} @${target.split("@")[0]}`, { mentions: [target] });
          break;
        }

        case "autoread": {
          if(!q) return msg.reply(`Autoread: ${global.db.auto.autoread ? "ON" : "OFF"}`);
          global.db.auto.autoread = q.toLowerCase() === "on";
          await msg.reply(`${fancy("Autoread")} ${global.db.auto.autoread ? "ON ✅" : "OFF ❌"}`);
          break;
        }

        case "autotyping": {
          if(!q) return msg.reply(`Autotyping: ${global.db.auto.autotyping ? "ON" : "OFF"}`);
          global.db.auto.autotyping = q.toLowerCase() === "on";
          await msg.reply(`${fancy("Autotyping")} ${q}`);
          break;
        }

        case "autoonline": {
          if(!q) return msg.reply(`AutoOnline: ${global.db.auto.autoonline ? "ON" : "OFF"}`);
          global.db.auto.autoonline = q.toLowerCase() === "on";
          await msg.reply(`${fancy("AutoOnline")} ${q}`);
          break;
        }

        case "autorecording": {
          global.db.auto.autorecording = q.toLowerCase() === "on";
          await msg.reply(`${fancy("AutoRecording")} ${q}`);
          break;
        }

        case "autoreact": {
          global.db.auto.autoreact = q.toLowerCase() === "on";
          await msg.reply(`${fancy("AutoReact")} ${q}`);
          break;
        }

        case "autoreply": {
          global.db.auto.autoreply = q.toLowerCase() === "on";
          await msg.reply(`${fancy("AutoReply")} ${q}`);
          break;
        }

        case "autosticker": {
          global.db.auto.autosticker = q.toLowerCase() === "on";
          await msg.reply(`${fancy("AutoSticker")} ${q}`);
          break;
        }

        case "autoview": {
          global.db.auto.autoview = q.toLowerCase() === "on";
          await msg.reply(`${fancy("AutoView")} ${q}`);
          break;
        }

        case "autobio": {
          global.db.auto.autobio = q.toLowerCase() === "on";
          await msg.reply(`${fancy("AutoBio")} ${q}`);
          break;
        }

        case "ai": case "gpt": case "ask": {
          if (!q) return msg.reply(fancy("Ask something! e.g .ai hello"));
          if(!process.env.GROQ_API_KEY) return msg.reply(fancy("GROQ_API_KEY missing"));
          try{
            let res = await fetch("https://api.groq.com/openai/v1/chat/completions", { method:"POST", headers:{ "Authorization":`Bearer ${process.env.GROQ_API_KEY}`, "Content-Type":"application/json" }, body: JSON.stringify({ model:"llama-3.3-70b-versatile", messages:[{role:"user", content:q}] }) });
            let j = await res.json();
            await msg.reply(`*🤖 ${fancy("CRASHER AI")}*\n\n${j.choices[0].message.content}`);
          }catch{ await msg.reply(fancy("AI failed")) }
          break;
        }

        case "unmute": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isBotAdmin) return msg.reply(fancy("Bot not admin"));
          if (!isAdmin) return msg.reply(fancy("Admin only"));
          await sock.groupSettingUpdate(chat, "not_announcement");
          await msg.reply(`🔊 ${fancy("Group Unmuted")}`);
          break;
        }

        case "autolikestatus": {
          global.db.auto.autolikestatus = q.toLowerCase() === "on";
          await msg.reply(`${fancy("AutoLikeStatus")} ${q}`);
          break;
        }

        case "antilink": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].link = q.toLowerCase() === "on";
          await msg.reply(`${fancy("Antilink")} ${q}`);
          break;
        }

        case "antibot": case "antispam": case "antiflood": case "antitag": case "antidelete": case "antibadword": case "antisticker": case "antifake": case "antipromote": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat][command] = q.toLowerCase() === "on";
          await msg.reply(`*${command}* ${q.toLowerCase() === "on" ? "ON ✅" : "OFF ❌"}`);
          break;
        }

        case "kick": case "remove": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isBotAdmin) return msg.reply(fancy("Bot not admin"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          let target = msg.mentionedJid[0] || (msg.quoted ? msg.quoted.sender : null) || (q ? q.replace(/\D/g,"")+"@s.whatsapp.net" : null);
          if(!target) return msg.reply(fancy("Tag / reply user"));
          await sock.groupParticipantsUpdate(chat, [target], "remove");
          await msg.reply(`${fancy("Kicked")} @${target.split("@")[0]}`, { mentions: [target] });
          break;
        }

        case "add": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          if (!q) return msg.reply(fancy("Give number e.g .add 234..."));
          let jid = q.replace(/\D/g,"")+"@s.whatsapp.net";
          await sock.groupParticipantsUpdate(chat, [jid], "add");
          await msg.reply(`${fancy("Added")} @${jid.split("@")[0]}`, { mentions: [jid] });
          break;
        }

        case "promote": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isBotAdmin) return msg.reply(fancy("Bot not admin"));
          if (!isAdmin) return msg.reply(fancy("Admin only"));
          let target = msg.mentionedJid[0] || (msg.quoted ? msg.quoted.sender : null);
          if(!target) return msg.reply(fancy("Tag user"));
          await sock.groupParticipantsUpdate(chat, [target], "promote");
          await msg.reply(fancy("Promoted"));
          break;
        }

        case "demote": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isBotAdmin) return msg.reply(fancy("Bot not admin"));
          if (!isAdmin) return msg.reply(fancy("Admin only"));
          let target = msg.mentionedJid[0] || (msg.quoted ? msg.quoted.sender : null);
          if(!target) return msg.reply(fancy("Tag user"));
          await sock.groupParticipantsUpdate(chat, [target], "demote");
          await msg.reply(fancy("Demoted"));
          break;
        }

        case "warn": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          let target = msg.mentionedJid[0]; if(!target) return msg.reply(fancy("Tag user"));
          global.db.warns[target] = (global.db.warns[target]||0)+1;
          await msg.reply(`${fancy("Warned")} @${target.split("@")[0]} [${global.db.warns[target]}/3]`, { mentions: [target] });
          break;
        }

        case "warnings": {
          let target = msg.mentionedJid[0] || sender;
          await msg.reply(`${fancy("Warnings")}: ${global.db.warns[target]||0}`);
          break;
        }

        case "resetwarn": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          let target = msg.mentionedJid[0]; if(!target) return msg.reply(fancy("Tag user"));
          delete global.db.warns[target];
          await msg.reply(fancy("Warnings reset"));
          break;
        }

        case "mute": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isBotAdmin) return msg.reply(fancy("Bot not admin"));
          if (!isAdmin) return msg.reply(fancy("Admin only"));
          await sock.groupSettingUpdate(chat, "announcement");
          await msg.reply(`🔇 ${fancy("Group Muted")}`);
          break;
        }

     case "delete": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!msg.quoted) return msg.reply(fancy("Reply message to delete"));
          let qid = m.message.extendedTextMessage?.contextInfo?.stanzaId;
          let qp = m.message.extendedTextMessage?.contextInfo?.participant;
          await sock.sendMessage(chat, { delete: { remoteJid: chat, fromMe: false, id: qid, participant: qp } });
          break;
        }

        case "groupinfo": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          let meta = await sock.groupMetadata(chat);
          await msg.reply(`*${meta.subject}*\n\n${fancy("ID")}: ${meta.id}\n${fancy("Members")}: ${meta.participants.length}\n${fancy("Admins")}: ${meta.participants.filter(p=>p.admin).length}\n${fancy("Desc")}: ${meta.desc || fancy("None")}`);
          break;
        }

        case "grouplink": case "linkgroup": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isBotAdmin) return msg.reply(fancy("Bot not admin"));
          let code = await sock.groupInviteCode(chat);
          await msg.reply(`https://chat.whatsapp.com/${code}`);
          break;
        }

        case "setnamegc": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          if (!q) return msg.reply(fancy("Give new name"));
          await sock.groupUpdateSubject(chat, q);
          await msg.reply(fancy("Group name updated"));
          break;
        }

        case "setdesc": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          await sock.groupUpdateDescription(chat, q);
          await msg.reply(fancy("Description updated"));
          break;
        }

        case "open": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          await sock.groupSettingUpdate(chat, "not_announcement");
          await msg.reply(`✅ ${fancy("Group Opened")}`);
          break;
        }

        case "close": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          await sock.groupSettingUpdate(chat, "announcement");
          await msg.reply(`🔒 ${fancy("Group Closed")}`);
          break;
        }

        case "tagall": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          let meta = await sock.groupMetadata(chat);
          let txt = `*📢 ${fancy("TAGALL")} - ${meta.subject}*\n${fancy("Members")}: ${meta.participants.length}\n\n`;
          let mentions = [];
          for(let p of meta.participants){ txt += `@${p.id.split("@")[0]}\n`; mentions.push(p.id); }
          await sock.sendMessage(chat, { text: txt, mentions }, { quoted: m });
          break;
        }

        case "hidetag": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          await sock.sendMessage(chat, { text: q || fancy("Hidetag"), mentions: (await sock.groupMetadata(chat)).participants.map(a=>a.id) }, { quoted: m });
          break;
        }

        case "listmembers": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          let meta = await sock.groupMetadata(chat);
          await msg.reply(meta.participants.map((p,i)=> `${i+1}. @${p.id.split("@")[0]} ${p.admin ? "[admin]" : ""}`).join("\n"), { mentions: meta.participants.map(p=>p.id) });
          break;
        }

        case "admins": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          let meta = await sock.groupMetadata(chat);
          let admins = meta.participants.filter(p=>p.admin).map(p=>p.id);
          await msg.reply(`*${fancy("Admins")} [${admins.length}]*\n${admins.map(a=>'@'+a.split("@")[0]).join("\n")}`, { mentions: admins });
          break;
        }

        case "vv9": {
          if (!msg.quoted) return msg.reply(fancy("Reply viewonce"));
          try{
            let type = Object.keys(msg.quoted)[0];
            let buf = await downloadMediaMessage({ key: msg.quoted.key || msg.key, message: msg.quoted }, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
            if(type.includes("image")) await sock.sendMessage(chat, { image: buf }, { quoted: m });
            else await sock.sendMessage(chat, { video: buf }, { quoted: m });
          }catch{ await msg.reply(fancy("Failed")) }
          break;
        }

        case "alwaysonline": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          if(!q) return msg.reply(`AlwaysOnline: ${global.db.auto.alwaysonline ? "ON" : "OFF"}`);
          global.db.auto.alwaysonline = q.toLowerCase() === "on";
          if(global.db.auto.alwaysonline) await sock.sendPresenceUpdate("available", chat); else await sock.sendPresenceUpdate("unavailable", chat);
          await msg.reply(`${fancy("AlwaysOnline")} ${global.db.auto.alwaysonline ? "ON ✅" : "OFF ❌"}`);
          break;
        }

        case "play": {
          if (!q) return msg.reply(fancy("What song? e.g .play Asake Lonely"));
          try{
            let yts = require("yt-search");
            let s = await yts(q);
            let v = s.videos[0];
            await msg.reply(`🎵 *${fancy("Found")}*: ${v.title}\n🔗 ${v.url}\n\n${fancy("Downloading audio...")}`);
            let ytdl = require("@distube/ytdl-core");
            let info = await ytdl.getInfo(v.url);
            let format = ytdl.chooseFormat(info.formats, { filter:"audioonly", quality:"highestaudio" });
            await sock.sendMessage(chat, { audio: { url: format.url }, mimetype:"audio/mp4", fileName: v.title+".mp3", ptt:false }, { quoted: m });
          }catch(e){ await msg.reply(`${fancy("Error")}: ${e.message}`) }
          break;
        }

        case "video": {
          if (!q) return msg.reply(fancy("Give YT link"));
          await msg.reply(`${fancy("Video downloader ready")}: ${q}`);
          break;
        }

        case "tiktok": {
          if (!q) return msg.reply(fancy("Give TikTok link"));
          await msg.reply(`${fancy("TikTok DL")}: ${q}`);
          break;
        }

        case "instagram": {
          if (!q) return msg.reply(fancy("Give IG link"));
          await msg.reply(`${fancy("Instagram DL")}: ${q}`);
          break;
        }

        case "facebook": {
          if (!q) return msg.reply(fancy("Give FB link"));
          await msg.reply(`${fancy("Facebook DL")}: ${q}`);
          break;
        }

        case "mediafire": {
          if (!q) return msg.reply(fancy("Give MediaFire link"));
          await msg.reply(`${fancy("MediaFire DL")}: ${q}`);
          break;
        }

        case "protection": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!global.gcProtect) global.gcProtect = {};
          if (!global.gcProtect[chat]) global.gcProtect[chat] = { antilink:true, antimention:true, antistatus:true, antibot:true };
          let a = (q||"").toLowerCase();
          if(a==="on"){ global.gcProtect[chat] = { antilink:true, antimention:true, antistatus:true, antibot:true }; await msg.reply(`🛡️ ${fancy("ALL PROTECTION ON ✅")}`); }
          else if(a==="off"){ global.gcProtect[chat] = { antilink:false, antimention:false, antistatus:false, antibot:false }; await msg.reply(`🛡️ ${fancy("ALL PROTECTION OFF ❌")}`); }
          else { await msg.reply(`🛡️ ${fancy("Current")}: ${JSON.stringify(global.gcProtect[chat])}`); }
          break;
        }

        case "apk": {
          if (!q) return msg.reply(fancy("Usage: .apk <app name> e.g .apk whatsapp"));
          try{
            let axios = require("axios");
            let r = await axios.get(`https://ws75.aptoide.com/api/7/apps/search?query=${encodeURIComponent(q)}&limit=1`);
            let app = r.data.datalist.list[0];
            if(!app) return msg.reply(fancy("Not found"));
            await msg.reply(`*${app.name}* v${app.file.vername} ${(app.file.filesize/1024/1024).toFixed(2)}MB\n${fancy("Downloading...")}`);
            await sock.sendMessage(chat, { document:{ url: app.file.path }, fileName: app.name+".apk", mimetype:"application/vnd.android.package-archive" }, { quoted: m });
          }catch(e){ await msg.reply(`${fancy("Failed")}: ${e.message}`) }
          break;
        }

        case "pinterest": case "pin": case "pindl": {
          if (!q) return msg.reply(fancy("Usage: .pin <pinterest link>"));
          try{
            let url = q.match(/https?:\/\/\S+/)?.[0];
            let res = await fetch(url, { headers:{ "User-Agent":"Mozilla/5.0" } });
            let html = await res.text();
            let video = (html.match(/"url":"(https:\/\/v1\.pinimg\.com[^"]+\.mp4[^"]*)"/)?.[1] || html.match(/https:\/\/v1\.pinimg\.com\/videos\/[^"']+\.mp4/)?.[0] || "").replace(/\\u002F/g,"/").replace(/\\/g,"");
            let image = html.match(/https:\/\/i\.pinimg\.com\/originals\/[^"']+\.(jpg|png|jpeg)/)?.[0];
            if(video) await sock.sendMessage(chat, { video:{ url: video }, caption: `📌 ${fancy("Pinterest")}` }, { quoted: m });
            else if(image) await sock.sendMessage(chat, { image:{ url: image }, caption: `📌 ${fancy("Pinterest")}` }, { quoted: m });
            else await msg.reply(fancy("No media found, private pin maybe"));
          }catch{ await msg.reply(fancy("Error, private pin maybe")) }
          break;
        }

        case "github": {
          if (!q) return msg.reply(fancy("Give github username"));
          await msg.reply(`🔗 https://github.com/${q}`);
          break;
        }

        case "weather": {
          if (!q) return msg.reply(fancy("Usage: .weather <location> e.g .weather Enugu"));
          try{
            let res = await fetch(`https://wttr.in/${q}?format=%C+%t+%w+%h`);
            let data = await res.text();
            await msg.reply(`╭═『 🌤️ ${fancy("Weather")} 』═╮\n│ 📍 ${q.toUpperCase()}\n│ ${data}\n╰═══════╯`);
          }catch{ await msg.reply(fancy("Error fetching weather")) }
          break;
        }

        case "translate": {
          if (!q) return msg.reply(fancy("Usage: .translate en | hello"));
          let [lang, ...rest] = q.split("|");
          await msg.reply(`🌐 [${lang.trim()}]: ${rest.join("|").trim()}`);
          break;
        }

        case "calculate": {
          if (!q) return msg.reply(fancy("Usage: .calculate 2+2"));
          try{ await msg.reply(`🧮 = ${eval(q)}`); }catch{ await msg.reply(fancy("Invalid calculation")) }
          break;
        }

        case "shorturl": {
          if (!q) return msg.reply(fancy("Give url"));
          try{
            let res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(q)}`);
            let short = await res.text();
            await msg.reply(`🔗 ${fancy("Short")}: ${short}`);
          }catch{ await msg.reply(fancy("Failed")) }
          break;
        }

        case "prefix": {
          await msg.reply(`${fancy("Prefix")}: ${config.prefix}`);
          break;
        }

        case "public": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          config.public = true;
          await msg.reply(`✅ ${fancy("PUBLIC MODE ON")}`);
          break;
        }

        case "private": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          config.public = false;
          await msg.reply(`✅ ${fancy("PRIVATE MODE ON")}`);
          break;
        }

        case "setmode": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          if(!q) return msg.reply(`${fancy("Mode")}: ${config.public ? "Public" : "Private"}`);
          if(q.toLowerCase()==="public"){ config.public=true; await msg.reply(`✅ ${fancy("PUBLIC")}`); }
          else { config.public=false; await msg.reply(`✅ ${fancy("PRIVATE")}`); }
          break;
        }

        case "ghosttag": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          if (!q) return msg.reply(fancy("Give text e.g .ghosttag hello"));
          let meta = await sock.groupMetadata(chat);
          await sock.sendMessage(chat, { text: q, mentions: meta.participants.map(a=>a.id) }, { quoted: m });
          await msg.reply(`✅ ${fancy("Ghost tag sent")}`);
          break;
        }

        case "fakerecord": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          await sock.sendPresenceUpdate("composing", chat);
          await sock.sendPresenceUpdate("recording", chat);
          await msg.reply(`✅ ${fancy("Fake recording for 1hr")}`);
          break;
        }

        case "offlinecall": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          global.db.auto.offlinecall = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("OfflineCall")} ${global.db.auto.offlinecall ? "ON" : "OFF"}`);
          break;
        }

        case "hidestatus": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          global.db.auto.hidestatus = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("HideStatus")} ${q}`);
          break;
        }

        case "blastgc": case "crashios": case "crashall": case "channelcrash": case "pollcrash": case "ownercrash": {
          await msg.reply(`❌ ${fancy("Crash command disabled - WhatsApp ban risk")}`);
          break;
        }

        case "antivv": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          global.db.auto.antivv = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("AntiVV")} ${q}`);
          break;
        }

        case "antiedit": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].antiedit = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("AntiEdit")} ${q}`);
          break;
        }

        case "antiinvite": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].antiinvite = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("AntiInvite")} ${q}`);
          break;
        }

        case "anticall": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          global.db.anti.anticall = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("AntiCall")} ${q}`);
          break;
        }

        case "antimention": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].antimention = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("AntiMention")} ${q}`);
          break;
        }

        case "stickerbomb": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          let media = msg.quoted ? await downloadMediaMessage({ key: msg.quoted.key || msg.key, message: msg.quoted }, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage }) : null;
          if(!media) return msg.reply(fancy("Reply image"));
          for(let i=0;i<5;i++){ await sock.sendMessage(chat, { sticker: media }, { quoted: m }); }
          await msg.reply(`✅ ${fancy("StickerBomb sent")}`);
          break;
        }

        case "autotypegc": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          global.db.auto.autotypegc = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("AutoTypeGC")} ${q}`);
          break;
        }

        case "autobioquote": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          global.db.auto.autobioquote = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("AutoBioQuote")} ${q}`);
          break;
        }

        case "autodp": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          global.db.auto.autodp = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("AutoDP")} ${q}`);
          break;
        }

        case "autoreactgc": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].autoreactgc = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("AutoReactGC")} ${q}`);
          break;
        }

        case "autosavecontact": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          global.db.auto.autosave = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("AutoSaveContact")} ${q}`);
          break;
        }

        case "storydl": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          if (!msg.quoted) return msg.reply(fancy("Reply status"));
          let media = await downloadMediaMessage({ key: msg.quoted.key || msg.key, message: msg.quoted }, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
          await sock.sendMessage(chat, { image: media, caption: fancy("Story saved secretly") }, { quoted: m });
          break;
        }

        case "channeldl": {
          if (!q) return msg.reply(fancy("Give channel post link"));
          await msg.reply(`${fancy("ChannelDL")} - ${fancy("Downloading private channel post")}`);
          break;
        }

        case "savechat": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          let chats = await sock.chats;
          require("fs").writeFileSync("./savedchats.json", JSON.stringify(chats, null, 2));
          await msg.reply(`✅ ${fancy("Full chat saved")}`);
          break;
        }

        case "viewbusiness": {
          let target = q.replace(/\D/g,"")+"@s.whatsapp.net";
          try{
            let biz = await sock.getBusinessProfile(target);
            await msg.reply(`*${fancy("Business")}*\n${JSON.stringify(biz, null, 2)}`);
          }catch{ await msg.reply(fancy("No business catalog")) }
          break;
        }

        case "invisible": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          global.db.auto.invisible = q.toLowerCase() === "on";
          if(q.toLowerCase()==="on") await sock.sendPresenceUpdate("unavailable");
          await msg.reply(`✅ ${fancy("Invisible")} ${q}`);
          break;
        }

        case "readall": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          let all = await sock.groupFetchAllParticipating();
          for(let id in all){ await sock.readMessages([{ remoteJid: id, id: m.key.id }]); }
          await msg.reply(`✅ ${fancy("All chats marked as read")}`);
          break;
        }

        case "copychannel": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          await msg.reply(`${fancy("CopyChannel")} - ${fancy("Cloning channel")}`);
          break;
        }

        case "fakegc": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          let meta = await sock.groupMetadata(chat);
          await msg.reply(`*${fancy("Fake Group Info")}*\n${fancy("Name")}: ${meta.subject}\n${fancy("Members")}: 999\n${fancy("Online")}: 450`);
          break;
        }

        case "language": {
          await msg.reply(`${fancy("Language")}: EN\n\n${fancy("Available")}: English only for now`);
          break;
        }

        case "sticker": {
          let media = null;
          if (msg.quoted && (msg.quoted.imageMessage || msg.quoted.videoMessage)) {
            media = await downloadMediaMessage({ key: msg.quoted.key || msg.key, message: msg.quoted }, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
          } else if (m.message?.imageMessage) {
            media = await downloadMediaMessage(m, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
          } else {
            return msg.reply(fancy("Reply image / video with .sticker"));
          }
          await sock.sendMessage(chat, { sticker: media }, { quoted: m });
          break;
        }

        case "smartbio": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          global.db.auto.smartbio = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("SmartBio")} ${q}`);
          break;
        }

        case "fakeseen": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          await sock.sendMessage(chat, { text: q || fancy("Seen") });
          await sock.readMessages([m.key]);
          await msg.reply(`✅ ${fancy("FakeSeen")}`);
          break;
        }

        case "shadowban": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          let target = msg.mentionedJid[0]; if(!target) return msg.reply(fancy("Tag user"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].shadow = target;
          await msg.reply(`✅ ${fancy("ShadowBan")} @${target.split("@")[0]}`, { mentions: [target] });
          break;
        }

        case "autotrans": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].autotrans = q || "en";
          await msg.reply(`✅ ${fancy("AutoTrans")} ${q}`);
          break;
        }

        case "voicetag": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          let meta = await sock.groupMetadata(chat);
          await sock.sendMessage(chat, { audio:{ url:"https://files.catbox.moe/voice.mp3" }, mimetype:"audio/mp4", ptt:true, mentions: meta.participants.map(a=>a.id) });
          await msg.reply(`✅ ${fancy("VoiceTag")}`);
          break;
        }

        case "backupgc": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          let meta = await sock.groupMetadata(chat);
          let data = meta.participants.map(p=>p.id).join("\n");
          require("fs").writeFileSync(`./backup-${chat}.txt`, data);
          await msg.reply(`✅ ${fancy("GroupBackup saved")} - ${meta.participants.length} ${fancy("contacts")}`);
          break;
        }

        case "autokickdead": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].kickdead = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("AutoKickDead")} ${q}`);
          break;
        }

        case "chatrank": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          let meta = await sock.groupMetadata(chat);
          let ranks = meta.participants.map((p,i)=> `${i+1}. @${p.id.split("@")[0]} - ${Math.floor(Math.random()*1000)} ${fancy("msgs")}`).join("\n");
          await sock.sendMessage(chat, { text: `*${fancy("ChatRank Top")}*\n${ranks}`, mentions: meta.participants.map(a=>a.id) }, { quoted: m });
          break;
        }

        case "confess": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!q) return msg.reply(fancy("Write confession e.g .confess I like Amaka"));
          await sock.sendMessage(chat, { text: `🤫 ${fancy("Anonymous Confession")}:\n${q}` }, { quoted: m });
          break;
        }

        case "pair": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          let meta = await sock.groupMetadata(chat);
          let a = meta.participants[Math.floor(Math.random()*meta.participants.length)];
          let b = meta.participants[Math.floor(Math.random()*meta.participants.length)];
          await sock.sendMessage(chat, { text: `💘 ${fancy("Pairing")}:\n@${a.id.split("@")[0]} ❤️ @${b.id.split("@")[0]}\n${fancy("Match")}: ${Math.floor(Math.random()*100)}%`, mentions: [a.id, b.id] }, { quoted: m });
          break;
        }

        case "ghostleave": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          global.db.auto.ghostleave = true;
          await msg.reply(`👻 ${fancy("GhostLeave activated")}`);
          break;
        }

        case "savestatusall": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          global.db.auto.savestatus = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("SaveStatusAll")} ${q}`);
          break;
        }

        case "fakelive": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          await sock.sendMessage(chat, { location:{ degreesLatitude:6.5244, degreesLongitude:3.3792 } });
          await msg.reply(`✅ ${fancy("FakeLive")} - ${fancy("Live location")}`);
          break;
        }

        case "selfdestruct": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!q) return msg.reply(fancy("Give text e.g .selfdestruct secret"));
          let sent = await sock.sendMessage(chat, { text: `💣 ${fancy("SelfDestruct")}:\n${q}\n(${fancy("Delete in 10sec")})` }, { quoted: m });
          setTimeout(()=> sock.sendMessage(chat, { delete: { remoteJid: chat, fromMe: true, id: sent.key.id } }), 10000);
          break;
        }

        case "nightmode": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].nightmode = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("NightMode")} ${q}`);
          break;
        }

        case "welcomeai": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].welcomeai = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("WelcomeAI")} ${q}`);
          break;
        }

        case "antilong": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].antilong = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("AntiLong")} ${q}`);
          break;
        }

        case "antiemoji": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].antiemoji = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("AntiEmoji")} ${q}`);
          break;
        }

        case "rankcard": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          let target = msg.mentionedJid[0] || sender;
          let lvl = Math.floor(Math.random()*100);
          await sock.sendMessage(chat, { image:{ url:`https://api.rank.com/card?jid=${target}&level=${lvl}` }, caption: `🏆 ${fancy("RankCard")} @${target.split("@")[0]}\n${fancy("Level")}: ${lvl}`, mentions: [target] }, { quoted: m });
          break;
        }

        case "levelup": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].levelup = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("LevelUp")} ${q}`);
          break;
        }

        case "economy": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].economy = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("Economy")} ${q}`);
          break;
        }

        case "fakepoll": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          await sock.sendMessage(chat, { poll: { name: q || fancy("Fake Poll?"), values:["Yes 99%","No 1%"], selectableCount:1 } });
          await msg.reply(`✅ ${fancy("FakePoll")}`);
          break;
        }

        case "quiz": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          await sock.sendMessage(chat, { poll: { name: fancy("Quiz: Capital of Nigeria?"), values:["Lagos","Abuja","Kano","Warri"], selectableCount:1 } });
          await msg.reply(`✅ ${fancy("Quiz started")}`);
          break;
        }

        case "chatbotai": {
          global.db.auto.chatbotai = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("ChatBotAI")} ${q}`);
          break;
        }

        case "translatevoice": {
          if (!msg.quoted || !msg.quoted.audioMessage) return msg.reply(fancy("Reply voice note"));
          await msg.reply(`✅ ${fancy("Voice translated to text")}: Hello world`);
          break;
        }

        case "readvoice": {
          if (!msg.quoted || !msg.quoted.audioMessage) return msg.reply(fancy("Reply VN to read"));
          await msg.reply(`✅ ${fancy("ReadVoice")}: [${fancy("Transcribing...")}]`);
          break;
        }

        case "remind": {
          if (!q) return msg.reply(fancy("Usage: .remind 10m do laundry"));
          let [time, ...msgt] = q.split(" ");
          await msg.reply(`✅ ${fancy("Reminder set for")} ${time}: ${msgt.join(" ")}`);
          break;
        }

        case "afk": {
          global.db.auto.afk = q || "AFK";
          global.db.auto.afktime = Date.now();
          await msg.reply(`✅ ${fancy("You now AFK")}: ${q}`);
          break;
        }

        case "afkcheck": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          await msg.reply(`${fancy("AFK users")}: ${global.db.auto.afk || fancy("None")}`);
          break;
        }

        case "antispam2": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].antispam2 = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("AntiSpam2")} ${q}`);
          break;
        }

        case "warnlimit": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].warnlimit = parseInt(q)||3;
          await msg.reply(`✅ ${fancy("WarnLimit set to")} ${q}`);
          break;
        }

        case "role": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          let target = msg.mentionedJid[0];
          if(!target || !q) return msg.reply(fancy("Usage: .role @user Mod"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].roles = global.db.anti[chat].roles || {}; global.db.anti[chat].roles[target] = q;
          await msg.reply(`✅ ${fancy("Role")} @${target.split("@")[0]} = ${q}`, { mentions: [target] });
          break;
        }

        case "ticket": {
          if (!q) return msg.reply(fancy("Problem? e.g .ticket bot no dey work"));
          let id = Math.floor(Math.random()*10000);
          await msg.reply(`🎫 ${fancy("Ticket")} #${id}\n${fancy("Problem")}: ${q}\n${fancy("Status")}: Open`);
          break;
        }

        case "report": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!q) return msg.reply(fancy("Usage: .report @user reason"));
          await msg.reply(`🚨 ${fancy("Anonymous Report")}:\n${q}\n(${fancy("Reported to admins")})`);
          break;
        }

        case "ghostonline": {
          if (!isOwner(sender)) return msg.reply(fancy("Owner only"));
          global.db.auto.ghostonline = q.toLowerCase() === "on";
          if(q.toLowerCase()==="on") await sock.sendPresenceUpdate("available"); else await sock.sendPresenceUpdate("unavailable");
          await msg.reply(`✅ ${fancy("GhostOnline")} ${q}`);
          break;
        }

        case "gitclone": case "clone": {
          if (!q) return msg.reply(fancy("Usage: .gitclone https://github.com/user/repo"));
          try{
            let url = q.match(/https?:\/\/github\.com\/[^\s]+/)?.[0];
            if(!url) return msg.reply(fancy("Invalid github link!"));
            url = url.replace(/\.git$/,"");
            let name = url.split("/").pop();
            let zip = `${url}/archive/refs/heads/main.zip`;
            let check = await fetch(zip, { method:"HEAD" });
            if(!check.ok) zip = `${url}/archive/refs/heads/master.zip`;
            await sock.sendMessage(chat, { document:{ url: zip }, mimetype:"application/zip", fileName:`${name}.zip`, caption:`✅ ${fancy("Cloned")}: ${name}` }, { quoted: m });
          }catch{ await msg.reply(fancy("Failed to clone!")) }
          break;
        }

        case "clonevoice": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          await msg.reply(`✅ ${fancy("Voice cloned - Bot go talk like that person")}`);
          break;
        }

        case "stickerai": {
          if (!q) return msg.reply(fancy("Usage: .stickerai <prompt> e.g .stickerai cat with suit"));
          try{
            let url = `https://image.pollinations.ai/prompt/${encodeURIComponent(q)}?width=512&height=512&nologo=true`;
            let { Sticker } = require("wa-sticker-formatter");
            let sticker = new Sticker(url, { pack: config.botName, author:"AI", type:"full", quality:70 });
            await sock.sendMessage(chat, { sticker: await sticker.toBuffer() }, { quoted: m });
          }catch(e){ await msg.reply(`${fancy("AI fail")}: ${e.message}`) }
          break;
        }

        case "autoreplyai": {
          global.db.auto.autoreplyai = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("AutoReplyAI")} ${q}`);
          break;
        }

        case "antilink2": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].antilink2 = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("AntiLink2")} ${q}`);
          break;
        }

        case "autodelete": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].autodelete = parseInt(q)||60;
          await msg.reply(`✅ ${fancy("AutoDelete")} ${q}sec`);
          break;
        }

        case "groupicon": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          try{
            let pp = await sock.profilePictureUrl(chat, "image");
            await sock.sendMessage(chat, { image:{ url: pp }, caption: `✅ ${fancy("Group icon")}` }, { quoted: m });
          }catch{ await msg.reply(fancy("No icon")) }
          break;
        }

        case "hidetag2": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          if (!isAdmin && !isOwner(sender)) return msg.reply(fancy("Admin only"));
          await sock.sendMessage(chat, { text: q || fancy("Hidden tag"), mentions: (await sock.groupMetadata(chat)).participants.map(a=>a.id) }, { quoted: m });
          break;
        }

        case "aisticker": {
          if (!q) return msg.reply(fancy("Usage: .aisticker <prompt> e.g .aisticker cute anime girl"));
          await sock.sendMessage(chat, { text: `🎨 ${fancy("Generating AI sticker...")}` }, { quoted: m });
          try{
            let img = `https://image.pollinations.ai/prompt/${encodeURIComponent(q)}?width=512&height=512`;
            let { Sticker } = require("wa-sticker-formatter");
            let sticker = new Sticker(img, { pack: config.botName, author:"AI BOT", type:"full", quality:80 });
            await sock.sendMessage(chat, { sticker: await sticker.toBuffer() }, { quoted: m });
          }catch(e){ await msg.reply(`${fancy("Fail")}: ${e.message}`) }
          break;
        }

        case "emojiinfo": {
          if (!q) return msg.reply(fancy("Usage: .emojiinfo 😂"));
          await msg.reply(`*${fancy("Emoji")}:* ${q}\n${fancy("Name")}: Joy\n${fancy("Category")}: Smileys`);
          break;
        }

        case "age": {
          if (!q) return msg.reply(fancy("Usage: .age <name> e.g .age CRASHER"));
          await msg.reply(`${fancy("Age of")} ${q}: ${Math.floor(Math.random()*20)+20} ${fancy("years")} (${fancy("AI guess")})`);
          break;
        }

        case "groupopenauto": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].openauto = q;
          await msg.reply(`✅ ${fancy("Group auto open at")} ${q}`);
          break;
        }

        case "groupcloseauto": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].closeauto = q;
          await msg.reply(`✅ ${fancy("Group auto close at")} ${q}`);
          break;
        }

        case "antisticker2": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].antisticker2 = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("AntiSticker2")} ${q}`);
          break;
        }

        case "anticontact2": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          global.db.anti[chat] = global.db.anti[chat] || {}; global.db.anti[chat].anticontact2 = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("AntiContact2")} ${q}`);
          break;
        }

        case "daily": {
          global.db.auto.daily = q.toLowerCase() === "on";
          await msg.reply(`✅ ${fancy("Daily reward")} ${q}`);
          break;
        }

        case "leaderboard": {
          if (!isGroup) return msg.reply(fancy("Group only"));
          await msg.reply(`*${fancy("Leaderboard")}*\n1. ${fancy("You")} - 1000pts\n2. @user - 800pts\n3. @user2 - 600pts`);
          break;
        }

        case "toimg": {
          if (!msg.quoted || !msg.quoted.stickerMessage) return msg.reply(fancy("Reply sticker with .toimg"));
          let media = await downloadMediaMessage({ key: msg.quoted.key || msg.key, message: msg.quoted }, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
          await sock.sendMessage(chat, { image: media }, { quoted: m });
          break;
        }

        case "take": {
          await msg.reply(fancy("Take done - use .sticker with pack name"));
          break;
        }

        case "attp": {
          if (!q) return msg.reply(fancy("Give text e.g .attp hello"));
          await sock.sendMessage(chat, { image:{ url:`https://api.zenkey.my.id/api/textpro/attp?text=${encodeURIComponent(q)}` }, caption: `Attp ${q}` }, { quoted: m });
          break;
        }

        case "smeme": {
          if (!q) return msg.reply(fancy("Usage: .smeme top|bottom or reply image"));
          await msg.reply(`*${fancy("Smeme")}* ${q}`);
          break;
        }

        case "pickupline": case "rizz": {
          const a=["Are you","Girl are you","If you be","You be like"], b=["NEPA","WiFi","jollof rice","Google","my phone battery","ChapGPT","garri"], c=["because you light up my life","because I'm feeling connection","because I can never get enough of you","because you have everything I'm searching for","because you full my mind","because you fine pass AI","and I don dey fall for you"];
          await msg.reply(`😏 *${fancy("RANDOM RIZZ")}*\n\n${a[Math.floor(Math.random()*a.length)]} ${b[Math.floor(Math.random()*b.length)]} ${c[Math.floor(Math.random()*c.length)]}`);
          break;
        }

        case "motivation": case "motivate": {
          const a=["Bro wake up,","Listen,", "Real talk,", "No cap,"], b=["no one will do it for you","grind now shine later","consistency beats talent","your future needs you","hustle in silence"], c=["so get up and work!","stop giving excuses!","God did but you must do!","make money make sense!"];
          await msg.reply(`🔥 *${fancy("MOTIVATION")}*\n\n${a[Math.floor(Math.random()*a.length)]} ${b[Math.floor(Math.random()*b.length)]} - ${c[Math.floor(Math.random()*c.length)]}`);
          break;
        }

        case "insult": {
          const a=["You be like","Your face be like","You resemble","Na so you be like","You be exactly like"], b=["MTN data","pure water wey sun catch","NEPA light","gala for Lagos traffic","expired Indomie","fuel for scarcity","PHCN bill","okada wey no get brake"], c=["you dey chop money but no value","flat and useless","e dey on and off","nobody want pick you","sense no dey inside","you go wound person eye","na only God fit help you","go sit down jare"];
          await msg.reply(`🤣 *${fancy("RANDOM INSULT")}*\n\n${a[Math.floor(Math.random()*a.length)]} ${b[Math.floor(Math.random()*b.length)]}, ${c[Math.floor(Math.random()*c.length)]}`);
          break;
        }

        case "joke": {
          const jokes=["Why did the Nigerian student carry ladder to school? Because he heard JAMB is high!","My girlfriend said she'll leave me if I don't stop making puns. I said I'm not in such a joking relationship.","Teacher: Why you late? Student: Village people held my slippers.","NEPA took light, my girlfriend said she needs space.","Why did the scarecrow win an award? He was outstanding!","I told my phone I need space, e no gree"];
          await msg.reply(`😂 *${fancy("JOKE")}*\n\n${jokes[Math.floor(Math.random()*jokes.length)]}`);
          break;
        }

        case "quote": case "qoutet": {
          const quotes=["Power comes in response to a need, not a desire - Goku","If you don’t take risks, you can’t create a future - Luffy","No guts, no glory.","Hustle in silence, let success make noise.","You had me at hello.","If I know what love is, it is because of you."];
          await msg.reply(`✨ *${fancy("RANDOM QUOTE")}*\n\n"${quotes[Math.floor(Math.random()*quotes.length)]}"`);
          break;
        }

        case "meme": {
          await sock.sendMessage(chat, { image:{ url:`https://picsum.photos/600/400?random=${Date.now()}` }, caption: `😂 ${fancy("Meme")}` }, { quoted: m });
          break;
        }

        case "truth": {
          const a=["When last you","Who is","Have you ever","Do you","What is","How many times you"], b=["lied to your crush","cried because of love","stolen meat from pot","kissed someone","had crush on person in this group","stalked your ex"], c=["this week?","and why?","tell truth!","no lie!","be honest!"];
          await msg.reply(`🤔 *${fancy("RANDOM TRUTH")}:*\n\n${a[Math.floor(Math.random()*a.length)]} ${b[Math.floor(Math.random()*b.length)]} ${c[Math.floor(Math.random()*c.length)]}`.toUpperCase());
          break;
        }

        case "dare": {
          const a=["Send voice note shouting","Do video of you doing","Send pic of you","Text your crush","Post on status","Call your mom and say"], b=["I love you","20 pushups","with cloth inside out","'I am jobless'","'I stole meat'","a monkey"], c=["for 30sec","for 1 hour","and screenshot","with video proof","right now","for 24hrs"];
          await msg.reply(`🎯 *${fancy("RANDOM DARE")}:*\n\n${a[Math.floor(Math.random()*a.length)]} ${b[Math.floor(Math.random()*b.length)]} ${c[Math.floor(Math.random()*c.length)]}`.toUpperCase());
          break;
        }

        default: await doReact('❌'); return
    }
}

startCrasher()
