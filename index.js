require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const Decimal = require("decimal.js");
const { Telegraf, Markup } = require("telegraf");
const { createClient } = require("@supabase/supabase-js");

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const UID_MIN = Number(process.env.UID_MIN || 1022220);
const UID_MAX = Number(process.env.UID_MAX || 35000000);
const RECEIVER_UID = process.env.RECEIVER_UID || "34856289";
const TRANSFER_ADDRESS = process.env.TRANSFER_ADDRESS || process.env.UEEX_TRANSFER_ADDRESS || "0xaa166d764b6967aa98394f61db605370fc8c3872";
const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || "UE";
const PLATFORM_FEE_BPS = Number(process.env.PLATFORM_FEE_BPS || 500);
const MAX_OPEN_MATCHES_SHOWN = Number(process.env.MAX_OPEN_MATCHES_SHOWN || 500);
const LIVE_UPDATE_INTERVAL_MS = Number(process.env.LIVE_UPDATE_INTERVAL_MS || 30000);
const MY_VOTE_PAGE_SIZE = Number(process.env.MY_VOTE_PAGE_SIZE || 3);
const WINNERS_PAGE_SIZE = Number(process.env.WINNERS_PAGE_SIZE || 5);
const NEED_RESULT_LIMIT = Number(process.env.NEED_RESULT_LIMIT || 50);
const MIN_BET_AMOUNT = new Decimal(process.env.MIN_BET_AMOUNT || 1000);
const MIN_BET_AMOUNT_ROUND_32 = new Decimal(process.env.MIN_BET_AMOUNT_ROUND_32 || process.env.MIN_BET_AMOUNT_R32 || 2000);
const MIN_BET_AMOUNT_ROUND_16 = new Decimal(process.env.MIN_BET_AMOUNT_ROUND_16 || process.env.MIN_BET_AMOUNT_R16 || 3000);
const MIN_BET_AMOUNT_QUARTER_FINAL = new Decimal(process.env.MIN_BET_AMOUNT_QUARTER_FINAL || process.env.MIN_BET_AMOUNT_QF || 4000);
const MIN_BET_AMOUNT_SEMI_FINAL = new Decimal(process.env.MIN_BET_AMOUNT_SEMI_FINAL || process.env.MIN_BET_AMOUNT_SF || 5000);
const MIN_BET_AMOUNT_FINAL = new Decimal(process.env.MIN_BET_AMOUNT_FINAL || 10000);
const BOT_USERNAME = (process.env.BOT_USERNAME || "").replace(/^@/, "");
const AUTO_CONFIRM_ENABLED = String(process.env.AUTO_CONFIRM_ENABLED || "false").toLowerCase() === "true";
const PAYMENT_CHECK_INTERVAL_MS = Number(process.env.PAYMENT_CHECK_INTERVAL_MS || 30000);
const UEEX_PAYMENT_ITEM_ID = Number(process.env.UEEX_PAYMENT_ITEM_ID || 1304);
const UEEX_PAYMENT_TYPE = Number(process.env.UEEX_PAYMENT_TYPE || 1);
const UEEX_RECEIVER_UID = process.env.UEEX_RECEIVER_UID || RECEIVER_UID;
const UEEX_INTERNAL_EXCHANGE_TYPE = Number(process.env.UEEX_INTERNAL_EXCHANGE_TYPE || 1);
const UEEX_SUCCESS_STATUS = process.env.UEEX_SUCCESS_STATUS || "success";
const PAYMENT_MATCH_MODE = process.env.PAYMENT_MATCH_MODE || "remark_or_uid_amount";
// UID is now the primary payment confirmation key. When true, UID+exact amount can match even if the user left a non-order remark.
const UID_AMOUNT_MATCH_ALLOW_REMARK = String(process.env.UID_AMOUNT_MATCH_ALLOW_REMARK || "true").toLowerCase() === "true";
const UEEX_API_BASE_URL = (process.env.UEEX_API_BASE_URL || "").replace(/\/$/, "");
const UEEX_API_KEY = process.env.UEEX_API_KEY || "";
const UEEX_API_SECRET = process.env.UEEX_API_SECRET || "";
const UEEX_API_TOKEN = process.env.UEEX_API_TOKEN || "";
const UEEX_API_DEPOSIT_LIST_PATH = process.env.UEEX_API_DEPOSIT_LIST_PATH || "/Assets/depositWithdrawList";
const UEEX_SIGN_MODE = process.env.UEEX_SIGN_MODE || "query_secret_suffix";
const UEEX_SIGN_SECRET_PARAM = process.env.UEEX_SIGN_SECRET_PARAM || "key";
const UEEX_SIGN_CASE = (process.env.UEEX_SIGN_CASE || "upper").toLowerCase();
// ThirdApi usually expects a 10-digit seconds timestamp. Set UEEX_TIMESTAMP_UNIT=milliseconds only if technical support confirms 13 digits are required.
const UEEX_TIMESTAMP_UNIT = (process.env.UEEX_TIMESTAMP_UNIT || "seconds").toLowerCase();
// ThirdApi nonce is documented as int. Default to numeric nonce to avoid -142 random number errors.
const UEEX_NONCE_MODE = (process.env.UEEX_NONCE_MODE || "numeric").toLowerCase();
const UEEX_NONCE_LENGTH = Number(process.env.UEEX_NONCE_LENGTH || 6);
const UEEX_RECORD_LIMIT = Number(process.env.UEEX_RECORD_LIMIT || 200);
const UEEX_RECORD_MAX_PAGES = Number(process.env.UEEX_RECORD_MAX_PAGES || 3);
const UEEX_RAW_DEBUG_DAYS = Number(process.env.UEEX_RAW_DEBUG_DAYS || 14);
const UEEX_REQUIRE_UID_MATCH = String(process.env.UEEX_REQUIRE_UID_MATCH || "true").toLowerCase() === "true";
// receiver_perspective: type=1 records are queried from official receiver account; account UID = 1122031, counterparty UID = user UID.
// sender_receiver: traditional transfer direction; from UID = user UID, to UID = 1122031.
// either: accept either of the above two UID directions.
const UEEX_UID_MATCH_MODE = process.env.UEEX_UID_MATCH_MODE || "receiver_perspective";
const UEEX_FIELD_REMARK = process.env.UEEX_FIELD_REMARK || "";
const UEEX_FIELD_AMOUNT = process.env.UEEX_FIELD_AMOUNT || "";
const UEEX_FIELD_STATUS = process.env.UEEX_FIELD_STATUS || "";
const UEEX_FIELD_ITEM_ID = process.env.UEEX_FIELD_ITEM_ID || "";
const UEEX_FIELD_FROM_UID = process.env.UEEX_FIELD_FROM_UID || "";
const UEEX_FIELD_TO_UID = process.env.UEEX_FIELD_TO_UID || "";
const UEEX_FIELD_ACCOUNT_UID = process.env.UEEX_FIELD_ACCOUNT_UID || "";
const UEEX_FIELD_COUNTERPARTY_UID = process.env.UEEX_FIELD_COUNTERPARTY_UID || "";
const UEEX_FIELD_EXCHANGE_ID = process.env.UEEX_FIELD_EXCHANGE_ID || "";
const UEEX_FIELD_EXCHANGE_TYPE = process.env.UEEX_FIELD_EXCHANGE_TYPE || "";
const WORLDCUP_IMAGE_URL = process.env.WORLDCUP_IMAGE_URL || "";
const WORLDCUP_IMAGE_URL_ZH = process.env.WORLDCUP_IMAGE_URL_ZH || "https://i.ibb.co/PsLDwsDB/Chat-GPT-Image-Jun-8-2026-02-43-59-PM-2.png";
const PENDING_ORDER_IMAGE_URL = process.env.PENDING_ORDER_IMAGE_URL || "https://ibb.co/NdLrz2qq";
const ORDER_CONFIRMED_IMAGE_URL = process.env.ORDER_CONFIRMED_IMAGE_URL || "";
const WELCOME_IMAGE_URL =
  process.env.WELCOME_IMAGE_URL ||
  "https://i.ibb.co/zhCkDn3V/Chat-GPT-Image-Jun-5-2026-02-45-56-PM.png";
const RULES_IMAGE_URL =
  process.env.RULES_IMAGE_URL ||
  "https://i.ibb.co/5xxJWyJS/Chat-GPT-Image-Jun-5-2026-10-48-45-AM-1.png";
const SUPPORT_IMAGE_URL =
  process.env.SUPPORT_IMAGE_URL ||
  "https://i.ibb.co/MxXqypCm/Chat-GPT-Image-Jun-5-2026-10-48-45-AM-2.png";
const MYVOTE_IMAGE_URL =
  process.env.MYVOTE_IMAGE_URL ||
  "https://i.ibb.co/C3MxB9zh/Chat-GPT-Image-Jun-5-2026-10-48-46-AM-3.png";
const HOW_TO_PLAY_IMAGE_URL = process.env.HOW_TO_PLAY_IMAGE_URL || "https://ibb.co/BVxnssjY";
const HOW_TO_PLAY_IMAGE_URL_ZH = process.env.HOW_TO_PLAY_IMAGE_URL_ZH || "https://ibb.co/C5MwfqPx";
const MATCH_CANCELLED_IMAGE_URL = process.env.MATCH_CANCELLED_IMAGE_URL || "https://ibb.co/SXLC5H0N";
const MATCH_CANCELLED_IMAGE_URL_ZH = process.env.MATCH_CANCELLED_IMAGE_URL_ZH || "https://ibb.co/mgdxZ4R";
const WINNER_IMAGE_URL =
  process.env.WINNER_IMAGE_URL ||
  "https://i.ibb.co/nqpCFgCQ/Chat-GPT-Image-Jun-5-2026-06-06-09-PM-2.png";
const LOSER_IMAGE_URL =
  process.env.LOSER_IMAGE_URL ||
  "https://i.ibb.co/fdhXY8xh/Chat-GPT-Image-Jun-5-2026-06-06-09-PM-1.png";
const MATCH_SETTLED_IMAGE_URL =
  process.env.MATCH_SETTLED_IMAGE_URL ||
  "https://i.ibb.co/fzfJTNWb/Chat-GPT-Image-Jun-5-2026-06-08-57-PM.png";
const ORDER_CANCELLED_IMAGE_URL =
  process.env.ORDER_CANCELLED_IMAGE_URL ||
  "https://i.ibb.co/zV2pxQNm/Chat-GPT-Image-Jun-8-2026-01-26-00-PM.png";
const TOPIC_RULES_IMAGE_URL = process.env.TOPIC_RULES_IMAGE_URL || "https://i.ibb.co/GfxngkkL/Chat-GPT-Image-Jun-4-2026-10-34-19-AM-1.png";
const ORDER_CANCELLED_IMAGE_URL_ZH = process.env.ORDER_CANCELLED_IMAGE_URL_ZH || "https://i.ibb.co/Vpj2PBwP/Chat-GPT-Image-Jun-8-2026-02-43-59-PM-1.png";
const PENDING_ORDER_IMAGE_URL_ZH = process.env.PENDING_ORDER_IMAGE_URL_ZH || "https://ibb.co/CKFt3NSZ";
const ORDER_CONFIRMED_IMAGE_URL_ZH = process.env.ORDER_CONFIRMED_IMAGE_URL_ZH || "https://i.ibb.co/7xnyz5x1/Chat-GPT-Image-Jun-8-2026-02-43-59-PM-4.png";
const LOSER_IMAGE_URL_ZH = process.env.LOSER_IMAGE_URL_ZH || "https://i.ibb.co/9Hf2VkrT/Chat-GPT-Image-Jun-8-2026-02-43-59-PM-5.png";
const WINNER_IMAGE_URL_ZH = process.env.WINNER_IMAGE_URL_ZH || "https://i.ibb.co/4RLw4LrR/Chat-GPT-Image-Jun-8-2026-02-43-59-PM-6.png";
const MATCH_SETTLED_IMAGE_URL_ZH = process.env.MATCH_SETTLED_IMAGE_URL_ZH || "https://i.ibb.co/VpJ27nxw/Chat-GPT-Image-Jun-8-2026-02-43-59-PM-7.png";
const RULES_IMAGE_URL_ZH = process.env.RULES_IMAGE_URL_ZH || "https://i.ibb.co/qMjDRwgH/Chat-GPT-Image-Jun-8-2026-02-43-59-PM-8.png";
const SUPPORT_IMAGE_URL_ZH = process.env.SUPPORT_IMAGE_URL_ZH || "https://i.ibb.co/spJjGyg8/Chat-GPT-Image-Jun-8-2026-02-43-59-PM-9.png";
const MYVOTE_IMAGE_URL_ZH = process.env.MYVOTE_IMAGE_URL_ZH || "https://i.ibb.co/mrQJkKqy/Chat-GPT-Image-Jun-8-2026-02-43-59-PM-10.png";
const TELEGRAM_CAPTION_SAFE_LIMIT = 1000;
const ADMIN_GROUP_CHAT_ID = process.env.ADMIN_GROUP_CHAT_ID || "";
const PUBLIC_GROUP_CHAT_ID = process.env.PUBLIC_GROUP_CHAT_ID || process.env.PUBLIC_CHAT_ID || "";
const PUBLIC_WORLD_CUP_TOPIC_ID = process.env.PUBLIC_WORLD_CUP_TOPIC_ID || process.env.WORLD_CUP_TOPIC_ID || "";
const PUBLIC_GROUP_USERNAME = (process.env.PUBLIC_GROUP_USERNAME || process.env.PUBLIC_CHAT_USERNAME || "").replace(/^@/, "");
const PUBLIC_WORLD_CUP_TOPIC_URL = process.env.PUBLIC_WORLD_CUP_TOPIC_URL || process.env.WORLD_CUP_TOPIC_URL || process.env.BROADCAST_TOPIC_URL || "";

// v50: If a settled match has no exact-score winners, its net pool rolls over to the World Cup Final prize pool.
// Set WORLDCUP_FINAL_MATCH_CODE after creating the final match for the safest targeting.
// If it is not set, the bot will treat a match_stage containing "Final" as the final match.
const CARRYOVER_NO_WINNER_TO_FINAL_ENABLED = String(process.env.CARRYOVER_NO_WINNER_TO_FINAL_ENABLED || "true").toLowerCase() === "true";
const WORLDCUP_FINAL_MATCH_CODE = String(process.env.WORLDCUP_FINAL_MATCH_CODE || process.env.FINAL_MATCH_CODE || "").trim().toUpperCase();

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is required");
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

app.use(express.json());

const sessionStore = new Map();
const privateMenuMessageStore = new Map();
const acceptedRulesStore = new Set();
const languageStore = new Map();

function getSessionKey(ctx) {
  return `${ctx.chat?.id || "unknown"}:${ctx.from?.id || "unknown"}`;
}
function getPrivateMenuKey(ctx, category = "default") {
  return `${ctx.chat?.id || "unknown"}:${ctx.from?.id || "unknown"}:${category}`;
}

async function deleteLastPrivateMenuMessage(ctx, category = "default") {
  if (!ctx || !isPrivateChat(ctx)) return;

  const key = getPrivateMenuKey(ctx, category);
  const stored = privateMenuMessageStore.get(key);

  if (!stored) return;

  const messageIds = Array.isArray(stored) ? stored : [stored];

  for (const messageId of messageIds) {
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, messageId);
    } catch (error) {
      // Ignore delete failures, for example if the user already deleted the message.
    }
  }

  privateMenuMessageStore.delete(key);
}

function rememberPrivateMenuMessage(ctx, sentMessage, category = "default") {
  if (ctx && isPrivateChat(ctx) && sentMessage?.message_id) {
    privateMenuMessageStore.set(getPrivateMenuKey(ctx, category), sentMessage.message_id);
  }

  return sentMessage;
}

function rememberPrivateMenuMessages(ctx, sentMessages, category = "default") {
  if (ctx && isPrivateChat(ctx)) {
    const ids = (sentMessages || [])
      .map((message) => message?.message_id)
      .filter(Boolean);

    if (ids.length) {
      privateMenuMessageStore.set(getPrivateMenuKey(ctx, category), ids);
    }
  }

  return sentMessages?.[sentMessages.length - 1] || null;
}


function setSession(ctx, data) {
  sessionStore.set(getSessionKey(ctx), {
    ...data,
    updatedAt: Date.now()
  });
}

function getSession(ctx) {
  return sessionStore.get(getSessionKey(ctx));
}

function clearSession(ctx) {
  sessionStore.delete(getSessionKey(ctx));
}

function isGroupChat(ctx) {
  return ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
}

function isPrivateChat(ctx) {
  return ctx.chat?.type === "private";
}

function isAdminGroupChat(ctx) {
  return Boolean(ADMIN_GROUP_CHAT_ID) && String(ctx.chat?.id || "") === String(ADMIN_GROUP_CHAT_ID);
}

function isPublicWorldCupChat(ctx) {
  return Boolean(PUBLIC_GROUP_CHAT_ID) && String(ctx.chat?.id || "") === String(PUBLIC_GROUP_CHAT_ID);
}

function isAdminControlChat(ctx) {
  return isPrivateChat(ctx) || isAdminGroupChat(ctx);
}

function getMessageText(ctx) {
  return ctx.message?.text || ctx.message?.caption || "";
}

function cleanCommandText(text) {
  return String(text || "").trim().replace(/@\w+/g, "");
}

function scheduleDeleteMessage(chatId, messageId, delayMs = 10000) {
  if (!chatId || !messageId) return;

  setTimeout(async () => {
    try {
      await bot.telegram.deleteMessage(chatId, messageId);
    } catch (error) {
      // Ignore delete failures, for example missing permission or message already deleted.
    }
  }, delayMs);
}

async function deleteStoredPrompt(ctx) {
  const session = getSession(ctx);

  if (!session?.promptMessageId || !ctx.chat?.id) return;

  try {
    await ctx.telegram.deleteMessage(ctx.chat.id, session.promptMessageId);
  } catch (error) {
    // Ignore delete failures.
  }
}

function isAdminId(userId) {
  return ADMIN_USER_IDS.includes(String(userId));
}

async function isAdminUser(ctx) {
  if (isAdminId(ctx.from?.id)) return true;
  if (isAdminGroupChat(ctx)) return true;

  if (!isGroupChat(ctx)) {
    return isAdminId(ctx.from?.id);
  }

  try {
    const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    return member.status === "creator" || member.status === "administrator";
  } catch (error) {
    console.error("Check admin error:", error);
    return false;
  }
}

async function requireAdmin(ctx) {
  const ok = await isAdminUser(ctx);

  if (!ok) {
    const warning = await ctx.reply("Only admins can use this command.");

    if (ctx.chat?.id && ctx.message?.message_id) {
      scheduleDeleteMessage(ctx.chat.id, ctx.message.message_id, 10000);
    }

    if (ctx.chat?.id && warning?.message_id) {
      scheduleDeleteMessage(ctx.chat.id, warning.message_id, 10000);
    }

    return false;
  }

  return true;
}

async function requireAdminControlChat(ctx) {
  if (!(await requireAdmin(ctx))) return false;

  if (isAdminControlChat(ctx)) return true;

  const warning = await ctx.reply("Please use this command in the admin group.");

  if (ctx.chat?.id && ctx.message?.message_id) {
    scheduleDeleteMessage(ctx.chat.id, ctx.message.message_id, 10000);
  }

  if (ctx.chat?.id && warning?.message_id) {
    scheduleDeleteMessage(ctx.chat.id, warning.message_id, 10000);
  }

  return false;
}

async function notifyAdminGroup(text, ctx = null) {
  if (!ADMIN_GROUP_CHAT_ID) return null;

  if (ctx && String(ctx.chat?.id || "") === String(ADMIN_GROUP_CHAT_ID)) {
    return null;
  }

  try {
    return await bot.telegram.sendMessage(ADMIN_GROUP_CHAT_ID, text, {
      disable_web_page_preview: true
    });
  } catch (error) {
    console.error("Failed to notify admin group:", error.message);
    return null;
  }
}

