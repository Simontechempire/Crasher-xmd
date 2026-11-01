require('dotenv').config()
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidNormalizedUser,
    Browsers,
    delay,
    downloadContentFromMessage
} = require('@whiskeysockets/baileys')
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

// FANCY FONT CONVERTER - ALL REPLIES USE THIS
function fancy(text) {
    const map = {
        'a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ғ','g':'ɢ','h':'ʜ','i':'ɪ','j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ','q':'ǫ','r':'ʀ','s':'ꜱ','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ',
        'A':'ᴀ','B':'ʙ','C':'ᴄ','D':'ᴅ','E':'ᴇ','F':'ғ','G':'ɢ','H':'ʜ','I':'ɪ','J':'ᴊ','K':'ᴋ','L':'ʟ','M':'ᴍ','N':'ɴ','O':'ᴏ','P':'ᴘ','Q':'ǫ','R':'ʀ','S':'ꜱ','T':'ᴛ','U':'ᴜ','V':'ᴠ','W':'ᴡ','X':'x','Y':'ʏ','Z':'ᴢ',
        '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9'
    }
    return text.split('').map(c => map[c] || c).join('')
}

// NEW MENU YOU GAVE ME - EXACTLY
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
app.get('/pair', async (req, res) => {
    const number = (req.query.number || '').replace(/\D/g, '')
    if (!number || number.length < 10) return res.json({ error: 'Invalid number' })
    if (!sock) return res.json({ error: 'Bot not started yet' })
    if (sock.authState.creds.registered) return res.json({ error: 'Already linked' })
    try {
        if (isConnecting) await delay(3000)
        const code = await sock.requestPairingCode(number)
        const formatted = code?.match(/.{1,4}/g)?.join('-') || code
        res.json({ code: formatted })
    } catch (err) { res.json({ error: err.message }) }
})
app.listen(process.env.PORT || config.port || 3000, () => console.log(chalk.cyan('[WEB] Ready')))

