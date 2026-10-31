require('dotenv').config();

module.exports = {
  owner: ["2348102350169"],
  ownerName: "CRASHER",
  botName: process.env.BOT_NAME || "ＣＲＡＳＨＥＲ ＭＤ",
  prefix: process.env.PREFIX || ".",
  sessionDir: "./session",
  port: process.env.PORT || 3000,
  totalCmds: 100,
  menuPic: "https://files.catbox.moe/hhafg3.jpg",
  // Pairing
  pairCode: true
}