function normalizeTeam(team) {
  return String(team || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

const TEAM_FLAG_MAP = {
  ALG: "🇩🇿", ARG: "🇦🇷", AUS: "🇦🇺", AUT: "🇦🇹", BEL: "🇧🇪",
  BIH: "🇧🇦", BRA: "🇧🇷", CAN: "🇨🇦", CHI: "🇨🇱", CHN: "🇨🇳",
  CIV: "🇨🇮", COD: "🇨🇩", COL: "🇨🇴", CPV: "🇨🇻", CRO: "🇭🇷",
  CUW: "🇨🇼", CZE: "🇨🇿", DEN: "🇩🇰", ECU: "🇪🇨", EGY: "🇪🇬",
  ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", ESP: "🇪🇸", FRA: "🇫🇷", GER: "🇩🇪", GHA: "🇬🇭",
  HAI: "🇭🇹", IRN: "🇮🇷", IRQ: "🇮🇶", ITA: "🇮🇹", JOR: "🇯🇴",
  JPN: "🇯🇵", KOR: "🇰🇷", KSA: "🇸🇦", MAR: "🇲🇦", MEX: "🇲🇽",
  NED: "🇳🇱", NGA: "🇳🇬", NOR: "🇳🇴", NZL: "🇳🇿", PAN: "🇵🇦",
  PAR: "🇵🇾", POL: "🇵🇱", POR: "🇵🇹", QAT: "🇶🇦", RUS: "🇷🇺",
  SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", SEN: "🇸🇳", SRB: "🇷🇸", SUI: "🇨🇭", SWE: "🇸🇪",
  TUN: "🇹🇳", TUR: "🇹🇷", UKR: "🇺🇦", URU: "🇺🇾", USA: "🇺🇸",
  UZB: "🇺🇿", WAL: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", ZAF: "🇿🇦"
};

function getTeamFlag(team) {
  return TEAM_FLAG_MAP[normalizeTeam(team)] || "🏳️";
}

function formatTeamWithFlag(team) {
  return `${getTeamFlag(team)} ${normalizeTeam(team)}`;
}

function getTelegramUserLabel(userLike) {
  if (!userLike) return "Unknown TG";
  if (userLike.username) return `@${userLike.username}`;

  const name = [userLike.first_name, userLike.last_name].filter(Boolean).join(" ");
  if (name) return name;

  if (userLike.telegram_id) return `TG ${userLike.telegram_id}`;
  if (userLike.id) return `TG ${userLike.id}`;

  return "Unknown TG";
}

function formatSelectionWithFlags(match, selection, ctxOrLang = null) {
  const raw = String(selection || "").trim();
  const upper = raw.toUpperCase();
  const teamAFlag = getTeamFlag(match.team_a);
  const teamBFlag = getTeamFlag(match.team_b);
  const zh = isZh(ctxOrLang);

  if (upper === "A_OTHER") {
    return zh
      ? `${teamAFlag} 其他 ${match.team_a} 胜 ${teamBFlag}`
      : `${teamAFlag} Other ${match.team_a} Win ${teamBFlag}`;
  }

  if (upper === "DRAW_OTHER") {
    return zh
      ? `${teamAFlag} 其他平局 ${teamBFlag}`
      : `${teamAFlag} Other Draw ${teamBFlag}`;
  }

  if (upper === "B_OTHER") {
    return zh
      ? `${teamAFlag} 其他 ${match.team_b} 胜 ${teamBFlag}`
      : `${teamAFlag} Other ${match.team_b} Win ${teamBFlag}`;
  }

  const score = parseScoreValue(raw);
  if (score) {
    return `${teamAFlag} ${score.text} ${teamBFlag}`;
  }

  return `${teamAFlag} ${labelForSelection(match, selection, ctxOrLang)} ${teamBFlag}`;
}

function isValidUid(uid) {
  if (!/^\d+$/.test(String(uid || ""))) return false;
  const num = Number(uid);
  return num >= UID_MIN && num <= UID_MAX;
}

function parsePositiveAmount(value) {
  const raw = String(value || "").trim().replace(/,/g, "");

  if (!/^\d+(\.\d{1,8})?$/.test(raw)) return null;

  try {
    const amount = new Decimal(raw);
    if (!amount.isFinite() || amount.lte(0)) return null;
    return amount;
  } catch (error) {
    return null;
  }
}

function addThousands(value) {
  const [integerPart, decimalPart] = String(value).split(".");
  const withCommas = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimalPart ? `${withCommas}.${decimalPart}` : withCommas;
}

function formatAmount(value, maxDp = 8) {
  const decimal = new Decimal(value || 0);

  if (decimal.isZero()) return "0";

  const fixed = decimal.toDecimalPlaces(maxDp, Decimal.ROUND_DOWN).toFixed();
  const cleaned = fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

  return addThousands(cleaned || "0");
}

function formatAmountForCommand(value, maxDp = 8) {
  const decimal = new Decimal(value || 0);
  const fixed = decimal.toDecimalPlaces(maxDp, Decimal.ROUND_DOWN).toFixed();
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") || "0";
}

function getStageMinimumBetAmount(matchOrStage = null) {
  const rawStage = typeof matchOrStage === "object"
    ? String(matchOrStage?.match_stage || "")
    : String(matchOrStage || "");

  const stage = rawStage.toLowerCase();
  const compact = stage.replace(/[\s_\-]/g, "");

  if (/半决赛|semi/.test(stage) || compact.includes("semifinal") || compact.includes("semifinals")) {
    return MIN_BET_AMOUNT_SEMI_FINAL;
  }

  if (/8强|quarter/.test(stage) || compact.includes("quarterfinal") || compact.includes("quarterfinals") || compact.includes("roundof8") || compact === "r8" || compact.includes("last8")) {
    return MIN_BET_AMOUNT_QUARTER_FINAL;
  }

  if (/16强/.test(stage) || compact.includes("roundof16") || compact.includes("round16") || compact === "r16" || compact.includes("last16") || compact.includes("top16")) {
    return MIN_BET_AMOUNT_ROUND_16;
  }

  if (/32强/.test(stage) || compact.includes("roundof32") || compact.includes("round32") || compact === "r32" || compact.includes("last32") || compact.includes("top32")) {
    return MIN_BET_AMOUNT_ROUND_32;
  }

  if (/决赛/.test(stage) || compact === "final" || compact.includes("worldcupfinal") || compact.includes("grandfinal")) {
    return MIN_BET_AMOUNT_FINAL;
  }

  return MIN_BET_AMOUNT;
}

function buildMinimumBetRuleLine(ctxOrLang = null) {
  if (isZh(ctxOrLang)) {
    return `💵 最低投票：小组赛/普通赛事 ${formatAmount(MIN_BET_AMOUNT)} UE；32强 ${formatAmount(MIN_BET_AMOUNT_ROUND_32)} UE；16强 ${formatAmount(MIN_BET_AMOUNT_ROUND_16)} UE；8强 ${formatAmount(MIN_BET_AMOUNT_QUARTER_FINAL)} UE；半决赛 ${formatAmount(MIN_BET_AMOUNT_SEMI_FINAL)} UE；决赛 ${formatAmount(MIN_BET_AMOUNT_FINAL)} UE。`;
  }

  return `💵 Minimum vote: Group/regular matches ${formatAmount(MIN_BET_AMOUNT)} UE; Round of 32 ${formatAmount(MIN_BET_AMOUNT_ROUND_32)} UE; Round of 16 ${formatAmount(MIN_BET_AMOUNT_ROUND_16)} UE; Quarter-finals ${formatAmount(MIN_BET_AMOUNT_QUARTER_FINAL)} UE; Semi-finals ${formatAmount(MIN_BET_AMOUNT_SEMI_FINAL)} UE; Final ${formatAmount(MIN_BET_AMOUNT_FINAL)} UE.`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatTimeLeft(endAt) {
  const diffMs = new Date(endAt).getTime() - Date.now();

  if (diffMs <= 0) return "Closed";

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const time = `${hours}:${pad2(minutes)}:${pad2(seconds)}`;

  return days > 0 ? `${days}d ${time}` : time;
}

function parseUtcOffsetMinutes(timezoneText) {
  const match = String(timezoneText || "").trim().toUpperCase().match(/^UTC([+-])(\d{1,2})$/);

  if (!match) return null;

  const sign = match[1] === "+" ? 1 : -1;
  const hours = Number(match[2]);

  if (Number.isNaN(hours) || hours > 14) return null;

  return sign * hours * 60;
}

function parseMatchStartAtUtc(matchDate, matchTime, matchTimezone) {
  const dateParts = String(matchDate || "").split(".").map((value) => Number(value));
  const timeParts = String(matchTime || "").split(":").map((value) => Number(value));
  const offsetMinutes = parseUtcOffsetMinutes(matchTimezone);

  if (
    dateParts.length !== 3 ||
    timeParts.length !== 2 ||
    offsetMinutes === null ||
    dateParts.some((value) => Number.isNaN(value)) ||
    timeParts.some((value) => Number.isNaN(value))
  ) {
    return null;
  }

  const [year, month, day] = dateParts;
  const [hour, minute] = timeParts;

  if (
    year < 2020 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const localAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  return new Date(localAsUtcMs - offsetMinutes * 60 * 1000);
}

function isVotingOpen(match) {
  return match.status === "open" && new Date(match.betting_end_at).getTime() > Date.now();
}

function getSelectionOptions(match) {
  const fallback = ["A", "DRAW", "B"];
  const raw = match?.selection_options;

  if (!raw) return fallback;

  if (Array.isArray(raw)) {
    return raw.map((item) => String(item)).filter(Boolean);
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch (error) {
      return fallback;
    }
  }

  return fallback;
}

function labelForSelection(match, selection, ctxOrLang = null) {
  const raw = String(selection || "").trim();
  const upper = raw.toUpperCase();
  const zh = isZh(ctxOrLang);

  if (upper === "A") return zh ? `${match.team_a} 胜` : `${match.team_a} Win`;
  if (upper === "B") return zh ? `${match.team_b} 胜` : `${match.team_b} Win`;
  if (upper === "DRAW") return zh ? "平局" : "Draw";
  if (upper === "A_OTHER") return zh ? `其他 ${match.team_a} 胜` : `Other ${match.team_a} Win`;
  if (upper === "DRAW_OTHER") return zh ? "其他平局" : "Other Draw";
  if (upper === "B_OTHER") return zh ? `其他 ${match.team_b} 胜` : `Other ${match.team_b} Win`;

  return raw || (zh ? "未知" : "Unknown");
}

function parseScoreValue(input) {
  const match = String(input || "").trim().match(/^(\d+):(\d+)$/);
  if (!match) return null;

  return {
    home: Number(match[1]),
    away: Number(match[2]),
    text: `${Number(match[1])}:${Number(match[2])}`
  };
}

function getSelectionOutcome(selection) {
  const raw = String(selection || "").trim();
  const upper = raw.toUpperCase();

  if (upper === "A" || upper === "A_OTHER") return "A";
  if (upper === "B" || upper === "B_OTHER") return "B";
  if (upper === "DRAW" || upper === "DRAW_OTHER") return "DRAW";

  const score = parseScoreValue(raw);
  if (!score) return null;

  if (score.home > score.away) return "A";
  if (score.home < score.away) return "B";
  return "DRAW";
}

function getOutcomeLabel(match, outcome, ctxOrLang = null) {
  const zh = isZh(ctxOrLang);

  if (outcome === "A") {
    return zh ? `${getTeamFlag(match.team_a)} ${match.team_a}胜` : `${getTeamFlag(match.team_a)} Win`;
  }

  if (outcome === "B") {
    return zh ? `${getTeamFlag(match.team_b)} ${match.team_b}胜` : `${getTeamFlag(match.team_b)} Win`;
  }

  return zh ? "🤝 平局" : "Draw";
}

function getOutcomeCallbackLabel(match, outcome, totals = null, ctxOrLang = null) {
  const label = getOutcomeLabel(match, outcome, ctxOrLang);

  if (!totals) return label;

  return `${label} | ${formatAmount(getOutcomeTotal(match, totals, outcome))} ${match.currency}`;
}

function formatSelectionButtonLabel(match, option, ctxOrLang = null) {
  return formatSelectionWithFlags(match, option, ctxOrLang);
}

function generateScoreOptions(startScore = "0:0", endScore = "5:5", lastOption = "Others") {
  const start = parseScoreValue(startScore) || { home: 0, away: 0 };
  const end = parseScoreValue(endScore) || { home: 5, away: 5 };

  if (start.home > end.home || start.away > end.away) return null;

  const scores = [];

  for (let home = start.home; home <= end.home; home += 1) {
    for (let away = start.away; away <= end.away; away += 1) {
      scores.push(`${home}:${away}`);
    }
  }

  scores.sort((a, b) => {
    const sa = parseScoreValue(a);
    const sb = parseScoreValue(b);
    const totalA = sa.home + sa.away;
    const totalB = sb.home + sb.away;

    if (totalA !== totalB) return totalA - totalB;
    return sb.home - sa.home;
  });

  return [...scores, "A_OTHER", "DRAW_OTHER", "B_OTHER"];
}

function getOptionsByOutcome(match, outcome) {
  const options = getSelectionOptions(match);
  const normalOptions = options.filter((option) => getSelectionOutcome(option) === outcome);
  const otherOption = outcome === "A" ? "A_OTHER" : outcome === "B" ? "B_OTHER" : "DRAW_OTHER";

  const withoutOther = normalOptions.filter((option) => String(option).toUpperCase() !== otherOption);

  if (options.map((option) => String(option).toUpperCase()).includes(otherOption)) {
    return [...withoutOther, otherOption];
  }

  return withoutOther;
}

function getOutcomeTotal(match, totals, outcome) {
  return getOptionsByOutcome(match, outcome).reduce((sum, option) => {
    return sum.plus(totals[option] || 0);
  }, new Decimal(0));
}

function resultInputToSelection(match, input) {
  const raw = String(input || "").trim();
  const options = getSelectionOptions(match);

  const exact = options.find((option) => option.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;

  const normalized = raw.toUpperCase();
  if (["A_OTHER", "DRAW_OTHER", "B_OTHER"].includes(normalized)) {
    const option = options.find((item) => item.toUpperCase() === normalized);
    return option || normalized;
  }

  const score = parseScoreValue(raw);
  if (score) {
    const outcome = score.home > score.away ? "A" : score.home < score.away ? "B" : "DRAW";
    const otherOption = outcome === "A" ? "A_OTHER" : outcome === "B" ? "B_OTHER" : "DRAW_OTHER";
    const foundOther = options.find((item) => item.toUpperCase() === otherOption);
    return foundOther || raw;
  }

  const legacyValue = normalizeTeam(raw);
  if (legacyValue === "DRAW" || legacyValue === "TIE") return "DRAW";
  if (legacyValue === normalizeTeam(match.team_a)) return "A";
  if (legacyValue === normalizeTeam(match.team_b)) return "B";
  if (legacyValue === "A") return "A";
  if (legacyValue === "B") return "B";

  return null;
}

function makeCode(prefix, length = 6) {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";

  for (let i = 0; i < length; i += 1) {
    result += chars[crypto.randomInt(0, chars.length)];
  }

  return `${prefix}${result}`;
}

async function generateUniqueCode(prefix, table, column) {
  for (let i = 0; i < 10; i += 1) {
    const code = makeCode(prefix, prefix === "WC" ? 4 : 6);

    const { data, error } = await supabase
      .from(table)
      .select(column)
      .eq(column, code)
      .maybeSingle();

    if (error) {
      console.error("Generate code check error:", error);
    }

    if (!data) return code;
  }

  return `${prefix}${Date.now().toString().slice(-8)}`;
}

async function upsertUser(ctx, uid) {
  const user = ctx.from;

  const payload = {
    telegram_id: user.id,
    ueex_uid: String(uid),
    username: user.username || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("wc_users")
    .upsert(payload, { onConflict: "telegram_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save UID: ${error.message}`);
  }

  return data;
}

async function getUserByTelegramId(telegramId) {
  const { data, error } = await supabase
    .from("wc_users")
    .select("*")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (error) {
    console.error("Get user error:", error);
    return null;
  }

  return data;
}

async function getMatch(matchCode) {
  const { data, error } = await supabase
    .from("wc_matches")
    .select("*")
    .eq("match_code", matchCode)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load match: ${error.message}`);
  }

  return data;
}

async function getOpenMatches(chatId) {
  const { data, error } = await supabase
    .from("wc_matches")
    .select("*")
    .eq("chat_id", chatId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(MAX_OPEN_MATCHES_SHOWN);

  if (error) {
    throw new Error(`Failed to load matches: ${error.message}`);
  }

  return data || [];
}

async function getAllOpenMatches() {
  const { data, error } = await supabase
    .from("wc_matches")
    .select("*")
    .eq("status", "open")
    .order("match_date", { ascending: true })
    .order("match_time", { ascending: true })
    .limit(500);

  if (error) {
    throw new Error(`Failed to load matches: ${error.message}`);
  }

  return data || [];
}

function getMatchSortTime(match) {
  const dateText = String(match.match_date || "9999.12.31").replace(/\./g, "-");
  const timeText = match.match_time || "23:59";
  const parsed = new Date(`${dateText}T${timeText}:00Z`).getTime();
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function sortMatchesBySchedule(matches) {
  return [...(matches || [])].sort((a, b) => {
    const diff = getMatchSortTime(a) - getMatchSortTime(b);
    if (diff !== 0) return diff;
    return String(a.match_code || "").localeCompare(String(b.match_code || ""));
  });
}

function getMatchDateKey(match) {
  return match.match_date || "Unknown Date";
}

function getMatchDayLabel(dateKey) {
  if (!dateKey || dateKey === "Unknown Date") return "Unknown Date";

  const parts = String(dateKey).split(".").map((value) => Number(value));
  if (parts.length !== 3 || parts.some((value) => Number.isNaN(value))) {
    return String(dateKey);
  }

  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);

  return `${dateKey} • ${weekday}`;
}

function getMatchListButtonLabel(match) {
  const timeText = match.match_time || "TBD";
  return `${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)} • ${timeText}`;
}

function encodeDateKey(dateKey) {
  return String(dateKey || "Unknown Date").replace(/:/g, "-");
}

function decodeDateKey(dateKey) {
  return String(dateKey || "Unknown Date").replace(/-/g, ":");
}

async function getMatchTotals(matchCode, match = null) {
  const matchData = match || (await getMatch(matchCode));
  const options = getSelectionOptions(matchData);

  const { data, error } = await supabase
    .from("wc_orders")
    .select("selection, confirmed_amount")
    .eq("match_code", matchCode)
    .eq("status", "confirmed");

  if (error) {
    throw new Error(`Failed to load totals: ${error.message}`);
  }

  const totals = {};

  for (const option of options) {
    totals[option] = new Decimal(0);
  }

  for (const row of data || []) {
    if (!totals[row.selection]) {
      totals[row.selection] = new Decimal(0);
    }

    totals[row.selection] = totals[row.selection].plus(row.confirmed_amount || 0);
  }

  return totals;
}

function getTotalPool(totals) {
  return Object.values(totals).reduce((sum, amount) => sum.plus(amount), new Decimal(0));
}

function getBetNowUrl(matchCode) {
  if (!BOT_USERNAME) return null;
  return `https://t.me/${BOT_USERNAME}?start=vote_${matchCode}`;
}

function getUserLang(ctxOrUserId = null) {
  const userId =
    typeof ctxOrUserId === "object"
      ? ctxOrUserId?.from?.id
      : ctxOrUserId;

  if (!userId) return "en";

  return languageStore.get(String(userId)) || "en";
}

function setUserLang(ctxOrUserId, lang) {
  const userId =
    typeof ctxOrUserId === "object"
      ? ctxOrUserId?.from?.id
      : ctxOrUserId;

  const normalized = String(lang || "").toLowerCase().startsWith("zh") ? "zh" : "en";

  if (userId) {
    languageStore.set(String(userId), normalized);
  }

  return normalized;
}

function hasSelectedLanguage(ctx) {
  return Boolean(ctx?.from?.id) && languageStore.has(String(ctx.from.id));
}

function isZh(ctxOrLang = null) {
  const lang =
    typeof ctxOrLang === "string"
      ? ctxOrLang
      : getUserLang(ctxOrLang);

  return lang === "zh";
}

function getLocalizedImageUrl(ctxOrLang, englishUrl, zhUrl) {
  return isZh(ctxOrLang) && zhUrl ? zhUrl : englishUrl;
}

function getPrivateMainMenu(ctxOrLang = null) {
  const zh = isZh(ctxOrLang);

  return {
    reply_markup: {
      keyboard: zh
        ? [
            [{ text: "⚽ 比赛" }, { text: "📊 我的投票" }],
            [{ text: "🏆 历史赢家" }],
            [{ text: "🎮 玩法" }, { text: "📜 规则" }],
            [{ text: "📣 播报群" }, { text: "🛟 客服" }]
          ]
        : [
            [{ text: "⚽ Matches" }, { text: "📊 My Vote" }],
            [{ text: "🏆 Winners" }],
            [{ text: "🎮 How to Play" }, { text: "📜 Rules" }],
            [{ text: "📣 Announcement" }, { text: "🛟 Support" }]
          ],
      resize_keyboard: true,
      one_time_keyboard: false,
      is_persistent: true
    }
  };
}

function getLanguageKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("中文", "wclang:zh"),
      Markup.button.callback("English", "wclang:en")
    ]
  ]);
}

async function showLanguageSelection(ctx, pendingMatchCode = "") {
  if (!isPrivateChat(ctx)) {
    return ctx.reply("Please open private chat with the bot to join World Cup Prediction.");
  }

  clearSession(ctx);

  if (pendingMatchCode) {
    setSession(ctx, { step: "language_pending_match", pendingMatchCode });
  }

  return ctx.reply("🌐 Please select your language\n请选择语言", getLanguageKeyboard());
}

function getPublicWorldCupTopicUrl() {
  const configuredUrl = String(PUBLIC_WORLD_CUP_TOPIC_URL || "").trim();
  if (configuredUrl) return configuredUrl;

  const topicId = String(PUBLIC_WORLD_CUP_TOPIC_ID || "").trim();
  if (!topicId) return null;

  if (PUBLIC_GROUP_USERNAME) {
    return `https://t.me/${PUBLIC_GROUP_USERNAME}/${topicId}`;
  }

  const rawChatId = String(PUBLIC_GROUP_CHAT_ID || "").trim();
  if (!rawChatId) return null;

  const internalChatId = rawChatId.startsWith("-100")
    ? rawChatId.slice(4)
    : rawChatId.startsWith("-")
      ? rawChatId.slice(1)
      : rawChatId;

  if (!internalChatId) return null;

  return `https://t.me/c/${internalChatId}/${topicId}`;
}

function getBroadcastTopicButton(ctxOrLang = null) {
  const url = getPublicWorldCupTopicUrl();
  if (!url) return null;

  return Markup.button.url(isZh(ctxOrLang) ? "📣 播报群" : "📣 Announcement Topic", url);
}

function withBroadcastTopicRow(rows, ctxOrLang = null) {
  const broadcastButton = getBroadcastTopicButton(ctxOrLang);
  return broadcastButton ? [...rows, [broadcastButton]] : rows;
}

function getBroadcastTopicKeyboard(ctxOrLang = null) {
  const broadcastButton = getBroadcastTopicButton(ctxOrLang);
  if (!broadcastButton) return null;
  return Markup.inlineKeyboard([[broadcastButton]]);
}

function getSupportKeyboard(ctxOrLang = null) {
  return Markup.inlineKeyboard(withBroadcastTopicRow([
    [Markup.button.url("Contact @UEEx_JJ", "https://t.me/UEEx_JJ")]
  ], ctxOrLang));
}

function getPrivateMatchesInlineKeyboard(ctxOrLang = null) {
  return Markup.inlineKeyboard(withBroadcastTopicRow([
    [Markup.button.callback(isZh(ctxOrLang) ? "⚽ 比赛" : "⚽ Matches", "wcgoto:matches")]
  ], ctxOrLang));
}

function getRulesAcceptKeyboard(ctxOrLang = null) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(isZh(ctxOrLang) ? "✅ 我已了解" : "✅ I Understand", "wcrules:accept")]
  ]);
}

function getOrderCancelledKeyboard(ctxOrLang = null) {
  return Markup.inlineKeyboard(withBroadcastTopicRow([
    [Markup.button.url(isZh(ctxOrLang) ? "🛟 客服" : "🛟 Support", "https://t.me/UEEx_JJ")],
    [Markup.button.callback(isZh(ctxOrLang) ? "⚽ 比赛" : "⚽ Matches", "wcgoto:matches")]
  ], ctxOrLang));
}

function hasAcceptedRules(ctx) {
  return Boolean(ctx?.from?.id) && acceptedRulesStore.has(String(ctx.from.id));
}

function markRulesAccepted(ctx) {
  if (ctx?.from?.id) {
    acceptedRulesStore.add(String(ctx.from.id));
  }
}

async function showStartRules(ctx, pendingMatchCode = "") {
  if (!isPrivateChat(ctx)) {
    return ctx.reply("Please open private chat with the bot to join World Cup Prediction.");
  }

  clearSession(ctx);

  if (pendingMatchCode) {
    setSession(ctx, { step: "rules_pending_match", pendingMatchCode });
  }

  const rulesText = `${buildRulesMessage(ctx)}

${isZh(ctx) ? "请阅读规则，并点击“我已了解”继续。" : "Please read the rules and tap “I Understand” to continue."}`;

  return replyWithOptionalPhoto(ctx, getLocalizedImageUrl(ctx, RULES_IMAGE_URL, RULES_IMAGE_URL_ZH), rulesText, getRulesAcceptKeyboard(ctx));
}

function getPendingOrderKeyboard(orderCode, ctxOrLang = null) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(isZh(ctxOrLang) ? "❌ 取消订单" : "❌ Cancel", `wccancel:${orderCode}`)],
    [Markup.button.callback(isZh(ctxOrLang) ? "⚽ 比赛" : "⚽ Matches", "wcgoto:matches")]
  ]);
}

function buildRulesMessage(ctxOrLang = null) {
  const feePercent = formatAmount(new Decimal(PLATFORM_FEE_BPS).div(100));

  if (isZh(ctxOrLang)) {
    return `📜 规则

${buildMinimumBetRuleLine(ctxOrLang)}
🏦 官方地址：${TRANSFER_ADDRESS}
🧾 系统将主要根据绑定 UID + 转账金额确认订单；订单 ID 不再作为必填备注。少转需补足，多转仅订单金额计入奖池。
⏰ 开赛前 15 分钟停止投票，逾期到账可能不计入。
🧮 平台手续费：${feePercent}%，从每场奖池扣除。
🎯 猜中准确比分，按中奖金额占比瓜分净奖池。
⏱️ 比分按官方90分钟结果结算，含伤停补时，不含加时/点球。
♻️ 若本场无人猜中准确比分，该场净奖池累计至世界杯总决赛。
🏆 总决赛中奖用户瓜分：总决赛净奖池 + 累计奖池。
📤 奖励预计次日 1pm（UTC+4）前发放；异常情况以 Admin/财务复核为准。`;
  }

  return `📜 Rules

${buildMinimumBetRuleLine(ctxOrLang)}
🏦 Official address: ${TRANSFER_ADDRESS}
🧾 Orders are mainly confirmed by bound UID + transfer amount. Order ID is no longer required as the transfer remark. Underpaid orders need top-up; overpaid orders count only the order amount.
⏰ Voting closes 15 minutes before kick-off. Late payments may not count.
🧮 Platform fee: ${feePercent}% per match pool.
🎯 Exact-score winners share the net pool by winning-vote amount.
⏱️ Scores are settled by the official 90-minute result, including stoppage time, excluding extra time/penalties.
♻️ If no one hits the exact score, that match net pool rolls over to the World Cup Final.
🏆 Final winners share: Final net pool + carryover pool.
📤 Rewards are expected by 1pm (UTC+4) the next day. Abnormal cases are subject to Admin/Finance review.`;
}

async function showRules(ctx) {
  if (isPrivateChat(ctx)) {
    await deleteLastPrivateMenuMessage(ctx, "rules");
  }

  const sent = await replyWithOptionalPhoto(ctx, getLocalizedImageUrl(ctx, RULES_IMAGE_URL, RULES_IMAGE_URL_ZH), buildRulesMessage(ctx), getPrivateMainMenu(ctx));
  return rememberPrivateMenuMessage(ctx, sent, "rules");
}

function buildHowToPlayMessage(ctxOrLang = null) {
  const feePercent = formatAmount(new Decimal(PLATFORM_FEE_BPS).div(100));

  if (isZh(ctxOrLang)) {
    return `🎮 玩法

1️⃣ 选择比赛、方向、准确比分和 UE 金额。
2️⃣ 按 Bot 显示金额转账，系统将根据绑定 UID + 金额确认订单。
3️⃣ 到账确认后，投票才计入奖池。

🏆 奖池

• 每场扣除 ${feePercent}% 手续费后为净奖池。
• 猜中准确比分，按中奖金额占比瓜分净奖池。
• 比分按90分钟+伤停补时结算，不含加时/点球。
• 本场无人猜中：净奖池累计到世界杯总决赛。
• 总决赛中奖用户瓜分：总决赛净奖池 + 累计奖池。

⚠️ 订单 ID 不再作为必填备注；如少转需补足，多转超出部分由 Admin 人工处理。`;
  }

  return `🎮 How to Play

1️⃣ Pick a match, side, exact score, and UE amount.
2️⃣ Transfer the bot-shown amount. The system confirms mainly by your bound UID + amount.
3️⃣ Your vote counts after payment confirmation.

🏆 Prize Pool

• Each match net pool is after the ${feePercent}% platform fee.
• Exact-score winners share the net pool by winning-vote amount.
• Scores use 90 mins + stoppage time only, excluding extra time/penalties.
• No exact-score winners: the net pool rolls over to the World Cup Final.
• Final winners share: Final net pool + carryover pool.

⚠️ Order ID is no longer required as the transfer remark. Underpaid orders need top-up; extra overpayment is reviewed by Admin.`;
}

async function showHowToPlay(ctx) {
  if (isPrivateChat(ctx)) {
    await deleteLastPrivateMenuMessage(ctx, "howtoplay");
  }

  const sent = await replyWithOptionalPhoto(
    ctx,
    getLocalizedImageUrl(ctx, HOW_TO_PLAY_IMAGE_URL, HOW_TO_PLAY_IMAGE_URL_ZH),
    buildHowToPlayMessage(ctx),
    getPrivateMainMenu(ctx)
  );

  return rememberPrivateMenuMessage(ctx, sent, "howtoplay");
}


async function showSupport(ctx) {
  if (isPrivateChat(ctx)) {
    await deleteLastPrivateMenuMessage(ctx, "support");
  }

  const sent = await replyWithOptionalPhoto(
    ctx,
    getLocalizedImageUrl(ctx, SUPPORT_IMAGE_URL, SUPPORT_IMAGE_URL_ZH),
    isZh(ctx) ? "如需帮助，请联系 @UEEx_JJ。" : "🛟 Need help? Contact @UEEx_JJ for support.",
    getSupportKeyboard(ctx)
  );
  return rememberPrivateMenuMessage(ctx, sent, "support");
}

async function showBroadcastTopic(ctx) {
  const keyboard = getBroadcastTopicKeyboard(ctx);

  if (!keyboard) {
    return ctx.reply(
      isZh(ctx)
        ? "播报群 Topic 链接暂未配置，请联系 Admin。"
        : "The announcement topic link is not configured yet. Please contact Admin.",
      getPrivateMainMenu(ctx)
    );
  }

  return ctx.reply(
    isZh(ctx)
      ? "📣 点击下方按钮进入世界杯播报群 Topic。"
      : "📣 Tap below to open the World Cup announcement topic.",
    keyboard
  );
}


function buildGroupMatchKeyboard(match) {
  const url = getBetNowUrl(match.match_code);

  if (url) {
    return Markup.inlineKeyboard([
      [Markup.button.url("🗳 Vote Now", url)]
    ]);
  }

  return Markup.inlineKeyboard([
    [Markup.button.callback("🗳 Vote Now", `wcmatch:${match.match_code}`)]
  ]);
}

function buildOutcomeKeyboard(match, totals, ctxOrLang = null) {
  const dateKey = getMatchDateKey(match);

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(getOutcomeCallbackLabel(match, "A", null, ctxOrLang), `wcoutcome:${match.match_code}:A`),
      Markup.button.callback(getOutcomeCallbackLabel(match, "DRAW", null, ctxOrLang), `wcoutcome:${match.match_code}:DRAW`),
      Markup.button.callback(getOutcomeCallbackLabel(match, "B", null, ctxOrLang), `wcoutcome:${match.match_code}:B`)
    ],
    [Markup.button.callback(isZh(ctxOrLang) ? "返回" : "Back", `wcdate:${encodeDateKey(dateKey)}`)]
  ]);
}

function buildScoreKeyboard(match, outcome, ctxOrLang = null) {
  const options = getOptionsByOutcome(match, outcome);
  const buttons = options.map((option) =>
    Markup.button.callback(
      formatSelectionButtonLabel(match, option, ctxOrLang),
      `wcsel:${match.match_code}:${option}`
    )
  );

  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  rows.push([Markup.button.callback(isZh(ctxOrLang) ? "返回" : "Back", `wcmatch:${match.match_code}`)]);

  return Markup.inlineKeyboard(rows);
}

function getStatusText(match, ctxOrLang = null) {
  if (isVotingOpen(match)) return isZh(ctxOrLang) ? "开放中" : "Open";
  if (match.status === "open") return isZh(ctxOrLang) ? "已关闭" : "Closed";
  return String(match.status || "").toUpperCase();
}

function getMatchMetaLines(match, ctxOrLang = null) {
  const lines = [];

  if (match.match_date) {
    lines.push(`🔸 ${isZh(ctxOrLang) ? "比赛日期" : "Match Date"}: ${match.match_date}`);
  }

  if (match.match_time || match.match_timezone) {
    const timeText = [match.match_time, match.match_timezone].filter(Boolean).join(" ");
    if (timeText) lines.push(`🔸 ${isZh(ctxOrLang) ? "比赛时间" : "Match Time"}: ${timeText}`);
  }

  if (match.match_stage) {
    lines.push(`🔸 ${isZh(ctxOrLang) ? "阶段" : "Stage"}: ${match.match_stage}`);
  }

  return lines.length ? `${lines.join("\n")}\n` : "";
}

function buildScoreMessage(match, totals, outcome, ctxOrLang = null) {
  const totalPool = getTotalPool(totals);
  const outcomePool = getOutcomeTotal(match, totals, outcome);
  const statusText = getStatusText(match, ctxOrLang);

  if (isZh(ctxOrLang)) {
    return `🔸 比赛 ID: ${match.match_code}
🔸 比赛: ${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}
${getMatchMetaLines(match, ctxOrLang)}🔸 状态: ${statusText}
🔸 剩余投票时间: ${formatTimeLeft(match.betting_end_at)}

📍 选择类型: ${getOutcomeLabel(match, outcome, ctxOrLang)}
📍 该类型奖池: ${formatAmount(outcomePool)} ${match.currency}

🎉总奖池: ${formatAmount(totalPool)} ${match.currency}

⏱️ 比分按90分钟+伤停补时结算，不含加时/点球。
请选择下方准确比分。`;
  }

  return `🔸 Match ID: ${match.match_code}
🔸 Match: ${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}
${getMatchMetaLines(match, ctxOrLang)}🔸 Status: ${statusText}
🔸 Voting Time Left: ${formatTimeLeft(match.betting_end_at)}

📍 Selection Type: ${getOutcomeLabel(match, outcome, ctxOrLang)}
📍 Selection Pool: ${formatAmount(outcomePool)} ${match.currency}

🎉Total Pool: ${formatAmount(totalPool)} ${match.currency}

⏱️ Scores use 90 mins + stoppage time only, excluding extra time/penalties.
Please select the exact score below.`;
}

function buildMatchMessage(match, totals, ctxOrLang = null) {
  const totalPool = getTotalPool(totals);
  const statusText = getStatusText(match, ctxOrLang);

  if (isZh(ctxOrLang)) {
    return `🔸 比赛 ID: ${match.match_code}
🔸 比赛: ${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}
${getMatchMetaLines(match, ctxOrLang)}🔸 状态: ${statusText}
🔸 剩余投票时间: ${formatTimeLeft(match.betting_end_at)}

🎉总奖池: ${formatAmount(totalPool)} ${match.currency}`;
  }

  return `🔸 Match ID: ${match.match_code}
🔸 Match: ${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}
${getMatchMetaLines(match, ctxOrLang)}🔸 Status: ${statusText}
🔸 Voting Time Left: ${formatTimeLeft(match.betting_end_at)}

🎉Total Pool: ${formatAmount(totalPool)} ${match.currency}`;
}