async function startCrasher() {
    if (isConnecting) return; isConnecting = true
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir)
    const { version } = await fetchLatestBaileysVersion()
    const msgRetryCounterCache = new Map()
    sock = makeWASocket({
        version, 
        logger: pino({ level: 'silent' }), 
        printQRInTerminal: false,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
        // STEALTH - NO CHROME, NO ONLINE
        browser: Browsers.macOS('Firefox'), 
        markOnlineOnConnect: false,
        syncFullHistory: false,
        msgRetryCounterCache,
        // FIX WAITING FOR THIS MESSAGE
        getMessage: async (key) => { return undefined },
        shouldSyncHistoryMessage: () => false,
        // FAST
        fireInitQueries: false,
        shouldIgnoreJid: jid => false,
    })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u
        if (connection === 'open') { 
            isConnecting = false; 
            console.log(chalk.green('✅ Connected - STEALTH MODE'))
            // STAY OFFLINE - LAST SEEN ONLY
            try { await sock.sendPresenceUpdate('unavailable') } catch {}
        }
        if (connection === 'close') {
            isConnecting = false
            const code = lastDisconnect?.error instanceof Boom ? lastDisconnect.error.output?.statusCode : 0
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

    if (global.db.auto.autoreact === true) {
        const emojis = ['❤️','🔥','😂','😍','🥰','😎','🤖','🐺','⚡','👑','💯']
        const random = emojis[Math.floor(Math.random()*emojis.length)]
        try { await sock.sendMessage(m.key.remoteJid, { react: { text: random, key: m.key } }) } catch {}
    }

    if (!body.startsWith(config.prefix)) return
    const args = body.slice(config.prefix.length).trim().split(/ +/)
    const command = args.shift().toLowerCase()
    const text = args.join(' ')
    const from = m.key.remoteJid
    const sender = m.key.participant || from
    const isGroupChat = isGroup(from)
    const owner = isOwner(sender)

    // FAST REACTION SYSTEM - ⏳ RUNNING
    const doReact = async (emoji) => { try { await sock.sendMessage(from, { react: { text: emoji, key: m.key } }) } catch {} }
    await doReact('⏳')

    let participants = [], isAdmin = false, isBotAdmin = false, groupMetadata = null
    if (isGroupChat) {
        try {
            groupMetadata = await sock.groupMetadata(from)
            participants = groupMetadata.participants || []
            const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net'
            const botJid = jidNormalizedUser(botId)
            const senderJid = jidNormalizedUser(sender)
            for (let p of participants) {
                const pid = jidNormalizedUser(p.id)
                const isPAdmin = p.admin === 'admin' || p.admin === 'superadmin' || p.admin === true
                if (isPAdmin && pid === botJid) isBotAdmin = true
                if (isPAdmin && pid === senderJid) isAdmin = true
            }
            if (owner) isAdmin = true
        } catch (e) {}
    }

    // FANCY REPLY - ALL TEXT IN FANCY FONT
    const reply = async (teks) => {
        await doReact('💀') // WORKING
        try { 
            await sock.sendMessage(from, { text: fancy(teks) }, { quoted: m }) 
        } catch { 
            await sock.sendMessage(from, { text: fancy(teks) }) 
        }
        await doReact('✅') // COMPLETE
    }
    const sendImage = async (caption, url = MENU_PIC) => {
        await doReact('💀')
        try { 
            await sock.sendMessage(from, { image: { url }, caption: caption }, { quoted: m }) 
        } catch (e) {
            await sock.sendMessage(from, { text: caption }, { quoted: m })
        }
        await doReact('✅')
    }

    const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage
    const ownerOnly = async () => { if (!owner) { await reply('👑 Owner only!'); return true } return false }
    const groupOnly = async () => { if (!isGroupChat) { await reply('👥 Group only!'); return true } return false }
    const adminOnly = async () => { if (!isAdmin && !owner) { await reply('🛡️ Admin only!'); return true } return false }
    const botAdmin = async () => { if (!isBotAdmin) { await reply('Bot must be admin!'); return true } return false }
        if(!global.gcProtect) global.gcProtect={}; if(!global.gcWarn) global.gcWarn={}; let warnKick=async(chat,user,limit,type)=>{if(!global.gcWarn[chat])global.gcWarn[chat]={};if(!global.gcWarn[chat][user])global.gcWarn[chat][user]={};if(!global.gcWarn[chat][user][type])global.gcWarn[chat][user][type]=0;global.gcWarn[chat][user][type]++;let c=global.gcWarn[chat][user][type];if(c>=limit){try{await sock.sendMessage(chat,{text:"🚫 @"+user.split('@')[0]+" KICKED - "+c+"/"+limit+" "+type,mentions:[user]});}catch{}try{await sock.groupParticipantsUpdate(chat,[user],'remove');}catch{}delete global.gcWarn[chat][user][type];}else{try{await sock.sendMessage(chat,{text:"⚠️ @"+user.split('@')[0]+" WARN "+c+"/"+limit+" - No "+type,mentions:[user]});}catch{}}}; if(!global.gcProtect[from]) global.gcProtect[from]={antilink:true,antimention:true,antistatus:true,antibot:true}; if(body.toLowerCase().startsWith(config.prefix+'antilink')){if(!isGroupChat)return;let a=(args[0]||'').toLowerCase();if(!global.gcProtect[from])global.gcProtect[from]={};if(a==='on')global.gcProtect[from].antilink=true;else if(a==='off')global.gcProtect[from].antilink=false;else global.gcProtect[from].antilink=!global.gcProtect[from].antilink;await reply("🔗 Antilink "+(global.gcProtect[from].antilink?"ON ✅":"OFF ❌")+" - 5 warn kick");return;} if(body.toLowerCase().startsWith(config.prefix+'antigmention')||body.toLowerCase().startsWith(config.prefix+'antimention')||body.toLowerCase().startsWith(config.prefix+'antigcmention')){if(!isGroupChat)return;let a=(args[0]||'').toLowerCase();if(!global.gcProtect[from])global.gcProtect[from]={};if(a==='on')global.gcProtect[from].antimention=true;else if(a==='off')global.gcProtect[from].antimention=false;else global.gcProtect[from].antimention=!global.gcProtect[from].antimention;await reply("👥 AntiGmention "+(global.gcProtect[from].antimention?"ON ✅":"OFF ❌")+" - 2 warn kick");return;} if(body.toLowerCase().startsWith(config.prefix+'antigcstatus')||body.toLowerCase().startsWith(config.prefix+'antistatus')){if(!isGroupChat)return;let a=(args[0]||'').toLowerCase();if(!global.gcProtect[from])global.gcProtect[from]={};if(a==='on')global.gcProtect[from].antistatus=true;else if(a==='off')global.gcProtect[from].antistatus=false;else global.gcProtect[from].antistatus=!global.gcProtect[from].antistatus;await reply("📢 AntiGCStatus "+(global.gcProtect[from].antistatus?"ON ✅":"OFF ❌")+" - 1 warn kick");return;} if(body.toLowerCase().startsWith(config.prefix+'antibot')){if(!isGroupChat)return;let a=(args[0]||'').toLowerCase();if(!global.gcProtect[from])global.gcProtect[from]={};if(a==='on')global.gcProtect[from].antibot=true;else if(a==='off')global.gcProtect[from].antibot=false;else global.gcProtect[from].antibot=!global.gcProtect[from].antibot;await reply("🤖 AntiBot "+(global.gcProtect[from].antibot?"ON ✅":"OFF ❌")+" - 2 warn kick");return;} if(global.gcProtect?.[from]?.antilink&&/(https?:\/\/|www\.|chat\.whatsapp\.com|wa\.me|t\.me|bit\.ly|\.com|\.net|\.org|\.xyz|\.link)/i.test(body)&&isGroupChat&&!isAdmin&&isBotAdmin){try{await sock.sendMessage(from,{delete:m.key});}catch{}await warnKick(from,sender,5,'antilink');return;} if(global.gcProtect?.[from]?.antimention&&(m.message?.extendedTextMessage?.contextInfo?.mentionedJid||[]).length>=4&&isGroupChat&&!isAdmin&&isBotAdmin){try{await sock.sendMessage(from,{delete:m.key});}catch{}await warnKick(from,sender,2,'antigmention');return;} if(global.gcProtect?.[from]?.antistatus&&m.message?.extendedTextMessage?.contextInfo?.isForwarded&&isGroupChat&&!isAdmin&&isBotAdmin){try{await sock.sendMessage(from,{delete:m.key});}catch{}await warnKick(from,sender,1,'antigcstatus');return;} if(global.gcProtect?.[from]?.antibot&&m.message?.key?.id?.startsWith('3EB0')&&isGroupChat&&!isAdmin&&isBotAdmin){try{await sock.sendMessage(from,{delete:m.key});}catch{}await warnKick(from,sender,2,'antibot');return;}
    switch(command){
        case 'menu': case 'help': return await sendImage(BOT_MENU)
        case 'ping': return await reply(`🏓 Pong! ${Date.now() - m.messageTimestamp*1000}ms\n⏱️ Runtime: ${runtime(process.uptime())}`)
        case 'alive': return await sendImage(`🐺 ${fancy('CRASHER MD ALIVE')}\n⚡ ${fancy('Power Speed Control')}\n⏱️ ${runtime(process.uptime())}`)
        case 'owner': return await reply(`👑 Owner: wa.me/${config.owner[0].replace(/[^0-9]/g,'')}`)
        case 'runtime': return await reply(`⏱️ Runtime: ${runtime(process.uptime())}`)
        case 'botinfo': return await sendImage(`🤖 ${config.botName}\nPrefix: ${config.prefix}\nMode: ${global.db.settings.mode}\nTotal: 100`)
        case 'restart': if(await ownerOnly()) return; await reply('♻️ Restarting...'); process.exit(0)
        case 'shutdown': if(await ownerOnly()) return; await reply('💤 Shutdown'); process.exit(0)
        case 'broadcast': if(await ownerOnly()) return; if(!text) return await reply('Text needed'); for(let id of Object.keys(await sock.groupFetchAllParticipating())){ await sock.sendMessage(id, { text: `📢 Broadcast:\n${text}` }) } return await reply('Broadcast sent')
        case 'setprefix': { if(!owner) return; if(!text) return await reply(`Give new prefix! Example: .setprefix !`); config.prefix = text.trim(); return await reply(`Prefix changed to: ${config.prefix} ✅`); break; }
        case 'setname': { if(!owner) return; if(!text) return await reply(`Give new name! Example: .setname LUCY`); config.name = text.trim(); return await reply(`Bot name changed to: ${config.name} ✅`); break; }
        case 'setbio': if(await ownerOnly()) return; await sock.updateProfileStatus(text); return await reply('Bio updated')
        case 'setpp': { if(await ownerOnly()) return; const q = m.message.imageMessage || quoted?.imageMessage; if(!q) return await reply('Send image with .setpp'); const buf = await downloadMedia(q, 'image'); await sock.updateProfilePicture(sock.user.id, buf); return await reply('PP updated') }
        case 'join': if(await ownerOnly()) return; try{ const link = text.split('/').pop(); await sock.groupAcceptInvite(link); return await reply('Joined') }catch{ return await reply('Invalid link') }
        case 'leave': { if(await groupOnly()) return; if(!isAdmin && !owner) return await reply(`Only group admin & owner can use this!`); await reply(`Goodbye 👋 - ${config.name} leaving...`); return await sock.groupLeave(from); break; }
        case 'block': if(await ownerOnly()) return; await sock.updateBlockStatus(text.replace(/[^0-9]/g,'')+'@s.whatsapp.net','block'); return await reply('Blocked')
        case 'unblock': if(await ownerOnly()) return; await sock.updateBlockStatus(text.replace(/[^0-9]/g,'')+'@s.whatsapp.net','unblock'); return await reply('Unblocked')
        case 'ban': { if(await groupOnly()) return; if(!isAdmin && !owner) return await reply(`👑 Only group admin & owner can use ban!`); const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || m.message.extendedTextMessage?.contextInfo?.participant || (text?text.replace(/[^0-9]/g,'')+'@s.whatsapp.net':null); if(!target) return await reply(`Usage: .ban @user or reply`); global.db.warns[target] = true; return await reply(`Banned @${target.split('@')[0]} ✅`, target); break; }
        case 'unban': if(await ownerOnly()) return; delete global.db.warns[text]; return await reply('Unbanned')
        case 'autoread': global.db.auto.autoread = text === 'on'; return await reply(`Autoread ${global.db.auto.autoread?'ON':'OFF'}`)
        case 'autotyping': global.db.auto.autotyping = text === 'on'; return await reply(`Autotyping ${text}`)
        case 'autoonline': global.db.auto.autoonline = text === 'on'; return await reply(`AutoOnline ${text}`)
        case 'autorecording': global.db.auto.autorecording = text === 'on'; return await reply(`AutoRec ${text}`)
        case 'autoreact': global.db.auto.autoreact = text === 'on'; return await reply(`AutoReact ${text}`)
        case 'autoreply': global.db.auto.autoreply = text === 'on'; return await reply(`AutoReply ${text}`)
        case 'autosticker': global.db.auto.autosticker = text === 'on'; return await reply(`AutoSticker ${text}`)
        case 'autoview': global.db.auto.autoview = text === 'on'; return await reply(`AutoView ${text}`)
        case 'autobio': global.db.auto.autobio = text === 'on'; return await reply(`AutoBio ${text}`)
        case 'autolikestatus': global.db.auto.autolikestatus = text === 'on'; return await reply(`AutoLikeStatus ${text}`)
        case 'antilink': if(await groupOnly()||await adminOnly()) return; global.db.anti[from] = global.db.anti[from]||{}; global.db.anti[from].link = text==='on'; return await reply(`Antilink ${text}`)
        case 'antibot': case 'antispam': case 'antiflood': case 'antitag': case 'antidelete': case 'antibadword': case 'antisticker': case 'antifake': case 'antipromote': if(await groupOnly()||await adminOnly()) return; global.db.anti[from] = global.db.anti[from]||{}; global.db.anti[from][command] = text==='on'; return await reply(`${command} ${text}`)
        case 'kick': { if(await groupOnly()) return; if(!isAdmin && !owner) return await reply(`👑 Only group admin & owner can use kick!`); if(!isBotAdmin) return await reply(`Bot must be admin!`); const qPart = m.message.extendedTextMessage?.contextInfo?.participant; const mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; const target = mentioned || qPart || (text ? text.replace(/[^0-9]/g,'')+'@s.whatsapp.net':null); if(!target) return await reply(`Usage: .kick @user OR reply to user`); try{ await doReact('💀'); await sock.groupParticipantsUpdate(from,[target],'remove'); await sock.sendMessage(from,{ text: fancy(`Kicked @${target.split('@')[0]} ✅`), mentions:[target] }, {quoted:m}); await doReact('✅'); }catch(e){ await doReact('❌'); await reply(`Failed - bot not admin`) } return }
        case 'add': { if(await groupOnly()) return; if(!isAdmin && !owner) return; if(!text) return await reply(`Give number! Example: .add 2348012345678`); let num = text.replace(/[^0-9]/g,''); if(!num) return; const jid = num+'@s.whatsapp.net'; await sock.groupParticipantsUpdate(from, [jid], 'add'); return await reply(`Added @${num} ✅`, { mentions: [jid] }); break; }
        case 'promote': { if(await groupOnly()) return; if(!isAdmin && !owner) return; let jid = m.quoted?.sender || m.mentionedJid[0]; if(!jid) return; await sock.groupParticipantsUpdate(from, [jid], 'promote'); await reply(`Promoted @${jid.split('@')[0]} ✅`, { mentions: [jid] }); break; }
        case 'demote': { if(await groupOnly()) return; if(!isAdmin && !owner) return; let jid = m.quoted?.sender || m.mentionedJid[0]; if(!jid) return; await sock.groupParticipantsUpdate(from, [jid], 'demote'); await reply(`Demoted @${jid.split('@')[0]} ✅`, { mentions: [jid] }); break; }
        case 'warn': { if(await groupOnly()||await adminOnly()) return; const mention = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; if(!mention) return await reply('Tag'); global.db.warns[mention] = (global.db.warns[mention]||0)+1; return await reply(`Warned ${mention} [${global.db.warns[mention]}/3]`) }
        case 'warnings': { const mention = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || sender; return await reply(`Warnings: ${global.db.warns[mention]||0}`) }
        case 'resetwarn': { if(await groupOnly()||await adminOnly()) return; const mention = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; delete global.db.warns[mention]; return await reply('Reset') }
        case 'mute': { if(await groupOnly()) return; if(!isAdmin && !owner) return; await sock.groupSettingUpdate(from, 'announcement'); await reply(`Group Muted 🔇 - Admin only`); break; }
        case 'unmute': case 'umute': { if(await groupOnly()) return; if(!isAdmin && !owner) return; await sock.groupSettingUpdate(from, 'not_announcement'); await reply(`Group Unmuted 🔊`); break; }
        case 'delete': { if(await groupOnly()||await adminOnly()) return; const qid = m.message.extendedTextMessage?.contextInfo?.stanzaId; const qp = m.message.extendedTextMessage?.contextInfo?.participant; if(!qid) return await reply('Reply message'); await sock.sendMessage(from,{ delete: { remoteJid: from, fromMe: false, id: qid, participant: qp } }); return }
        case 'groupinfo': if(await groupOnly()) return; return await reply(`*${groupMetadata.subject}*\nID: ${from}\nMembers: ${participants.length}\nAdmins: ${participants.filter(p=>p.admin).length}\nDesc: ${groupMetadata.desc||'None'}`)
        case 'grouplink': case 'linkgroup': if(await groupOnly()||await botAdmin()) return; const code = await sock.groupInviteCode(from); return await reply(`https://chat.whatsapp.com/${code}`)
        case 'setnamegc': if(await groupOnly()||await adminOnly()||await botAdmin()) return; await sock.groupUpdateSubject(from,text); return await reply('Name updated')
        case 'setdesc': if(await groupOnly()||await adminOnly()||await botAdmin()) return; await sock.groupUpdateDescription(from,text); return await reply('Desc updated')
        case 'open': { if(await groupOnly()) return; if(!isAdmin && !owner) return; await sock.groupSettingUpdate(from, 'not_announcement'); return await reply(`Group Opened ✅`); break; }
        case 'close': { if(await groupOnly()) return; if(!isAdmin && !owner) return; await sock.groupSettingUpdate(from, 'announcement'); return await reply(`Group Closed 🔒 - Only admin can chat`); break; }
        case 'tagall': { if(await groupOnly()) return; if(!isAdmin && !owner) return await reply(`Only admin & owner!`); const members = groupMetadata.participants; let txt = `*📢 TAGALL - ${groupMetadata.subject}*\n\n*Members: ${members.length}*\n\n`; const ments = []; for(const m of members){ txt += `@${m.id.split('@')[0]}\n`; ments.push(m.id); } return await sock.sendMessage(from, { text: txt, mentions: ments }, { quoted: m }); break; }
        case 'hidetag': { if(await groupOnly()||await adminOnly()) return; await doReact('💀'); await sock.sendMessage(from,{ text: text||'hidetag', mentions: participants.map(a=>a.id) }); await doReact('✅'); return }
        case 'listmembers': if(await groupOnly()) return; return await reply(participants.map((p,i)=> `${i+1}. ${p.id.split('@')[0]} ${p.admin?'[admin]':''}`).join('\n'))
        case 'admins': if(await groupOnly()) return; const admins = participants.filter(p=>p.admin).map(p=>p.id); return await reply(`*Admins [${admins.length}]*\n${admins.map(a=> '@'+a.split('@')[0]).join('\n')}`)
        case 'vv': { if(!owner) return await reply(`👑 Owner only!`); if(!quoted) return await reply('Reply to view-once image/video'); const qmsg = quoted.viewOnceMessageV2?.message || quoted.viewOnceMessage?.message || quoted; const type = Object.keys(qmsg)[0]; const msgType = type.includes('image')?'image':type.includes('video')?'video':'audio'; try{ const buffer = await downloadMedia(qmsg[type], msgType); await doReact('💀'); if(msgType==='image') await sock.sendMessage(from,{ image: buffer, caption: qmsg[type].caption||'' }, {quoted:m}); else if(msgType==='video') await sock.sendMessage(from,{ video: buffer, caption: qmsg[type].caption||'' }, {quoted:m}); else await sock.sendMessage(from,{ audio: buffer, mimetype:'audio/mp4', ptt:true }, {quoted:m}); await doReact('✅'); }catch(e){ await doReact('❌'); return await reply('Failed: '+e.message) } break; }
        case 'alwaysonline': { if(!owner) return await reply(`👑 Owner only!`); const on = text==='on'; global.db.auto.alwaysonline = on; try{ if(on) await sock.sendPresenceUpdate('available', from); else await sock.sendPresenceUpdate('unavailable'); }catch{} return await reply(`AlwaysOnline ${on?'ON ✅':'OFF ❌'}`); break; }
        case 'play': case 'song': if(!text) return await reply('Give song name'); return await reply(`🎵 Searching YT: ${text}`)
        case 'video': if(!text) return await reply('Give YT link'); return await reply(`🎬 Video: ${text}`)
        case 'tiktok': if(!text) return await reply('Give TikTok link'); return await reply(`TikTok: ${text}`)
        case 'instagram': if(!text) return await reply('Give IG link'); return await reply(`IG: ${text}`)
        case 'facebook': if(!text) return await reply('Give FB link'); return await reply(`FB: ${text}`)
        case 'mediafire': if(!text) return await reply('Give MediaFire link'); return await reply(`MediaFire: ${text}`)
        case 'protection': {
        case 'protection':{if(!isGroupChat)return reply('❌ Group only');if(!global.gcProtect)global.gcProtect={};if(!global.gcProtect[from])global.gcProtect[from]={antilink:true,antimention:true,antistatus:true,antibot:true};let a=(args[0]||'').toLowerCase();if(a==='on'){global.gcProtect[from]={antilink:true,antimention:true,antistatus:true,antibot:true};return reply('🛡️ ALL PROTECTION ON ✅');}if(a==='off'){global.gcProtect[from]={antilink:false,antimention:false,antistatus:false,antibot:false};return reply('🛡️ ALL PROTECTION OFF ❌');}return reply(`🛡️ Current: Antilink ${global.gcProtect[from].antilink?'ON ✅':'OFF ❌'} | Use: .protection on/off`);}
        case 'apk': if(!text) return await reply('Give app name'); return await reply(`APK: ${text}`)
        case 'pinterest': if(!text) return await reply('Give query'); return await sendImage(`Pinterest: ${text}`, `https://picsum.photos/600/400?random=${Date.now()}`)
        case 'github': if(!text) return await reply('Give github link'); return await reply(`GitHub: ${text}`)
        case 'weather': { if(!text) return await reply('Give city'); try { const res = await fetch(`https://wttr.in/${encodeURIComponent(text)}?format=3`); const t = await res.text(); return await reply(`🌤️ ${t}`) } catch { return await reply('Weather fail') } }
        case 'translate': { if(!text) return await reply('.translate en | hello'); const [lang, ...rest] = text.split('|'); return await reply(`🌐 [${lang.trim()}]: ${rest.join('|').trim()}`) }
        case 'calculate': { try { return await reply(`🧮 = ${eval(text)}`) } catch { return await reply('Invalid calc') } }
        case 'shorturl': { if(!text) return await reply('Give url'); return await reply(`🔗 https://tinyurl.com/api-create.php?url=${encodeURIComponent(text)}`) }
        case 'prefix': return await reply(`Prefix: ${config.prefix}`)
        case 'public': { if(!owner) return; global.db.settings.mode = 'public'; return await reply(`Public Mode ON ✅ - Everybody can use bot`); break; }
        case 'private': { if(!owner) return; const on = text==='on'; global.db.settings.mode = on?'private':'public'; return await reply(`${on?'Private ✅':'Public ✅'} Mode`); break; }
        case 'setmode': { if(!owner) return; if(!text) return await reply(`Usage: .setmode private / public`); const mode = text.toLowerCase(); if(mode==='private'){ global.db.settings.mode='private'; return await reply(`Private Mode ON ✅ - Only Owner`); } else { global.db.settings.mode='public'; return await reply(`Public Mode ON ✅ - Everybody`); } break; }
        case 'language': return await reply('Lang: EN')
        case 'sticker': { const q = m.message.imageMessage || quoted?.imageMessage; if(!q) return await reply('Send image with .sticker'); const buf = await downloadMedia(q, 'image'); await doReact('💀'); await sock.sendMessage(from,{ sticker: buf }, { quoted: m }); await doReact('✅'); return }
        case 'toimg': { const q = quoted?.stickerMessage; if(!q) return await reply('Reply sticker'); const buf = await downloadMedia(q, 'sticker'); await doReact('💀'); await sock.sendMessage(from,{ image: buf }, { quoted: m }); await doReact('✅'); return }
        case 'take': return await reply('Take done')
        case 'attp': if(!text) return await reply('Text?'); return await sendImage(`Attp ${text}`, `https://api.zenkey.my.id/api/textpro/attp?text=${encodeURIComponent(text)}`)
        case 'smeme': return await reply(`Smeme ${text}`)
        case 'pickupline': case 'rizz': { const a=["Are you","Girl are you","If you be","You be like"], b=["NEPA","WiFi","jollof rice","Google","my phone battery","ChapGPT","garri"], c=["because you light up my life","because I'm feeling connection","because I can never get enough of you","because you have everything I'm searching for","because you full my mind","because you fine pass AI","and I don dey fall for you"]; await reply(`😏 *RANDOM RIZZ*\n\n${a[Math.floor(Math.random()*a.length)]} ${b[Math.floor(Math.random()*b.length)]} ${c[Math.floor(Math.random()*c.length)]}`); break; }
        case 'motivation': case 'motivate': { const a=["Bro wake up,","Listen,", "Real talk,", "No cap,"], b=["no one will do it for you","grind now shine later","consistency beats talent","your future needs you","hustle in silence"], c=["so get up and work!","stop giving excuses!","God did but you must do!","make money make sense!"]; await reply(`🔥 *MOTIVATION*\n\n${a[Math.floor(Math.random()*a.length)]} ${b[Math.floor(Math.random()*b.length)]} - ${c[Math.floor(Math.random()*c.length)]}`); break; }
        case 'insult': { const a=["You be like","Your face be like","You resemble","Na so you be like","You be exactly like"], b=["MTN data","pure water wey sun catch","NEPA light","gala for Lagos traffic","expired Indomie","fuel for scarcity","PHCN bill","okada wey no get brake"], c=["you dey chop money but no value","flat and useless","e dey on and off","nobody want pick you","sense no dey inside","you go wound person eye","na only God fit help you","go sit down jare"]; await reply(`🤣 *RANDOM INSULT*\n\n${a[Math.floor(Math.random()*a.length)]} ${b[Math.floor(Math.random()*b.length)]}, ${c[Math.floor(Math.random()*c.length)]}!`); break; }
        case 'joke': { const j=["Why did the Nigerian student carry ladder to school? Because he heard JAMB is high!","My girlfriend said she'll leave me if I don't stop making puns. I'm not sure she was joking - but pun intended.","Teacher: Why you late? Student: Village people held my slippers.","NEPA took light, my girlfriend said she needs space. I off my inverter too - make everywhere dark.","Why did the scarecrow win an award? He was outstanding in his field!","I told my phone I need space, e no gree - na why e dey follow me everywhere."]; await reply(`😂 *JOKE*\n\n${j[Math.floor(Math.random()*j.length)]}`); break; }
        case 'quote': case 'qoutet': { const anime=["Power comes in response to a need, not a desire - Goku","If you don’t take risks, you can’t create a future - Luffy","Fear is not evil, it tells you what weakness is - Gildarts","It’s not the face that makes someone a monster, it’s the choices they make - Naruto"], motive=["No guts, no glory.","Hustle in silence, let success make noise.","Consistency > Intensity.","Dream big, start small.","God did!"], love=["You had me at hello.","I love you not because of who you are, but who I am when with you.","True love is rare.","If I know what love is, it is because of you."]; const all=[...anime,...motive,...love]; await reply(`✨ *RANDOM QUOTE*\n\n"${all[Math.floor(Math.random()*all.length)]}"`); break; }
        case 'meme': return await sendImage('Meme', `https://picsum.photos/600/400?random=${Date.now()}`)
        case 'truth': { const a=["When last you","Who is","Have you ever","Do you","What is","How many times you","Why did you","Have you","What's your","Do you still"], b=["lied to your crush","cried because of love","stolen meat from pot","kissed someone","had crush on person in this group","stalked your ex","sent nudes","cheated on exam","faked sickness","had sex dream"], c=["this week?","and why?","tell truth!","no lie!","be honest!","we dey listen!","or you lie?","confess now!","make we hear!"]; return await reply(`🤔 *RANDOM TRUTH:*\n\n${a[Math.floor(Math.random()*a.length)]} ${b[Math.floor(Math.random()*b.length)]} ${c[Math.floor(Math.random()*c.length)]}`.toUpperCase()); break; }
        case 'dare': { const a=["Send voice note shouting","Do video of you doing","Send pic of you","Text your crush","Post on status","Call your mom and say","Dance like","Act like","Eat","Drink","Wear","Shout in group","Sing","Cry like","Laugh like"], b=["I love you","20 pushups","with cloth inside out","'I am jobless'","'I stole meat'","a monkey","a baby","raw pepper","water on your head","your shoe on your head","I am mumu","frog jump","chicken dance","I need money","proposing to chair"], c=["for 30sec","for 1 hour","and screenshot","with video proof","right now","for 24hrs","in family group","to your ex","to 3 contacts","shouting crush name","on one leg","with eyes closed"]; return await reply(`🎯 *RANDOM DARE:*\n\n${a[Math.floor(Math.random()*a.length)]} ${b[Math.floor(Math.random()*b.length)]} ${c[Math.floor(Math.random()*c.length)]}`.toUpperCase()); break; }
        default: await doReact('❌'); return
    }
}

startCrasher()
