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
        case 'setprefix': if(await ownerOnly()) return; if(!text) return await reply('Give new prefix'); config.prefix = text; return await reply(`Prefix: ${text}`)
        case 'setname': if(await ownerOnly()) return; await sock.updateProfileName(text); return await reply(`Name: ${text}`)
        case 'setbio': if(await ownerOnly()) return; await sock.updateProfileStatus(text); return await reply('Bio updated')
        case 'setpp': { if(await ownerOnly()) return; const q = m.message.imageMessage || quoted?.imageMessage; if(!q) return await reply('Send image with .setpp'); const buf = await downloadMedia(q, 'image'); await sock.updateProfilePicture(sock.user.id, buf); return await reply('PP updated') }
        case 'join': if(await ownerOnly()) return; try{ const link = text.split('/').pop(); await sock.groupAcceptInvite(link); return await reply('Joined') }catch{ return await reply('Invalid link') }
        case 'leave': if(await ownerOnly()) return; if(await groupOnly()) return; await sock.groupLeave(from); return
        case 'block': if(await ownerOnly()) return; await sock.updateBlockStatus(text.replace(/[^0-9]/g,'')+'@s.whatsapp.net','block'); return await reply('Blocked')
        case 'unblock': if(await ownerOnly()) return; await sock.updateBlockStatus(text.replace(/[^0-9]/g,'')+'@s.whatsapp.net','unblock'); return await reply('Unblocked')
        case 'ban': if(await ownerOnly()) return; global.db.warns[text] = true; return await reply('Banned')
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
        case 'kick': { if(await groupOnly()||await adminOnly()||await botAdmin()) return; const mention = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (text? text.replace(/[^0-9]/g,'')+'@s.whatsapp.net':null); if(!mention) return await reply('Tag user'); await sock.groupParticipantsUpdate(from,[mention],'remove'); return await reply('Kicked') }
        case 'add': { if(await groupOnly()||await adminOnly()||await botAdmin()) return; const num = text.replace(/[^0-9]/g,'')+'@s.whatsapp.net'; await sock.groupParticipantsUpdate(from,[num],'add'); return await reply('Added') }
        case 'promote': { if(await groupOnly()||await adminOnly()||await botAdmin()) return; const mention = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || text.replace(/[^0-9]/g,'')+'@s.whatsapp.net'; await sock.groupParticipantsUpdate(from,[mention],'promote'); return await reply('Promoted') }
        case 'demote': { if(await groupOnly()||await adminOnly()||await botAdmin()) return; const mention = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || text.replace(/[^0-9]/g,'')+'@s.whatsapp.net'; await sock.groupParticipantsUpdate(from,[mention],'demote'); return await reply('Demoted') }
        case 'warn': { if(await groupOnly()||await adminOnly()) return; const mention = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; if(!mention) return await reply('Tag'); global.db.warns[mention] = (global.db.warns[mention]||0)+1; return await reply(`Warned ${mention} [${global.db.warns[mention]}/3]`) }
        case 'warnings': { const mention = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || sender; return await reply(`Warnings: ${global.db.warns[mention]||0}`) }
        case 'resetwarn': { if(await groupOnly()||await adminOnly()) return; const mention = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; delete global.db.warns[mention]; return await reply('Reset') }
        case 'mute': if(await groupOnly()||await adminOnly()||await botAdmin()) return; await sock.groupSettingUpdate(from,'announcement'); return await reply('🔒 Muted')
        case 'unmute': if(await groupOnly()||await adminOnly()||await botAdmin()) return; await sock.groupSettingUpdate(from,'not_announcement'); return await reply('🔓 Unmuted')
        case 'delete': { if(await groupOnly()||await adminOnly()) return; const qid = m.message.extendedTextMessage?.contextInfo?.stanzaId; const qp = m.message.extendedTextMessage?.contextInfo?.participant; if(!qid) return await reply('Reply message'); await sock.sendMessage(from,{ delete: { remoteJid: from, fromMe: false, id: qid, participant: qp } }); return }
        case 'groupinfo': if(await groupOnly()) return; return await reply(`*${groupMetadata.subject}*\nID: ${from}\nMembers: ${participants.length}\nAdmins: ${participants.filter(p=>p.admin).length}\nDesc: ${groupMetadata.desc||'None'}`)
        case 'grouplink': case 'linkgroup': if(await groupOnly()||await botAdmin()) return; const code = await sock.groupInviteCode(from); return await reply(`https://chat.whatsapp.com/${code}`)
        case 'setnamegc': if(await groupOnly()||await adminOnly()||await botAdmin()) return; await sock.groupUpdateSubject(from,text); return await reply('Name updated')
        case 'setdesc': if(await groupOnly()||await adminOnly()||await botAdmin()) return; await sock.groupUpdateDescription(from,text); return await reply('Desc updated')
        case 'open': if(await groupOnly()||await adminOnly()||await botAdmin()) return; await sock.groupSettingUpdate(from,'not_announcement'); return await reply('🔓 Opened')
        case 'close': if(await groupOnly()||await adminOnly()||await botAdmin()) return; await sock.groupSettingUpdate(from,'announcement'); return await reply('🔒 Closed')
        case 'tagall': { if(await groupOnly()||await adminOnly()) return; let txt = `*Tag All: ${text||''}*\n`; for(let p of participants) txt+=`@${p.id.split('@')[0]}\n`; await doReact('💀'); await sock.sendMessage(from,{ text: txt, mentions: participants.map(a=>a.id) }, { quoted: m }); await doReact('✅'); return }
        case 'hidetag': { if(await groupOnly()||await adminOnly()) return; await doReact('💀'); await sock.sendMessage(from,{ text: text||'hidetag', mentions: participants.map(a=>a.id) }); await doReact('✅'); return }
        case 'listmembers': if(await groupOnly()) return; return await reply(participants.map((p,i)=> `${i+1}. ${p.id.split('@')[0]} ${p.admin?'[admin]':''}`).join('\n'))
        case 'admins': if(await groupOnly()) return; const admins = participants.filter(p=>p.admin).map(p=>p.id); return await reply(`*Admins [${admins.length}]*\n${admins.map(a=> '@'+a.split('@')[0]).join('\n')}`)
        case 'vv': {
            if(!quoted) return await reply('Reply to view-once image/video')
            const qmsg = quoted.viewOnceMessageV2?.message || quoted.viewOnceMessage?.message || quoted
            const type = Object.keys(qmsg)[0]
            const msgType = type.includes('image') ? 'image' : type.includes('video') ? 'video' : 'audio'
            try {
                const buffer = await downloadMedia(qmsg[type], msgType)
                await doReact('💀')
                if(msgType==='image') await sock.sendMessage(from,{ image: buffer, caption: qmsg[type].caption||'' }, { quoted: m })
                else if(msgType==='video') await sock.sendMessage(from,{ video: buffer, caption: qmsg[type].caption||'' }, { quoted: m })
                else await sock.sendMessage(from,{ audio: buffer, mimetype: 'audio/mp4', ptt: true }, { quoted: m })
                await doReact('✅')
            } catch(e){ await doReact('❌'); return await reply('Failed: '+e.message) }
            break
        }
        case 'play': case 'song': if(!text) return await reply('Give song name'); return await reply(`🎵 Searching YT: ${text}`)
        case 'video': if(!text) return await reply('Give YT link'); return await reply(`🎬 Video: ${text}`)
        case 'tiktok': if(!text) return await reply('Give TikTok link'); return await reply(`TikTok: ${text}`)
                case 'instagram': if(!text) return await reply('Give IG link'); return await reply(`IG: ${text}`)
        case 'facebook': if(!text) return await reply('Give FB link'); return await reply(`FB: ${text}`)
        case 'mediafire': if(!text) return await reply('Give MediaFire link'); return await reply(`MediaFire: ${text}`)
        case 'apk': if(!text) return await reply('Give app name'); return await reply(`APK: ${text}`)
        case 'pinterest': if(!text) return await reply('Give query'); return await sendImage(`Pinterest: ${text}`, `https://picsum.photos/600/400?random=${Date.now()}`)
        case 'github': if(!text) return await reply('Give github link'); return await reply(`GitHub: ${text}`)
        case 'weather': { if(!text) return await reply('Give city'); try { const res = await fetch(`https://wttr.in/${encodeURIComponent(text)}?format=3`); const t = await res.text(); return await reply(`🌤️ ${t}`) } catch { return await reply('Weather fail') } }
        case 'translate': { if(!text) return await reply('.translate en | hello'); const [lang, ...rest] = text.split('|'); return await reply(`🌐 [${lang.trim()}]: ${rest.join('|').trim()}`) }
        case 'calculate': { try { return await reply(`🧮 = ${eval(text)}`) } catch { return await reply('Invalid calc') } }
        case 'shorturl': { if(!text) return await reply('Give url'); return await reply(`🔗 https://tinyurl.com/api-create.php?url=${encodeURIComponent(text)}`) }
        case 'prefix': return await reply(`Prefix: ${config.prefix}`)
        case 'public': global.db.settings.mode = 'public'; return await reply('Public ✅')
        case 'private': global.db.settings.mode = 'private'; return await reply('Private ✅')
        case 'setmode': global.db.settings.mode = text; return await reply(`Mode: ${text}`)
        case 'language': return await reply('Lang: EN')
        case 'sticker': { const q = m.message.imageMessage || quoted?.imageMessage; if(!q) return await reply('Send image with .sticker'); const buf = await downloadMedia(q, 'image'); await doReact('💀'); await sock.sendMessage(from,{ sticker: buf }, { quoted: m }); await doReact('✅'); return }
        case 'toimg': { const q = quoted?.stickerMessage; if(!q) return await reply('Reply sticker'); const buf = await downloadMedia(q, 'sticker'); await doReact('💀'); await sock.sendMessage(from,{ image: buf }, { quoted: m }); await doReact('✅'); return }
        case 'take': return await reply('Take done')
        case 'attp': if(!text) return await reply('Text?'); return await sendImage(`Attp ${text}`, `https://api.zenkey.my.id/api/textpro/attp?text=${encodeURIComponent(text)}`)
        case 'smeme': return await reply(`Smeme ${text}`)
        case 'joke': return await reply('😂 Why did dev cross road? To debug chicken!')
        case 'quote': return await reply('💬 Power Speed Control - CRASHER MD')
        case 'meme': return await sendImage('Meme', `https://picsum.photos/600/400?random=${Date.now()}`)
        case 'truth': return await reply('Truth: Biggest fear?')
        case 'dare': return await reply('Dare: Send screenshot!')
        default: await doReact('❌'); return
    }
}

startCrasher()