function buildPublicMatchMessage(match, totals) {
  return `${buildMatchMessage(match, totals, "en")}

📌 Rules:
• Tap Vote Now to enter the bot and submit your prediction.
• Minimum voting amount: ${formatAmount(getStageMinimumBetAmount(match))} ${match.currency}.
• Transfer the exact ${match.currency} amount to the BSC address ${TRANSFER_ADDRESS}.
• Orders are mainly confirmed by bound UID + amount. Order ID is no longer required as the transfer remark.
• Score settlement uses 90 mins + stoppage time only, excluding extra time/penalties.
• Votes are counted only after payment confirmation.`;
}

function buildPhotoExtra(caption, keyboard = null, extraOptions = {}) {
  const extra = { caption, ...extraOptions };

  if (keyboard?.reply_markup) {
    extra.reply_markup = keyboard.reply_markup;
  }

  return extra;
}

function splitCaptionText(text, maxLength = TELEGRAM_CAPTION_SAFE_LIMIT) {
  const safeText = String(text || "").trim();

  if (safeText.length <= maxLength) {
    return [safeText, ""];
  }

  let splitAt = safeText.lastIndexOf("\n\n", maxLength);

  if (splitAt < Math.floor(maxLength * 0.45)) {
    splitAt = safeText.lastIndexOf("\n", maxLength);
  }

  if (splitAt < Math.floor(maxLength * 0.45)) {
    splitAt = maxLength;
  }

  const caption = safeText.slice(0, splitAt).trim();
  const remaining = safeText.slice(splitAt).trim();

  return [caption, remaining];
}

async function replyWithOptionalPhoto(ctx, imageUrl, text, keyboard = null, extraOptions = {}) {
  const safeText = String(text || "");

  if (imageUrl) {
    const [caption, remainingText] = splitCaptionText(safeText);
    const photoExtra = { ...extraOptions };

    if (caption) {
      photoExtra.caption = caption;
    }

    if (!remainingText && keyboard?.reply_markup) {
      photoExtra.reply_markup = keyboard.reply_markup;
    }

    const photoMessage = await ctx.replyWithPhoto(imageUrl, photoExtra);

    if (!remainingText) {
      return photoMessage;
    }

    const options = { ...extraOptions };
    if (keyboard?.reply_markup) {
      options.reply_markup = keyboard.reply_markup;
    }

    return ctx.reply(remainingText, options);
  }

  const options = { ...extraOptions };
  if (keyboard?.reply_markup) {
    options.reply_markup = keyboard.reply_markup;
  }

  return ctx.reply(safeText, options);
}

async function sendOptionalPhoto(chatId, imageUrl, text, keyboard = null, extraOptions = {}) {
  const safeText = String(text || "");

  if (imageUrl) {
    const [caption, remainingText] = splitCaptionText(safeText);
    const photoExtra = { ...extraOptions };

    if (caption) {
      photoExtra.caption = caption;
    }

    if (!remainingText && keyboard?.reply_markup) {
      photoExtra.reply_markup = keyboard.reply_markup;
    }

    const photoMessage = await bot.telegram.sendPhoto(chatId, imageUrl, photoExtra);

    if (!remainingText) {
      return photoMessage;
    }

    const options = { ...extraOptions };
    if (keyboard?.reply_markup) {
      options.reply_markup = keyboard.reply_markup;
    }

    return bot.telegram.sendMessage(chatId, remainingText, options);
  }

  const options = { ...extraOptions };
  if (keyboard?.reply_markup) {
    options.reply_markup = keyboard.reply_markup;
  }

  return bot.telegram.sendMessage(chatId, safeText, options);
}
async function notifyPublicWorldCupTopic(text, imageUrl = "", keyboard = null) {
  if (!PUBLIC_GROUP_CHAT_ID) return null;

  const topicOptions = PUBLIC_WORLD_CUP_TOPIC_ID
    ? { message_thread_id: Number(PUBLIC_WORLD_CUP_TOPIC_ID) }
    : {};

  try {
    return await sendOptionalPhoto(PUBLIC_GROUP_CHAT_ID, imageUrl, text, keyboard, topicOptions);
  } catch (error) {
    console.error("Failed to notify public World Cup topic:", error.message);
    return null;
  }
}


async function editLiveMessage(chatId, messageId, imageUrl, text, keyboard = null) {
  if (imageUrl) {
    return bot.telegram.editMessageCaption(
      chatId,
      messageId,
      undefined,
      text,
      keyboard || undefined
    );
  }

  return bot.telegram.editMessageText(
    chatId,
    messageId,
    undefined,
    text,
    keyboard || undefined
  );
}

async function editCallbackMessage(ctx, text, keyboard = null) {
  const message = ctx.callbackQuery?.message;
  const hasPhoto = Array.isArray(message?.photo) && message.photo.length > 0;

  if (hasPhoto && ctx.editMessageCaption) {
    return ctx.editMessageCaption(text, keyboard || undefined);
  }

  if (ctx.editMessageText) {
    return ctx.editMessageText(text, keyboard || undefined);
  }

  return ctx.reply(text, keyboard || undefined);
}

async function updateLiveMatchMessage(matchCode) {
  const match = await getMatch(matchCode);

  if (!match || !match.live_message_id || !match.chat_id) return;

  await autoVoidExpiredPendingOrders(match);
  const totals = await getMatchTotals(matchCode, match);

  try {
    await editLiveMessage(
      match.chat_id,
      match.live_message_id,
      WORLDCUP_IMAGE_URL,
      buildPublicMatchMessage(match, totals),
      buildGroupMatchKeyboard(match)
    );
  } catch (error) {
    if (!String(error.message || "").includes("message is not modified")) {
      console.error("Update live match message error:", error.message);
    }
  }
}


function md5Sign(input) {
  const digest = crypto.createHash("md5").update(String(input)).digest("hex");
  return UEEX_SIGN_CASE === "lower" ? digest.toLowerCase() : digest.toUpperCase();
}

function getNonEmptyParams(params) {
  return Object.fromEntries(
    Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== null && String(value) !== "")
  );
}

function createUeexSign(params) {
  const cleanParams = getNonEmptyParams(params);
  const entries = Object.entries(cleanParams)
    .filter(([key]) => key !== "sign")
    .sort(([a], [b]) => a.localeCompare(b));

  let raw;

  if (UEEX_SIGN_MODE === "concat_secret_suffix" || UEEX_SIGN_MODE === "query_direct_secret_suffix") {
    // UEEx doc style: sorted query string, then append api_secret value directly.
    // Example: api_key=xxx&nonce=123456&timestamp=1234567890<SECRET>
    raw = `${entries.map(([key, value]) => `${key}=${value}`).join("&")}${UEEX_API_SECRET}`;
  } else if (UEEX_SIGN_MODE === "plain_concat_secret_suffix") {
    raw = `${entries.map(([key, value]) => `${key}${value}`).join("")}${UEEX_API_SECRET}`;
  } else if (UEEX_SIGN_MODE === "plain_concat_secret_prefix") {
    raw = `${UEEX_API_SECRET}${entries.map(([key, value]) => `${key}${value}`).join("")}`;
  } else if (UEEX_SIGN_MODE === "query_secret_prefix") {
    raw = `${UEEX_SIGN_SECRET_PARAM}=${UEEX_API_SECRET}&${entries.map(([key, value]) => `${key}=${value}`).join("&")}`;
  } else {
    raw = `${entries.map(([key, value]) => `${key}=${value}`).join("&")}&${UEEX_SIGN_SECRET_PARAM}=${UEEX_API_SECRET}`;
  }

  return md5Sign(raw);
}


function maskSensitiveValue(value, visibleStart = 4, visibleEnd = 4) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= visibleStart + visibleEnd) return "***";
  return `${text.slice(0, visibleStart)}***${text.slice(-visibleEnd)}`;
}

function buildSignRawFromEntries(entries, secretValue, maskSensitive = false) {
  const secret = maskSensitive ? "<SECRET>" : secretValue;
  const formatValue = (key, value) => {
    if (!maskSensitive) return String(value);
    if (["api_key", "token", "api_token", "access_token"].includes(String(key).toLowerCase())) {
      return maskSensitiveValue(value);
    }
    return String(value);
  };

  if (UEEX_SIGN_MODE === "concat_secret_suffix" || UEEX_SIGN_MODE === "query_direct_secret_suffix") {
    return `${entries.map(([key, value]) => `${key}=${formatValue(key, value)}`).join("&")}${secret}`;
  }

  if (UEEX_SIGN_MODE === "plain_concat_secret_suffix") {
    return `${entries.map(([key, value]) => `${key}${formatValue(key, value)}`).join("")}${secret}`;
  }

  if (UEEX_SIGN_MODE === "plain_concat_secret_prefix") {
    return `${secret}${entries.map(([key, value]) => `${key}${formatValue(key, value)}`).join("")}`;
  }

  if (UEEX_SIGN_MODE === "query_secret_prefix") {
    return `${UEEX_SIGN_SECRET_PARAM}=${secret}&${entries.map(([key, value]) => `${key}=${formatValue(key, value)}`).join("&")}`;
  }

  return `${entries.map(([key, value]) => `${key}=${formatValue(key, value)}`).join("&")}&${UEEX_SIGN_SECRET_PARAM}=${secret}`;
}

function createUeexSignDebug(params) {
  const cleanParams = getNonEmptyParams(params);
  const entries = Object.entries(cleanParams)
    .filter(([key]) => key !== "sign")
    .sort(([a], [b]) => a.localeCompare(b));

  const raw = buildSignRawFromEntries(entries, UEEX_API_SECRET, false);
  const rawMasked = buildSignRawFromEntries(entries, UEEX_API_SECRET, true);
  const sign = md5Sign(raw);

  return {
    entries,
    rawMasked,
    sign
  };
}

function getUeexTimestamp() {
  if (UEEX_TIMESTAMP_UNIT === "milliseconds" || UEEX_TIMESTAMP_UNIT === "millisecond" || UEEX_TIMESTAMP_UNIT === "ms") {
    return String(Date.now());
  }

  return String(Math.floor(Date.now() / 1000));
}

function getUeexNonce() {
  if (UEEX_NONCE_MODE === "hex") {
    return crypto.randomBytes(8).toString("hex");
  }

  const length = Math.min(Math.max(Number.isFinite(UEEX_NONCE_LENGTH) ? UEEX_NONCE_LENGTH : 6, 1), 12);

  if (length === 1) {
    return String(crypto.randomInt(0, 10));
  }

  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return String(crypto.randomInt(min, max));
}

function buildUeexApiParams(extraParams = {}) {
  const nonce = getUeexNonce();
  const timestamp = getUeexTimestamp();

  const params = getNonEmptyParams({
    api_key: UEEX_API_KEY,
    nonce,
    timestamp,
    token: UEEX_API_TOKEN,
    ...extraParams
  });

  return {
    ...params,
    sign: createUeexSign(params)
  };
}

function buildUeexUrl(path) {
  const cleanPath = String(path || "").startsWith("/") ? String(path || "") : `/${path}`;
  return `${UEEX_API_BASE_URL}${cleanPath}`;
}

function getNestedArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return null;

  const candidateKeys = ["data", "list", "records", "rows", "items", "result"];

  for (const key of candidateKeys) {
    if (Array.isArray(value[key])) return value[key];
  }

  for (const key of candidateKeys) {
    const nested = getNestedArray(value[key]);
    if (nested) return nested;
  }

  return null;
}

function pickField(record, envField, candidates) {
  if (!record || typeof record !== "object") return undefined;

  if (envField && Object.prototype.hasOwnProperty.call(record, envField)) {
    return record[envField];
  }

  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key];
    }
  }

  return undefined;
}

function pickUidField(record, envField, candidates) {
  if (!record || typeof record !== "object") return undefined;

  const keys = envField
    ? [envField, ...candidates.filter((key) => key !== envField)]
    : candidates;

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;

    const value = record[key];
    const text = value !== undefined && value !== null ? String(value).trim() : "";

    // UEEx may return 0 when the opposite user field is not populated.
    if (!text || text === "0") continue;

    return value;
  }

  return undefined;
}

function normalizeApiRecord(record) {
  const remark = pickField(record, UEEX_FIELD_REMARK, ["remark", "memo", "note", "transfer_remark", "chain_tag"]);
  const amount = pickField(record, UEEX_FIELD_AMOUNT, ["num", "amount", "quantity", "value", "money", "volume"]);
  const status = pickField(record, UEEX_FIELD_STATUS, ["status", "state", "audit_status"]);
  const itemId = pickField(record, UEEX_FIELD_ITEM_ID, ["item_id", "itemId", "coin_id", "asset_id", "currency_id"]);
  const exchangeType = pickField(record, UEEX_FIELD_EXCHANGE_TYPE, ["exchange_type", "exchangeType", "transfer_type", "address_type"]);
  const exchangeId = pickField(record, UEEX_FIELD_EXCHANGE_ID, ["exchange_id", "exchangeId", "id", "record_id", "order_id", "tx_id", "txid", "hash"]);
  const fromUid = pickUidField(record, UEEX_FIELD_FROM_UID, ["from_uid", "from_user_id", "from_userid", "sender_uid", "sender_user_id", "client_user_id", "clientUserId", "user_id"]);
  const toUid = pickUidField(record, UEEX_FIELD_TO_UID, ["to_uid", "to_user_id", "to_userid", "receiver_uid", "receive_uid", "target_uid", "target_user_id", "collection_uid", "counterparty_uid", "counterparty_user_id", "opposite_uid", "opposite_user_id", "opposite_client_user_id", "oppositeClientUserId", "other_uid", "other_user_id", "peer_uid", "peer_user_id"]);
  const accountUid = pickUidField(record, UEEX_FIELD_ACCOUNT_UID, ["account_uid", "account_user_id", "client_user_id", "clientUserId", "user_uid", "uid", "user_id"]);
  const counterpartyUid = pickUidField(record, UEEX_FIELD_COUNTERPARTY_UID, ["counterparty_uid", "counterparty_user_id", "opposite_uid", "opposite_user_id", "opposite_client_user_id", "oppositeClientUserId", "opposite_client_uid", "oppositeClientUid", "counterparty_client_user_id", "other_uid", "other_user_id", "peer_uid", "peer_user_id", "target_uid", "target_user_id", "to_uid", "to_user_id"]);
  const txid = pickField(record, "", ["txid", "tx_id", "hash", "transaction_hash"]);

  const fallbackExchangeId = md5Sign([
    remark,
    fromUid,
    toUid,
    accountUid,
    counterpartyUid,
    amount,
    itemId,
    status,
    pickField(record, "", ["create_time", "created_at", "time"])
  ].filter((item) => item !== undefined && item !== null && String(item) !== "").join("|"));

  return {
    raw: record,
    exchangeId: exchangeId ? String(exchangeId) : fallbackExchangeId,
    txid: txid ? String(txid) : null,
    remark: remark !== undefined && remark !== null ? String(remark).trim() : "",
    amount: amount !== undefined && amount !== null ? String(amount).trim() : "",
    status: status !== undefined && status !== null ? String(status).trim() : "",
    itemId: itemId !== undefined && itemId !== null ? String(itemId).trim() : "",
    exchangeType: exchangeType !== undefined && exchangeType !== null ? String(exchangeType).trim() : "",
    fromUid: fromUid !== undefined && fromUid !== null ? String(fromUid).trim() : "",
    toUid: toUid !== undefined && toUid !== null ? String(toUid).trim() : "",
    accountUid: accountUid !== undefined && accountUid !== null ? String(accountUid).trim() : "",
    counterpartyUid: counterpartyUid !== undefined && counterpartyUid !== null ? String(counterpartyUid).trim() : ""
  };
}

function apiTimeSeconds(dateValue) {
  const date = dateValue ? new Date(dateValue) : new Date();
  return String(Math.floor(date.getTime() / 1000));
}

async function fetchUeexPaymentRecords(startAt, endAt = new Date()) {
  if (!UEEX_API_BASE_URL || !UEEX_API_KEY || !UEEX_API_SECRET) {
    throw new Error("UEEx API is not configured. Please set UEEX_API_BASE_URL, UEEX_API_KEY, and UEEX_API_SECRET.");
  }

  const allRecords = [];

  for (let page = 1; page <= UEEX_RECORD_MAX_PAGES; page += 1) {
    const params = buildUeexApiParams({
      item_id: UEEX_PAYMENT_ITEM_ID,
      type: UEEX_PAYMENT_TYPE,
      page,
      limit: UEEX_RECORD_LIMIT,
      start_time: apiTimeSeconds(startAt),
      end_time: apiTimeSeconds(endAt)
    });

    const formData = new FormData();
    for (const [key, value] of Object.entries(params)) {
      formData.append(key, String(value));
    }

    const response = await fetch(buildUeexUrl(UEEX_API_DEPOSIT_LIST_PATH), {
      method: "POST",
      body: formData
    });

    const responseText = await response.text();
    let json;

    try {
      json = JSON.parse(responseText);
    } catch (error) {
      throw new Error(`UEEx API returned non-JSON response: ${responseText.slice(0, 200)}`);
    }

    if (!response.ok) {
      throw new Error(`UEEx API HTTP ${response.status}: ${responseText.slice(0, 300)}`);
    }

    const code = json.code ?? json.status_code ?? json.statusCode;
    const apiMessage = json.msg || json.message || json.error;

    if (code !== undefined && ![0, 1, 200, "0", "1", "200", "success", "SUCCESS"].includes(code)) {
      throw new Error(`UEEx API error ${code}: ${apiMessage || responseText.slice(0, 300)}`);
    }

    const records = getNestedArray(json) || [];
    allRecords.push(...records.map(normalizeApiRecord));

    if (records.length < UEEX_RECORD_LIMIT) break;
  }

  return allRecords;
}

function decimalEquals(a, b) {
  try {
    return new Decimal(a || 0).eq(new Decimal(b || 0));
  } catch (error) {
    return false;
  }
}

function isRemarkMatchedPayment(record, order) {
  return String(record?.remark || "").trim() === String(order?.order_code || "").trim();
}

function isEmptyPaymentRemark(record) {
  return !String(record?.remark || "").trim();
}

function getPaymentCounterpartyUid(record) {
  return String(record?.counterpartyUid || record?.toUid || "").trim();
}

function isLikelyOrderRemark(value) {
  return /^O[A-Z0-9]+$/i.test(String(value || "").trim());
}

function isUidAmountPaymentMatch(record, order) {
  if (PAYMENT_MATCH_MODE !== "remark_or_uid_amount") return false;
  if (!record || !order) return false;

  const remark = String(record?.remark || "").trim();

  if (!UID_AMOUNT_MATCH_ALLOW_REMARK && remark) return false;

  // If the user explicitly typed another order code as the remark, do not steal it by UID+amount matching.
  if (UID_AMOUNT_MATCH_ALLOW_REMARK && isLikelyOrderRemark(remark) && remark.toUpperCase() !== String(order.order_code || "").toUpperCase()) {
    return false;
  }

  const payerUid = getPaymentCounterpartyUid(record);
  if (!payerUid || payerUid === "0") return false;

  if (payerUid !== String(order.ueex_uid || "")) return false;

  // UID+amount matching must be exact amount to avoid accidentally matching top-ups or overpayments.
  return decimalEquals(record.amount, order.expected_amount);
}

function findUidAmountAmbiguousOrders(record, order, pendingOrders) {
  if (!isUidAmountPaymentMatch(record, order)) return [];

  return (pendingOrders || []).filter((candidate) => {
    if (!candidate || candidate.order_code === order.order_code) return false;
    if (String(candidate.ueex_uid || "") !== String(order.ueex_uid || "")) return false;
    return decimalEquals(candidate.expected_amount, order.expected_amount);
  });
}

function paymentRecordCanBeCandidate(record, order) {
  return isRemarkMatchedPayment(record, order) || isUidAmountPaymentMatch(record, order);
}

function paymentRecordMatchesOrder(record, order) {
  if (!record) return { ok: false, reason: "Record missing" };

  const remarkMatched = isRemarkMatchedPayment(record, order);
  const uidAmountMatched = isUidAmountPaymentMatch(record, order);

  if (!remarkMatched && !uidAmountMatched) {
    return { ok: false, reason: PAYMENT_MATCH_MODE === "remark_or_uid_amount" ? "Neither remark nor UID+amount matches order" : "Remark does not match order ID" };
  }

  record.paymentMatchMode = uidAmountMatched && !remarkMatched ? "uid_amount" : "remark";

  if (String(record.status).toLowerCase() !== String(UEEX_SUCCESS_STATUS).toLowerCase()) {
    return { ok: false, reason: "Payment status is not success" };
  }

  if (record.itemId && String(record.itemId) !== String(UEEX_PAYMENT_ITEM_ID)) {
    return { ok: false, reason: "Item ID does not match UE" };
  }

  if (record.exchangeType && String(record.exchangeType) !== String(UEEX_INTERNAL_EXCHANGE_TYPE)) {
    return { ok: false, reason: "Exchange type is not internal transfer" };
  }

  if (UEEX_REQUIRE_UID_MATCH) {
    const userUid = String(order.ueex_uid);
    const receiverUid = String(UEEX_RECEIVER_UID);

    const directFromUid = String(record.fromUid || "");
    const directToUid = String(record.toUid || "");
    const accountUid = String(record.accountUid || record.fromUid || "");
    const counterpartyUid = String(record.counterpartyUid || record.toUid || "");

    const directMatch = directFromUid === userUid && directToUid === receiverUid;
    const receiverPerspectiveMatch = accountUid === receiverUid && counterpartyUid === userUid;

    if (UEEX_UID_MATCH_MODE === "sender_receiver") {
      if (!directFromUid) return { ok: false, reason: "Payment sender UID field missing" };
      if (!directToUid) return { ok: false, reason: "Payment receiver UID field missing" };
      if (!directMatch) return { ok: false, reason: "Sender/receiver UID does not match order" };
    } else if (UEEX_UID_MATCH_MODE === "either") {
      if (!directMatch && !receiverPerspectiveMatch) {
        return { ok: false, reason: "UID does not match order in either receiver-perspective or sender-receiver mode" };
      }
    } else {
      if (!accountUid) return { ok: false, reason: "Payment account UID field missing" };
      if (!counterpartyUid) return { ok: false, reason: "Payment counterparty UID field missing" };
      if (!receiverPerspectiveMatch) return { ok: false, reason: "Receiver account/counterparty UID does not match order" };
    }
  }

  return { ok: true, reason: "matched" };
}

async function isPaymentRecordAlreadyUsed(exchangeId) {
  const { data, error } = await supabase
    .from("wc_payment_records")
    .select("matched_order_code")
    .eq("exchange_id", exchangeId)
    .maybeSingle();

  if (error) {
    console.error("Check payment record usage error:", error.message);
    return false;
  }

  return Boolean(data?.matched_order_code);
}

async function savePaymentRecord(record, orderCode) {
  const payload = {
    exchange_id: record.exchangeId,
    remark: record.remark,
    from_uid: record.paymentFromUid || record.fromUid || record.counterpartyUid || null,
    to_uid: record.paymentToUid || record.toUid || record.accountUid || null,
    amount: record.amount || 0,
    currency: DEFAULT_CURRENCY,
    item_id: record.itemId ? Number(record.itemId) : UEEX_PAYMENT_ITEM_ID,
    exchange_type: record.exchangeType ? Number(record.exchangeType) : UEEX_INTERNAL_EXCHANGE_TYPE,
    status: record.status,
    raw_data: record.raw,
    matched_order_code: orderCode
  };

  const { error } = await supabase
    .from("wc_payment_records")
    .upsert(payload, { onConflict: "exchange_id" });

  if (error) {
    throw new Error(`Failed to save payment record: ${error.message}`);
  }
}

async function loadPendingOrdersForAutoConfirm() {
  const { data, error } = await supabase
    .from("wc_orders")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    throw new Error(`Failed to load pending orders: ${error.message}`);
  }

  return data || [];
}

async function autoConfirmPendingOrders(ctx = null) {
  if (!AUTO_CONFIRM_ENABLED) {
    if (ctx) await ctx.reply("Auto confirmation is OFF. Set AUTO_CONFIRM_ENABLED=true to enable it.");
    return { checked: 0, confirmed: 0, message: "Auto confirmation is OFF." };
  }

  const pendingOrders = await loadPendingOrdersForAutoConfirm();

  if (!pendingOrders.length) {
    if (ctx) await ctx.reply("No pending orders to check.");
    return { checked: 0, confirmed: 0, message: "No pending orders." };
  }

  const earliestCreatedAt = pendingOrders[0].created_at;
  const startAt = new Date(new Date(earliestCreatedAt).getTime() - 60 * 60 * 1000);
  const records = await fetchUeexPaymentRecords(startAt, new Date());

  let confirmed = 0;
  const errors = [];

  for (const order of pendingOrders) {
    const matchingRecords = records.filter((record) => paymentRecordCanBeCandidate(record, order));

    if (!matchingRecords.length) continue;

    const validUnusedRecords = [];

    for (const record of matchingRecords) {
      const matchResult = paymentRecordMatchesOrder(record, order);

      if (!matchResult.ok) {
        errors.push(`${order.order_code}: ${matchResult.reason}`);
        continue;
      }

      const ambiguousOrders = findUidAmountAmbiguousOrders(record, order, pendingOrders);
      if (ambiguousOrders.length) {
        errors.push(`${order.order_code}: UID+amount match is ambiguous with ${ambiguousOrders.map((item) => item.order_code).join(", ")}`);
        continue;
      }

      const used = await isPaymentRecordAlreadyUsed(record.exchangeId);
      if (used) {
        errors.push(`${order.order_code}: payment record already used ${record.exchangeId}`);
        continue;
      }

      validUnusedRecords.push(record);
    }

    if (!validUnusedRecords.length) continue;

    const receivedAmount = validUnusedRecords.reduce((sum, record) => {
      try {
        return sum.plus(record.amount || 0);
      } catch (error) {
        return sum;
      }
    }, new Decimal(0));

    const expectedAmount = new Decimal(order.expected_amount || 0);

    if (receivedAmount.lt(expectedAmount)) {
      const remainingAmount = expectedAmount.minus(receivedAmount);
      const underpayReason = `Partial payment received ${formatAmount(receivedAmount)} ${order.currency || DEFAULT_CURRENCY}; remaining ${formatAmount(remainingAmount)} ${order.currency || DEFAULT_CURRENCY} required before confirmation`;

      await supabase
        .from("wc_orders")
        .update({
          payment_checked_at: new Date().toISOString(),
          auto_confirm_error: underpayReason,
          updated_at: new Date().toISOString()
        })
        .eq("order_code", order.order_code);

      errors.push(`${order.order_code}: ${underpayReason}`);
      continue;
    }

    for (const record of validUnusedRecords) {
      record.paymentFromUid = order.ueex_uid;
      record.paymentToUid = UEEX_RECEIVER_UID;
      await savePaymentRecord(record, order.order_code);
    }

    const overpaidAmount = receivedAmount.minus(expectedAmount);
    const primaryRecord = {
      ...validUnusedRecords[0],
      combinedAmount: receivedAmount.toFixed(),
      expectedAmount: expectedAmount.toFixed(),
      overpaidAmount: overpaidAmount.gt(0) ? overpaidAmount.toFixed() : "0",
      paymentExchangeIds: validUnusedRecords.map((record) => record.exchangeId).join(",")
    };

    await confirmOrderByCode(ctx, order.order_code, expectedAmount, {
      autoConfirmed: true,
      paymentRecord: primaryRecord
    });

    if (overpaidAmount.gt(0)) {
      await notifyAdminGroup(`⚠️ Overpayment Detected

Order ID: ${order.order_code}
UID: ${order.ueex_uid}
TG: ${getTelegramUserLabel(order)}
Expected Amount: ${formatAmount(expectedAmount)} ${order.currency || DEFAULT_CURRENCY}
Received Amount: ${formatAmount(receivedAmount)} ${order.currency || DEFAULT_CURRENCY}
Excess Amount: ${formatAmount(overpaidAmount)} ${order.currency || DEFAULT_CURRENCY}

The order has been confirmed with the expected amount only. Please manually review the excess amount.

Suggested command after manual handling:
/compensate_${order.order_code}_${formatAmountForCommand(overpaidAmount)}`);
    }

    confirmed += 1;
  }

  const message = `Payment check completed. Pending checked: ${pendingOrders.length}. Records fetched: ${records.length}. Auto confirmed: ${confirmed}.${errors.length ? `\n\nSkipped / Waiting:\n${errors.slice(0, 10).join("\n")}` : ""}`;

  if (ctx) await ctx.reply(message);

  return { checked: pendingOrders.length, confirmed, message };
}

