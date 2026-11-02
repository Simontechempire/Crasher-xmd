module.exports = {
  isOwner: (sender) => {
    try {
      if (!sender) return false
      const num = sender.split("@")[0].replace(/[^0-9]/g,'')
      return ["2348071569915","2348071569915@s.whatsapp.net"].includes(sender) || ["2348071569915"].includes(num)
    } catch { return false }
  },
  isGroup: (jid) => {
    try {
      if (!jid) return false
      return jid.endsWith("@g.us")
    } catch { return false }
  },
  runtime: (seconds) => {
    try {
      seconds = Number(seconds) || 0
      const d = Math.floor(seconds / (3600 * 24))
      const h = Math.floor((seconds % (3600 * 24)) / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      const s = Math.floor(seconds % 60)
      return `${d}d ${h}h ${m}m ${s}s`
    } catch { return "0d 0h 0m 0s" }
  }
}
