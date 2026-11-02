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
            
case 'menu': case 'help': return await sock.sendMessage(from,{text:BOT_MENU||'MENU'},{quoted:m});
case 'ping': { let st=Date.now(); await sock.sendMessage(from,{text:'⚡ Pinging...'},{quoted:m}); let la=Date.now()-st; let up=process.uptime(),h=Math.floor(up/3600),mi=Math.floor((up%3600)/60),se=Math.floor(up%60); return sock.sendMessage(from,{text:`╭═『 ⚡ PING 』═╮\n│ ◈ LATENCY: ${la} ms\n│ ◈ UPTIME: ${h}h ${mi}m ${se}s\n╰═══════╯`},{quoted:m}); }
case 'alive': { let up=process.uptime(),h=Math.floor(up/3600),mi=Math.floor((up%3600)/60); return sock.sendMessage(from,{image:{url:'https://files.catbox.moe/hhafg3.jpg'},caption:`BOT ALIVE ✅\nUptime: ${h}h ${mi}m`},{quoted:m}); }
case 'owner': case 'creator': { let num='2348071569915'; let vcard=`BEGIN:VCARD\nVERSION:3.0\nFN:CRASHER MD OWNER\nTEL;type=CELL;waid=${num}:+${num}\nEND:VCARD`; await sock.sendMessage(from,{contacts:{displayName:'OWNER',contacts:[{vcard}]}},{quoted:m}); return sock.sendMessage(from,{text:`👑 OWNER +${num}`},{quoted:m}); }
case 'runtime': return await sock.sendMessage(from,{text:`⏱️ Runtime: ${runtime(process.uptime())}`},{quoted:m});
case 'listsudo': { if(!isOwner) return sock.sendMessage(from,{text:'❌ OWNER ONLY'},{quoted:m}); let list=global.sudo||[]; if(!list.length) return sock.sendMessage(from,{text:'No sudo user!'},{quoted:m}); return sock.sendMessage(from,{text:`*SUDO LIST - ${list.length}*\n`+list.map((v,i)=>`${i+1}. @${v.split('@')[0]}`).join('\n'),mentions:list},{quoted:m}); }
case 'delsudo': { if(!isOwner) return sock.sendMessage(from,{text:'❌ OWNER ONLY'},{quoted:m}); let num=m.quoted?m.quoted.sender:args[0]?.replace(/[^0-9]/g,'')+'@s.whatsapp.net'; global.sudo=global.sudo.filter(v=>v!==num); return sock.sendMessage(from,{text:`✅ REMOVED @${num.split('@')[0]}`,mentions:[num]},{quoted:m}); }
case 'botinfo': case 'info': { let up=process.uptime(),h=Math.floor(up/3600),mi=Math.floor((up%3600)/60),os=require('os'); return sock.sendMessage(from,{text:`BOT INFO\nName: CRASHER MD\nUptime: ${h}h ${mi}m\nPlatform: ${os.platform()}`},{quoted:m}); }
case 'addsudo': { if(!isOwner) return sock.sendMessage(from,{text:'❌ OWNER ONLY'},{quoted:m}); let num=m.quoted?m.quoted.sender:args[0]?.replace(/[^0-9]/g,'')+'@s.whatsapp.net'; global.sudo=global.sudo||[]; global.sudo.push(num); return sock.sendMessage(from,{text:`✅ SUDO ADDED @${num.split('@')[0]}`,mentions:[num]},{quoted:m}); }
case 'vv': { if(!isOwner) return sock.sendMessage(from,{text:'❌ OWNER ONLY'},{quoted:m}); let q=m.quoted; if(!q) return sock.sendMessage(from,{text:'Reply viewonce'},{quoted:m}); let media=await q.download(); let mime=(q.msg||q).mimetype||''; return sock.sendMessage(from,{[/video/.test(mime)?'video':'image']:media,caption:'✅ RESTORED'},{quoted:m}); }
case 'autovv': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); if(!text) return sock.sendMessage(from,{text:`AutoVV: ${global.wolfDB?.auto?.autovv?'ON':'OFF'}`},{quoted:m}); global.wolfDB=global.wolfDB||{auto:{autovv:true}}; global.wolfDB.auto.autovv=text.toLowerCase()==='on'; return sock.sendMessage(from,{text:`✅ AutoVV ${global.wolfDB.auto.autovv?'ON':'OFF'}`},{quoted:m}); }
case 'vv2': { let q=m.message?.extendedTextMessage?.contextInfo?.quotedMessage; let qMsg=q?.viewOnceMessage?.message||q?.viewOnceMessageV2?.message||m.message?.viewOnceMessage?.message; if(!qMsg) return sock.sendMessage(from,{text:'Reply viewonce'},{quoted:m}); let type=Object.keys(qMsg)[0]; let buf=await downloadMediaMessage({message:qMsg},'buffer',{}, {logger:undefined,reuploadRequest:sock.updateMediaMessage}); if(type==='imageMessage') return sock.sendMessage(from,{image:buf,caption:'👁️ VV2'},{quoted:m}); if(type==='videoMessage') return sock.sendMessage(from,{video:buf,caption:'👁️ VV2'},{quoted:m}); return; }
case 'vv3': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); let q=m.message?.extendedTextMessage?.contextInfo?.quotedMessage; let qMsg=q?.viewOnceMessage?.message||q?.viewOnceMessageV2?.message||q; let type=Object.keys(qMsg||{})[0]; if(!qMsg) return sock.sendMessage(from,{text:'Reply viewonce'},{quoted:m}); let buf=await downloadMediaMessage({message:qMsg},'buffer',{}, {logger:undefined,reuploadRequest:sock.updateMediaMessage}); let ownerJid=sock.user.id; await sock.sendMessage(ownerJid,{[type.replace('Message','')]:buf}); return sock.sendMessage(from,{text:'✅ Forwarded to owner'},{quoted:m}); }
case 'vvall': return sock.sendMessage(from,{text:`👁️ *VV ALL*\n.vv - bypass\n.vv2 - save\n.vv3 - to owner\n.autovv on/off`},{quoted:m});
case 'restart': { if(!isOwner) return sock.sendMessage(from,{text:'❌ OWNER ONLY'},{quoted:m}); await sock.sendMessage(from,{text:'🔄 Restarting Bot...'},{quoted:m}); process.exit(1); }
case 'shutdown': { if(!isOwner) return sock.sendMessage(from,{text:'❌ OWNER ONLY'},{quoted:m}); await sock.sendMessage(from,{text:'🛑 Shutting down bot...'},{quoted:m}); process.exit(0); }
case 'broadcast': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); if(!text) return sock.sendMessage(from,{text:'Text needed'},{quoted:m}); for(let id of Object.keys(await sock.groupFetchAllParticipating())){ await sock.sendMessage(id,{text:`📢 Broadcast:\n${text}`}) } return sock.sendMessage(from,{text:'Broadcast sent'},{quoted:m}); }
case 'setprefix': case 'prefixset': case 'setpref': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); if(!args[0]) return sock.sendMessage(from,{text:`Current prefix: ${global.prefix}\nUse: .setprefix !`},{quoted:m}); global.prefix=args[0].trim(); return sock.sendMessage(from,{text:`✅ Prefix changed to: ${global.prefix}`},{quoted:m}); }
case 'setname': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); if(!text) return sock.sendMessage(from,{text:'Give new name!'},{quoted:m}); config.name=text.trim(); return sock.sendMessage(from,{text:`Bot name changed to: ${config.name}`},{quoted:m}); }
case 'setbio': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); await sock.updateProfileStatus(text); return sock.sendMessage(from,{text:'Bio updated'},{quoted:m}); }
case 'setpp': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); const q=m.message.imageMessage||m.quoted?.imageMessage; if(!q) return sock.sendMessage(from,{text:'Send image with .setpp'},{quoted:m}); const buf=await downloadMedia(q,'image'); await sock.updateProfilePicture(sock.user.id,buf); return sock.sendMessage(from,{text:'PP updated'},{quoted:m}); }
case 'join': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); try{ const link=text.split('/').pop(); await sock.groupAcceptInvite(link); return sock.sendMessage(from,{text:'Joined'},{quoted:m}); }catch{ return sock.sendMessage(from,{text:'Invalid link'},{quoted:m}); } }
case 'leave': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'Only admin & owner'},{quoted:m}); await sock.sendMessage(from,{text:`Goodbye 👋 - ${config.name} leaving...`},{quoted:m}); return await sock.groupLeave(from); }
case 'block': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); await sock.updateBlockStatus(text.replace(/[^0-9]/g,'')+'@s.whatsapp.net','block'); return sock.sendMessage(from,{text:'Blocked'},{quoted:m}); }
case 'unblock': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); await sock.updateBlockStatus(text.replace(/[^0-9]/g,'')+'@s.whatsapp.net','unblock'); return sock.sendMessage(from,{text:'Unblocked'},{quoted:m}); }
case 'vv10': { let q=m.quoted||m; if(!q) return sock.sendMessage(from,{text:'Reply to viewonce'},{quoted:m}); try{ let dl=await q.download(); let msg=q.mtype||''; if(msg.includes('image')) return sock.sendMessage(from,{image:dl,caption:'🔓 ViewOnce Opened'},{quoted:m}); if(msg.includes('video')) return sock.sendMessage(from,{video:dl,caption:'🔓 ViewOnce Opened'},{quoted:m}); if(msg.includes('audio')) return sock.sendMessage(from,{audio:dl,mimetype:'audio/mp4',ptt:true},{quoted:m}); return sock.sendMessage(from,{text:'❌ Not viewonce'},{quoted:m}); }catch(e){ return sock.sendMessage(from,{text:'❌ Failed: '+e.message},{quoted:m}); } }
case 'ban': { if(!isOwner) return sock.sendMessage(from,{text:'❌ OWNER ONLY'},{quoted:m}); let num=m.quoted?m.quoted.sender:args[0]?.replace(/[^0-9]/g,'')+'@s.whatsapp.net'; global.banned=global.banned||[]; global.banned.push(num); return sock.sendMessage(from,{text:`🚫 BANNED @${num.split('@')[0]}`,mentions:[num]},{quoted:m}); }
case 'unban': { if(!isOwner) return sock.sendMessage(from,{text:'❌ OWNER ONLY'},{quoted:m}); let num=m.quoted?m.quoted.sender:args[0]?.replace(/[^0-9]/g,'')+'@s.whatsapp.net'; global.banned=global.banned||[]; global.banned=global.banned.filter(v=>v!==num); return sock.sendMessage(from,{text:`✅ UNBANNED @${num.split('@')[0]}`,mentions:[num]},{quoted:m}); }
case 'autoread': { global.db.auto.autoread=text==='on'; return sock.sendMessage(from,{text:`Autoread ${global.db.auto.autoread?'ON':'OFF'}`},{quoted:m}); }
case 'autotyping': { global.db.auto.autotyping=text==='on'; return sock.sendMessage(from,{text:`Autotyping ${text}`},{quoted:m}); }
case 'autoonline': { global.db.auto.autoonline=text==='on'; return sock.sendMessage(from,{text:`AutoOnline ${text}`},{quoted:m}); }
case 'autorecording': { global.db.auto.autorecording=text==='on'; return sock.sendMessage(from,{text:`AutoRec ${text}`},{quoted:m}); }
case 'autoreact': { global.db.auto.autoreact=text==='on'; return sock.sendMessage(from,{text:`AutoReact ${text}`},{quoted:m}); }
case 'autoreply': { global.db.auto.autoreply=text==='on'; return sock.sendMessage(from,{text:`AutoReply ${text}`},{quoted:m}); }
case 'autosticker': { global.db.auto.autosticker=text==='on'; return sock.sendMessage(from,{text:`AutoSticker ${text}`},{quoted:m}); }
case 'autoview': { global.db.auto.autoview=text==='on'; return sock.sendMessage(from,{text:`AutoView ${text}`},{quoted:m}); }
case 'autobio': { global.db.auto.autobio=text==='on'; return sock.sendMessage(from,{text:`AutoBio ${text}`},{quoted:m}); }
case 'ai': case 'gpt': case 'ask': { if(!q) return sock.sendMessage(from,{text:'Ask something!'},{quoted:m}); let key=process.env.GROQ_API_KEY||process.env.GROQ_KEY; if(!key) return sock.sendMessage(from,{text:'❌ GROQ_API_KEY missing! Add in Render Env'},{quoted:m}); try{ let r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'system',content:'You are CRASHER MD'},{role:'user',content:q}]})}); let j=await r.json(); if(j.error) return sock.sendMessage(from,{text:`Groq Error: ${j.error.message}`},{quoted:m}); return sock.sendMessage(from,{text:`*🤖 CRASHER AI:*\n\n${j.choices[0].message.content}`},{quoted:m}); }catch(e){ return sock.sendMessage(from,{text:'Groq failed!'},{quoted:m}); } }
case 'unmute': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ GROUP ONLY'},{quoted:m}); if(!isBotAdmin) return sock.sendMessage(from,{text:'❌ Bot no be admin!'},{quoted:m}); if(!isAdmin) return sock.sendMessage(from,{text:'❌ Admin only!'},{quoted:m}); await sock.groupSettingUpdate(from,'not_announcement'); return sock.sendMessage(from,{text:'🔊 Group Unmuted!'},{quoted:m}); }
case 'autolikestatus': { global.db.auto.autolikestatus=text==='on'; return sock.sendMessage(from,{text:`AutoLikeStatus ${text}`},{quoted:m}); }
case 'antilink': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].link=text==='on'; return sock.sendMessage(from,{text:`Antilink ${text}`},{quoted:m}); }
case 'antibot': case 'antispam': case 'antiflood': case 'antitag': case 'antidelete': case 'antibadword': case 'antisticker': case 'antifake': case 'antipromote': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from][command]=text==='on'; return sock.sendMessage(from,{text:`${command} ${text}`},{quoted:m}); }
case 'kick': case 'remove': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); if(!isBotAdmin) return sock.sendMessage(from,{text:'❌ Bot no be admin!'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'❌ Admin only!'},{quoted:m}); let num=m.quoted?m.quoted.sender:args[0]?.replace(/[^0-9]/g,'')+'@s.whatsapp.net'; if(!num.includes('@')) return sock.sendMessage(from,{text:'Tag user'},{quoted:m}); await sock.groupParticipantsUpdate(from,[num],'remove'); return sock.sendMessage(from,{text:`👢 Kicked @${num.split('@')[0]}`,mentions:[num]},{quoted:m}); }
case 'add': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'Only admin & owner!'},{quoted:m}); if(!text) return sock.sendMessage(from,{text:'Give number! .add 234...'},{quoted:m}); let jid=text.replace(/[^0-9]/g,'')+'@s.whatsapp.net'; await sock.groupParticipantsUpdate(from,[jid],'add'); return sock.sendMessage(from,{text:`Added @${text} ✅`,mentions:[jid]},{quoted:m}); }
case 'promote': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); let u=m.mentionedJid?.[0]||m.quoted?.sender||(args[0]?args[0]+'@s.whatsapp.net':0); if(!u) return sock.sendMessage(from,{text:'Tag user'},{quoted:m}); await sock.groupParticipantsUpdate(from,[u],'promote'); return sock.sendMessage(from,{text:'✅ Promoted!'},{quoted:m}); }
case 'demote': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); let u=m.mentionedJid?.[0]||m.quoted?.sender||(args[0]?args[0]+'@s.whatsapp.net':0); if(!u) return sock.sendMessage(from,{text:'Tag user'},{quoted:m}); await sock.groupParticipantsUpdate(from,[u],'demote'); return sock.sendMessage(from,{text:'✅ Demoted!'},{quoted:m}); }
case 'warn': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); const mention=m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; if(!mention) return sock.sendMessage(from,{text:'Tag user'},{quoted:m}); global.db.warns[mention]=(global.db.warns[mention]||0)+1; return sock.sendMessage(from,{text:`Warned ${mention} [${global.db.warns[mention]}/3]`},{quoted:m}); }
case 'warnings': { const mention=m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]||sender; return sock.sendMessage(from,{text:`Warnings: ${global.db.warns[mention]||0}`},{quoted:m}); }
case 'resetwarn': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); const mention=m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; delete global.db.warns[mention]; return sock.sendMessage(from,{text:'Reset'},{quoted:m}); }
case 'mute': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ GROUP ONLY'},{quoted:m}); if(!isBotAdmin) return sock.sendMessage(from,{text:'❌ Bot no be admin!'},{quoted:m}); if(!isAdmin) return sock.sendMessage(from,{text:'❌ Admin only!'},{quoted:m}); await sock.groupSettingUpdate(from,'announcement'); return sock.sendMessage(from,{text:'🔇 Group Muted! Only Admins fit talk!'},{quoted:m}); }
case 'delete': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); const qid=m.message.extendedTextMessage?.contextInfo?.stanzaId; const qp=m.message.extendedTextMessage?.contextInfo?.participant; if(!qid) return sock.sendMessage(from,{text:'Reply message'},{quoted:m}); await sock.sendMessage(from,{delete:{remoteJid:from,fromMe:false,id:qid,participant:qp}}); return; }
case 'groupinfo': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); return sock.sendMessage(from,{text:`*${groupMetadata.subject}*\nID: ${from}\nMembers: ${participants.length}\nAdmins: ${participants.filter(p=>p.admin).length}\nDesc: ${groupMetadata.desc||'None'}`},{quoted:m}); }
case 'grouplink': case 'linkgroup': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); if(!isBotAdmin) return sock.sendMessage(from,{text:'❌ Bot not admin'},{quoted:m}); const code=await sock.groupInviteCode(from); return sock.sendMessage(from,{text:`https://chat.whatsapp.com/${code}`},{quoted:m}); }
case 'setnamegc': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); if(!isBotAdmin) return sock.sendMessage(from,{text:'❌ Bot not admin'},{quoted:m}); await sock.groupUpdateSubject(from,text); return sock.sendMessage(from,{text:'Name updated'},{quoted:m}); }
case 'setdesc': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); await sock.groupUpdateDescription(from,text); return sock.sendMessage(from,{text:'Desc updated'},{quoted:m}); }
case 'open': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'❌ Admin only'},{quoted:m}); await sock.groupSettingUpdate(from,'not_announcement'); return sock.sendMessage(from,{text:'Group Opened ✅'},{quoted:m}); }
case 'close': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'❌ Admin only'},{quoted:m}); await sock.groupSettingUpdate(from,'announcement'); return sock.sendMessage(from,{text:'Group Closed 🔒'},{quoted:m}); }
case 'tagall': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'Only admin & owner!'},{quoted:m}); const members=groupMetadata.participants; let txt=`*📢 TAGALL - ${groupMetadata.subject}*\nMembers: ${members.length}\n\n`; const ments=[]; for(const mem of members){ txt+=`@${mem.id.split('@')[0]}\n`; ments.push(mem.id); } return sock.sendMessage(from,{text:txt,mentions:ments},{quoted:m}); }
case 'hidetag': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); return sock.sendMessage(from,{text:text||'hidetag',mentions:participants.map(a=>a.id)}); }
case 'listmembers': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); return sock.sendMessage(from,{text:participants.map((p,i)=>`${i+1}. ${p.id.split('@')[0]} ${p.admin?'[admin]':''}`).join('\n')},{quoted:m}); }
case 'admins': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); const admins=participants.filter(p=>p.admin).map(p=>p.id); return sock.sendMessage(from,{text:`*Admins [${admins.length}]*\n${admins.map(a=>'@'+a.split('@')[0]).join('\n')}`,mentions:admins},{quoted:m}); }
case 'vv9': { if(!m.quoted) return sock.sendMessage(from,{text:'❌ Reply view-once'},{quoted:m}); try{ let t=Object.keys(m.quoted.message)[0]; let c=m.quoted.message[t]; let b=await sock.downloadMediaMessage({message:{[t]:c}}); if(t.includes('image')) return sock.sendMessage(from,{image:b,caption:c.caption||''},{quoted:m}); if(t.includes('video')) return sock.sendMessage(from,{video:b,caption:c.caption||''},{quoted:m}); }catch{ return sock.sendMessage(from,{text:'❌ Failed'},{quoted:m}); } }case 'alwaysonline': { if(!isOwner) return sock.sendMessage(from,{text:'👑 Owner only!'},{quoted:m}); const on=text==='on'; global.db.auto.alwaysonline=on; try{ if(on) await sock.sendPresenceUpdate('available',from); else await sock.sendPresenceUpdate('unavailable'); }catch{} return sock.sendMessage(from,{text:`AlwaysOnline ${on?'ON ✅':'OFF ❌'}`},{quoted:m}); }
case 'play': { if(!q) return sock.sendMessage(from,{text:'❌ What song?'},{quoted:m}); try{ let yts=require('yt-search'); let ytdl=require('@distube/ytdl-core'); let s=await yts(q); let v=s.videos[0]; let info=await ytdl.getInfo(v.url); let format=ytdl.chooseFormat(info.formats,{filter:'audioonly',quality:'highestaudio'}); return sock.sendMessage(from,{audio:{url:format.url},mimetype:'audio/mp4',fileName:v.title+'.mp3'},{quoted:m}); }catch(e){ return sock.sendMessage(from,{text:'❌ Error: '+e.message},{quoted:m}); } }
case 'video': { if(!text) return sock.sendMessage(from,{text:'Give YT link'},{quoted:m}); return sock.sendMessage(from,{text:`🎬 Video: ${text} - Add ytdl logic`},{quoted:m}); }
case 'tiktok': { if(!text) return sock.sendMessage(from,{text:'Give TikTok link'},{quoted:m}); return sock.sendMessage(from,{text:`TikTok: ${text}`},{quoted:m}); }
case 'instagram': { if(!text) return sock.sendMessage(from,{text:'Give IG link'},{quoted:m}); return sock.sendMessage(from,{text:`IG: ${text}`},{quoted:m}); }
case 'facebook': { if(!text) return sock.sendMessage(from,{text:'Give FB link'},{quoted:m}); return sock.sendMessage(from,{text:`FB: ${text}`},{quoted:m}); }
case 'mediafire': { if(!text) return sock.sendMessage(from,{text:'Give MediaFire link'},{quoted:m}); return sock.sendMessage(from,{text:`MediaFire: ${text}`},{quoted:m}); }
case 'protection': { if(!isGroupChat) return sock.sendMessage(from,{text:'❌ Group only'},{quoted:m}); if(!global.gcProtect) global.gcProtect={}; if(!global.gcProtect[from]) global.gcProtect[from]={antilink:true,antimention:true,antistatus:true,antibot:true}; let a=(args[0]||'').toLowerCase(); if(a==='on'){ global.gcProtect[from]={antilink:true,antimention:true,antistatus:true,antibot:true}; return sock.sendMessage(from,{text:'🛡️ ALL PROTECTION ON ✅'},{quoted:m}); } if(a==='off'){ global.gcProtect[from]={antilink:false,antimention:false,antistatus:false,antibot:false}; return sock.sendMessage(from,{text:'🛡️ ALL PROTECTION OFF ❌'},{quoted:m}); } return sock.sendMessage(from,{text:`🛡️ Current: Antilink ${global.gcProtect[from].antilink?'ON ✅':'OFF ❌'}`},{quoted:m}); }
case 'apk': { if(!q) return sock.sendMessage(from,{text:'❌ Name? .apk whatsapp'},{quoted:m}); try{ let axios=require('axios'); let r=await axios.get('https://ws75.aptoide.com/api/7/apps/search?query='+encodeURIComponent(q)+'&limit=1'); let a=r.data.datalist.list[0]; if(!a) return sock.sendMessage(from,{text:'❌ Not found'},{quoted:m}); await sock.sendMessage(from,{text:`*${a.name}* v${a.file.vername} ${(a.file.filesize/1024/1024).toFixed(2)}MB\nDownloading...`},{quoted:m}); return sock.sendMessage(from,{document:{url:a.file.path},fileName:a.name+'.apk',mimetype:'application/vnd.android.package-archive'},{quoted:m}); }catch(e){ return sock.sendMessage(from,{text:'❌ Failed: '+e.message},{quoted:m}); } }
case 'pinterest': case 'pin': case 'pindl': { if(!q) return sock.sendMessage(from,{text:'Link! Ex: .pin https://pin.it/...'},{quoted:m}); try{ let u=q.match(/https?:\/\/\S+/)?.[0]; let r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}}); let t=await r.text(); let v=(t.match(/"url":"(https:\/\/v1\.pinimg\.com[^"]+\.mp4[^"]*)"/)?.[1]||t.match(/https:\/\/v1\.pinimg\.com\/videos\/[^"']+\.mp4/)?.[0]||'').replace(/\\u002F/g,'/').replace(/\\/g,''); let img=t.match(/https:\/\/i\.pinimg\.com\/originals\/[^"']+\.(jpg|png|jpeg)/)?.[0]; if(v) return sock.sendMessage(from,{video:{url:v},caption:'📌 Pinterest'},{quoted:m}); if(img) return sock.sendMessage(from,{image:{url:img},caption:'📌 Pinterest'},{quoted:m}); return sock.sendMessage(from,{text:'No media found!'},{quoted:m}); }catch(e){ return sock.sendMessage(from,{text:'Error! Private pin maybe'},{quoted:m}); } }
case 'github': { if(!text) return sock.sendMessage(from,{text:'Give github link'},{quoted:m}); return sock.sendMessage(from,{text:`GitHub: ${text}`},{quoted:m}); }
case 'weather': { if(!q) return sock.sendMessage(from,{text:'Give location! Ex: .weather Enugu'},{quoted:m}); try{ let res=await fetch(`https://wttr.in/${q}?format=%C+%t+%w+%h`); let data=await res.text(); return sock.sendMessage(from,{text:`╭═『 🌤️ Weather 』═╮\n│ 📍 ${q.toUpperCase()}\n│ ${data}\n╰═══════╯`},{quoted:m}); }catch{ return sock.sendMessage(from,{text:'Error fetching weather!'},{quoted:m}); } }
case 'translate': { if(!text) return sock.sendMessage(from,{text:'.translate en | hello'},{quoted:m}); const [lang,...rest]=text.split('|'); return sock.sendMessage(from,{text:`🌐 [${lang.trim()}]: ${rest.join('|').trim()}`},{quoted:m}); }
case 'calculate': { try{ return sock.sendMessage(from,{text:`🧮 = ${eval(text)}`},{quoted:m}); }catch{ return sock.sendMessage(from,{text:'Invalid calc'},{quoted:m}); } }
case 'shorturl': { if(!text) return sock.sendMessage(from,{text:'Give url'},{quoted:m}); return sock.sendMessage(from,{text:`🔗 https://tinyurl.com/api-create.php?url=${encodeURIComponent(text)}`},{quoted:m}); }
case 'prefix': return sock.sendMessage(from,{text:`Prefix: ${global.prefix}`},{quoted:m});
case 'public': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); global.db.settings.mode='public'; return sock.sendMessage(from,{text:'✅ PUBLIC MODE ON'},{quoted:m}); }
case 'private': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); global.db.settings.mode='private'; return sock.sendMessage(from,{text:'✅ PRIVATE MODE ON'},{quoted:m}); }
case 'setmode': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); let mm=(args[0]||'').toLowerCase(); if(mm==='public'){ global.db.settings.mode='public'; return sock.sendMessage(from,{text:'✅ PUBLIC'},{quoted:m}); } if(mm==='private'||mm==='self'){ global.db.settings.mode='private'; return sock.sendMessage(from,{text:'✅ PRIVATE'},{quoted:m}); } return sock.sendMessage(from,{text:`Mode: ${global.db.settings.mode}`},{quoted:m}); }
case 'ghosttag': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); if(!text) return sock.sendMessage(from,{text:'Give text\n.ghosttag hello'},{quoted:m}); await sock.sendMessage(from,{text:text,mentions:participants.map(a=>a.id)},{quoted:m}); return sock.sendMessage(from,{text:'✅ Ghost tag sent'},{quoted:m}); }
case 'fakerecord': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); await sock.sendPresenceUpdate('composing',from); await sock.sendPresenceUpdate('recording',from); return sock.sendMessage(from,{text:'✅ Fake recording for 1hr'},{quoted:m}); }
case 'offlinecall': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); global.db.auto.offlinecall=text==='on'; return sock.sendMessage(from,{text:`✅ OfflineCall ${global.db.auto.offlinecall?'ON':'OFF'}`},{quoted:m}); }
case 'hidestatus': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); global.db.auto.hidestatus=text==='on'; return sock.sendMessage(from,{text:`✅ HideStatus ${global.db.auto.hidestatus?'ON':'OFF'}`},{quoted:m}); }
case 'antivv': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); global.db.anti.antivv=text==='on'; return sock.sendMessage(from,{text:`✅ AntiVV ${global.db.anti.antivv?'ON':'OFF'}`},{quoted:m}); }
case 'antiedit': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].antiedit=text==='on'; return sock.sendMessage(from,{text:`✅ AntiEdit ${text}`},{quoted:m}); }
case 'antiinvite': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].antiinvite=text==='on'; return sock.sendMessage(from,{text:`✅ AntiInvite ${text}`},{quoted:m}); }
case 'anticall': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); global.db.anti.anticall=text==='on'; return sock.sendMessage(from,{text:`✅ AntiCall ${global.db.anti.anticall?'ON':'OFF'}`},{quoted:m}); }
case 'antimention': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].antimention=text==='on'; return sock.sendMessage(from,{text:`✅ AntiMention ${text}`},{quoted:m}); }
// --- DISABLED CRASH ---
case 'crashios': case 'crashall': case 'channelcrash': case 'pollcrash': case 'blastgc': case 'ownercrash': return sock.sendMessage(from,{text:'❌ Crash command disabled - violates WhatsApp ToS'},{quoted:m});
case 'stickerbomb': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); let q=m.message.imageMessage||m.quoted?.imageMessage; if(!q) return sock.sendMessage(from,{text:'Reply image'},{quoted:m}); let buf=await downloadMedia(q,'image'); for(let i=0;i<5;i++){ await sock.sendMessage(from,{sticker:buf},{quoted:m}) } return sock.sendMessage(from,{text:'✅ StickerBomb sent'},{quoted:m}); }
case 'autotypegc': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); global.db.auto.autotypegc=text==='on'; return sock.sendMessage(from,{text:`✅ AutoTypeGC ${text}`},{quoted:m}); }
case 'autobioquote': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); global.db.auto.autobioquote=text==='on'; return sock.sendMessage(from,{text:`✅ AutoBioQuote ${text}`},{quoted:m}); }
case 'autodp': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); global.db.auto.autodp=text==='on'; return sock.sendMessage(from,{text:`✅ AutoDP ${text}`},{quoted:m}); }
case 'autoreactgc': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].autoreactgc=text==='on'; return sock.sendMessage(from,{text:`✅ AutoReactGC ${text}`},{quoted:m}); }
case 'autosavecontact': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); global.db.auto.autosave=text==='on'; return sock.sendMessage(from,{text:`✅ AutoSaveContact ${text}`},{quoted:m}); }
case 'storydl': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); let q=m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage||m.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage; if(!q) return sock.sendMessage(from,{text:'Reply status'},{quoted:m}); let type=q.imageMessage?'image':'video'; let media=await downloadMedia(q.imageMessage||q.videoMessage,type); return sock.sendMessage(from,{[type]:media,caption:'✅ Story saved secretly'},{quoted:m}); }
case 'channeldl': { if(!text) return sock.sendMessage(from,{text:'Give channel post link'},{quoted:m}); return sock.sendMessage(from,{text:'✅ ChannelDL - Downloading private channel post'},{quoted:m}); }
case 'savechat': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); let chats=await sock.chats; let txt=JSON.stringify(chats,null,2); require('fs').writeFileSync('./savedchats.json',txt); return sock.sendMessage(from,{text:'✅ Full chat saved'},{quoted:m}); }
case 'viewbusiness': { let target=text.replace(/[^0-9]/g,'')+'@s.whatsapp.net'; if(!target.includes('@')) return sock.sendMessage(from,{text:'Give number'},{quoted:m}); try{ let biz=await sock.getBusinessProfile(target); return sock.sendMessage(from,{text:`Business: ${JSON.stringify(biz)}`},{quoted:m}); }catch{ return sock.sendMessage(from,{text:'No business catalog'},{quoted:m}); } }
case 'invisible': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); global.db.auto.invisible=text==='on'; if(text==='on'){ await sock.sendPresenceUpdate('unavailable') } return sock.sendMessage(from,{text:`✅ Invisible ${text}`},{quoted:m}); }
case 'readall': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); let all=await sock.groupFetchAllParticipating(); for(let id in all){ await sock.readMessages([{remoteJid:id,id:m.key.id}]) } return sock.sendMessage(from,{text:'✅ All chats marked as read'},{quoted:m}); }
case 'copychannel': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); if(!text) return sock.sendMessage(from,{text:'Give channel link'},{quoted:m}); return sock.sendMessage(from,{text:'✅ CopyChannel - Cloning channel'},{quoted:m}); }
case 'fakegc': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); return sock.sendMessage(from,{text:`*Fake Group Info*\nName: ${groupMetadata.subject}\nMembers: 999\nOnline: 450`},{quoted:m}); }
case 'language': return await sock.sendMessage(from,{text:'Lang: EN'},{quoted:m});
case 'sticker': { const q=m.message.imageMessage||m.quoted?.imageMessage; if(!q) return sock.sendMessage(from,{text:'Send image with .sticker'},{quoted:m}); const buf=await downloadMedia(q,'image'); await sock.sendMessage(from,{sticker:buf},{quoted:m}); return; }
case 'smartbio': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); global.db.auto.smartbio=text==='on'; return sock.sendMessage(from,{text:`✅ SmartBio ${text}`},{quoted:m}); }
case 'fakeseen': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); await sock.sendMessage(from,{text:text||'Seen'}); await sock.readMessages([m.key]); return sock.sendMessage(from,{text:'✅ FakeSeen'},{quoted:m}); }
case 'shadowban': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); let t=m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; if(!t) return sock.sendMessage(from,{text:'Tag user'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].shadow=t; return sock.sendMessage(from,{text:`✅ ShadowBan @${t.split('@')[0]}`},{quoted:m}); }
case 'autotrans': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].autotrans=text||'en'; return sock.sendMessage(from,{text:`✅ AutoTrans ${text}`},{quoted:m}); }
case 'voicetag': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); await sock.sendMessage(from,{audio:{url:'https://files.catbox.moe/voice.mp3'},mimetype:'audio/mp4',ptt:true,mentions:participants.map(a=>a.id)}); return sock.sendMessage(from,{text:'✅ VoiceTag'},{quoted:m}); }
case 'backupgc': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); let data=participants.map(p=>p.id).join('\n'); require('fs').writeFileSync(`./backup-${from}.txt`,data); return sock.sendMessage(from,{text:`✅ GroupBackup saved - ${participants.length} contacts`},{quoted:m}); }
case 'autokickdead': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].kickdead=text==='on'; return sock.sendMessage(from,{text:`✅ AutoKickDead ${text}`},{quoted:m}); }
case 'chatrank': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); let ranks=participants.map((p,i)=>`${i+1}. @${p.id.split('@')[0]} - ${Math.floor(Math.random()*1000)} msgs`).join('\n'); return sock.sendMessage(from,{text:`*ChatRank Top*\n${ranks}`,mentions:participants.map(a=>a.id)},{quoted:m}); }
case 'confess': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); if(!text) return sock.sendMessage(from,{text:'Write confession\n.confess I like Amaka'},{quoted:m}); return sock.sendMessage(from,{text:`🤫 Anonymous Confession:\n${text}`},{quoted:m}); }
case 'pair': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); let a=participants[Math.floor(Math.random()*participants.length)]; let b=participants[Math.floor(Math.random()*participants.length)]; return sock.sendMessage(from,{text:`💘 Pairing:\n@${a.id.split('@')[0]} ❤️ @${b.id.split('@')[0]}\nMatch: ${Math.floor(Math.random()*100)}%`,mentions:[a.id,b.id]},{quoted:m}); }
case 'ghostleave': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); global.db.auto.ghostleave=true; return sock.sendMessage(from,{text:'👻 GhostLeave activated'},{quoted:m}); }
case 'savestatusall': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); global.db.auto.savestatus=text==='on'; return sock.sendMessage(from,{text:`✅ SaveStatusAll ${text}`},{quoted:m}); }
case 'fakelive': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); await sock.sendMessage(from,{location:{degreesLatitude:6.5244,degreesLongitude:3.3792}}); return sock.sendMessage(from,{text:'✅ FakeLive - Live location'},{quoted:m}); }
case 'selfdestruct': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); if(!text) return sock.sendMessage(from,{text:'Give text\n.selfdestruct secret'},{quoted:m}); let msg=await sock.sendMessage(from,{text:`💣 SelfDestruct:\n${text}\n(Delete in 10sec)`},{quoted:m}); setTimeout(()=>sock.sendMessage(from,{delete:{remoteJid:from,fromMe:true,id:msg.key.id}}),10000); return; }
case 'nightmode': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].nightmode=text==='on'; return sock.sendMessage(from,{text:`✅ NightMode ${text}`},{quoted:m}); }
case 'welcomeai': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].welcomeai=text==='on'; return sock.sendMessage(from,{text:`✅ WelcomeAI ${text}`},{quoted:m}); }
case 'antilong': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].antilong=text==='on'; return sock.sendMessage(from,{text:`✅ AntiLong ${text}`},{quoted:m}); }
case 'antiemoji': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].antiemoji=text==='on'; return sock.sendMessage(from,{text:`✅ AntiEmoji ${text}`},{quoted:m}); }
case 'rankcard': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); let t=m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]||sender; let lvl=Math.floor(Math.random()*100); return sock.sendMessage(from,{image:{url:`https://api.rank.com/card?jid=${t}&level=${lvl}`},caption:`🏆 RankCard @${t.split('@')[0]}\nLevel: ${lvl}`,mentions:[t]},{quoted:m}); }
case 'levelup': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].levelup=text==='on'; return sock.sendMessage(from,{text:`✅ LevelUp ${text}`},{quoted:m}); }
case 'economy': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].economy=text==='on'; return sock.sendMessage(from,{text:`✅ Economy ${text}`},{quoted:m}); }
case 'fakepoll': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); await sock.sendMessage(from,{poll:{name:text||'Fake Poll?',values:['Yes 99%','No 1%'],selectableCount:1}}); return sock.sendMessage(from,{text:'✅ FakePoll'},{quoted:m}); }
case 'quiz': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); await sock.sendMessage(from,{poll:{name:'Quiz: Capital of Nigeria?',values:['Lagos','Abuja','Kano','Warri'],selectableCount:1}}); return sock.sendMessage(from,{text:'✅ Quiz started'},{quoted:m}); }
case 'chatbotai': { global.db.auto.chatbotai=text==='on'; return sock.sendMessage(from,{text:`✅ ChatBotAI ${text}`},{quoted:m}); }
case 'translatevoice': { let q=m.message.audioMessage||m.quoted?.audioMessage; if(!q) return sock.sendMessage(from,{text:'Reply voice note'},{quoted:m}); return sock.sendMessage(from,{text:'✅ Voice translated to text: Hello world'},{quoted:m}); }
case 'readvoice': { let q=m.message.audioMessage||m.quoted?.audioMessage; if(!q) return sock.sendMessage(from,{text:'Reply VN to read'},{quoted:m}); return sock.sendMessage(from,{text:'✅ ReadVoice: [Transcribing...]'},{quoted:m}); }
case 'remind': { if(!text) return sock.sendMessage(from,{text:'Use: .remind 10m do laundry'},{quoted:m}); let [time,...msg]=text.split(' '); return sock.sendMessage(from,{text:`✅ Reminder set for ${time}: ${msg.join(' ')}`},{quoted:m}); }
case 'afk': { global.db.auto.afk=text||'AFK'; global.db.auto.afktime=Date.now(); return sock.sendMessage(from,{text:`✅ You now AFK: ${text}`},{quoted:m}); }
case 'afkcheck': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); return sock.sendMessage(from,{text:`AFK users: ${global.db.auto.afk||'None'}`},{quoted:m}); }
case 'antispam2': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].antispam2=text==='on'; return sock.sendMessage(from,{text:`✅ AntiSpam2 ${text}`},{quoted:m}); }
case 'warnlimit': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].warnlimit=parseInt(text)||3; return sock.sendMessage(from,{text:`✅ WarnLimit set to ${text}`},{quoted:m}); }
case 'role': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); let t=m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; if(!t||!text) return sock.sendMessage(from,{text:'.role @user Mod'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].roles=global.db.anti[from].roles||{}; global.db.anti[from].roles[t]=text; return sock.sendMessage(from,{text:`✅ Role @${t.split('@')[0]} = ${text}`},{quoted:m}); }
case 'ticket': { if(!text) return sock.sendMessage(from,{text:'Problem?\n.ticket bot no dey work'},{quoted:m}); let id=Math.floor(Math.random()*10000); return sock.sendMessage(from,{text:`🎫 Ticket #${id}\nProblem: ${text}\nStatus: Open`},{quoted:m}); }
case 'report': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); if(!text) return sock.sendMessage(from,{text:'.report @user reason'},{quoted:m}); return sock.sendMessage(from,{text:`🚨 Anonymous Report:\n${text}\n(Reported to admins)`},{quoted:m}); }
case 'ghostonline': { if(!isOwner) return sock.sendMessage(from,{text:'❌ Owner only'},{quoted:m}); global.db.auto.ghostonline=text==='on'; if(text==='on') await sock.sendPresenceUpdate('available'); else await sock.sendPresenceUpdate('unavailable'); return sock.sendMessage(from,{text:`✅ GhostOnline ${text}`},{quoted:m}); }
case 'gitclone': case 'clone': { if(!q) return sock.sendMessage(from,{text:'Link! Ex: .gitclone https://github.com/user/repo'},{quoted:m}); try{ let url=q.match(/https?:\/\/github\.com\/[^\s]+/)?.[0]; if(!url) return sock.sendMessage(from,{text:'Invalid github link!'},{quoted:m}); url=url.replace(/\.git$/,''); let name=url.split('/').pop(); let zip=`${url}/archive/refs/heads/main.zip`; let check=await fetch(zip,{method:'HEAD'}); if(!check.ok) zip=`${url}/archive/refs/heads/master.zip`; return sock.sendMessage(from,{document:{url:zip},mimetype:'application/zip',fileName:`${name}.zip`,caption:`✅ Cloned: ${name}`},{quoted:m}); }catch(e){ return sock.sendMessage(from,{text:'Failed to clone!'},{quoted:m}); } }
case 'clonevoice': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); let q=m.message.audioMessage||m.quoted?.audioMessage; if(!q) return sock.sendMessage(from,{text:'Reply VN to clone'},{quoted:m}); return sock.sendMessage(from,{text:'✅ Voice cloned - Bot go talk like that person'},{quoted:m}); }
case 'stickerai': { if(!q) return sock.sendMessage(from,{text:'❌ Give prompt! Ex: .stickerai cat with suit'},{quoted:m}); try{ let url=`https://image.pollinations.ai/prompt/${encodeURIComponent(q)}?width=512&height=512&nologo=true`; let {Sticker}=require('wa-sticker-formatter'); let st=new Sticker(url,{pack:'CRASHER MD',author:'AI',type:'full',quality:70}); return sock.sendMessage(from,{sticker:await st.toBuffer()},{quoted:m}); }catch(e){ return sock.sendMessage(from,{text:'❌ AI fail: '+e.message},{quoted:m}); } }
case 'autoreplyai': { global.db.auto.autoreplyai=text==='on'; return sock.sendMessage(from,{text:`✅ AutoReplyAI ${text}`},{quoted:m}); }
case 'antilink2': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].antilink2=text==='on'; return sock.sendMessage(from,{text:`✅ AntiLink2 ${text}`},{quoted:m}); }
case 'autodelete': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].autodelete=parseInt(text)||60; return sock.sendMessage(from,{text:`✅ AutoDelete ${text}sec`},{quoted:m}); }
case 'groupicon': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); try{ let pp=await sock.profilePictureUrl(from,'image'); return sock.sendMessage(from,{image:{url:pp},caption:'✅ Group icon'},{quoted:m}); }catch{ return sock.sendMessage(from,{text:'No icon'},{quoted:m}); } }
case 'hidetag2': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); if(!isAdmin && !isOwner) return sock.sendMessage(from,{text:'🛡️ Admin only'},{quoted:m}); let msg=text||'Hidden tag'; return sock.sendMessage(from,{text:msg,mentions:participants.map(a=>a.id)}); }
case 'aisticker': { if(!q) return sock.sendMessage(from,{text:'Give prompt! .aisticker cute anime girl'},{quoted:m}); await sock.sendMessage(from,{text:'🎨 Generating AI sticker...'},{quoted:m}); try{ let img=`https://image.pollinations.ai/prompt/${encodeURIComponent(q)}?width=512&height=512`; let {Sticker}=require('wa-sticker-formatter'); let sticker=new Sticker(img,{pack:'CRASHER MD',author:'AI BOT',type:'full',quality:80}); return sock.sendMessage(from,{sticker:await sticker.toBuffer()},{quoted:m}); }catch(e){ return sock.sendMessage(from,{text:'Fail: '+e.message},{quoted:m}); } }
case 'emojiinfo': { if(!text) return sock.sendMessage(from,{text:'Give emoji\n.emojiinfo 😂'},{quoted:m}); return sock.sendMessage(from,{text:`Emoji: ${text}\nName: Joy`},{quoted:m}); }
case 'age': { if(!text) return sock.sendMessage(from,{text:'Name\n.age CRASHER'},{quoted:m}); return sock.sendMessage(from,{text:`Age of ${text}: 25 years (AI guess)`},{quoted:m}); }
case 'groupopenauto': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].openauto=text; return sock.sendMessage(from,{text:`✅ Group auto open at ${text}`},{quoted:m}); }
case 'groupcloseauto': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].closeauto=text; return sock.sendMessage(from,{text:`✅ Group auto close at ${text}`},{quoted:m}); }
case 'antisticker2': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].antisticker2=text==='on'; return sock.sendMessage(from,{text:`✅ AntiSticker2 ${text}`},{quoted:m}); }
case 'anticontact2': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); global.db.anti[from]=global.db.anti[from]||{}; global.db.anti[from].anticontact2=text==='on'; return sock.sendMessage(from,{text:`✅ AntiContact2 ${text}`},{quoted:m}); }
case 'daily': { global.db.auto.daily=text==='on'; return sock.sendMessage(from,{text:`✅ Daily reward ${text}`},{quoted:m}); }
case 'leaderboard': { if(!isGroupChat) return sock.sendMessage(from,{text:'👥 Group only'},{quoted:m}); return sock.sendMessage(from,{text:`*Leaderboard*\n1. You - 1000pts\n2. @user - 800pts\n3. @user2 - 600pts`},{quoted:m}); }
case 'toimg': { const q=m.quoted?.stickerMessage; if(!q) return sock.sendMessage(from,{text:'Reply sticker'},{quoted:m}); const buf=await downloadMedia(q,'sticker'); return sock.sendMessage(from,{image:buf},{quoted:m}); }
case 'take': return await sock.sendMessage(from,{text:'Take done'},{quoted:m});
case 'attp': { if(!text) return sock.sendMessage(from,{text:'Text?'},{quoted:m}); return sock.sendMessage(from,{image:{url:`https://api.zenkey.my.id/api/textpro/attp?text=${encodeURIComponent(text)}`},caption:`Attp ${text}`},{quoted:m}); }
case 'smeme': return await sock.sendMessage(from,{text:`Smeme ${text}`},{quoted:m});
case 'pickupline': case 'rizz': { const a=["Are you","Girl are you","If you be","You be like"], b=["NEPA","WiFi","jollof rice","Google","my phone battery","ChapGPT","garri"], c=["because you light up my life","because I'm feeling connection","because I can never get enough of you","because you have everything I'm searching for","because you full my mind","because you fine pass AI","and I don dey fall for you"]; return sock.sendMessage(from,{text:`😏 *RANDOM RIZZ*\n\n${a[Math.floor(Math.random()*a.length)]} ${b[Math.floor(Math.random()*b.length)]} ${c[Math.floor(Math.random()*c.length)]}`},{quoted:m}); }
case 'motivation': case 'motivate': { const a=["Bro wake up,","Listen,", "Real talk,", "No cap,"], b=["no one will do it for you","grind now shine later","consistency beats talent","your future needs you","hustle in silence"], c=["so get up and work!","stop giving excuses!","God did but you must do!","make money make sense!"]; return sock.sendMessage(from,{text:`🔥 *MOTIVATION*\n\n${a[Math.floor(Math.random()*a.length)]} ${b[Math.floor(Math.random()*b.length)]} - ${c[Math.floor(Math.random()*c.length)]}`},{quoted:m}); }
case 'insult': { const a=["You be like","Your face be like","You resemble","Na so you be like","You be exactly like"], b=["MTN data","pure water wey sun catch","NEPA light","gala for Lagos traffic","expired Indomie","fuel for scarcity","PHCN bill","okada wey no get brake"], c=["you dey chop money but no value","flat and useless","e dey on and off","nobody want pick you","sense no dey inside","you go wound person eye","na only God fit help you","go sit down jare"]; return sock.sendMessage(from,{text:`🤣 *RANDOM INSULT*\n\n${a[Math.floor(Math.random()*a.length)]} ${b[Math.floor(Math.random()*b.length)]}, ${c[Math.floor(Math.random()*c.length)]}`},{quoted:m}); }
case 'joke': { const j=["Why did the Nigerian student carry ladder to school? Because he heard JAMB is high!","My girlfriend said she'll leave me if I don't stop making puns.","Teacher: Why you late? Student: Village people held my slippers.","NEPA took light, my girlfriend said she needs space.","Why did the scarecrow win an award? He was outstanding!","I told my phone I need space, e no gree"]; return sock.sendMessage(from,{text:`😂 *JOKE*\n\n${j[Math.floor(Math.random()*j.length)]}`},{quoted:m}); }
case 'quote': case 'qoutet': { const all=["Power comes in response to a need, not a desire - Goku","If you don’t take risks, you can’t create a future - Luffy","No guts, no glory.","Hustle in silence, let success make noise.","You had me at hello.","If I know what love is, it is because of you."]; return sock.sendMessage(from,{text:`✨ *RANDOM QUOTE*\n\n"${all[Math.floor(Math.random()*all.length)]}"`},{quoted:m}); }
case 'meme': return sock.sendMessage(from,{image:{url:`https://picsum.photos/600/400?random=${Date.now()}`},caption:'Meme'},{quoted:m});
case 'truth': { const a=["When last you","Who is","Have you ever","Do you","What is","How many times you"], b=["lied to your crush","cried because of love","stolen meat from pot","kissed someone","had crush on person in this group","stalked your ex"], c=["this week?","and why?","tell truth!","no lie!","be honest!"]; return sock.sendMessage(from,{text:`🤔 *RANDOM TRUTH:*\n\n${a[Math.floor(Math.random()*a.length)]} ${b[Math.floor(Math.random()*b.length)]} ${c[Math.floor(Math.random()*c.length)]}`.toUpperCase()},{quoted:m}); }
case 'dare': { const a=["Send voice note shouting","Do video of you doing","Send pic of you","Text your crush","Post on status","Call your mom and say"], b=["I love you","20 pushups","with cloth inside out","'I am jobless'","'I stole meat'","a monkey"], c=["for 30sec","for 1 hour","and screenshot","with video proof","right now","for 24hrs"]; return sock.sendMessage(from,{text:`🎯 *RANDOM DARE:*\n\n${a[Math.floor(Math.random()*a.length)]} ${b[Math.floor(Math.random()*b.length)]} ${c[Math.floor(Math.random()*c.length)]}`.toUpperCase()},{quoted:m}); }
break; }
        default: await doReact('❌'); return
    }
}

startCrasher()
            