function startAutoPaymentChecker() {
  if (!AUTO_CONFIRM_ENABLED) return;
  if (!PAYMENT_CHECK_INTERVAL_MS || PAYMENT_CHECK_INTERVAL_MS < 10000) return;

  setInterval(async () => {
    try {
      await autoConfirmPendingOrders();
    } catch (error) {
      console.error("Auto payment checker error:", error.message);
      await notifyAdminGroup(`⚠️ Auto payment checker error:\n${error.message}`);
    }
  }, PAYMENT_CHECK_INTERVAL_MS);
}

async function payCheckCommand(ctx) {
  if (!(await requireAdminControlChat(ctx))) return;

  try {
    await ctx.reply("Checking pending payments from UEEx API...");
    await autoConfirmPendingOrders(ctx);
  } catch (error) {
    console.error("Manual payment check error:", error);
    await ctx.reply(`Payment check failed: ${error.message}`);
  }
}


function truncateForTelegram(value, maxLength = 900) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (!text) return "";
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;
}

function buildRawDebugTimeRange(pendingOrders) {
  const now = new Date();

  if (pendingOrders && pendingOrders.length) {
    const earliestCreatedAt = pendingOrders[0].created_at;
    return {
      startAt: new Date(new Date(earliestCreatedAt).getTime() - 60 * 60 * 1000),
      endAt: now,
      mode: "pending_orders"
    };
  }

  return {
    startAt: new Date(now.getTime() - UEEX_RAW_DEBUG_DAYS * 24 * 60 * 60 * 1000),
    endAt: now,
    mode: `${UEEX_RAW_DEBUG_DAYS}_days`
  };
}

async function fetchUeexPaymentRawRecords({ startAt, endAt, paymentType, includeItemId = true, limit = 20, page = 1 }) {
  if (!UEEX_API_BASE_URL || !UEEX_API_KEY || !UEEX_API_SECRET) {
    throw new Error("UEEx API is not configured. Please set UEEX_API_BASE_URL, UEEX_API_KEY, and UEEX_API_SECRET.");
  }

  const extraParams = {
    type: paymentType,
    page,
    limit,
    start_time: apiTimeSeconds(startAt),
    end_time: apiTimeSeconds(endAt)
  };

  if (includeItemId) {
    extraParams.item_id = UEEX_PAYMENT_ITEM_ID;
  }

  const params = buildUeexApiParams(extraParams);
  const formData = new FormData();
  for (const [key, value] of Object.entries(params)) {
    formData.append(key, String(value));
  }

  const response = await fetch(buildUeexUrl(UEEX_API_DEPOSIT_LIST_PATH), {
    method: "POST",
    body: formData
  });

  const responseText = await response.text();
  let json;

  try {
    json = JSON.parse(responseText);
  } catch (error) {
    json = null;
  }

  const records = json ? getNestedArray(json) || [] : [];

  return {
    ok: response.ok,
    httpStatus: response.status,
    json,
    responseText,
    records,
    normalizedRecords: records.map(normalizeApiRecord),
    safeRequest: {
      path: UEEX_API_DEPOSIT_LIST_PATH,
      type: paymentType,
      item_id: includeItemId ? UEEX_PAYMENT_ITEM_ID : "omitted",
      page,
      limit,
      start_time: extraParams.start_time,
      end_time: extraParams.end_time
    }
  };
}


async function payCheckSignDebugCommand(ctx) {
  if (!(await requireAdminControlChat(ctx))) return;

  try {
    if (!UEEX_API_BASE_URL || !UEEX_API_KEY || !UEEX_API_SECRET) {
      return ctx.reply("UEEx API is not configured. Please set UEEX_API_BASE_URL, UEEX_API_KEY, and UEEX_API_SECRET.");
    }

    const pendingOrders = await loadPendingOrdersForAutoConfirm();
    const { startAt, endAt, mode } = buildRawDebugTimeRange(pendingOrders);

    const extraParams = {
      item_id: UEEX_PAYMENT_ITEM_ID,
      type: UEEX_PAYMENT_TYPE,
      page: 1,
      limit: 5,
      start_time: apiTimeSeconds(startAt),
      end_time: apiTimeSeconds(endAt)
    };

    const nonce = getUeexNonce();
    const timestamp = getUeexTimestamp();
    const baseParams = getNonEmptyParams({
      api_key: UEEX_API_KEY,
      nonce,
      timestamp,
      token: UEEX_API_TOKEN,
      ...extraParams
    });

    const signDebug = createUeexSignDebug(baseParams);
    const signedParams = {
      ...baseParams,
      sign: signDebug.sign
    };

    const formData = new FormData();
    for (const [key, value] of Object.entries(signedParams)) {
      formData.append(key, String(value));
    }

    const url = buildUeexUrl(UEEX_API_DEPOSIT_LIST_PATH);
    const response = await fetch(url, {
      method: "POST",
      body: formData
    });

    const responseText = await response.text();
    let json = null;

    try {
      json = JSON.parse(responseText);
    } catch (error) {
      json = null;
    }

    const records = json ? getNestedArray(json) || [] : [];
    const apiStatus = json ? json.status ?? json.code ?? json.status_code ?? json.statusCode ?? "n/a" : "non-json";
    const apiMessage = json ? json.msg || json.message || json.error || "empty" : truncateForTelegram(responseText, 120);

    const safeParams = Object.fromEntries(
      Object.entries(signedParams).map(([key, value]) => {
        const lower = key.toLowerCase();
        if (["api_key", "token", "api_token", "access_token"].includes(lower)) {
          return [key, maskSensitiveValue(value)];
        }
        if (lower === "sign") {
          const signText = String(value || "");
          return [key, `${signText.slice(0, 8)}***${signText.slice(-6)}`];
        }
        return [key, String(value)];
      })
    );

    const lines = [
      "🧪 Payment Sign Debug",
      "",
      `API URL: ${url}`,
      `API path: ${UEEX_API_DEPOSIT_LIST_PATH}`,
      `HTTP: ${response.status}`,
      `API status/code: ${apiStatus}`,
      `API message: ${apiMessage}`,
      `Records: ${records.length}`,
      "",
      `Range mode: ${mode}`,
      `Start: ${startAt.toISOString()}`,
      `End: ${endAt.toISOString()}`,
      `Payment type: ${UEEX_PAYMENT_TYPE}`,
      `Item ID: ${UEEX_PAYMENT_ITEM_ID}`,
      `Receiver UID: ${UEEX_RECEIVER_UID}`,
      "",
      `Sign mode: ${UEEX_SIGN_MODE}`,
      `Sign case: ${UEEX_SIGN_CASE}`,
      `Secret param: ${UEEX_SIGN_SECRET_PARAM}`,
      `Timestamp: ${timestamp}`,
      `Timestamp length: ${timestamp.length}`,
      `Timestamp unit: ${UEEX_TIMESTAMP_UNIT}`,
      `Nonce: ${nonce}`,
      `Nonce mode: ${UEEX_NONCE_MODE}`,
      `Nonce length: ${nonce.length}`,
      `API key: ${maskSensitiveValue(UEEX_API_KEY)}`,
      `Token configured: ${UEEX_API_TOKEN ? "yes" : "no"}`,
      `Secret configured: ${UEEX_API_SECRET ? "yes" : "no"}`,
      "",
      `Sorted sign keys: ${signDebug.entries.map(([key]) => key).join(", ")}`,
      `Request params: ${truncateForTelegram(safeParams, 900)}`,
      `String to sign (masked): ${truncateForTelegram(signDebug.rawMasked, 1200)}`,
      `Generated sign: ${signDebug.sign.slice(0, 8)}***${signDebug.sign.slice(-6)}`,
      "",
      `Top-level keys: ${json ? Object.keys(json).slice(0, 25).join(", ") : "non-json"}`,
      `Raw preview: ${truncateForTelegram(json || responseText, 700)}`
    ];

    const output = lines.join("\n");
    for (let i = 0; i < output.length; i += 3500) {
      await ctx.reply(output.slice(i, i + 3500));
    }
  } catch (error) {
    console.error("Payment sign debug error:", error);
    await ctx.reply(`Payment sign debug failed: ${error.message}`);
  }
}


function formatRawDebugValue(value) {
  if (value === undefined || value === null || value === "") return "empty";
  if (typeof value === "object") return truncateForTelegram(value, 180);
  return String(value);
}

function buildRawFieldDebugLines(record) {
  const fields = [
    "user_id",
    "client_user_id",
    "from_uid",
    "to_uid",
    "counterparty_uid",
    "opposite_uid",
    "payer_uid",
    "from_user_id",
    "to_user_id",
    "from_address",
    "to_address",
    "address",
    "chain_tag",
    "remark",
    "num",
    "amount",
    "status",
    "item_id",
    "type",
    "exchange_type",
    "exchange_id",
    "txid",
    "create_time"
  ];

  const lines = ["First raw record key fields (no normalize):"];

  for (const field of fields) {
    lines.push(`• raw.${field}: ${formatRawDebugValue(record?.[field])}`);
  }

  return lines;
}


async function payCheckRawCommand(ctx) {
  if (!(await requireAdminControlChat(ctx))) return;

  try {
    const pendingOrders = await loadPendingOrdersForAutoConfirm();
    const { startAt, endAt, mode } = buildRawDebugTimeRange(pendingOrders);

    const scenarios = [
      { label: `type=${UEEX_PAYMENT_TYPE}, item_id=${UEEX_PAYMENT_ITEM_ID}`, paymentType: UEEX_PAYMENT_TYPE, includeItemId: true },
      { label: `type=${UEEX_PAYMENT_TYPE}, no item_id`, paymentType: UEEX_PAYMENT_TYPE, includeItemId: false },
      { label: `type=${UEEX_PAYMENT_TYPE === 1 ? 2 : 1}, item_id=${UEEX_PAYMENT_ITEM_ID}`, paymentType: UEEX_PAYMENT_TYPE === 1 ? 2 : 1, includeItemId: true },
      { label: `type=${UEEX_PAYMENT_TYPE === 1 ? 2 : 1}, no item_id`, paymentType: UEEX_PAYMENT_TYPE === 1 ? 2 : 1, includeItemId: false }
    ];

    const lines = [
      "🧪 Payment Raw Debug",
      "",
      `Range mode: ${mode}`,
      `Start: ${startAt.toISOString()}`,
      `End: ${endAt.toISOString()}`,
      `API path: ${UEEX_API_DEPOSIT_LIST_PATH}`,
      `Receiver UID: ${UEEX_RECEIVER_UID}`,
      `Pending orders: ${pendingOrders.length}`
    ];

    for (const scenario of scenarios) {
      const raw = await fetchUeexPaymentRawRecords({
        startAt,
        endAt,
        paymentType: scenario.paymentType,
        includeItemId: scenario.includeItemId,
        limit: 20,
        page: 1
      });

      const code = raw.json ? raw.json.code ?? raw.json.status_code ?? raw.json.statusCode ?? "n/a" : "non-json";
      const message = raw.json ? raw.json.msg || raw.json.message || raw.json.error || "" : truncateForTelegram(raw.responseText, 120);

      lines.push(
        "",
        `Scenario: ${scenario.label}`,
        `HTTP: ${raw.httpStatus}`,
        `API code: ${code}`,
        `API message: ${message || "empty"}`,
        `Records: ${raw.records.length}`
      );

      if (raw.normalizedRecords[0]) {
        const first = raw.normalizedRecords[0];
        lines.push(
          "First normalized record:",
          `• remark: ${first.remark || "empty"}`,
          `• amount: ${first.amount || "empty"}`,
          `• status: ${first.status || "empty"}`,
          `• item_id: ${first.itemId || "empty"}`,
          `• exchange_type: ${first.exchangeType || "empty"}`,
          `• account_uid: ${first.accountUid || "empty"}`,
          `• counterparty_uid: ${first.counterpartyUid || "empty"}`,
          `• from_uid: ${first.fromUid || "empty"}`,
          `• to_uid: ${first.toUid || "empty"}`,
          `Raw keys: ${Object.keys(first.raw || {}).slice(0, 25).join(", ") || "none"}`
        );

        lines.push(...buildRawFieldDebugLines(first.raw || {}));
      } else if (raw.json) {
        lines.push(`Top-level keys: ${Object.keys(raw.json || {}).slice(0, 25).join(", ") || "none"}`);
        lines.push(`Raw preview: ${truncateForTelegram(raw.json, 500)}`);
      }
    }

    const output = lines.join("\n");
    const chunks = [];
    for (let i = 0; i < output.length; i += 3500) {
      chunks.push(output.slice(i, i + 3500));
    }

    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }
  } catch (error) {
    console.error("Payment raw debug error:", error);
    await ctx.reply(`Payment raw debug failed: ${error.message}`);
  }
}

async function payCheckDebugCommand(ctx) {
  if (!(await requireAdminControlChat(ctx))) return;

  try {
    const pendingOrders = await loadPendingOrdersForAutoConfirm();
    if (!pendingOrders.length) {
      return ctx.reply("No pending orders to debug.");
    }

    const earliestCreatedAt = pendingOrders[0].created_at;
    const startAt = new Date(new Date(earliestCreatedAt).getTime() - 60 * 60 * 1000);
    const records = await fetchUeexPaymentRecords(startAt, new Date());
    const first = records[0] || null;

    const lines = [
      "🧪 Payment Check Debug",
      "",
      `Pending orders: ${pendingOrders.length}`,
      `Records fetched: ${records.length}`,
      `Payment type: ${UEEX_PAYMENT_TYPE}`,
      `Payment match mode: ${PAYMENT_MATCH_MODE}`,
      `UID+amount allows non-order remark: ${UID_AMOUNT_MATCH_ALLOW_REMARK ? "yes" : "no"}`,
      `UID match mode: ${UEEX_UID_MATCH_MODE}`,
      `Item ID: ${UEEX_PAYMENT_ITEM_ID}`,
      `Receiver UID: ${UEEX_RECEIVER_UID}`,
      `API path: ${UEEX_API_DEPOSIT_LIST_PATH}`,
      "",
      "Latest pending orders:",
      ...pendingOrders.slice(0, 5).map((order) => `• ${order.order_code} | UID ${order.ueex_uid} | ${formatAmount(order.expected_amount)} ${order.currency || DEFAULT_CURRENCY} | ${order.status}`)
    ];

    if (first) {
      lines.push(
        "",
        "First normalized API record:",
        `• remark: ${first.remark || "empty"}`,
        `• amount: ${first.amount || "empty"}`,
        `• status: ${first.status || "empty"}`,
        `• item_id: ${first.itemId || "empty"}`,
        `• exchange_type: ${first.exchangeType || "empty"}`,
        `• from_uid: ${first.fromUid || "empty"}`,
        `• to_uid: ${first.toUid || "empty"}`,
        `• account_uid: ${first.accountUid || "empty"}`,
        `• counterparty_uid: ${first.counterpartyUid || "empty"}`,
        `• exchange_id: ${first.exchangeId || "empty"}`,
        "",
        `Raw keys: ${Object.keys(first.raw || {}).slice(0, 30).join(", ")}`
      );
    } else {
      lines.push("", "No records returned by the API for the queried time range.");
    }

    return ctx.reply(lines.join("\n"));
  } catch (error) {
    console.error("Payment debug error:", error);
    return ctx.reply(`Payment debug failed: ${error.message}`);
  }
}

async function autoVoidExpiredPendingOrders(matchInput) {
  const match = typeof matchInput === "string" ? await getMatch(matchInput) : matchInput;

  if (!match || new Date(match.betting_end_at).getTime() > Date.now()) {
    return 0;
  }

  const { data: orders, error } = await supabase
    .from("wc_orders")
    .select("*")
    .eq("match_code", match.match_code)
    .eq("status", "pending");

  if (error) {
    console.error("Auto-void load pending orders error:", error.message);
    return 0;
  }

  if (!orders || orders.length === 0) return 0;

  const orderCodes = orders.map((order) => order.order_code);
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("wc_orders")
    .update({
      status: "voided",
      voided_at: now,
      auto_confirm_error: "Auto-voided after voting time ended",
      updated_at: now
    })
    .in("order_code", orderCodes);

  if (updateError) {
    console.error("Auto-void pending orders error:", updateError.message);
    return 0;
  }

  for (const order of orders) {
    if (order.pending_chat_id && order.pending_message_id) {
      try {
        await bot.telegram.deleteMessage(order.pending_chat_id, order.pending_message_id);
      } catch (error) {
        // Ignore delete failures.
      }
    }

    try {
      await sendOptionalPhoto(
        order.telegram_id,
        getLocalizedImageUrl(order.telegram_id, LOSER_IMAGE_URL, LOSER_IMAGE_URL_ZH),
        `⚽️ Match: ${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}
🔸 Match ID: ${match.match_code}
🔸 Order ID: ${order.order_code}
🔸 Amount: ${formatAmount(order.expected_amount)} ${match.currency}

This pending order was automatically voided because voting time ended before payment confirmation.`
      );
    } catch (error) {
      console.error(`Failed to notify auto-voided order ${order.order_code}:`, error.message);
    }
  }

  await notifyAdminGroup(`⏰ Auto-voided ${orders.length} pending order(s) after voting time ended.

Match: ${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}
Match ID: ${match.match_code}
Orders: ${orderCodes.join(", ")}`);

  return orders.length;
}

async function updateAllLiveOpenMatches() {
  try {
    const { data, error } = await supabase
      .from("wc_matches")
      .select("match_code")
      .eq("status", "open")
      .not("live_message_id", "is", null)
      .limit(50);

    if (error) {
      console.error("Load live matches error:", error.message);
      return;
    }

    for (const match of data || []) {
      await updateLiveMatchMessage(match.match_code);
    }
  } catch (error) {
    console.error("Live match updater error:", error.message);
  }
}

function startLiveMatchUpdater() {
  if (!LIVE_UPDATE_INTERVAL_MS || LIVE_UPDATE_INTERVAL_MS < 5000) return;

  setInterval(updateAllLiveOpenMatches, LIVE_UPDATE_INTERVAL_MS);
}

async function createMatch(ctx, text) {
  if (!(await requireAdminControlChat(ctx))) return;

  if (!PUBLIC_GROUP_CHAT_ID) {
    return ctx.reply("PUBLIC_GROUP_CHAT_ID is not configured. Please add the public group chat ID in Render Environment.");
  }

  if (!BOT_USERNAME) {
    return ctx.reply("BOT_USERNAME is not configured. Please add the bot username in Render Environment.");
  }

  const cleaned = cleanCommandText(text);
  const match = cleaned.match(/^\/worldcup_([A-Za-z0-9]+)_([A-Za-z0-9]+)_([0-9]+:[0-9]+)_([0-9]+:[0-9]+)_([A-Za-z0-9]+)_([0-9]{4}\.[0-9]{2}\.[0-9]{2})_([0-9]{1,2}:[0-9]{2})_(UTC[+-]\d{1,2})_([A-Za-z0-9-]+)$/i);

  if (!match) {
    return ctx.reply(
      "Invalid format.\nExample:\n/worldcup_NED_JPN_0:0_5:5_Others_2026.06.15_00:00_UTC+4_Group-F\n\nFormat:\n/worldcup_Team1_Team2_MinScore_MaxScore_Others_Date_Time_Timezone_Stage\n\nVoting automatically closes 15 minutes before match time."
    );
  }

  const teamA = normalizeTeam(match[1]);
  const teamB = normalizeTeam(match[2]);
  const startScore = match[3] || "0:0";
  const endScore = match[4] || "5:5";
  const lastOption = match[5] || "Others";
  const matchDate = match[6];
  const matchTime = match[7];
  const matchTimezone = match[8].toUpperCase();
  const matchStage = match[9];
  const selectionOptions = generateScoreOptions(startScore, endScore, lastOption);

  if (!teamA || !teamB || teamA === teamB) {
    return ctx.reply("Invalid teams. Example: /worldcup_NED_JPN_0:0_5:5_Others_2026.06.15_00:00_UTC+4_Group-F");
  }

  const matchStartAt = parseMatchStartAtUtc(matchDate, matchTime, matchTimezone);

  if (!matchStartAt || Number.isNaN(matchStartAt.getTime())) {
    return ctx.reply("Invalid match date, time, or timezone. Example: 2026.06.15_00:00_UTC+4");
  }

  if (!selectionOptions || selectionOptions.length < 2) {
    return ctx.reply("Invalid score range. Example: 0:0_5:5_Others");
  }

  const matchCode = await generateUniqueCode("WC", "wc_matches", "match_code");
  const now = new Date();
  const votingEndAt = new Date(matchStartAt.getTime() - 15 * 60 * 1000);

  if (votingEndAt.getTime() <= now.getTime()) {
    return ctx.reply("Invalid match time. Voting closes 15 minutes before the match, so the voting close time must be in the future.");
  }

  const payload = {
    match_code: matchCode,
    chat_id: Number(PUBLIC_GROUP_CHAT_ID),
    team_a: teamA,
    team_b: teamB,
    currency: DEFAULT_CURRENCY,
    receiver_uid: RECEIVER_UID,
    fee_bps: PLATFORM_FEE_BPS,
    selection_options: selectionOptions,
    match_date: matchDate,
    match_time: matchTime,
    match_timezone: matchTimezone,
    match_stage: matchStage,
    status: "open",
    betting_start_at: now.toISOString(),
    betting_end_at: votingEndAt.toISOString(),
    created_by: ctx.from.id,
    updated_at: now.toISOString()
  };

  const { data, error } = await supabase
    .from("wc_matches")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("Create match error:", error);
    return ctx.reply(`Failed to create match: ${error.message}`);
  }

  const totals = await getMatchTotals(data.match_code, data);
  const topicOptions = PUBLIC_WORLD_CUP_TOPIC_ID
    ? { message_thread_id: Number(PUBLIC_WORLD_CUP_TOPIC_ID) }
    : {};

  let liveMessage;
  try {
    liveMessage = await sendOptionalPhoto(
      PUBLIC_GROUP_CHAT_ID,
      WORLDCUP_IMAGE_URL,
      buildPublicMatchMessage(data, totals),
      buildGroupMatchKeyboard(data),
      topicOptions
    );
  } catch (sendError) {
    console.error("Send public match card error:", sendError);
    await supabase.from("wc_matches").delete().eq("match_code", data.match_code);
    return ctx.reply(`Failed to send match card to public group/topic: ${sendError.message}`);
  }

  await supabase
    .from("wc_matches")
    .update({
      live_chat_id: Number(PUBLIC_GROUP_CHAT_ID),
      live_message_id: liveMessage.message_id,
      updated_at: new Date().toISOString()
    })
    .eq("match_code", data.match_code);

  return ctx.reply(`✅ Match created and posted to the World Cup topic.

Match ID: ${data.match_code}
Match: ${formatTeamWithFlag(teamA)} vs ${formatTeamWithFlag(teamB)}
Match Time: ${matchDate} ${matchTime} ${matchTimezone}
Stage: ${matchStage}
Voting closes: 15 minutes before match time
Voting Time Left: ${formatTimeLeft(data.betting_end_at)}`);
}

async function showWorldCupEntry(ctx) {
  return showOpenMatches(ctx);
}

async function showOpenMatches(ctx) {
  if (isPrivateChat(ctx)) {
    if (!hasSelectedLanguage(ctx)) {
      return showLanguageSelection(ctx);
    }

    if (!hasAcceptedRules(ctx)) {
      return showStartRules(ctx);
    }

    return showMatchDateSelection(ctx);
  }

  const message = "Please use the World Cup topic and tap Vote Now to join the prediction in private chat.";
  const sent = await ctx.reply(message);

  if (ctx.chat?.id && ctx.message?.message_id) {
    scheduleDeleteMessage(ctx.chat.id, ctx.message.message_id, 10000);
  }

  if (ctx.chat?.id && sent?.message_id) {
    scheduleDeleteMessage(ctx.chat.id, sent.message_id, 10000);
  }

  return sent;
}

async function showMatchDateSelection(ctx, edit = false) {
  if (!edit && isPrivateChat(ctx)) {
    await deleteLastPrivateMenuMessage(ctx, "matches");
  }

  const matches = sortMatchesBySchedule((await getAllOpenMatches()).filter(isVotingOpen));

  if (!matches.length) {
    const message = isZh(ctx) ? "当前暂无开放中的世界杯预测比赛。" : "No open World Cup prediction matches are available now.";
    if (edit) return editCallbackMessage(ctx, message, null);
    const sent = await ctx.reply(message, getPrivateMainMenu(ctx));
    return rememberPrivateMenuMessage(ctx, sent, "matches");
  }

  const seen = new Set();
  const rows = [];

  for (const match of matches) {
    const dateKey = getMatchDateKey(match);
    if (seen.has(dateKey)) continue;
    seen.add(dateKey);

    const count = matches.filter((item) => getMatchDateKey(item) === dateKey).length;
    rows.push([
      Markup.button.callback(
        `${getMatchDayLabel(dateKey)} • ${count} ${isZh(ctx) ? "场比赛" : `match${count > 1 ? "es" : ""}`}`,
        `wcdate:${encodeDateKey(dateKey)}`
      )
    ]);
  }

  const text = isZh(ctx)
    ? `🏆 即将开始的比赛

请选择比赛日期：`
    : `🏆 Upcoming Matches

Please select a match day:`;
  const keyboard = Markup.inlineKeyboard(rows);

  if (edit) {
    return editCallbackMessage(ctx, text, keyboard);
  }

  const sent = await replyWithOptionalPhoto(ctx, getLocalizedImageUrl(ctx, WORLDCUP_IMAGE_URL, WORLDCUP_IMAGE_URL_ZH), text, keyboard);
  return rememberPrivateMenuMessage(ctx, sent, "matches");
}


async function showMatchesForDate(ctx, dateKey, edit = false) {
  const matches = sortMatchesBySchedule(
    (await getAllOpenMatches()).filter((match) => isVotingOpen(match) && getMatchDateKey(match) === dateKey)
  );

  if (!matches.length) {
    const message = isZh(ctx) ? "该日期暂无开放中的比赛。" : "No open matches are available for this date.";
    const backKeyboard = Markup.inlineKeyboard([[Markup.button.callback(isZh(ctx) ? "返回" : "Back", "wcdates")]]);
    if (edit) return editCallbackMessage(ctx, message, backKeyboard);
    return ctx.reply(message, backKeyboard);
  }

  const rows = matches.map((match) => [
    Markup.button.callback(getMatchListButtonLabel(match), `wcmatch:${match.match_code}`)
  ]);
  rows.push([Markup.button.callback(isZh(ctx) ? "返回" : "Back", "wcdates")]);

  const text = `${getMatchDayLabel(dateKey)}`;
  const keyboard = Markup.inlineKeyboard(rows);

  if (edit) {
    return editCallbackMessage(ctx, text, keyboard);
  }

  return replyWithOptionalPhoto(ctx, getLocalizedImageUrl(ctx, WORLDCUP_IMAGE_URL, WORLDCUP_IMAGE_URL_ZH), text, keyboard);
}

async function startPrivateBet(ctx, matchCode) {
  if (!isPrivateChat(ctx)) {
    return ctx.reply("Please open private chat with the bot to vote.");
  }

  const match = await getMatch(matchCode);

  if (!match) {
    return ctx.reply("Match not found.");
  }

  if (!isVotingOpen(match)) {
    return ctx.reply(isZh(ctx) ? "该比赛已停止投票。" : "Voting for this match is already closed.");
  }

  const user = await getUserByTelegramId(ctx.from.id);

  if (!user) {
    await deleteStoredPrompt(ctx);

    const prompt = await ctx.reply(isZh(ctx) ? "请输入你的 UEEx UID。" : "Please enter your UEEx UID.", {
      reply_markup: {
        force_reply: true,
        selective: true
      }
    });

    setSession(ctx, {
      step: "awaiting_uid",
      nextMatchCode: matchCode,
      promptMessageId: prompt.message_id
    });

    return;
  }

  return showSelectedMatch(ctx, matchCode);
}

async function showSelectedMatch(ctx, matchCode, edit = false) {
  const match = await getMatch(matchCode);

  if (!match) {
    return ctx.answerCbQuery ? ctx.answerCbQuery("Match not found.") : ctx.reply("Match not found.");
  }

  const totals = await getMatchTotals(matchCode, match);
  const message = buildMatchMessage(match, totals, ctx);
  const keyboard = buildOutcomeKeyboard(match, totals, ctx);

  if (edit) {
    return editCallbackMessage(ctx, message, keyboard);
  }

  return replyWithOptionalPhoto(ctx, getLocalizedImageUrl(ctx, WORLDCUP_IMAGE_URL, WORLDCUP_IMAGE_URL_ZH), message, keyboard);
}

async function showOutcomeScores(ctx, matchCode, outcome, edit = false) {
  const match = await getMatch(matchCode);

  if (!match) {
    return ctx.answerCbQuery ? ctx.answerCbQuery("Match not found.") : ctx.reply("Match not found.");
  }

  const totals = await getMatchTotals(matchCode, match);
  const message = buildScoreMessage(match, totals, outcome, ctx);
  const keyboard = buildScoreKeyboard(match, outcome, ctx);

  if (edit) {
    return editCallbackMessage(ctx, message, keyboard);
  }

  return replyWithOptionalPhoto(ctx, getLocalizedImageUrl(ctx, WORLDCUP_IMAGE_URL, WORLDCUP_IMAGE_URL_ZH), message, keyboard);
}

async function getSelectionPool(matchCode, selection) {
  const { data, error } = await supabase
    .from("wc_orders")
    .select("confirmed_amount")
    .eq("match_code", matchCode)
    .eq("selection", selection)
    .eq("status", "confirmed");

  if (error) {
    throw new Error(`Failed to load selection pool: ${error.message}`);
  }

  return (data || []).reduce((sum, order) => {
    return sum.plus(order.confirmed_amount || 0);
  }, new Decimal(0));
}

function buildAmountPrompt(match, selection, pool, prefix = "", ctxOrLang = null) {
  const intro = prefix ? `${prefix}

` : "";
  const minBetAmount = getStageMinimumBetAmount(match);

  if (isZh(ctxOrLang)) {
    return `${intro}🔸 选择: ${formatSelectionWithFlags(match, selection, ctxOrLang)}
🔸 奖池: ${formatAmount(pool)} ${match.currency}

请输入你的 UE 投票金额。最低: ${formatAmount(minBetAmount)} ${match.currency}`;
  }

  return `${intro}🔸 Selection: ${formatSelectionWithFlags(match, selection, ctxOrLang)}
🔸 Pool: ${formatAmount(pool)} ${match.currency}

Please enter your UE voting amount. Minimum: ${formatAmount(minBetAmount)} ${match.currency}`;
}
async function handleAmountInput(ctx, text, session) {
  const amount = parsePositiveAmount(text);

  if (!amount) {
    return ctx.reply(isZh(ctx) ? "金额格式错误。请输入有效的 UE 金额，例如：1,000 或 1,150.5" : "Invalid amount. Please enter a positive UE amount, for example: 1,000 or 1,150.5", getPrivateMainMenu(ctx));
  }

  const match = await getMatch(session.matchCode);

  if (!match) {
    clearSession(ctx);
    return ctx.reply(isZh(ctx) ? "未找到比赛，请重新开始。" : "Match not found. Please start again with /worldcup.");
  }

  if (!isVotingOpen(match)) {
    clearSession(ctx);
    return ctx.reply(isZh(ctx) ? "该比赛已停止投票。" : "Voting for this match is already closed.");
  }

  const minBetAmount = getStageMinimumBetAmount(match);
  if (amount.lt(minBetAmount)) {
    return ctx.reply(isZh(ctx) ? `最低投票金额为 ${formatAmount(minBetAmount)} UE。` : `Minimum voting amount is ${formatAmount(minBetAmount)} UE.`, getPrivateMainMenu(ctx));
  }

  const userRecord = await getUserByTelegramId(ctx.from.id);

  if (!userRecord) {
    clearSession(ctx);
    return ctx.reply(isZh(ctx) ? "请先绑定你的 UEEx UID。" : "Please bind your UEEx UID first with /worldcup.");
  }

  const orderCode = await generateUniqueCode("O", "wc_orders", "order_code");

  const orderPayload = {
    order_code: orderCode,
    match_code: match.match_code,
    telegram_id: ctx.from.id,
    ueex_uid: userRecord.ueex_uid,
    username: ctx.from.username || null,
    first_name: ctx.from.first_name || null,
    last_name: ctx.from.last_name || null,
    selection: session.selection,
    expected_amount: amount.toString(),
    confirmed_amount: 0,
    currency: match.currency,
    status: "pending",
    payment_remark: orderCode,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("wc_orders")
    .insert(orderPayload)
    .select("*")
    .single();

  if (error) {
    console.error("Create order error:", error);
    return ctx.reply(`Failed to create pending order: ${error.message}`);
  }

  await deleteStoredPrompt(ctx);
  clearSession(ctx);

  const pendingMessageText = isZh(ctx)
    ? `⚽️ 比赛：${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}

🔸 比赛 ID：${match.match_code}
🔸 订单 ID：<code>${escapeHtml(data.order_code)}</code>
🔸 UID：<code>${escapeHtml(data.ueex_uid)}</code>
🔸 TG：${escapeHtml(getTelegramUserLabel(data))}
🔸 选择：${escapeHtml(formatSelectionWithFlags(match, data.selection, ctx))}
🔸 金额：${formatAmount(amount)} ${match.currency}

❗️请转账 ${formatAmount(amount)} ${match.currency} 到以下 BSC 地址：
<code>${escapeHtml(TRANSFER_ADDRESS)}</code>
✅ 系统将主要根据你的绑定 UID + 转账金额自动确认订单。
🧾 转账备注可留空；如填写，建议填写订单 ID：<code>${escapeHtml(data.order_code)}</code>，便于人工核对。
⚠️ 请不要填写其他无关备注，避免影响人工核对。
⚠️ 如少转，请继续补足剩余金额；累计到账达到订单金额后才可确认。
⚠️ 如多转，系统仅按订单金额计入奖池，超出部分由 Admin 人工核对处理。
❗️你的投票将在付款确认后计入。`
    : `⚽️ Match: ${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}

🔸 Match ID: ${match.match_code}
🔸 Order ID: <code>${escapeHtml(data.order_code)}</code>
🔸 UID: <code>${escapeHtml(data.ueex_uid)}</code>
🔸 TG: ${escapeHtml(getTelegramUserLabel(data))}
🔸 Selection: ${escapeHtml(formatSelectionWithFlags(match, data.selection))}
🔸 Amount: ${formatAmount(amount)} ${match.currency}

❗️Please transfer ${formatAmount(amount)} ${match.currency} to the BSC address below:
<code>${escapeHtml(TRANSFER_ADDRESS)}</code>.
✅ The system confirms mainly by your bound UID + transfer amount.
🧾 Transfer remark is optional. If you enter one, we recommend using the Order ID: <code>${escapeHtml(data.order_code)}</code> for manual review.
⚠️ Please avoid unrelated remarks to make manual review easier.
⚠️ If you underpay, please top up the remaining amount. The order can be confirmed only after the total received amount reaches the order amount.
⚠️ If you overpay, only the order amount is counted into the prize pool. The excess amount will be manually reviewed by Admin.
❗️Your vote will be counted after payment confirmation.`;

  const pendingMessage = await replyWithOptionalPhoto(
    ctx,
    getLocalizedImageUrl(ctx, PENDING_ORDER_IMAGE_URL, PENDING_ORDER_IMAGE_URL_ZH),
    pendingMessageText,
    getPendingOrderKeyboard(data.order_code, ctx),
    { parse_mode: "HTML" }
  );

  await supabase
    .from("wc_orders")
    .update({
      pending_chat_id: ctx.chat.id,
      pending_message_id: pendingMessage.message_id,
      updated_at: new Date().toISOString()
    })
    .eq("order_code", data.order_code);

  await notifyAdminGroup(`🕐 New Pending Order

⚽️ Match: ${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}

🔸 Order ID: ${data.order_code}
🔸 UID: ${data.ueex_uid}
🔸 TG: ${getTelegramUserLabel(data)}
🔸 Selection: ${formatSelectionWithFlags(match, data.selection)}
🔸 Amount: ${formatAmount(amount)} ${match.currency}
🔸 Remark: optional; Order ID can be used for manual review

Confirm step 1:
/confirm_${data.order_code}_${formatAmountForCommand(amount)}

Then reply with recharge order number / exchange_id

Void:
/void_${data.order_code}`);

  return pendingMessage;
}

async function cancelPendingOrder(ctx, orderCode) {
  const normalizedOrderCode = String(orderCode || "").toUpperCase();

  const { data: order, error: orderError } = await supabase
    .from("wc_orders")
    .select("*")
    .eq("order_code", normalizedOrderCode)
    .maybeSingle();

  if (orderError || !order) {
    return ctx.answerCbQuery("Order not found.", { show_alert: true });
  }

  if (Number(order.telegram_id) !== Number(ctx.from.id)) {
    return ctx.answerCbQuery("You can only cancel your own order.", { show_alert: true });
  }

  if (order.status !== "pending") {
    return ctx.answerCbQuery(`This order is already ${order.status}.`, { show_alert: true });
  }

  const { error } = await supabase
    .from("wc_orders")
    .update({
      status: "voided",
      voided_by: ctx.from.id,
      voided_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("order_code", normalizedOrderCode);

  if (error) {
    return ctx.answerCbQuery(`Failed to cancel order: ${error.message}`, { show_alert: true });
  }

  await ctx.answerCbQuery("Order cancelled.");

  const match = await getMatch(order.match_code);
  const message = isZh(ctx)
    ? `❌ 订单已取消

⚽️ 比赛: ${match ? `${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}` : order.match_code}

🔸 订单 ID: ${order.order_code}
🔸 UID: ${order.ueex_uid}
🔸 TG: ${getTelegramUserLabel(order)}
🔸 选择: ${match ? formatSelectionWithFlags(match, order.selection, ctx) : order.selection}
🔸 金额: ${formatAmount(order.expected_amount)} ${order.currency}`
    : `❌ Order Cancelled

⚽️ Match: ${match ? `${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}` : order.match_code}

🔸 Order ID: ${order.order_code}
🔸 UID: ${order.ueex_uid}
🔸 TG: ${getTelegramUserLabel(order)}
🔸 Selection: ${match ? formatSelectionWithFlags(match, order.selection) : order.selection}
🔸 Amount: ${formatAmount(order.expected_amount)} ${order.currency}`;

  await notifyAdminGroup(`❌ Pending Order Cancelled

⚽️ Match: ${match ? `${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}` : order.match_code}

🔸 Order ID: ${order.order_code}
🔸 UID: ${order.ueex_uid}
🔸 TG: ${getTelegramUserLabel(order)}
🔸 Selection: ${match ? formatSelectionWithFlags(match, order.selection) : order.selection}
🔸 Amount: ${formatAmount(order.expected_amount)} ${order.currency}`);

  try {
    await ctx.deleteMessage();
  } catch (error) {
    // Ignore delete failures.
  }

  return replyWithOptionalPhoto(ctx, getLocalizedImageUrl(ctx, ORDER_CANCELLED_IMAGE_URL, ORDER_CANCELLED_IMAGE_URL_ZH), message, getOrderCancelledKeyboard(ctx));
}

async function confirmOrderByCode(ctx, orderCode, amount, options = {}) {
  const { autoConfirmed = false, paymentRecord = null } = options;

  if (!ctx) {
    ctx = {
      from: null,
      chat: null,
      reply: async (message) => {
        console.log("Auto confirmation:", message);
        return null;
      }
    };
  }

  const { data: order, error: orderError } = await supabase
    .from("wc_orders")
    .select("*")
    .eq("order_code", orderCode)
    .maybeSingle();

  if (orderError || !order) {
    return ctx.reply("Order not found.");
  }

  if (order.status !== "pending") {
    return ctx.reply(`Order ${orderCode} is not pending. Current status: ${order.status}`);
  }

  const matchData = await getMatch(order.match_code);

  if (!matchData) {
    return ctx.reply("Related match not found.");
  }

  const updatePayload = {
    confirmed_amount: amount.toFixed(),
    status: "confirmed",
    confirmed_by: ctx.from?.id || null,
    confirmed_at: new Date().toISOString(),
    auto_confirmed: autoConfirmed,
    payment_checked_at: new Date().toISOString(),
    auto_confirm_error: null,
    updated_at: new Date().toISOString()
  };

  if (paymentRecord) {
    updatePayload.payment_exchange_id = paymentRecord.exchangeId || null;
    updatePayload.payment_txid = paymentRecord.txid || null;
    updatePayload.payment_from_uid = paymentRecord.paymentFromUid || paymentRecord.fromUid || paymentRecord.counterpartyUid || null;
    updatePayload.payment_to_uid = paymentRecord.paymentToUid || paymentRecord.toUid || paymentRecord.accountUid || null;
    updatePayload.payment_remark = paymentRecord.remark || orderCode;
  }

  const { error: updateError } = await supabase
    .from("wc_orders")
    .update(updatePayload)
    .eq("order_code", orderCode);

  if (updateError) {
    return ctx.reply(`Failed to confirm order: ${updateError.message}`);
  }

  if (order.pending_chat_id && order.pending_message_id) {
    try {
      await bot.telegram.deleteMessage(order.pending_chat_id, order.pending_message_id);
    } catch (error) {
      // Ignore delete failures.
    }
  }

  await updateLiveMatchMessage(order.match_code);

  const confirmedMessageText = isZh(order.telegram_id)
    ? `⚽️ 比赛: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}

🔸 比赛 ID: ${matchData.match_code}
🔸 订单 ID: ${orderCode}
🔸 UID: ${order.ueex_uid}
🔸 TG: ${getTelegramUserLabel(order)}
🔸 选择: ${formatSelectionWithFlags(matchData, order.selection, order.telegram_id)}
🔸 确认金额: ${formatAmount(amount)} ${matchData.currency}

📊 点击下方“比赛”可继续投票，或发送 /myvote 查看投票明细。`
    : `⚽️ Match: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}

🔸 Match ID: ${matchData.match_code}
🔸 Order ID: ${orderCode}
🔸 UID: ${order.ueex_uid}
🔸 TG: ${getTelegramUserLabel(order)}
🔸 Selection: ${formatSelectionWithFlags(matchData, order.selection)}
🔸 Confirmed Amount: ${formatAmount(amount)} ${matchData.currency}

📊 Send /myvote to view your vote details.`;

  let userNotified = true;

  try {
    await sendOptionalPhoto(order.telegram_id, getLocalizedImageUrl(order.telegram_id, ORDER_CONFIRMED_IMAGE_URL, ORDER_CONFIRMED_IMAGE_URL_ZH), confirmedMessageText, getPrivateMatchesInlineKeyboard(order.telegram_id));
  } catch (error) {
    userNotified = false;
    console.error("Failed to notify user after confirmation:", error.message);
  }

  await notifyAdminGroup(`✅ Order Confirmed

⚽️ Match: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}

🔸 Match ID: ${matchData.match_code}
🔸 Order ID: ${orderCode}
🔸 UID: ${order.ueex_uid}
🔸 TG: ${getTelegramUserLabel(order)}
🔸 Selection: ${formatSelectionWithFlags(matchData, order.selection)}
🔸 Confirmed Amount: ${formatAmount(amount)} ${matchData.currency}
🔸 User Notified: ${userNotified ? "yes" : "no"}`, ctx);

  const updatedTotals = await getMatchTotals(order.match_code, matchData);
  await notifyPublicWorldCupTopic(`✅ Order Confirmed

⚽️ ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
🔸 Match ID: ${matchData.match_code}
🔸 Selection: ${formatSelectionWithFlags(matchData, order.selection)}
🔸 Amount: ${formatAmount(amount)} ${matchData.currency}
🔸 User: ${getTelegramUserLabel(order)}

🎉Total Pool: ${formatAmount(getTotalPool(updatedTotals))} ${matchData.currency}`, ORDER_CONFIRMED_IMAGE_URL, buildPublicOrderConfirmedKeyboard());

  return ctx.reply(`✅ Order confirmed: ${orderCode}
UID: ${order.ueex_uid}
Amount: ${formatAmount(amount)} ${matchData.currency}
User notified: ${userNotified ? "yes" : "no"}`);
}

async function isManualRechargeOrderIdUsed(rechargeOrderId, currentOrderCode = "") {
  const value = String(rechargeOrderId || "").trim();

  if (!value) return false;

  const { data: usedOrder, error: orderError } = await supabase
    .from("wc_orders")
    .select("order_code")
    .eq("payment_exchange_id", value)
    .neq("order_code", String(currentOrderCode || "").toUpperCase())
    .maybeSingle();

  if (orderError) {
    console.error("Check manual recharge order id in wc_orders error:", orderError.message);
  }

  if (usedOrder?.order_code) return true;

  const { data: usedPayment, error: paymentError } = await supabase
    .from("wc_payment_records")
    .select("matched_order_code")
    .eq("exchange_id", value)
    .maybeSingle();

  if (paymentError) {
    console.error("Check manual recharge order id in wc_payment_records error:", paymentError.message);
  }

  return Boolean(usedPayment?.matched_order_code);
}

function isValidRechargeOrderId(value) {
  return /^[A-Za-z0-9_-]{3,80}$/.test(String(value || "").trim());
}

async function promptManualConfirmRechargeId(ctx, orderCode, amount) {
  const { data: order, error: orderError } = await supabase
    .from("wc_orders")
    .select("*")
    .eq("order_code", orderCode)
    .maybeSingle();

  if (orderError || !order) {
    return ctx.reply("Order not found.");
  }

  if (order.status !== "pending") {
    return ctx.reply(`Order ${orderCode} is not pending. Current status: ${order.status}`);
  }

  setSession(ctx, {
    step: "awaiting_admin_confirm_recharge_id",
    orderCode,
    amount: amount.toFixed()
  });

  return ctx.reply(
    `Step 2 required before confirmation.

Order ID: ${orderCode}
Amount: ${formatAmount(amount)} ${order.currency || DEFAULT_CURRENCY}
User UID: ${order.ueex_uid}

Please reply with the UEEx recharge order number / exchange_id for this payment.
To cancel this confirmation flow, send /cancel_confirm or reply cancel.`,
    {
      reply_markup: {
        force_reply: true,
        selective: true
      }
    }
  );
}

async function handleAdminConfirmRechargeId(ctx, session, text) {
  if (!(await requireAdminControlChat(ctx))) return;

  const rechargeOrderId = String(text || "").trim();

  if (/^(cancel|取消)$/i.test(rechargeOrderId)) {
    clearSession(ctx);
    return ctx.reply("Manual confirmation flow cancelled.");
  }

  if (!isValidRechargeOrderId(rechargeOrderId)) {
    return ctx.reply("Invalid recharge order number. Please enter 3-80 characters using letters, numbers, _ or - only. Or send /cancel_confirm / cancel.");
  }

  const alreadyUsed = await isManualRechargeOrderIdUsed(rechargeOrderId, session.orderCode);

  if (alreadyUsed) {
    return ctx.reply("This recharge order number / exchange_id has already been used. Please check and enter another one, or send /cancel_confirm / cancel.");
  }

  clearSession(ctx);

  return confirmOrderByCode(ctx, session.orderCode, new Decimal(session.amount), {
    autoConfirmed: false,
    paymentRecord: {
      exchangeId: rechargeOrderId,
      remark: session.orderCode
    }
  });
}


async function confirmOrder(ctx, text) {
  if (!(await requireAdmin(ctx))) return;

  const cleaned = cleanCommandText(text);
  const match = cleaned.match(/^\/confirm_([A-Z0-9]+)_([0-9]+(?:\.[0-9]{1,8})?)$/i);

  if (!match) {
    return ctx.reply("Invalid format.\nExample: /confirm_O000123_1150");
  }

  const orderCode = match[1].toUpperCase();
  const amount = parsePositiveAmount(match[2]);

  if (!amount) {
    return ctx.reply("Invalid amount.");
  }

  return promptManualConfirmRechargeId(ctx, orderCode, amount);
}

async function mockPayOrder(ctx, text) {
  if (!(await requireAdmin(ctx))) return;

  const cleaned = cleanCommandText(text);
  const match = cleaned.match(/^\/mockpay_([A-Z0-9]+)_([0-9]+(?:\.[0-9]{1,8})?)$/i);

  if (!match) {
    return ctx.reply("Invalid format.\nExample: /mockpay_O000123_1150");
  }

  const orderCode = match[1].toUpperCase();
  const amount = parsePositiveAmount(match[2]);

  if (!amount) {
    return ctx.reply("Invalid amount.");
  }

  return confirmOrderByCode(ctx, orderCode, amount, { autoConfirmed: true });
}

async function voidOrder(ctx, text) {
  if (!(await requireAdmin(ctx))) return;

  const cleaned = cleanCommandText(text);
  const match = cleaned.match(/^\/void_([A-Z0-9]+)$/i);

  if (!match) {
    return ctx.reply("Invalid format.\nExample: /void_O000123");
  }

  const orderCode = match[1].toUpperCase();

  const { data: order, error: orderError } = await supabase
    .from("wc_orders")
    .select("*")
    .eq("order_code", orderCode)
    .maybeSingle();

  if (orderError || !order) {
    return ctx.reply("Order not found.");
  }

  if (order.status === "voided") {
    return ctx.reply("This order is already voided.");
  }

  if (order.status !== "pending") {
    return ctx.reply(`Only pending orders can be voided. Current status: ${order.status}`);
  }

  const matchData = await getMatch(order.match_code);

  const { error } = await supabase
    .from("wc_orders")
    .update({
      status: "voided",
      voided_by: ctx.from.id,
      voided_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("order_code", orderCode);

  if (error) {
    return ctx.reply(`Failed to void order: ${error.message}`);
  }

  if (order.pending_chat_id && order.pending_message_id) {
    try {
      await bot.telegram.deleteMessage(order.pending_chat_id, order.pending_message_id);
    } catch (error) {
      // Ignore delete failures.
    }
  }

  await updateLiveMatchMessage(order.match_code);

  const userCancelText = isZh(order.telegram_id)
    ? `❌ 订单已取消

⚽️ 比赛: ${matchData ? `${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}` : order.match_code}

🔸 比赛 ID: ${order.match_code}
🔸 订单 ID: ${order.order_code}
🔸 选择: ${matchData ? formatSelectionWithFlags(matchData, order.selection) : order.selection}
🔸 金额: ${formatAmount(order.expected_amount)} ${order.currency || DEFAULT_CURRENCY}

该待支付订单已由管理员取消，不会计入投票。`
    : `❌ Order Cancelled

⚽️ Match: ${matchData ? `${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}` : order.match_code}

🔸 Match ID: ${order.match_code}
🔸 Order ID: ${order.order_code}
🔸 Selection: ${matchData ? formatSelectionWithFlags(matchData, order.selection) : order.selection}
🔸 Amount: ${formatAmount(order.expected_amount)} ${order.currency || DEFAULT_CURRENCY}

This pending order has been cancelled by admin. It will not be counted.`;

  let userNotified = true;
  try {
    await sendOptionalPhoto(order.telegram_id, getLocalizedImageUrl(order.telegram_id, ORDER_CANCELLED_IMAGE_URL, ORDER_CANCELLED_IMAGE_URL_ZH), userCancelText, getOrderCancelledKeyboard(order.telegram_id));
  } catch (error) {
    userNotified = false;
    console.error("Failed to notify user after admin void:", error.message);
  }

  return ctx.reply(`✅ Order voided: ${orderCode}
User notified: ${userNotified ? "yes" : "no"}`);
}

async function lockMatch(ctx, text) {
  if (!(await requireAdmin(ctx))) return;

  const cleaned = cleanCommandText(text);
  const match = cleaned.match(/^\/lock_(WC[A-Z0-9]+)$/i);

  if (!match) {
    return ctx.reply("Invalid format.\nExample: /lock_WC0001");
  }

  const matchCode = match[1].toUpperCase();
  const matchData = await getMatch(matchCode);

  if (!matchData) {
    return ctx.reply("Match not found.");
  }

  if (matchData.status !== "open") {
    return ctx.reply(`Match is not open. Current status: ${matchData.status}`);
  }

  const { error } = await supabase
    .from("wc_matches")
    .update({
      status: "locked",
      updated_at: new Date().toISOString()
    })
    .eq("match_code", matchCode);

  if (error) {
    return ctx.reply(`Failed to lock match: ${error.message}`);
  }

  await updateLiveMatchMessage(matchCode);

  return ctx.reply(`🔒 Match locked: ${matchCode}`);
}

async function hideDateMatches(ctx, text) {
  if (!(await requireAdmin(ctx))) return;

  const cleaned = cleanCommandText(text);
  const match = cleaned.match(/^\/hide_date_(\d{4}\.\d{2}\.\d{2})$/i);

  if (!match) {
    return ctx.reply("Invalid format.\nExample: /hide_date_2026.06.19");
  }

  const date = match[1];
  const { data, error } = await supabase
    .from("wc_matches")
    .update({ status: "hidden", updated_at: new Date().toISOString() })
    .eq("match_date", date)
    .in("status", ["open", "locked"])
    .select("match_code");

  if (error) {
    return ctx.reply(`Failed to hide matches: ${error.message}`);
  }

  return ctx.reply(`✅ Hidden ${(data || []).length} match(es) on ${date}.`);
}

async function showDateMatches(ctx, text) {
  if (!(await requireAdmin(ctx))) return;

  const cleaned = cleanCommandText(text);
  const match = cleaned.match(/^\/show_date_(\d{4}\.\d{2}\.\d{2})$/i);

  if (!match) {
    return ctx.reply("Invalid format.\nExample: /show_date_2026.06.19");
  }

  const date = match[1];
  const { data, error } = await supabase
    .from("wc_matches")
    .update({ status: "open", updated_at: new Date().toISOString() })
    .eq("match_date", date)
    .eq("status", "hidden")
    .select("match_code");

  if (error) {
    return ctx.reply(`Failed to show matches: ${error.message}`);
  }

  return ctx.reply(`✅ Shown ${(data || []).length} match(es) on ${date}.`);
}

async function hideSingleMatch(ctx, text) {
  if (!(await requireAdmin(ctx))) return;

  const cleaned = cleanCommandText(text);
  const match = cleaned.match(/^\/hide_(WC[A-Z0-9]+)$/i);

  if (!match) {
    return ctx.reply("Invalid format.\nExample: /hide_WC0001");
  }

  const matchCode = match[1].toUpperCase();
  const matchData = await getMatch(matchCode);

  if (!matchData) {
    return ctx.reply("Match not found.");
  }

  if (matchData.status === "settled") {
    return ctx.reply("Settled matches cannot be hidden.");
  }

  const { error } = await supabase
    .from("wc_matches")
    .update({ status: "hidden", updated_at: new Date().toISOString() })
    .eq("match_code", matchCode);

  if (error) {
    return ctx.reply(`Failed to hide match: ${error.message}`);
  }

  await updateLiveMatchMessage(matchCode);
  return ctx.reply(`✅ Match hidden: ${matchCode}`);
}

async function showSingleMatch(ctx, text) {
  if (!(await requireAdmin(ctx))) return;

  const cleaned = cleanCommandText(text);
  const match = cleaned.match(/^\/show_(WC[A-Z0-9]+)$/i);

  if (!match) {
    return ctx.reply("Invalid format.\nExample: /show_WC0001");
  }

  const matchCode = match[1].toUpperCase();
  const matchData = await getMatch(matchCode);

  if (!matchData) {
    return ctx.reply("Match not found.");
  }

  if (matchData.status !== "hidden") {
    return ctx.reply(`Match is not hidden. Current status: ${matchData.status}`);
  }

  const { error } = await supabase
    .from("wc_matches")
    .update({ status: "open", updated_at: new Date().toISOString() })
    .eq("match_code", matchCode);

  if (error) {
    return ctx.reply(`Failed to show match: ${error.message}`);
  }

  await updateLiveMatchMessage(matchCode);
  return ctx.reply(`✅ Match shown: ${matchCode}`);
}

async function setMatchResult(ctx, text) {
  if (!(await requireAdmin(ctx))) return;

  const cleaned = cleanCommandText(text);
  const commandMatch = cleaned.match(/^\/result_(WC[A-Z0-9]+)_([A-Za-z0-9:_-]+)$/i);

  if (!commandMatch) {
    return ctx.reply("Invalid format.\nExample: /result_WC0001_0:0");
  }

  const matchCode = commandMatch[1].toUpperCase();
  const resultInput = commandMatch[2];
  const matchData = await getMatch(matchCode);

  if (!matchData) {
    return ctx.reply("Match not found.");
  }

  if (matchData.status === "settled") {
    return ctx.reply("This match has already been settled.");
  }

  const selection = resultInputToSelection(matchData, resultInput);

  if (!selection) {
    return ctx.reply(`Invalid result. Use one of the score options or Others.\nExample: /result_${matchCode}_0:0`);
  }

  const { error } = await supabase
    .from("wc_matches")
    .update({
      status: "resulted",
      result: selection,
      updated_at: new Date().toISOString()
    })
    .eq("match_code", matchCode);

  if (error) {
    return ctx.reply(`Failed to set result: ${error.message}`);
  }

  await updateLiveMatchMessage(matchCode);

  return ctx.reply(`✅ Result recorded

Match: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
Result: ${labelForSelection(matchData, selection)}

Next step:
/preview_${matchCode}`);
}

async function loadConfirmedOrders(matchCode) {
  const { data, error } = await supabase
    .from("wc_orders")
    .select("*")
    .eq("match_code", matchCode)
    .eq("status", "confirmed")
    .order("confirmed_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load confirmed orders: ${error.message}`);
  }

  return data || [];
}

function normalizeStageForMatchStage(stage) {
  return String(stage || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isWorldCupFinalMatch(matchData) {
  if (!matchData) return false;

  const matchCode = String(matchData.match_code || "").trim().toUpperCase();
  if (WORLDCUP_FINAL_MATCH_CODE && matchCode === WORLDCUP_FINAL_MATCH_CODE) return true;

  const normalizedStage = normalizeStageForMatchStage(matchData.match_stage);
  return normalizedStage === "final" || normalizedStage === "worldcupfinal" || normalizedStage === "grandfinal" || normalizedStage === "championship";
}

function decimalFromDb(value) {
  try {
    const amount = new Decimal(value || 0);
    return amount.isFinite() ? amount : new Decimal(0);
  } catch (error) {
    return new Decimal(0);
  }
}

function isNoWinnerCarryoverSettlement(row) {
  if (!row || String(row.status || "").toLowerCase() !== "settled") return false;

  const netPool = decimalFromDb(row.net_pool);
  const winningPool = decimalFromDb(row.winning_pool);

  return netPool.gt(0) && winningPool.eq(0);
}

async function loadFinalCarryovers(finalMatchCode) {
  if (!CARRYOVER_NO_WINNER_TO_FINAL_ENABLED) return [];

  const { data, error } = await supabase
    .from("wc_settlements")
    .select("match_code,result,total_pool,fee_amount,net_pool,winning_pool,fee_bps,status,settled_at")
    .eq("status", "settled")
    .neq("match_code", finalMatchCode)
    .order("settled_at", { ascending: true })
    .limit(500);

  if (error) {
    throw new Error(`Failed to load final carryovers: ${error.message}`);
  }

  return (data || []).filter(isNoWinnerCarryoverSettlement);
}

function getCarryoverTotal(carryovers) {
  return (carryovers || []).reduce((sum, item) => sum.plus(decimalFromDb(item.net_pool)), new Decimal(0));
}

async function loadCurrentFinalCarryovers(currentMatchData = null) {
  if (!CARRYOVER_NO_WINNER_TO_FINAL_ENABLED) return [];

  const { data, error } = await supabase
    .from("wc_settlements")
    .select("match_code,result,total_pool,fee_amount,net_pool,winning_pool,fee_bps,status,settled_at")
    .eq("status", "settled")
    .order("settled_at", { ascending: true })
    .limit(500);

  if (error) {
    throw new Error(`Failed to load current final carryovers: ${error.message}`);
  }

  const currentMatchCode = String(currentMatchData?.match_code || "").trim().toUpperCase();

  return (data || []).filter((row) => {
    const rowMatchCode = String(row.match_code || "").trim().toUpperCase();

    if (WORLDCUP_FINAL_MATCH_CODE && rowMatchCode === WORLDCUP_FINAL_MATCH_CODE) return false;
    if (currentMatchCode && isWorldCupFinalMatch(currentMatchData) && rowMatchCode === currentMatchCode) return false;

    return isNoWinnerCarryoverSettlement(row);
  });
}

async function getCurrentFinalCarryoverTotal(currentMatchData = null) {
  return getCarryoverTotal(await loadCurrentFinalCarryovers(currentMatchData));
}

function buildCarryoverLines(carryovers, currency, maxItems = 20) {
  const rows = (carryovers || []).slice(0, maxItems).map((item, index) => {
    return `${index + 1}. ${item.match_code} - ${formatAmount(decimalFromDb(item.net_pool))} ${currency}`;
  });

  if ((carryovers || []).length > maxItems) {
    rows.push(`...and ${(carryovers || []).length - maxItems} more carryover match(es).`);
  }

  return rows;
}

function calculateSettlement(matchData, orders, carryovers = []) {
  const result = matchData.result;
  const feeBps = Number(matchData.fee_bps || PLATFORM_FEE_BPS);
  const isFinalMatch = isWorldCupFinalMatch(matchData);

  let totalPool = new Decimal(0);
  let winningPool = new Decimal(0);

  for (const order of orders) {
    const amount = new Decimal(order.confirmed_amount || 0);
    totalPool = totalPool.plus(amount);

    if (order.selection === result) {
      winningPool = winningPool.plus(amount);
    }
  }

  const feeAmount = totalPool.mul(feeBps).div(10000);
  const netPoolBeforeCarryover = totalPool.minus(feeAmount);
  const carryoverTotal = isFinalMatch ? getCarryoverTotal(carryovers) : new Decimal(0);
  const payoutPool = netPoolBeforeCarryover.plus(carryoverTotal);
  const noWinnerCarryoverAmount = !isFinalMatch && winningPool.eq(0) && netPoolBeforeCarryover.gt(0)
    ? netPoolBeforeCarryover
    : new Decimal(0);

  const winners = orders.filter((order) => order.selection === result);
  const payouts = winners.map((order) => {
    const winningAmount = new Decimal(order.confirmed_amount || 0);
    const payoutAmount = winningPool.gt(0)
      ? winningAmount.div(winningPool).mul(payoutPool)
      : new Decimal(0);

    return {
      order,
      winningAmount,
      payoutAmount
    };
  });

  return {
    result,
    feeBps,
    totalPool,
    feeAmount,
    netPool: payoutPool,
    netPoolBeforeCarryover,
    carryoverTotal,
    carryovers: carryovers || [],
    payoutPool,
    noWinnerCarryoverAmount,
    isFinalMatch,
    winningPool,
    winners,
    payouts
  };
}

function buildSettlementPreviewMessage(matchData, settlement) {
  const feePercent = new Decimal(settlement.feeBps).div(100).toFixed();
  const carryoverLines = buildCarryoverLines(settlement.carryovers, matchData.currency);

  const lines = settlement.payouts.map((payout, index) => {
    const order = payout.order;
    const user = order.username ? `@${order.username}` : `UID ${order.ueex_uid}`;

    return `${index + 1}. ${user} / UID ${order.ueex_uid} - Vote ${formatAmount(payout.winningAmount)} ${matchData.currency} - Payout ${formatAmount(payout.payoutAmount)} ${matchData.currency}`;
  });

  const carryoverSection = settlement.isFinalMatch
    ? `\n🏆 Final Carryover Added: ${formatAmount(settlement.carryoverTotal)} ${matchData.currency}\n${carryoverLines.length ? carryoverLines.join("\n") : "No carryover matches."}\n🎁 Final Payout Pool: ${formatAmount(settlement.payoutPool)} ${matchData.currency}`
    : settlement.noWinnerCarryoverAmount.gt(0)
      ? `\n♻️ No exact-score winners. Carryover to World Cup Final: ${formatAmount(settlement.noWinnerCarryoverAmount)} ${matchData.currency}`
      : "";

  return `🏆 Settlement Preview

Match ID: ${matchData.match_code}
Match: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
Result: ${formatSelectionWithFlags(matchData, settlement.result)}

💰 Total Pool: ${formatAmount(settlement.totalPool)} ${matchData.currency}
🏦 Platform Fee ${feePercent}%: ${formatAmount(settlement.feeAmount)} ${matchData.currency}
🎁 Net Pool: ${formatAmount(settlement.netPoolBeforeCarryover)} ${matchData.currency}${carryoverSection}
🎯 Winning Pool: ${formatAmount(settlement.winningPool)} ${matchData.currency}

Winners:
${lines.length ? lines.join("\n") : "No winners."}

Use /settle_${matchData.match_code} to publish and notify users.`;
}

function getPublicUserLabel(order, index) {
  if (order.username) return `@${order.username}`;
  return `Anonymous Winner #${index + 1}`;
}

function buildSettlementCompletedAdminMessage(matchData, settlement) {
  const feePercent = new Decimal(settlement.feeBps).div(100).toFixed();
  const carryoverLines = buildCarryoverLines(settlement.carryovers, matchData.currency);
  const winnerLines = settlement.payouts.map((payout, index) => {
    const order = payout.order;
    return `${index + 1}. ${getTelegramUserLabel(order)} / UID ${order.ueex_uid}
   Vote: ${formatAmount(payout.winningAmount)} ${matchData.currency}
   Payout: ${formatAmount(payout.payoutAmount)} ${matchData.currency}`;
  });

  const carryoverSection = settlement.isFinalMatch
    ? `\n🏆 Final Carryover Added: ${formatAmount(settlement.carryoverTotal)} ${matchData.currency}\n${carryoverLines.length ? carryoverLines.join("\n") : "No carryover matches."}\n🎁 Final Payout Pool: ${formatAmount(settlement.payoutPool)} ${matchData.currency}`
    : settlement.noWinnerCarryoverAmount.gt(0)
      ? `\n♻️ No exact-score winners. Carryover to World Cup Final: ${formatAmount(settlement.noWinnerCarryoverAmount)} ${matchData.currency}`
      : "";

  return `✅ Settlement Completed

⚽️ ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
🔸 Match ID: ${matchData.match_code}
🔸 Result: ${formatSelectionWithFlags(matchData, settlement.result)}

💰 Total Pool: ${formatAmount(settlement.totalPool)} ${matchData.currency}
🏦 Platform Fee ${feePercent}%: ${formatAmount(settlement.feeAmount)} ${matchData.currency}
🎁 Net Pool: ${formatAmount(settlement.netPoolBeforeCarryover)} ${matchData.currency}${carryoverSection}
🎯 Winning Pool: ${formatAmount(settlement.winningPool)} ${matchData.currency}

Winners:
${winnerLines.length ? winnerLines.join("\n\n") : "No winners."}`;
}

function buildSettlementPublicMessage(matchData, settlement, finalCarryoverTotal = null) {
  const feePercent = new Decimal(settlement.feeBps).div(100).toFixed();
  const winnerLines = settlement.payouts.map((payout, index) => {
    const order = payout.order;
    return `${index + 1}. ${getPublicUserLabel(order, index)}
   Vote: ${formatAmount(payout.winningAmount)} ${matchData.currency}
   Payout: ${formatAmount(payout.payoutAmount)} ${matchData.currency}`;
  });

  const carryoverSection = settlement.isFinalMatch
    ? `
🏆 Final Carryover Added: ${formatAmount(settlement.carryoverTotal)} ${matchData.currency}
🎁 Final Payout Pool: ${formatAmount(settlement.payoutPool)} ${matchData.currency}`
    : settlement.noWinnerCarryoverAmount.gt(0)
      ? `
♻️ No exact-score winners. Net pool carried over to the World Cup Final: ${formatAmount(settlement.noWinnerCarryoverAmount)} ${matchData.currency}`
      : "";

  const finalCarryoverSection = finalCarryoverTotal !== null && finalCarryoverTotal !== undefined
    ? `
🏆 Current Final Carryover Pool: ${formatAmount(finalCarryoverTotal)} ${matchData.currency}`
    : "";

  const ending = winnerLines.length
    ? "Congratulations to all winners! 🎉"
    : settlement.isFinalMatch
      ? "No exact-score winners in the Final. UEEx will review this manually."
      : "No exact-score winners. This net pool has been carried over to the World Cup Final prize pool.";

  return `⚽️ ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
🔸 Match ID: ${matchData.match_code}
🔸 Result: ${formatSelectionWithFlags(matchData, settlement.result)}

💰 Total Pool: ${formatAmount(settlement.totalPool)} ${matchData.currency}
🏦 Platform Fee ${feePercent}%: ${formatAmount(settlement.feeAmount)} ${matchData.currency}
🎁 Net Pool: ${formatAmount(settlement.netPoolBeforeCarryover)} ${matchData.currency}${carryoverSection}
🎯 Winning Pool: ${formatAmount(settlement.winningPool)} ${matchData.currency}${finalCarryoverSection}

Winners:
${winnerLines.length ? winnerLines.join("\n\n") : "No winners."}

${ending}`;
}


function buildWinningUserSettlementMessage(matchData, order, payout) {
  const voteAmount = new Decimal(order.confirmed_amount || 0);
  const pnl = payout.payoutAmount.minus(voteAmount);
  const pnlSign = pnl.gte(0) ? "+" : "";

  if (isZh(order.telegram_id)) {
    return `⚽️ 比赛: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
🔸 赛果: ${formatSelectionWithFlags(matchData, matchData.result, order.telegram_id)}
🔸 你的选择: ${formatSelectionWithFlags(matchData, order.selection, order.telegram_id)}
🔸 你的投票: ${formatAmount(voteAmount)} ${matchData.currency}
🔸 预计派奖: ${formatAmount(payout.payoutAmount)} ${matchData.currency}
🔸 总盈亏: ${pnlSign}${formatAmount(pnl)} ${matchData.currency}

奖励将在最终审核后安排发放。`;
  }

  return `⚽️ Match: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
🔸 Result: ${formatSelectionWithFlags(matchData, matchData.result)}
🔸 Your Selection: ${formatSelectionWithFlags(matchData, order.selection)}
🔸 Your Vote: ${formatAmount(voteAmount)} ${matchData.currency}
🔸 Estimated Payout: ${formatAmount(payout.payoutAmount)} ${matchData.currency}
🔸 Total PnL: ${pnlSign}${formatAmount(pnl)} ${matchData.currency}

Rewards will be arranged after final review.`;
}

function buildLosingUserSettlementMessage(matchData, order, noWinnerMode = false, settlement = null) {
  const voteAmount = new Decimal(order.confirmed_amount || 0);

  if (noWinnerMode) {
    if (settlement?.isFinalMatch) {
      if (isZh(order.telegram_id)) {
        return `⚽️ 比赛: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
🔸 赛果: ${formatSelectionWithFlags(matchData, matchData.result, order.telegram_id)}
🔸 你的选择: ${formatSelectionWithFlags(matchData, order.selection, order.telegram_id)}
🔸 你的投票: ${formatAmount(voteAmount)} ${matchData.currency}
🔸 总盈亏: -${formatAmount(voteAmount)} ${matchData.currency}

❌ 未猜中准确比分。
⚠️ 总决赛无人中奖，UEEx 将进行人工复核。`;
      }

      return `⚽️ Match: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
🔸 Result: ${formatSelectionWithFlags(matchData, matchData.result)}
🔸 Your Selection: ${formatSelectionWithFlags(matchData, order.selection)}
🔸 Your Vote: ${formatAmount(voteAmount)} ${matchData.currency}
🔸 Total PnL: -${formatAmount(voteAmount)} ${matchData.currency}

❌ Your exact score did not win.
⚠️ No exact-score winners in the Final. UEEx will review this manually.`;
    }

    if (isZh(order.telegram_id)) {
      return `⚽️ 比赛: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
🔸 赛果: ${formatSelectionWithFlags(matchData, matchData.result, order.telegram_id)}
🔸 你的选择: ${formatSelectionWithFlags(matchData, order.selection, order.telegram_id)}
🔸 你的投票: ${formatAmount(voteAmount)} ${matchData.currency}
🔸 总盈亏: -${formatAmount(voteAmount)} ${matchData.currency}

❌ 未猜中准确比分。
♻️ 本场暂无赢家，净奖池累计至世界杯总决赛。`;
    }

    return `⚽️ Match: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
🔸 Result: ${formatSelectionWithFlags(matchData, matchData.result)}
🔸 Your Selection: ${formatSelectionWithFlags(matchData, order.selection)}
🔸 Your Vote: ${formatAmount(voteAmount)} ${matchData.currency}
🔸 Total PnL: -${formatAmount(voteAmount)} ${matchData.currency}

❌ Your exact score did not win.
♻️ No exact-score winners this match. The net pool rolls over to the World Cup Final.`;
  }

  if (isZh(order.telegram_id)) {
    return `⚽️ 比赛: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
🔸 赛果: ${formatSelectionWithFlags(matchData, matchData.result, order.telegram_id)}
🔸 你的选择: ${formatSelectionWithFlags(matchData, order.selection, order.telegram_id)}
🔸 你的投票: ${formatAmount(voteAmount)} ${matchData.currency}
🔸 总盈亏: -${formatAmount(voteAmount)} ${matchData.currency}

感谢参与。`;
  }

  return `⚽️ Match: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
🔸 Result: ${formatSelectionWithFlags(matchData, matchData.result)}
🔸 Your Selection: ${formatSelectionWithFlags(matchData, order.selection)}
🔸 Your Vote: ${formatAmount(voteAmount)} ${matchData.currency}
🔸 Total PnL: -${formatAmount(voteAmount)} ${matchData.currency}

Thank you for participating.`;
}


function splitLongMessage(text, maxLength = 3800) {
  const lines = String(text || "").split("\n");
  const chunks = [];
  let current = "";

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxLength && current) {
      chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

async function replyLongMessage(ctx, text) {
  const chunks = splitLongMessage(text);
  let lastMessage = null;

  for (const chunk of chunks) {
    lastMessage = await ctx.reply(chunk);
  }

  return lastMessage;
}

async function notifyPublicWorldCupTopicLong(text, imageUrl = "", keyboard = null) {
  if (!PUBLIC_GROUP_CHAT_ID) return null;

  const baseOptions = PUBLIC_WORLD_CUP_TOPIC_ID
    ? { message_thread_id: Number(PUBLIC_WORLD_CUP_TOPIC_ID), disable_web_page_preview: true }
    : { disable_web_page_preview: true };
  const fallbackOptions = { disable_web_page_preview: true };

  const withKeyboard = (options, includeKeyboard = false) => {
    const nextOptions = { ...options };
    if (includeKeyboard && keyboard?.reply_markup) {
      nextOptions.reply_markup = keyboard.reply_markup;
    }
    return nextOptions;
  };

  const sendPhotoSafely = async (caption, includeKeyboard = false) => {
    const photoOptions = withKeyboard({ ...baseOptions, caption }, includeKeyboard);

    try {
      return await bot.telegram.sendPhoto(PUBLIC_GROUP_CHAT_ID, imageUrl, photoOptions);
    } catch (error) {
      console.error("Failed to send public settlement image with caption:", error.message);

      if (baseOptions.message_thread_id) {
        try {
          return await bot.telegram.sendPhoto(PUBLIC_GROUP_CHAT_ID, imageUrl, withKeyboard({ ...fallbackOptions, caption }, includeKeyboard));
        } catch (fallbackError) {
          console.error("Failed to send public settlement image fallback:", fallbackError.message);
        }
      }
    }

    return null;
  };

  const sendMessageSafely = async (messageText, includeKeyboard = false) => {
    try {
      return await bot.telegram.sendMessage(PUBLIC_GROUP_CHAT_ID, messageText, withKeyboard(baseOptions, includeKeyboard));
    } catch (error) {
      console.error("Failed to send public settlement chunk:", error.message);

      if (baseOptions.message_thread_id) {
        try {
          return await bot.telegram.sendMessage(PUBLIC_GROUP_CHAT_ID, messageText, withKeyboard(fallbackOptions, includeKeyboard));
        } catch (fallbackError) {
          console.error("Failed to send public settlement fallback:", fallbackError.message);
        }
      }
    }

    return null;
  };

  const safeText = String(text || "").trim();
  let lastMessage = null;

  if (imageUrl) {
    const [caption, remainingText] = splitCaptionText(safeText);
    const remainingChunks = splitLongMessage(remainingText, 3500);

    lastMessage = await sendPhotoSafely(caption || " ", remainingChunks.length === 0);

    for (let i = 0; i < remainingChunks.length; i += 1) {
      lastMessage = await sendMessageSafely(remainingChunks[i], i === remainingChunks.length - 1);
    }

    return lastMessage;
  }

  const chunks = splitLongMessage(safeText, 3500);

  for (let i = 0; i < chunks.length; i += 1) {
    lastMessage = await sendMessageSafely(chunks[i], i === chunks.length - 1);
  }

  return lastMessage;
}


async function notifySettlementUsers(matchData, orders, settlement) {
  const payoutByOrderKey = new Map();

  for (const payout of settlement.payouts) {
    const key = `${payout.order.telegram_id}:${payout.order.selection}:${payout.order.confirmed_amount}:${payout.order.created_at}`;
    payoutByOrderKey.set(key, payout);
  }

  const noWinnerMode = settlement.payouts.length === 0;

  for (const order of orders) {
    const key = `${order.telegram_id}:${order.selection}:${order.confirmed_amount}:${order.created_at}`;
    const payout = payoutByOrderKey.get(key);
    const message = payout
      ? buildWinningUserSettlementMessage(matchData, order, payout)
      : buildLosingUserSettlementMessage(matchData, order, noWinnerMode, settlement);
    const imageUrl = payout ? getLocalizedImageUrl(order.telegram_id, WINNER_IMAGE_URL, WINNER_IMAGE_URL_ZH) : getLocalizedImageUrl(order.telegram_id, LOSER_IMAGE_URL, LOSER_IMAGE_URL_ZH);

    try {
      await sendOptionalPhoto(order.telegram_id, imageUrl, message, getPrivateMatchesInlineKeyboard(order.telegram_id));
    } catch (error) {
      console.error(`Failed to notify settlement user ${order.telegram_id}:`, error.message);
    }
  }
}

async function previewSettlement(ctx, text) {
  if (!(await requireAdmin(ctx))) return;

  const cleaned = cleanCommandText(text);
  const match = cleaned.match(/^\/preview_(WC[A-Z0-9]+)$/i);

  if (!match) {
    return ctx.reply("Invalid format.\nExample: /preview_WC0001");
  }

  const matchCode = match[1].toUpperCase();
  const matchData = await getMatch(matchCode);

  if (!matchData) {
    return ctx.reply("Match not found.");
  }

  if (!matchData.result) {
    return ctx.reply(`Please record the result first.\nExample: /result_${matchCode}_DRAW`);
  }

  const orders = await loadConfirmedOrders(matchCode);
  const carryovers = isWorldCupFinalMatch(matchData) ? await loadFinalCarryovers(matchCode) : [];
  const settlement = calculateSettlement(matchData, orders, carryovers);

  const settlementPayload = {
    match_code: matchData.match_code,
    result: settlement.result,
    total_pool: settlement.totalPool.toFixed(),
    fee_amount: settlement.feeAmount.toFixed(),
    net_pool: settlement.netPool.toFixed(),
    winning_pool: settlement.winningPool.toFixed(),
    fee_bps: settlement.feeBps,
    status: "preview",
    created_by: ctx.from.id,
    created_at: new Date().toISOString()
  };

  const { data: savedSettlement, error: settlementError } = await supabase
    .from("wc_settlements")
    .upsert(settlementPayload, { onConflict: "match_code" })
    .select("*")
    .single();

  if (settlementError) {
    return ctx.reply(`Failed to save settlement preview: ${settlementError.message}`);
  }

  await supabase
    .from("wc_payouts")
    .delete()
    .eq("match_code", matchCode);

  if (settlement.payouts.length > 0) {
    const payoutRows = settlement.payouts.map((payout) => ({
      match_code: matchCode,
      settlement_id: savedSettlement.id,
      telegram_id: payout.order.telegram_id,
      ueex_uid: payout.order.ueex_uid,
      username: payout.order.username,
      selection: payout.order.selection,
      winning_amount: payout.winningAmount.toFixed(),
      payout_amount: payout.payoutAmount.toFixed(),
      currency: matchData.currency,
      status: "pending"
    }));

    const { error: payoutError } = await supabase
      .from("wc_payouts")
      .insert(payoutRows);

    if (payoutError) {
      return ctx.reply(`Failed to save payout rows: ${payoutError.message}`);
    }
  }

  return replyLongMessage(ctx, buildSettlementPreviewMessage(matchData, settlement));
}

async function settleMatch(ctx, text) {
  if (!(await requireAdmin(ctx))) return;

  const cleaned = cleanCommandText(text);
  const match = cleaned.match(/^\/settle_(WC[A-Z0-9]+)$/i);

  if (!match) {
    return ctx.reply("Invalid format.\nExample: /settle_WC0001");
  }

  const matchCode = match[1].toUpperCase();
  const matchData = await getMatch(matchCode);

  if (!matchData) {
    return ctx.reply("Match not found.");
  }

  const { data: savedSettlement, error: settlementError } = await supabase
    .from("wc_settlements")
    .select("*")
    .eq("match_code", matchCode)
    .maybeSingle();

  if (settlementError || !savedSettlement) {
    return ctx.reply(`No settlement preview found. Please run /preview_${matchCode} first.`);
  }

  if (savedSettlement.status === "settled") {
    return ctx.reply("This match has already been settled.");
  }

  const orders = await loadConfirmedOrders(matchCode);
  const carryovers = isWorldCupFinalMatch(matchData) ? await loadFinalCarryovers(matchCode) : [];
  const settlement = calculateSettlement(matchData, orders, carryovers);

  await supabase
    .from("wc_settlements")
    .update({
      result: settlement.result,
      total_pool: settlement.totalPool.toFixed(),
      fee_amount: settlement.feeAmount.toFixed(),
      net_pool: settlement.netPool.toFixed(),
      winning_pool: settlement.winningPool.toFixed(),
      fee_bps: settlement.feeBps,
      status: "settled",
      settled_by: ctx.from.id,
      settled_at: new Date().toISOString()
    })
    .eq("match_code", matchCode);

  await supabase
    .from("wc_matches")
    .update({
      status: "settled",
      updated_at: new Date().toISOString()
    })
    .eq("match_code", matchCode);

  await updateLiveMatchMessage(matchCode);

  await notifySettlementUsers(matchData, orders, settlement);

  let finalCarryoverTotal = null;
  try {
    finalCarryoverTotal = await getCurrentFinalCarryoverTotal(matchData);
  } catch (error) {
    console.error("Failed to load current final carryover total for public settlement message:", error.message);
  }

  const adminMessage = buildSettlementCompletedAdminMessage(matchData, settlement);
  const publicMessage = buildSettlementPublicMessage(matchData, settlement, finalCarryoverTotal);

  const publicNotifyResult = await notifyPublicWorldCupTopicLong(publicMessage, MATCH_SETTLED_IMAGE_URL, buildPublicOrderConfirmedKeyboard());
  const adminFinalMessage = `${adminMessage}

Public Topic Notification: ${publicNotifyResult ? "sent" : "failed or not configured"}`;

  return replyLongMessage(ctx, adminFinalMessage);
}

function getMatchResultDisplay(match, ctxOrLang = null) {
  if (!match) return isZh(ctxOrLang) ? "未开始" : "Not Started";

  if (match.result) {
    return formatSelectionWithFlags(match, match.result, ctxOrLang);
  }

  if (match.status === "locked") return isZh(ctxOrLang) ? "进行中" : "In Progress";
  if (match.status === "resulted" || match.status === "settled") {
    return match.result ? formatSelectionWithFlags(match, match.result, ctxOrLang) : isZh(ctxOrLang) ? "进行中" : "In Progress";
  }

  return isZh(ctxOrLang) ? "未开始" : "Not Started";
}

async function getConfirmedOrdersForMatches(matchCodes) {
  if (!matchCodes.length) return [];

  const { data, error } = await supabase
    .from("wc_orders")
    .select("*")
    .in("match_code", matchCodes)
    .eq("status", "confirmed");

  if (error) {
    throw new Error(`Failed to load match pools: ${error.message}`);
  }

  return data || [];
}

function buildMatchStatsMap(matches, confirmedOrders) {
  const map = new Map();

  for (const match of matches || []) {
    map.set(match.match_code, {
      match,
      totalPool: new Decimal(0),
      winningPool: new Decimal(0),
      netPool: new Decimal(0),
      carryoverTotal: new Decimal(0),
      feeBps: Number(match.fee_bps || PLATFORM_FEE_BPS),
      orders: []
    });
  }

  for (const order of confirmedOrders || []) {
    const stats = map.get(order.match_code);
    if (!stats) continue;

    const amount = new Decimal(order.confirmed_amount || 0);
    stats.totalPool = stats.totalPool.plus(amount);
    stats.orders.push(order);

    if (stats.match.result && order.selection === stats.match.result) {
      stats.winningPool = stats.winningPool.plus(amount);
    }
  }

  for (const stats of map.values()) {
    const feeAmount = stats.totalPool.mul(stats.feeBps).div(10000);
    stats.netPool = stats.totalPool.minus(feeAmount);
  }

  return map;
}


async function applyFinalCarryoversToStatsMap(matches, statsMap) {
  if (!CARRYOVER_NO_WINNER_TO_FINAL_ENABLED) return;

  for (const match of matches || []) {
    if (!isWorldCupFinalMatch(match)) continue;

    const stats = statsMap.get(match.match_code);
    if (!stats) continue;

    const carryovers = await loadFinalCarryovers(match.match_code);
    const carryoverTotal = getCarryoverTotal(carryovers);

    if (carryoverTotal.gt(0)) {
      stats.carryoverTotal = carryoverTotal;
      stats.netPool = stats.netPool.plus(carryoverTotal);
    }
  }
}

function calculateOrderPnlValue(order, match, stats) {
  if (!match || order.status !== "confirmed" || !match.result) return null;

  const amount = new Decimal(order.confirmed_amount || 0);

  if (order.selection !== match.result) {
    return amount.negated();
  }

  if (!stats || !stats.winningPool || stats.winningPool.lte(0)) return null;

  const payout = amount.div(stats.winningPool).mul(stats.netPool);
  return payout.minus(amount);
}

function calculateOrderPnl(order, match, stats) {
  const pnl = calculateOrderPnlValue(order, match, stats);
  if (!pnl) return "-";

  const sign = pnl.gte(0) ? "+" : "";
  return `${sign}${formatAmount(pnl)} ${order.currency}`;
}


function getSafePageSize(value, fallback) {
  const size = Number(value || fallback);
  return Number.isFinite(size) && size > 0 ? Math.min(Math.max(Math.floor(size), 1), 20) : fallback;
}

function clampPage(page, totalPages) {
  const parsed = Number(page || 1);
  const safePage = Number.isFinite(parsed) ? Math.floor(parsed) : 1;
  return Math.min(Math.max(safePage, 1), Math.max(totalPages || 1, 1));
}

function buildPaginationKeyboard(prefix, page, totalPages, ctxOrLang = null) {
  const rows = [];
  const row = [];
  const zh = isZh(ctxOrLang);

  if (page > 1) {
    row.push(Markup.button.callback(zh ? "⬅️ 上一页" : "⬅️ Previous", `${prefix}:${page - 1}`));
  }

  if (page < totalPages) {
    row.push(Markup.button.callback(zh ? "下一页 ➡️" : "Next ➡️", `${prefix}:${page + 1}`));
  }

  if (row.length) rows.push(row);
  return rows.length ? Markup.inlineKeyboard(rows) : undefined;
}

async function replyOrEditDataPage(ctx, text, keyboard = undefined, edit = false, category = "data") {
  if (edit && ctx.editMessageText) {
    return ctx.editMessageText(text, keyboard || undefined);
  }

  if (isPrivateChat(ctx)) {
    await deleteLastPrivateMenuMessage(ctx, category);
  }

  const sent = await ctx.reply(text, keyboard || undefined);
  return rememberPrivateMenuMessage(ctx, sent, category);
}

async function loadMatchesByCodes(matchCodes) {
  if (!matchCodes.length) return [];

  const { data, error } = await supabase
    .from("wc_matches")
    .select("*")
    .in("match_code", matchCodes);

  if (error) {
    throw new Error(`Failed to load matches: ${error.message}`);
  }

  return data || [];
}

async function loadSettledPredictionStats() {
  const { data: matches, error: matchError } = await supabase
    .from("wc_matches")
    .select("*")
    .eq("status", "settled")
    .not("result", "is", null)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (matchError) {
    throw new Error(`Failed to load settled matches: ${matchError.message}`);
  }

  const settledMatches = matches || [];
  const matchCodes = settledMatches.map((match) => match.match_code).filter(Boolean);

  if (!matchCodes.length) {
    return {
      matches: [],
      matchMap: new Map(),
      orders: [],
      statsMap: new Map(),
      winnerRows: []
    };
  }

  const confirmedOrders = await getConfirmedOrdersForMatches(matchCodes);
  const matchMap = new Map(settledMatches.map((match) => [match.match_code, match]));
  const statsMap = buildMatchStatsMap(settledMatches, confirmedOrders);
  await applyFinalCarryoversToStatsMap(settledMatches, statsMap);

  const winnerRows = [];

  for (const order of confirmedOrders) {
    const match = matchMap.get(order.match_code);
    const stats = statsMap.get(order.match_code);
    if (!match || !stats) continue;

    const amount = new Decimal(order.confirmed_amount || 0);
    const payoutAmount = order.selection === match.result && stats.winningPool.gt(0)
      ? amount.div(stats.winningPool).mul(stats.netPool)
      : new Decimal(0);
    const pnl = payoutAmount.minus(amount);
    if (payoutAmount.gt(0)) {
      winnerRows.push({
        order,
        match,
        stats,
        amount,
        payoutAmount,
        profit: pnl,
        currency: order.currency || match.currency || DEFAULT_CURRENCY,
        settledAt: new Date(match.updated_at || match.created_at || 0).getTime() || 0
      });
    }
  }

  winnerRows.sort((a, b) => b.settledAt - a.settledAt || String(b.order.confirmed_at || "").localeCompare(String(a.order.confirmed_at || "")));


  return {
    matches: settledMatches,
    matchMap,
    orders: confirmedOrders,
    statsMap,
    winnerRows
  };
}

function getStatsUserLabel(rowOrOrder, fallback = "User") {
  if (rowOrOrder?.username) return `@${rowOrOrder.username}`;
  const name = [rowOrOrder?.first_name, rowOrOrder?.last_name].filter(Boolean).join(" ");
  if (name) return name;
  if (rowOrOrder?.ueexUid) return `UID ${rowOrOrder.ueexUid}`;
  if (rowOrOrder?.ueex_uid) return `UID ${rowOrOrder.ueex_uid}`;
  if (rowOrOrder?.telegramId) return `TG ${rowOrOrder.telegramId}`;
  if (rowOrOrder?.telegram_id) return `TG ${rowOrOrder.telegram_id}`;
  return fallback;
}

function formatProfit(value, currency) {
  const decimal = new Decimal(value || 0);
  const sign = decimal.gte(0) ? "+" : "";
  return `${sign}${formatAmount(decimal)} ${currency}`;
}

async function showMyVote(ctx, page = 1, edit = false) {
  if (!isPrivateChat(ctx)) {
    return ctx.reply("Please check your vote details in private chat with the bot.");
  }

  const { data: orders, error } = await supabase
    .from("wc_orders")
    .select("*")
    .eq("telegram_id", ctx.from.id)
    .neq("status", "voided")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return replyOrEditDataPage(ctx, `${isZh(ctx) ? "加载投票记录失败" : "Failed to load your votes"}: ${error.message}`, undefined, edit, "myvote");
  }

  if (!orders || orders.length === 0) {
    return replyOrEditDataPage(ctx, isZh(ctx) ? "📊 我的投票\n\n你还没有世界杯预测订单。" : "📊 My Vote\n\nYou have no World Cup prediction orders yet.", undefined, edit, "myvote");
  }

  const matchCodes = [...new Set(orders.map((order) => order.match_code).filter(Boolean))];
  const matches = await loadMatchesByCodes(matchCodes);
  const confirmedOrders = await getConfirmedOrdersForMatches(matchCodes);
  const matchMap = new Map((matches || []).map((match) => [match.match_code, match]));
  const statsMap = buildMatchStatsMap(matches || [], confirmedOrders);
  await applyFinalCarryoversToStatsMap(matches || [], statsMap);

  let totalVoteAmount = new Decimal(0);
  let totalPnlAmount = new Decimal(0);
  let hasSettledPnl = false;
  let confirmedCount = 0;
  let pendingCount = 0;

  for (const order of orders) {
    const match = matchMap.get(order.match_code);
    const stats = statsMap.get(order.match_code);
    const amount = order.status === "confirmed" ? order.confirmed_amount : order.expected_amount;
    const amountDecimal = new Decimal(amount || 0);
    const pnlValue = calculateOrderPnlValue(order, match, stats);

    if (order.status === "confirmed") confirmedCount += 1;
    if (order.status === "pending") pendingCount += 1;

    if (["pending", "confirmed"].includes(order.status)) {
      totalVoteAmount = totalVoteAmount.plus(amountDecimal);
    }

    if (pnlValue !== null) {
      totalPnlAmount = totalPnlAmount.plus(pnlValue);
      hasSettledPnl = true;
    }
  }

  const pageSize = getSafePageSize(MY_VOTE_PAGE_SIZE, 3);
  const totalPages = Math.max(Math.ceil(orders.length / pageSize), 1);
  const safePage = clampPage(page, totalPages);
  const pageOrders = orders.slice((safePage - 1) * pageSize, safePage * pageSize);
  const currency = orders[0]?.currency || DEFAULT_CURRENCY;
  const totalPnlText = hasSettledPnl ? formatProfit(totalPnlAmount, currency) : `0 ${currency}`;

  const lines = pageOrders.map((order, index) => {
    const match = matchMap.get(order.match_code);
    const stats = statsMap.get(order.match_code);
    const displayIndex = (safePage - 1) * pageSize + index + 1;
    const matchTitle = match ? `${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}` : order.match_code;
    const selection = match ? formatSelectionWithFlags(match, order.selection, ctx) : order.selection;
    const amount = order.status === "confirmed" ? order.confirmed_amount : order.expected_amount;
    const totalPool = stats ? stats.totalPool : new Decimal(0);
    const carryoverTotal = stats?.carryoverTotal || new Decimal(0);
    const carryoverLine = carryoverTotal.gt(0)
      ? (isZh(ctx) ? `\n🔸 总决赛累计奖池: ${formatAmount(carryoverTotal)} ${order.currency}` : `\n🔸 Final Carryover Pool: ${formatAmount(carryoverTotal)} ${order.currency}`)
      : "";
    const resultDisplay = getMatchResultDisplay(match, ctx);
    const pnl = calculateOrderPnl(order, match, stats);
    const orderStatus = isZh(ctx)
      ? (order.status === "confirmed" ? "已确认" : order.status === "pending" ? "待确认" : order.status)
      : (order.status === "confirmed" ? "Confirmed" : order.status === "pending" ? "Pending" : order.status);

    if (isZh(ctx)) {
      return `${displayIndex}. ${matchTitle}\n🔸 比赛 ID: ${order.match_code}\n🔸 订单: ${order.order_code}\n🔸 选择: ${selection}\n🔸 金额: ${formatAmount(amount)} ${order.currency}\n🔸 总奖池: ${formatAmount(totalPool)} ${order.currency}${carryoverLine}\n🔸 订单状态: ${orderStatus}\n🔸 比赛赛果: ${resultDisplay}\n🔸 总盈亏: ${pnl}`;
    }

    return `${displayIndex}. ${matchTitle}\n🔸 Match ID: ${order.match_code}\n🔸 Order: ${order.order_code}\n🔸 Selection: ${selection}\n🔸 Amount: ${formatAmount(amount)} ${order.currency}\n🔸 Total Pool: ${formatAmount(totalPool)} ${order.currency}${carryoverLine}\n🔸 Order Status: ${orderStatus}\n🔸 Game Result: ${resultDisplay}\n🔸 Total PnL: ${pnl}`;
  });

  const body = isZh(ctx)
    ? `📊 我的投票\n\n订单: ${orders.length} | 已确认: ${confirmedCount} | 待确认: ${pendingCount}\n💰 总投票金额: ${formatAmount(totalVoteAmount)} ${currency}\n💎 总盈亏: ${totalPnlText}\n\n第 ${safePage} / ${totalPages} 页\n\n${lines.join("\n\n")}`
    : `📊 My Vote\n\nOrders: ${orders.length} | Confirmed: ${confirmedCount} | Pending: ${pendingCount}\n💰 Total Vote Amount: ${formatAmount(totalVoteAmount)} ${currency}\n💎 Total PnL: ${totalPnlText}\n\nPage ${safePage} / ${totalPages}\n\n${lines.join("\n\n")}`;

  return replyOrEditDataPage(ctx, body, buildPaginationKeyboard("wcmyvote", safePage, totalPages, ctx), edit, "myvote");
}

async function showRecentWinners(ctx, page = 1, edit = false) {
  const { winnerRows } = await loadSettledPredictionStats();

  if (!winnerRows.length) {
    return replyOrEditDataPage(ctx, isZh(ctx) ? "🏆 历史赢家\n\n目前还没有已结算的中奖记录。" : "🏆 Recent Winners\n\nNo settled winner records yet.", undefined, edit, "winners");
  }

  const pageSize = getSafePageSize(WINNERS_PAGE_SIZE, 5);
  const totalPages = Math.max(Math.ceil(winnerRows.length / pageSize), 1);
  const safePage = clampPage(page, totalPages);
  const pageRows = winnerRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const lines = pageRows.map((row, index) => {
    const displayIndex = (safePage - 1) * pageSize + index + 1;
    const user = getStatsUserLabel(row.order, `Winner #${displayIndex}`);
    const matchTitle = `${formatTeamWithFlag(row.match.team_a)} vs ${formatTeamWithFlag(row.match.team_b)}`;
    const result = formatSelectionWithFlags(row.match, row.match.result, ctx);
    const selection = formatSelectionWithFlags(row.match, row.order.selection, ctx);

    if (isZh(ctx)) {
      return `${displayIndex}. ${matchTitle}\n🔸 赢家: ${user}\n🔸 赛果: ${result}\n🔸 选择: ${selection}\n🔸 投票: ${formatAmount(row.amount)} ${row.currency}\n🔸 奖励: ${formatAmount(row.payoutAmount)} ${row.currency}\n🔸 盈利: ${formatProfit(row.profit, row.currency)}`;
    }

    return `${displayIndex}. ${matchTitle}\n🔸 Winner: ${user}\n🔸 Result: ${result}\n🔸 Pick: ${selection}\n🔸 Vote: ${formatAmount(row.amount)} ${row.currency}\n🔸 Payout: ${formatAmount(row.payoutAmount)} ${row.currency}\n🔸 Profit: ${formatProfit(row.profit, row.currency)}`;
  });

  const body = isZh(ctx)
    ? `🏆 历史赢家\n\n仅统计已结算比赛。\n第 ${safePage} / ${totalPages} 页\n\n${lines.join("\n\n")}`
    : `🏆 Recent Winners\n\nSettled matches only.\nPage ${safePage} / ${totalPages}\n\n${lines.join("\n\n")}`;

  return replyOrEditDataPage(ctx, body, buildPaginationKeyboard("wcwinners", safePage, totalPages, ctx), edit, "winners");
}

async function showPendingOrders(ctx, matchCode = null) {
  if (!(await requireAdminControlChat(ctx))) return;

  let query = supabase
    .from("wc_orders")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(30);

  if (matchCode) {
    query = query.eq("match_code", String(matchCode).toUpperCase());
  }

  const { data: orders, error } = await query;

  if (error) {
    return ctx.reply(`Failed to load pending orders: ${error.message}`);
  }

  if (!orders || orders.length === 0) {
    return ctx.reply(matchCode ? `No pending orders for ${String(matchCode).toUpperCase()}.` : "No pending orders.");
  }

  const matchCodes = [...new Set(orders.map((order) => order.match_code))];
  const { data: matches } = await supabase
    .from("wc_matches")
    .select("*")
    .in("match_code", matchCodes);

  const matchMap = new Map((matches || []).map((match) => [match.match_code, match]));

  const lines = orders.map((order, index) => {
    const match = matchMap.get(order.match_code);
    const matchLabel = match ? `${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}` : order.match_code;
    const selection = match ? formatSelectionWithFlags(match, order.selection) : order.selection;

    return `${index + 1}. ${order.order_code}
Match: ${matchLabel}
UID: ${order.ueex_uid}
TG: ${getTelegramUserLabel(order)}
Selection: ${selection}
Amount: ${formatAmount(order.expected_amount)} ${order.currency}
Confirm step 1: /confirm_${order.order_code}_${formatAmountForCommand(order.expected_amount)}
Then reply with recharge order number / exchange_id`;
  });

  return ctx.reply(`🧾 Pending Orders${matchCode ? ` | ${String(matchCode).toUpperCase()}` : ""}

${lines.join("\n\n")}`);
}



function formatPastDuration(dateValue) {
  const diffMs = Date.now() - new Date(dateValue).getTime();

  if (!Number.isFinite(diffMs) || diffMs < 0) return "just now";

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h ago`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m ago`;
  }

  return `${Math.max(minutes, 0)}m ago`;
}

async function showMatchesNeedingResult(ctx, dateFilter = "") {
  if (!(await requireAdminControlChat(ctx))) return;

  const normalizedDate = String(dateFilter || "").trim();

  if (normalizedDate && !/^\d{4}\.\d{2}\.\d{2}$/.test(normalizedDate)) {
    return ctx.reply("Invalid format. Example: /need_result_2026.06.14");
  }

  const nowIso = new Date().toISOString();
  const safeLimit = Math.min(Math.max(Number.isFinite(NEED_RESULT_LIMIT) ? NEED_RESULT_LIMIT : 50, 1), 100);

  let query = supabase
    .from("wc_matches")
    .select("*")
    .in("status", ["open", "locked"])
    .lte("betting_end_at", nowIso)
    .order("match_date", { ascending: true })
    .order("match_time", { ascending: true })
    .limit(safeLimit);

  if (normalizedDate) {
    query = query.eq("match_date", normalizedDate);
  }

  const { data: matches, error } = await query;

  if (error) {
    return ctx.reply(`Failed to load matches waiting for result: ${error.message}`);
  }

  if (!matches || matches.length === 0) {
    return ctx.reply(normalizedDate
      ? `✅ No matches waiting for result on ${normalizedDate}.`
      : "✅ No matches waiting for result.");
  }

  const lines = matches.map((match, index) => {
    const matchTime = [match.match_date, match.match_time, match.match_timezone].filter(Boolean).join(" ") || "TBD";
    const stage = match.match_stage ? `
Stage: ${match.match_stage}` : "";
    const closedAgo = match.betting_end_at ? formatPastDuration(match.betting_end_at) : "unknown";

    return `${index + 1}. ${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}
Match ID: ${match.match_code}${stage}
Match Time: ${matchTime}
Status: ${String(match.status || "").toUpperCase()}
Voting Closed: ${closedAgo}
Set result: /result_${match.match_code}_0:0
If no confirmed orders: /no_bet_${match.match_code}`;
  });

  return ctx.reply(`⏰ Matches Waiting for Result${normalizedDate ? ` | ${normalizedDate}` : ""}

${lines.join("\n\n")}`);
}

async function compensateOrder(ctx, text) {
  if (!(await requireAdminControlChat(ctx))) return;

  const cleaned = cleanCommandText(text);
  const match = cleaned.match(/^\/compensate_([A-Z0-9]+)_([0-9]+(?:\.[0-9]{1,8})?)$/i);

  if (!match) {
    return ctx.reply("Invalid format. Example: /compensate_O000123_2000");
  }

  const orderCode = match[1].toUpperCase();
  const amount = parsePositiveAmount(match[2]);

  if (!amount) {
    return ctx.reply("Invalid amount.");
  }

  const { data: order, error } = await supabase
    .from("wc_orders")
    .select("*")
    .eq("order_code", orderCode)
    .maybeSingle();

  if (error || !order) {
    return ctx.reply("Order not found.");
  }

  const matchData = await getMatch(order.match_code);
  const message = isZh(order.telegram_id)
    ? `💳 补账/人工处理通知

订单 ID：${order.order_code}
比赛：${matchData ? `${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}` : order.match_code}
补账/处理金额：${formatAmount(amount)} ${order.currency || DEFAULT_CURRENCY}

该金额已由 Admin 记录并将进行人工处理。如有疑问请联系 @UEEx_JJ。`
    : `💳 Manual Compensation Notice

Order ID: ${order.order_code}
Match: ${matchData ? `${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}` : order.match_code}
Compensation / handling amount: ${formatAmount(amount)} ${order.currency || DEFAULT_CURRENCY}

This amount has been recorded by Admin for manual handling. Contact @UEEx_JJ if you need help.`;

  let userNotified = true;
  try {
    await bot.telegram.sendMessage(order.telegram_id, message);
  } catch (notifyError) {
    userNotified = false;
    console.error("Failed to notify compensated user:", notifyError.message);
  }

  await notifyAdminGroup(`💳 Manual Compensation Recorded

Order ID: ${order.order_code}
Match ID: ${order.match_code}
UID: ${order.ueex_uid}
TG: ${getTelegramUserLabel(order)}
Amount: ${formatAmount(amount)} ${order.currency || DEFAULT_CURRENCY}
User Notified: ${userNotified ? "yes" : "no"}`, ctx);

  return ctx.reply(`✅ Compensation recorded for ${orderCode}: ${formatAmount(amount)} ${order.currency || DEFAULT_CURRENCY}. User notified: ${userNotified ? "yes" : "no"}`);
}

function buildPublicCancellationMessage(matchData, orders) {
  const lines = orders.map((order, index) => {
    return `${index + 1}. ${getPublicUserLabel(order, index)}
   Refund Amount: ${formatAmount(order.confirmed_amount || order.expected_amount)} ${order.currency || matchData.currency || DEFAULT_CURRENCY}`;
  });

  return `⚠️ Match Cancelled / Refund Notice

⚽️ ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
🔸 Match ID: ${matchData.match_code}
🔸 Reason: match postponed, cancelled, abandoned, or abnormal result handling

Refund List:
${lines.length ? lines.join("\n\n") : "No confirmed participants."}

Admin will manually review and arrange refunds.`;
}

function buildAdminCancellationMessage(matchData, orders) {
  const lines = orders.map((order, index) => {
    return `${index + 1}. ${getTelegramUserLabel(order)} / UID ${order.ueex_uid}
   Order ID: ${order.order_code}
   Selection: ${formatSelectionWithFlags(matchData, order.selection)}
   Refund Amount: ${formatAmount(order.confirmed_amount || order.expected_amount)} ${order.currency || matchData.currency || DEFAULT_CURRENCY}`;
  });

  return `⚠️ Match Cancelled

⚽️ ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
🔸 Match ID: ${matchData.match_code}

Refund List:
${lines.length ? lines.join("\n\n") : "No confirmed participants."}`;
}


async function getConfirmedOrderCount(matchCode) {
  const { count, error } = await supabase
    .from("wc_orders")
    .select("order_code", { count: "exact", head: true })
    .eq("match_code", matchCode)
    .eq("status", "confirmed");

  if (error) {
    throw new Error(`Failed to count confirmed orders: ${error.message}`);
  }

  return count || 0;
}

async function deletePublicLiveMatchMessage(matchData) {
  const chatId = matchData?.live_chat_id || matchData?.chat_id;
  const messageId = matchData?.live_message_id;

  if (!chatId || !messageId) {
    return "not found";
  }

  try {
    await bot.telegram.deleteMessage(chatId, messageId);
    return "deleted";
  } catch (error) {
    console.error(`Failed to delete no-bet live message ${matchData.match_code}:`, error.message);
    return `delete failed: ${error.message}`;
  }
}

async function updateMatchAsNoBet(matchCode) {
  const now = new Date().toISOString();
  const payload = {
    status: "no_bet",
    result: null,
    updated_at: now
  };

  const { error } = await supabase
    .from("wc_matches")
    .update(payload)
    .eq("match_code", matchCode);

  if (!error) {
    return { status: "no_bet", fallbackUsed: false };
  }

  console.error(`Failed to update ${matchCode} as no_bet, falling back to hidden:`, error.message);

  const { error: fallbackError } = await supabase
    .from("wc_matches")
    .update({ status: "hidden", result: null, updated_at: now })
    .eq("match_code", matchCode);

  if (fallbackError) {
    throw new Error(`Failed to close match as no-bet: ${fallbackError.message}`);
  }

  return { status: "hidden", fallbackUsed: true, originalError: error.message };
}

async function closeNoBetMatch(ctx, text) {
  if (!(await requireAdminControlChat(ctx))) return;

  const cleaned = cleanCommandText(text);
  const match = cleaned.match(/^\/no_bet_(WC[A-Z0-9]+)$/i);

  if (!match) {
    return ctx.reply("Invalid format. Example: /no_bet_WC0001");
  }

  const matchCode = match[1].toUpperCase();
  const matchData = await getMatch(matchCode);

  if (!matchData) {
    return ctx.reply("Match not found.");
  }

  if (!["open", "locked"].includes(String(matchData.status || "").toLowerCase())) {
    return ctx.reply(`This match cannot be closed as no-bet. Current status: ${matchData.status}`);
  }

  if (new Date(matchData.betting_end_at).getTime() > Date.now()) {
    return ctx.reply(`Voting is still open for this match. Close time: ${matchData.betting_end_at}`);
  }

  const voidedPendingCount = await autoVoidExpiredPendingOrders(matchData);
  const confirmedCount = await getConfirmedOrderCount(matchCode);

  if (confirmedCount > 0) {
    return ctx.reply(`This match has ${confirmedCount} confirmed order(s), so it cannot be closed as no-bet.

Please record and settle the result normally:
/result_${matchCode}_0:0
/preview_${matchCode}
/settle_${matchCode}`);
  }

  await supabase.from("wc_payouts").delete().eq("match_code", matchCode);
  await supabase.from("wc_settlements").delete().eq("match_code", matchCode);

  const statusResult = await updateMatchAsNoBet(matchCode);
  const publicMessageResult = await deletePublicLiveMatchMessage(matchData);

  return ctx.reply(`✅ Match closed as no-bet.

⚽️ Match: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
🔸 Match ID: ${matchCode}
🔸 Final Status: ${String(statusResult.status).toUpperCase()}
🔸 Confirmed Orders: 0
🔸 Pending Orders Auto-Voided: ${voidedPendingCount}
🔸 Public Result Announcement: not sent
🔸 Final Carryover Generated: 0 ${matchData.currency || DEFAULT_CURRENCY}
🔸 Public Match Card: ${publicMessageResult}

${statusResult.fallbackUsed ? `Note: database rejected status no_bet, so this match was hidden instead. Original error: ${statusResult.originalError}` : "This match will no longer appear in /need_result."}`);
}

async function cancelMatch(ctx, text) {
  if (!(await requireAdminControlChat(ctx))) return;

  const cleaned = cleanCommandText(text);
  const match = cleaned.match(/^\/cancel_(WC[A-Z0-9]+)$/i);

  if (!match) {
    return ctx.reply("Invalid format. Example: /cancel_WC0001");
  }

  const matchCode = match[1].toUpperCase();
  const matchData = await getMatch(matchCode);

  if (!matchData) {
    return ctx.reply("Match not found.");
  }

  const orders = await loadConfirmedOrders(matchCode);

  await supabase
    .from("wc_matches")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString()
    })
    .eq("match_code", matchCode);

  const publicMessage = buildPublicCancellationMessage(matchData, orders);
  const adminMessage = buildAdminCancellationMessage(matchData, orders);

  const publicNotifyResult = await notifyPublicWorldCupTopicLong(publicMessage, MATCH_CANCELLED_IMAGE_URL);
  await replyLongMessage(ctx, `${adminMessage}

Public Topic Notification: ${publicNotifyResult ? "sent" : "failed or not configured"}

Refunds should be handled manually after Admin/Finance review.`);

  for (const order of orders) {
    try {
      const userMessage = isZh(order.telegram_id)
        ? `⚠️ 赛事取消/退款通知

比赛：${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
订单 ID：${order.order_code}
退款金额：${formatAmount(order.confirmed_amount || order.expected_amount)} ${order.currency || matchData.currency || DEFAULT_CURRENCY}

Admin 将进行人工复核并安排退款。`
        : `⚠️ Match Cancelled / Refund Notice

Match: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
Order ID: ${order.order_code}
Refund Amount: ${formatAmount(order.confirmed_amount || order.expected_amount)} ${order.currency || matchData.currency || DEFAULT_CURRENCY}

Admin will manually review and arrange the refund.`;

      await sendOptionalPhoto(
        order.telegram_id,
        getLocalizedImageUrl(order.telegram_id, MATCH_CANCELLED_IMAGE_URL, MATCH_CANCELLED_IMAGE_URL_ZH),
        userMessage
      );
    } catch (error) {
      console.error(`Failed to notify cancelled match user ${order.telegram_id}:`, error.message);
    }
  }
}


function getStartPredictionUrl() {
  if (!BOT_USERNAME) return null;
  return `https://t.me/${BOT_USERNAME}?start=worldcup`;
}

function buildTopicRulesKeyboard() {
  const url = getStartPredictionUrl();

  if (!url) return undefined;

  return Markup.inlineKeyboard([
    [Markup.button.url("⚽ Start Prediction", url)]
  ]);
}

function buildPublicOrderConfirmedKeyboard() {
  const url = getStartPredictionUrl();

  if (!url) return undefined;

  return Markup.inlineKeyboard([
    [Markup.button.url("⚽ Start Prediction", url)]
  ]);
}

function buildTopicRulesMessage() {
  return `🏆 UEEx World Cup Prediction Event

Predict the exact score, join the match prize pool, and share rewards with other winners.

📌 How to Join
1. Tap “⚽ Start Prediction”.
2. Choose a match, result direction, exact score, and UE amount.
3. Transfer the exact amount shown by the bot.
4. The system confirms mainly by your bound UID + transfer amount.
5. Your prediction counts only after payment confirmation.

⚠️ Important
• Order ID is no longer required as the transfer remark. If you enter a remark, using the Order ID can help manual review.
• Minimum vote: Group/regular matches ${formatAmount(MIN_BET_AMOUNT)} UE; Round of 32 ${formatAmount(MIN_BET_AMOUNT_ROUND_32)} UE; Round of 16 ${formatAmount(MIN_BET_AMOUNT_ROUND_16)} UE; Quarter-finals ${formatAmount(MIN_BET_AMOUNT_QUARTER_FINAL)} UE; Semi-finals ${formatAmount(MIN_BET_AMOUNT_SEMI_FINAL)} UE; Final ${formatAmount(MIN_BET_AMOUNT_FINAL)} UE.
• Underpaid orders must be topped up.
• Overpaid orders count only the order amount; extra funds will be reviewed by Admin.
• Voting closes 15 minutes before kick-off.
• Scores use 90 mins + stoppage time only, excluding extra time/penalties.

🏆 Prize Pool
• Each match has its own prize pool.
• UEEx charges a 5% platform fee.
• Exact-score winners share the net prize pool by confirmed voting amount.
• No exact-score winners: net pool rolls over to the World Cup Final.
• Final winners share: Final net pool + carryover pool.
• Rewards will be distributed by 1pm (UTC+4) the next day.

For full rules, please check the bot menu.

Good luck and enjoy the World Cup with UEEx! ⚽️`;
}

async function sendTopicRules(ctx, shouldPin = true) {
  if (!(await requireAdmin(ctx))) return;

  if (!PUBLIC_GROUP_CHAT_ID) {
    return ctx.reply("PUBLIC_GROUP_CHAT_ID is not configured. Please add the official public group chat ID in Render Environment.");
  }

  if (!BOT_USERNAME) {
    return ctx.reply("BOT_USERNAME is not configured. Please add the bot username in Render Environment.");
  }

  const topicOptions = PUBLIC_WORLD_CUP_TOPIC_ID
    ? { message_thread_id: Number(PUBLIC_WORLD_CUP_TOPIC_ID) }
    : {};

  const keyboard = buildTopicRulesKeyboard();
  const text = buildTopicRulesMessage();

  let sentMessage;
  try {
    sentMessage = await sendOptionalPhoto(
      PUBLIC_GROUP_CHAT_ID,
      TOPIC_RULES_IMAGE_URL,
      text,
      keyboard,
      topicOptions
    );
  } catch (error) {
    console.error("Send topic rules error:", error);
    return ctx.reply(`Failed to send topic rules: ${error.message}`);
  }

  let pinStatus = "not requested";

  if (shouldPin) {
    try {
      await bot.telegram.pinChatMessage(PUBLIC_GROUP_CHAT_ID, sentMessage.message_id, {
        disable_notification: true
      });
      pinStatus = "pinned";
    } catch (error) {
      pinStatus = `pin failed: ${error.message}. Please pin the message manually in the World Cup topic.`;
      console.error("Pin topic rules error:", error.message);
    }
  }

  return ctx.reply(`✅ Topic rules sent as one photo message with caption.

Public group: ${PUBLIC_GROUP_CHAT_ID}
Topic ID: ${PUBLIC_WORLD_CUP_TOPIC_ID || "main chat"}
Message ID: ${sentMessage.message_id}
Pin status: ${pinStatus}`);
}

async function showAdminHelp(ctx) {
  const text = `⚽ UEEx World Cup Bot Commands

User:
/worldcup - View matches
/myvote - View my votes

Admin:
/worldcup_MEX_ZAF_7:7:51_0:0_5:5_Others_2026.06.11_23:00_UTC+4_Group - Create match and post it to World Cup topic
/confirm_O000123_1150 - Start manual confirmation, then reply with recharge order number / exchange_id
/cancel_confirm - Cancel pending manual confirmation flow
/mockpay_O000123_1150 - Mock auto payment test
/paycheck - Manually check pending payments from UEEx API
/paycheck_debug - Show payment API debug summary
/paycheck_raw - Test payment API raw records with type/item_id variants
/paycheck_sign_debug - Show safe signature debug info
/lock_WC0001 - Lock match
/hide_date_2026.06.19 - Hide all matches on a date
/show_date_2026.06.19 - Show hidden matches on a date
/hide_WC0001 - Hide a match
/show_WC0001 - Show a hidden match
/result_WC0001_0:0 - Record result
/preview_WC0001 - Generate settlement preview
/settle_WC0001 - Publish settlement
/pending - View latest pending orders in admin group/private
/pending_WC0001 - View pending orders for a match
/need_result - View matches whose voting is closed but result is not recorded
/need_result_2026.06.14 - View result-pending matches on a date
/no_bet_WC0001 - Close a voting-closed match with no confirmed orders, without publishing result or carryover
/send_topic_rules - Send official pinned activity rules to World Cup topic with Start Prediction button
/chatid - Check chat ID and topic ID
/ping - Test bot`;

  return ctx.reply(text);
}

function buildWelcomeMessage() {
  return `🏆 Welcome to UEEx World Cup Prediction

Predict match scores, vote with UE, and track your orders directly in this bot.

Use the menu below to continue.`;
}

bot.start(async (ctx) => {
  const text = getMessageText(ctx);
  const payload = text.split(/\s+/)[1] || "";

  if (payload.startsWith("vote_") || payload.startsWith("bet_")) {
    const matchCode = payload.replace(/^(vote_|bet_)/i, "").toUpperCase();

    if (!hasSelectedLanguage(ctx)) {
      return showLanguageSelection(ctx, matchCode);
    }

    if (!hasAcceptedRules(ctx)) {
      return showStartRules(ctx, matchCode);
    }

    return startPrivateBet(ctx, matchCode);
  }

  if (isPrivateChat(ctx)) {
    if (!hasSelectedLanguage(ctx)) {
      return showLanguageSelection(ctx);
    }

    if (!hasAcceptedRules(ctx)) {
      return showStartRules(ctx);
    }

    return showMatchDateSelection(ctx, false);
  }

  return ctx.reply("Please open private chat with the bot to join World Cup Prediction.");
});

bot.command("ping", async (ctx) => {
  await ctx.reply("pong");
});

bot.command("help", async (ctx) => {
  await showAdminHelp(ctx);
});

bot.command("send_topic_rules", async (ctx) => {
  try {
    await sendTopicRules(ctx, true);
  } catch (error) {
    console.error("Send topic rules command error:", error);
    await ctx.reply(`Error: ${error.message}`);
  }
});

bot.command("chatid", async (ctx) => {
  const topicId = ctx.message?.message_thread_id || ctx.update?.message?.message_thread_id || "";
  await ctx.reply(`Chat ID: ${ctx.chat.id}${topicId ? `\nTopic ID: ${topicId}` : ""}`);
});

bot.command("worldcup", async (ctx) => {
  try {
    await showWorldCupEntry(ctx);
  } catch (error) {
    console.error("Worldcup command error:", error);
    await ctx.reply(`Error: ${error.message}`);
  }
});

bot.command("pending", async (ctx) => {
  try {
    await showPendingOrders(ctx);
  } catch (error) {
    console.error("Pending command error:", error);
    await ctx.reply(`Error: ${error.message}`);
  }
});

bot.command("myvote", async (ctx) => {
  try {
    if (!isPrivateChat(ctx)) {
      const url = BOT_USERNAME ? `https://t.me/${BOT_USERNAME}` : null;
      const keyboard = url ? Markup.inlineKeyboard([[Markup.button.url("Open Bot", url)]]) : undefined;
      const msg = await ctx.reply("Please check your vote details in private chat with the bot.", keyboard);

      if (ctx.chat?.id && ctx.message?.message_id) {
        scheduleDeleteMessage(ctx.chat.id, ctx.message.message_id, 10000);
      }

      if (ctx.chat?.id && msg?.message_id) {
        scheduleDeleteMessage(ctx.chat.id, msg.message_id, 10000);
      }

      return;
    }

    await showMyVote(ctx);
  } catch (error) {
    console.error("Myvote error:", error);
    await ctx.reply(`Error: ${error.message}`);
  }
});

bot.command("winners", async (ctx) => {
  try {
    if (!isPrivateChat(ctx)) {
      const url = BOT_USERNAME ? `https://t.me/${BOT_USERNAME}` : null;
      const keyboard = url ? Markup.inlineKeyboard([[Markup.button.url("Open Bot", url)]]) : undefined;
      const msg = await ctx.reply("Please check winners in private chat with the bot.", keyboard);

      if (ctx.chat?.id && ctx.message?.message_id) {
        scheduleDeleteMessage(ctx.chat.id, ctx.message.message_id, 10000);
      }

      if (ctx.chat?.id && msg?.message_id) {
        scheduleDeleteMessage(ctx.chat.id, msg.message_id, 10000);
      }

      return;
    }

    await showRecentWinners(ctx);
  } catch (error) {
    console.error("Winners error:", error);
    await ctx.reply(`Error: ${error.message}`);
  }
});

bot.on("callback_query", async (ctx) => {
  try {
    const data = ctx.callbackQuery?.data || "";

    if (data.startsWith("wcmyvote:")) {
      if (!isPrivateChat(ctx)) {
        return ctx.answerCbQuery("Please use private chat with the bot.", { show_alert: true });
      }

      await ctx.answerCbQuery();
      return showMyVote(ctx, data.split(":")[1] || 1, true);
    }

    if (data.startsWith("wcwinners:")) {
      if (!isPrivateChat(ctx)) {
        return ctx.answerCbQuery("Please use private chat with the bot.", { show_alert: true });
      }

      await ctx.answerCbQuery();
      return showRecentWinners(ctx, data.split(":")[1] || 1, true);
    }


    if (data.startsWith("wclang:")) {
      if (!isPrivateChat(ctx)) {
        return ctx.answerCbQuery("Please use private chat with the bot.", { show_alert: true });
      }

      const lang = data.split(":")[1] === "zh" ? "zh" : "en";
      setUserLang(ctx, lang);
      acceptedRulesStore.delete(String(ctx.from.id));

      const session = getSession(ctx);
      const pendingMatchCode = session?.pendingMatchCode || "";
      clearSession(ctx);

      await ctx.answerCbQuery(lang === "zh" ? "已选择中文" : "English selected");

      try {
        await ctx.deleteMessage();
      } catch (error) {
        // Ignore delete failures.
      }

      return showStartRules(ctx, pendingMatchCode);
    }

    if (data === "wcrules:accept") {
      if (!isPrivateChat(ctx)) {
        return ctx.answerCbQuery("Please use private chat with the bot.", { show_alert: true });
      }

      markRulesAccepted(ctx);
      await ctx.answerCbQuery("Rules accepted.");

      const session = getSession(ctx);
      const pendingMatchCode = session?.pendingMatchCode || "";
      clearSession(ctx);

      try {
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
      } catch (error) {
        // Keep the rules message even if the inline keyboard cannot be edited.
      }

      await ctx.reply(isZh(ctx) ? "✅ 规则已确认。请使用下方菜单继续。" : "✅ Rules accepted. Use the menu below to continue.", getPrivateMainMenu(ctx));

      if (pendingMatchCode) {
        return startPrivateBet(ctx, pendingMatchCode);
      }

      return showMatchDateSelection(ctx, false);
    }

    if (data === "wcdates") {
      if (!isPrivateChat(ctx)) {
        return ctx.answerCbQuery("Please use private chat with the bot.", { show_alert: true });
      }

      if (!hasSelectedLanguage(ctx)) {
        await ctx.answerCbQuery();
        return showLanguageSelection(ctx);
      }

      if (!hasAcceptedRules(ctx)) {
        await ctx.answerCbQuery();
        return showStartRules(ctx);
      }

      await ctx.answerCbQuery();
      return showMatchDateSelection(ctx, true);
    }

    if (data === "wcgoto:matches") {
      if (!isPrivateChat(ctx)) {
        return ctx.answerCbQuery("Please use private chat with the bot.", { show_alert: true });
      }

      if (!hasSelectedLanguage(ctx)) {
        await ctx.answerCbQuery();
        return showLanguageSelection(ctx);
      }

      if (!hasAcceptedRules(ctx)) {
        await ctx.answerCbQuery();
        return showStartRules(ctx);
      }

      await ctx.answerCbQuery();
      return showMatchDateSelection(ctx, false);
    }

    if (data.startsWith("wcdate:")) {
      if (!isPrivateChat(ctx)) {
        return ctx.answerCbQuery("Please use private chat with the bot.", { show_alert: true });
      }

      const dateKey = decodeDateKey(data.replace(/^wcdate:/, ""));
      await ctx.answerCbQuery();
      return showMatchesForDate(ctx, dateKey, true);
    }

    if (data.startsWith("wcmatch:")) {
      const matchCode = data.split(":")[1];

      if (!isPrivateChat(ctx)) {
        const url = getBetNowUrl(matchCode);
        return ctx.answerCbQuery(
          url ? "Please tap Vote Now to open private chat with the bot." : "Please set BOT_USERNAME in Render to enable private voting.",
          { show_alert: true }
        );
      }

      await ctx.answerCbQuery();
      return showSelectedMatch(ctx, matchCode, true);
    }

    if (data.startsWith("wcoutcome:")) {
      if (!isPrivateChat(ctx)) {
        return ctx.answerCbQuery("Please vote in private chat with the bot.", { show_alert: true });
      }

      if (!hasSelectedLanguage(ctx)) {
        await ctx.answerCbQuery();
        return showLanguageSelection(ctx);
      }

      if (!hasAcceptedRules(ctx)) {
        await ctx.answerCbQuery();
        return showStartRules(ctx);
      }

      const [, matchCode, outcome] = data.split(":");
      await ctx.answerCbQuery();
      return showOutcomeScores(ctx, matchCode, outcome, true);
    }

    if (data.startsWith("wccancel:")) {
      const orderCode = data.split(":")[1];
      return cancelPendingOrder(ctx, orderCode);
    }

    if (data.startsWith("wcsel:")) {
      if (!isPrivateChat(ctx)) {
        return ctx.answerCbQuery("Please vote in private chat with the bot.", { show_alert: true });
      }

      if (!hasSelectedLanguage(ctx)) {
        await ctx.answerCbQuery();
        return showLanguageSelection(ctx);
      }

      if (!hasAcceptedRules(ctx)) {
        await ctx.answerCbQuery();
        return showStartRules(ctx);
      }

      const parts = data.split(":");
      const matchCode = parts[1];
      const selection = parts.slice(2).join(":");
      const match = await getMatch(matchCode);

      if (!match) {
        return ctx.answerCbQuery("Match not found.", { show_alert: true });
      }

      if (!isVotingOpen(match)) {
        return ctx.answerCbQuery("Voting for this match is already closed.", { show_alert: true });
      }

      const user = await getUserByTelegramId(ctx.from.id);

      if (!user) {
        await deleteStoredPrompt(ctx);
        await ctx.answerCbQuery();

        const prompt = await ctx.reply(
          isZh(ctx) ? `请先输入你的 UEEx UID。` : `Please enter your UEEx UID first.`,
          {
            reply_markup: {
              force_reply: true,
              selective: true
            }
          }
        );

        setSession(ctx, {
          step: "awaiting_uid",
          nextMatchCode: matchCode,
          nextSelection: selection,
          promptMessageId: prompt.message_id
        });

        return;
      }

      await deleteStoredPrompt(ctx);
      await ctx.answerCbQuery();

      const selectionPool = await getSelectionPool(matchCode, selection);
      const prompt = await ctx.reply(
        buildAmountPrompt(match, selection, selectionPool, "", ctx),
        {
          reply_markup: {
            force_reply: true,
            selective: true
          }
        }
      );

      setSession(ctx, {
        step: "awaiting_amount",
        matchCode,
        selection,
        promptMessageId: prompt.message_id
      });

      return;
    }
  } catch (error) {
    console.error("Callback query error:", error);

    try {
      await ctx.answerCbQuery("Error. Please try again.", { show_alert: true });
    } catch (answerError) {
      console.error("Answer callback error:", answerError);
    }
  }
});

bot.on("message", async (ctx) => {
  try {
    if (!ctx.from || ctx.from.is_bot) return;

    const text = getMessageText(ctx);
    if (!text) return;

    const cleaned = cleanCommandText(text);

    if (/^\/cancel_confirm$/i.test(cleaned)) {
      if (!(await requireAdminControlChat(ctx))) return;
      const session = getSession(ctx);
      if (session?.step === "awaiting_admin_confirm_recharge_id") {
        clearSession(ctx);
        return ctx.reply("Manual confirmation flow cancelled.");
      }
      return ctx.reply("No manual confirmation flow to cancel.");
    }

    if (/^\/worldcup_/i.test(cleaned)) {
      return createMatch(ctx, cleaned);
    }

    if (/^\/confirm_/i.test(cleaned)) {
      if (!(await requireAdminControlChat(ctx))) return;
      return confirmOrder(ctx, cleaned);
    }

    if (/^\/mockpay_/i.test(cleaned)) {
      if (!(await requireAdminControlChat(ctx))) return;
      return mockPayOrder(ctx, cleaned);
    }

    if (/^\/void_/i.test(cleaned)) {
      if (!(await requireAdminControlChat(ctx))) return;
      return voidOrder(ctx, cleaned);
    }

    if (/^\/lock_/i.test(cleaned)) {
      if (!(await requireAdminControlChat(ctx))) return;
      return lockMatch(ctx, cleaned);
    }

    if (/^\/hide_date_/i.test(cleaned)) {
      if (!(await requireAdminControlChat(ctx))) return;
      return hideDateMatches(ctx, cleaned);
    }

    if (/^\/show_date_/i.test(cleaned)) {
      if (!(await requireAdminControlChat(ctx))) return;
      return showDateMatches(ctx, cleaned);
    }

    if (/^\/hide_WC/i.test(cleaned)) {
      if (!(await requireAdminControlChat(ctx))) return;
      return hideSingleMatch(ctx, cleaned);
    }

    if (/^\/show_WC/i.test(cleaned)) {
      if (!(await requireAdminControlChat(ctx))) return;
      return showSingleMatch(ctx, cleaned);
    }

    if (/^\/result_/i.test(cleaned)) {
      if (!(await requireAdminControlChat(ctx))) return;
      return setMatchResult(ctx, cleaned);
    }

    if (/^\/preview_/i.test(cleaned)) {
      if (!(await requireAdminControlChat(ctx))) return;
      return previewSettlement(ctx, cleaned);
    }

    if (/^\/settle_/i.test(cleaned)) {
      if (!(await requireAdminControlChat(ctx))) return;
      return settleMatch(ctx, cleaned);
    }

    if (/^\/no_bet_/i.test(cleaned)) {
      if (!(await requireAdminControlChat(ctx))) return;
      return closeNoBetMatch(ctx, cleaned);
    }

    if (/^\/cancel_/i.test(cleaned)) {
      if (!(await requireAdminControlChat(ctx))) return;
      return cancelMatch(ctx, cleaned);
    }

    if (/^\/compensate_/i.test(cleaned)) {
      if (!(await requireAdminControlChat(ctx))) return;
      return compensateOrder(ctx, cleaned);
    }

    if (/^\/paycheck$/i.test(cleaned)) {
      return payCheckCommand(ctx);
    }

    if (/^\/paycheck_debug$/i.test(cleaned)) {
      return payCheckDebugCommand(ctx);
    }


    if (/^\/paycheck_raw$/i.test(cleaned)) {
      return payCheckRawCommand(ctx);
    }


    if (/^\/paycheck_sign_debug$/i.test(cleaned)) {
      return payCheckSignDebugCommand(ctx);
    }

    if (/^\/need_result(?:_(\d{4}\.\d{2}\.\d{2}))?$/i.test(cleaned)) {
      const needResultMatch = cleaned.match(/^\/need_result(?:_(\d{4}\.\d{2}\.\d{2}))?$/i);
      return showMatchesNeedingResult(ctx, needResultMatch?.[1] || "");
    }

    if (/^\/pending(?:_(WC[A-Z0-9]+))?$/i.test(cleaned)) {
      const pendingMatch = cleaned.match(/^\/pending(?:_(WC[A-Z0-9]+))?$/i);
      return showPendingOrders(ctx, pendingMatch?.[1] || null);
    }

    if (isPrivateChat(ctx) && /^\/language$/i.test(cleaned)) {
      return showLanguageSelection(ctx);
    }

    if (isPrivateChat(ctx) && ["⚽ Matches", "Matches", "matches", "🎮 Game", "Game", "game", "⚽ 比赛", "比赛"].includes(cleaned)) {
      clearSession(ctx);

      if (!hasSelectedLanguage(ctx)) {
        return showLanguageSelection(ctx);
      }

      if (!hasAcceptedRules(ctx)) {
        return showStartRules(ctx);
      }

      return showMatchDateSelection(ctx);
    }

    if (isPrivateChat(ctx) && ["📜 Rules", "Rules", "rules", "Rule", "rule", "📜 规则", "规则"].includes(cleaned)) {
      clearSession(ctx);

      if (!hasSelectedLanguage(ctx)) {
        return showLanguageSelection(ctx);
      }

      if (!hasAcceptedRules(ctx)) {
        return showStartRules(ctx);
      }

      return showRules(ctx);
    }

    if (isPrivateChat(ctx) && ["🎮 How to Play", "How to Play", "how to play", "玩法", "🎮 玩法"].includes(cleaned)) {
      clearSession(ctx);

      if (!hasSelectedLanguage(ctx)) {
        return showLanguageSelection(ctx);
      }

      if (!hasAcceptedRules(ctx)) {
        return showStartRules(ctx);
      }

      return showHowToPlay(ctx);
    }

    if (isPrivateChat(ctx) && ["📣 Announcement", "Announcement", "announcement", "📣 Announcement Topic", "Announcement Topic", "announcement topic", "Broadcast", "broadcast", "📣 播报群", "播报群"].includes(cleaned)) {
      clearSession(ctx);

      if (!hasSelectedLanguage(ctx)) {
        return showLanguageSelection(ctx);
      }

      if (!hasAcceptedRules(ctx)) {
        return showStartRules(ctx);
      }

      return showBroadcastTopic(ctx);
    }

    if (isPrivateChat(ctx) && ["🛟 Support", "Support", "support", "Help", "help", "🛟 客服", "客服"].includes(cleaned)) {
      clearSession(ctx);

      if (!hasSelectedLanguage(ctx)) {
        return showLanguageSelection(ctx);
      }

      if (!hasAcceptedRules(ctx)) {
        return showStartRules(ctx);
      }

      return showSupport(ctx);
    }

    if (isPrivateChat(ctx) && ["📊 My Vote", "My Vote", "my vote", "My Votes", "my votes", "📊 我的投票", "我的投票"].includes(cleaned)) {
      clearSession(ctx);

      if (!hasSelectedLanguage(ctx)) {
        return showLanguageSelection(ctx);
      }

      if (!hasAcceptedRules(ctx)) {
        return showStartRules(ctx);
      }

      return showMyVote(ctx);
    }

    if (isPrivateChat(ctx) && ["🏆 Winners", "Winners", "winners", "Recent Winners", "recent winners", "🏆 历史赢家", "历史赢家"].includes(cleaned)) {
      clearSession(ctx);

      if (!hasSelectedLanguage(ctx)) {
        return showLanguageSelection(ctx);
      }

      if (!hasAcceptedRules(ctx)) {
        return showStartRules(ctx);
      }

      return showRecentWinners(ctx);
    }


    if (cleaned.startsWith("/")) return;

    const session = getSession(ctx);

    if (!session) return;

    if (session.step === "awaiting_admin_confirm_recharge_id") {
      return handleAdminConfirmRechargeId(ctx, session, text);
    }

    if (session.step === "awaiting_uid") {
      const uid = String(text || "").trim();

      if (!isValidUid(uid)) {
        return ctx.reply("UID format error. Please enter a valid UEEx UID.");
      }

      await upsertUser(ctx, uid);

      if (session.nextMatchCode && session.nextSelection) {
        const match = await getMatch(session.nextMatchCode);

        const selectionPool = await getSelectionPool(session.nextMatchCode, session.nextSelection);
        const prompt = await ctx.reply(
          buildAmountPrompt(match, session.nextSelection, selectionPool, isZh(ctx) ? `✅ UID 已确认：${uid}` : `✅ UID confirmed: ${uid}`, ctx),
          {
            reply_markup: {
              force_reply: true,
              selective: true
            }
          }
        );

        setSession(ctx, {
          step: "awaiting_amount",
          matchCode: session.nextMatchCode,
          selection: session.nextSelection,
          promptMessageId: prompt.message_id
        });

        return;
      }

      if (session.nextMatchCode) {
        const nextMatchCode = session.nextMatchCode;
        clearSession(ctx);
        await ctx.reply(isZh(ctx) ? `✅ UID 已确认：${uid}` : `✅ UID confirmed: ${uid}`, getPrivateMainMenu(ctx));
        return showSelectedMatch(ctx, nextMatchCode);
      }

      clearSession(ctx);
      await ctx.reply(isZh(ctx) ? `✅ UID 已确认：${uid}` : `✅ UID confirmed: ${uid}`, getPrivateMainMenu(ctx));
      return showMatchDateSelection(ctx);
    }

    if (session.step === "awaiting_amount") {
      return handleAmountInput(ctx, text, session);
    }
  } catch (error) {
    console.error("Message handler error:", error);

    try {
      await ctx.reply(`Error: ${error.message}`);
    } catch (replyError) {
      console.error("Failed to reply error:", replyError);
    }
  }
});

app.post("/telegram", async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(500);
  }
});

app.get("/", (req, res) => {
  res.send("UEEx World Cup Bot is running.");
});

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);

  try {
    const botInfo = await bot.telegram.getMe();
    console.log(`Bot username: @${botInfo.username}`);

    if (WEBHOOK_URL) {
      const webhookUrl = `${WEBHOOK_URL.replace(/\/$/, "")}/telegram`;

      await bot.telegram.setWebhook(webhookUrl, {
        allowed_updates: ["message", "callback_query"]
      });

      console.log(`Webhook set to ${webhookUrl}`);
    } else {
      console.log("WEBHOOK_URL is not set. Webhook was not configured.");
    }

    startLiveMatchUpdater();
    startAutoPaymentChecker();
    console.log(`Live match updater interval: ${LIVE_UPDATE_INTERVAL_MS} ms`);
    console.log(`Auto confirmation enabled: ${AUTO_CONFIRM_ENABLED ? "ON" : "OFF"}; interval: ${PAYMENT_CHECK_INTERVAL_MS} ms; item_id: ${UEEX_PAYMENT_ITEM_ID}; payment_type: ${UEEX_PAYMENT_TYPE}; receiver_uid: ${UEEX_RECEIVER_UID}; uid_match_mode: ${UEEX_UID_MATCH_MODE}; internal_exchange_type: ${UEEX_INTERNAL_EXCHANGE_TYPE}; success_status: ${UEEX_SUCCESS_STATUS}; api_base: ${UEEX_API_BASE_URL || "not set"}; path: ${UEEX_API_DEPOSIT_LIST_PATH}`);
  } catch (error) {
    console.error("Startup error:", error);
  }
});
