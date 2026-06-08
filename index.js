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
const RECEIVER_UID = process.env.RECEIVER_UID || "1234567";
const TRANSFER_ADDRESS = process.env.TRANSFER_ADDRESS || process.env.UEEX_TRANSFER_ADDRESS || "0x54ff9bbc6fdd9579acf54dd59adcb0689c901035";
const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || "UE";
const PLATFORM_FEE_BPS = Number(process.env.PLATFORM_FEE_BPS || 500);
const MAX_OPEN_MATCHES_SHOWN = Number(process.env.MAX_OPEN_MATCHES_SHOWN || 500);
const LIVE_UPDATE_INTERVAL_MS = Number(process.env.LIVE_UPDATE_INTERVAL_MS || 30000);
const MIN_BET_AMOUNT = new Decimal(process.env.MIN_BET_AMOUNT || 1000);
const BOT_USERNAME = (process.env.BOT_USERNAME || "").replace(/^@/, "");
const AUTO_CONFIRM_ENABLED = String(process.env.AUTO_CONFIRM_ENABLED || "false").toLowerCase() === "true";
const PAYMENT_CHECK_INTERVAL_MS = Number(process.env.PAYMENT_CHECK_INTERVAL_MS || 30000);
const UEEX_PAYMENT_ITEM_ID = Number(process.env.UEEX_PAYMENT_ITEM_ID || 1304);
const UEEX_PAYMENT_TYPE = Number(process.env.UEEX_PAYMENT_TYPE || 1);
const UEEX_RECEIVER_UID = process.env.UEEX_RECEIVER_UID || RECEIVER_UID;
const UEEX_INTERNAL_EXCHANGE_TYPE = Number(process.env.UEEX_INTERNAL_EXCHANGE_TYPE || 1);
const UEEX_SUCCESS_STATUS = process.env.UEEX_SUCCESS_STATUS || "success";
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
const PENDING_ORDER_IMAGE_URL = process.env.PENDING_ORDER_IMAGE_URL || "";
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
const ORDER_CANCELLED_IMAGE_URL_ZH = process.env.ORDER_CANCELLED_IMAGE_URL_ZH || "https://i.ibb.co/Vpj2PBwP/Chat-GPT-Image-Jun-8-2026-02-43-59-PM-1.png";
const PENDING_ORDER_IMAGE_URL_ZH = process.env.PENDING_ORDER_IMAGE_URL_ZH || "https://i.ibb.co/hxVVJJRt/Chat-GPT-Image-Jun-8-2026-02-43-59-PM-3.png";
const ORDER_CONFIRMED_IMAGE_URL_ZH = process.env.ORDER_CONFIRMED_IMAGE_URL_ZH || "https://i.ibb.co/7xnyz5x1/Chat-GPT-Image-Jun-8-2026-02-43-59-PM-4.png";
const LOSER_IMAGE_URL_ZH = process.env.LOSER_IMAGE_URL_ZH || "https://i.ibb.co/9Hf2VkrT/Chat-GPT-Image-Jun-8-2026-02-43-59-PM-5.png";
const WINNER_IMAGE_URL_ZH = process.env.WINNER_IMAGE_URL_ZH || "https://i.ibb.co/4RLw4LrR/Chat-GPT-Image-Jun-8-2026-02-43-59-PM-6.png";
const MATCH_SETTLED_IMAGE_URL_ZH = process.env.MATCH_SETTLED_IMAGE_URL_ZH || "https://i.ibb.co/VpJ27nxw/Chat-GPT-Image-Jun-8-2026-02-43-59-PM-7.png";
const RULES_IMAGE_URL_ZH = process.env.RULES_IMAGE_URL_ZH || "https://i.ibb.co/qMjDRwgH/Chat-GPT-Image-Jun-8-2026-02-43-59-PM-8.png";
const SUPPORT_IMAGE_URL_ZH = process.env.SUPPORT_IMAGE_URL_ZH || "https://i.ibb.co/spJjGyg8/Chat-GPT-Image-Jun-8-2026-02-43-59-PM-9.png";
const MYVOTE_IMAGE_URL_ZH = process.env.MYVOTE_IMAGE_URL_ZH || "https://i.ibb.co/mrQJkKqy/Chat-GPT-Image-Jun-8-2026-02-43-59-PM-10.png";
const TELEGRAM_CAPTION_SAFE_LIMIT = 900;
const ADMIN_GROUP_CHAT_ID = process.env.ADMIN_GROUP_CHAT_ID || "";
const PUBLIC_GROUP_CHAT_ID = process.env.PUBLIC_GROUP_CHAT_ID || process.env.PUBLIC_CHAT_ID || "";
const PUBLIC_WORLD_CUP_TOPIC_ID = process.env.PUBLIC_WORLD_CUP_TOPIC_ID || process.env.WORLD_CUP_TOPIC_ID || "";

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

function formatSelectionWithFlags(match, selection) {
  const raw = String(selection || "").trim();
  const upper = raw.toUpperCase();
  const teamAFlag = getTeamFlag(match.team_a);
  const teamBFlag = getTeamFlag(match.team_b);

  if (upper === "A_OTHER") {
    return `${teamAFlag} Other ${match.team_a} Win ${teamBFlag}`;
  }

  if (upper === "DRAW_OTHER") {
    return `${teamAFlag} Other Draw ${teamBFlag}`;
  }

  if (upper === "B_OTHER") {
    return `${teamAFlag} Other ${match.team_b} Win ${teamBFlag}`;
  }

  const score = parseScoreValue(raw);
  if (score) {
    return `${teamAFlag} ${score.text} ${teamBFlag}`;
  }

  return `${teamAFlag} ${labelForSelection(match, selection)} ${teamBFlag}`;
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

function isBettingOpen(match) {
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

function labelForSelection(match, selection) {
  const raw = String(selection || "").trim();
  const upper = raw.toUpperCase();

  if (upper === "A") return `${match.team_a} Win`;
  if (upper === "B") return `${match.team_b} Win`;
  if (upper === "DRAW") return "Draw";
  if (upper === "A_OTHER") return `Other ${match.team_a} Win`;
  if (upper === "DRAW_OTHER") return "Other Draw";
  if (upper === "B_OTHER") return `Other ${match.team_b} Win`;

  return raw || "Unknown";
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

function getOutcomeLabel(match, outcome) {
  if (outcome === "A") return `${formatTeamWithFlag(match.team_a)} Win`;
  if (outcome === "B") return `${formatTeamWithFlag(match.team_b)} Win`;
  return "Draw";
}

function getOutcomeCallbackLabel(match, outcome, totals = null) {
  const label = getOutcomeLabel(match, outcome);

  if (!totals) return label;

  return `${label} | ${formatAmount(getOutcomeTotal(match, totals, outcome))} ${match.currency}`;
}

function formatSelectionButtonLabel(match, option) {
  return formatSelectionWithFlags(match, option);
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
  return `https://t.me/${BOT_USERNAME}?start=bet_${matchCode}`;
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
            [{ text: "📜 规则" }, { text: "🛟 客服" }]
          ]
        : [
            [{ text: "⚽ Matches" }, { text: "📊 My Vote" }],
            [{ text: "📜 Rules" }, { text: "🛟 Support" }]
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

function getSupportKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.url("Contact @UEEx_JJ", "https://t.me/UEEx_JJ")]
  ]);
}

function getPrivateMatchesInlineKeyboard(ctxOrLang = null) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(isZh(ctxOrLang) ? "⚽ 比赛" : "⚽ Matches", "wcgoto:matches")]
  ]);
}

function getRulesAcceptKeyboard(ctxOrLang = null) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(isZh(ctxOrLang) ? "✅ 我已了解" : "✅ I Understand", "wcrules:accept")]
  ]);
}

function getOrderCancelledKeyboard(ctxOrLang = null) {
  return Markup.inlineKeyboard([
    [Markup.button.url(isZh(ctxOrLang) ? "🛟 客服" : "🛟 Support", "https://t.me/UEEx_JJ")],
    [Markup.button.callback(isZh(ctxOrLang) ? "⚽ 比赛" : "⚽ Matches", "wcgoto:matches")]
  ]);
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
  if (isZh(ctxOrLang)) {
    return `1. 点击“比赛”，选择比赛日期、比赛、预测方向、准确比分和 UE 投票金额。
2. 最低投票金额：${formatAmount(MIN_BET_AMOUNT)} UE。
3. 创建待支付订单后，请将对应 UE 金额转账至 BSC 地址：${TRANSFER_ADDRESS}。
4. 转账备注必须填写订单 ID。订单仅在付款确认后计入。
5. 如果转账金额、备注或其他信息不正确，订单可能无法自动确认。
6. 比赛结果录入后，猜中用户将按已确认投票金额比例瓜分净奖池。
7. 平台手续费：${formatAmount(new Decimal(PLATFORM_FEE_BPS).div(100))}%。
8. UEEx 保留对异常行为、无效付款及最终奖励资格进行审核的权利。`;
  }

  return `1. Tap Matches and select a match day, match, prediction type, exact score, and UE voting amount.
2. Minimum voting amount: ${formatAmount(MIN_BET_AMOUNT)} UE.
3. After creating a pending order, transfer the exact UE amount to the BSC address ${TRANSFER_ADDRESS}.
4. Use your Order ID as the transfer remark. Orders are counted only after payment confirmation.
5. If your transfer amount, remark, or other information is incorrect, your vote may not be confirmed automatically.
6. After the match result is recorded, winning users share the net pool according to their confirmed voting amount.
7. Platform fee: ${formatAmount(new Decimal(PLATFORM_FEE_BPS).div(100))}%.
8. UEEx reserves the right to review abnormal activity, invalid payments, and final reward eligibility.`;
}

async function showRules(ctx) {
  if (isPrivateChat(ctx)) {
    await deleteLastPrivateMenuMessage(ctx, "rules");
  }

  const sent = await replyWithOptionalPhoto(ctx, getLocalizedImageUrl(ctx, RULES_IMAGE_URL, RULES_IMAGE_URL_ZH), buildRulesMessage(ctx), getPrivateMainMenu(ctx));
  return rememberPrivateMenuMessage(ctx, sent, "rules");
}


async function showSupport(ctx) {
  if (isPrivateChat(ctx)) {
    await deleteLastPrivateMenuMessage(ctx, "support");
  }

  const sent = await replyWithOptionalPhoto(
    ctx,
    getLocalizedImageUrl(ctx, SUPPORT_IMAGE_URL, SUPPORT_IMAGE_URL_ZH),
    isZh(ctx) ? "如需帮助，请联系 @UEEx_JJ。" : "🛟 Need help? Contact @UEEx_JJ for support.",
    getPrivateMainMenu(ctx)
  );
  return rememberPrivateMenuMessage(ctx, sent, "support");
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

function buildOutcomeKeyboard(match, totals) {
  const dateKey = getMatchDateKey(match);

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(getOutcomeCallbackLabel(match, "A"), `wcoutcome:${match.match_code}:A`),
      Markup.button.callback("Draw", `wcoutcome:${match.match_code}:DRAW`),
      Markup.button.callback(getOutcomeCallbackLabel(match, "B"), `wcoutcome:${match.match_code}:B`)
    ],
    [Markup.button.callback("Back", `wcdate:${encodeDateKey(dateKey)}`)]
  ]);
}

function buildScoreKeyboard(match, outcome) {
  const options = getOptionsByOutcome(match, outcome);
  const buttons = options.map((option) =>
    Markup.button.callback(
      formatSelectionButtonLabel(match, option),
      `wcsel:${match.match_code}:${option}`
    )
  );

  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  rows.push([Markup.button.callback("Back", `wcmatch:${match.match_code}`)]);

  return Markup.inlineKeyboard(rows);
}

function getMatchMetaLines(match) {
  const lines = [];

  if (match.match_date) {
    lines.push(`🔸 Match Date: ${match.match_date}`);
  }

  if (match.match_time || match.match_timezone) {
    const timeText = [match.match_time, match.match_timezone].filter(Boolean).join(" ");
    if (timeText) lines.push(`🔸 Match Time: ${timeText}`);
  }

  if (match.match_stage) {
    lines.push(`🔸 Stage: ${match.match_stage}`);
  }

  return lines.length ? `${lines.join("\n")}\n` : "";
}

function buildScoreMessage(match, totals, outcome) {
  const totalPool = getTotalPool(totals);
  const outcomePool = getOutcomeTotal(match, totals, outcome);
  const statusText = isBettingOpen(match) ? "Open" : match.status === "open" ? "Closed" : match.status.toUpperCase();

  return `🔸 Match ID: ${match.match_code}
🔸 Match: ${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}
${getMatchMetaLines(match)}🔸 Status: ${statusText}
🔸 Betting Time Left: ${formatTimeLeft(match.betting_end_at)}

📍 Selection Type: ${getOutcomeLabel(match, outcome)}
📍 Selection Pool: ${formatAmount(outcomePool)} ${match.currency}

🎉Total Pool: ${formatAmount(totalPool)} ${match.currency}

Please select the exact score below.`;
}

function buildMatchMessage(match, totals) {
  const totalPool = getTotalPool(totals);
  const statusText = isBettingOpen(match) ? "Open" : match.status === "open" ? "Closed" : match.status.toUpperCase();

  return `🔸 Match ID: ${match.match_code}
🔸 Match: ${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}
${getMatchMetaLines(match)}🔸 Status: ${statusText}
🔸 Betting Time Left: ${formatTimeLeft(match.betting_end_at)}

🎉Total Pool: ${formatAmount(totalPool)} ${match.currency}`;
}

function buildPublicMatchMessage(match, totals) {
  return `${buildMatchMessage(match, totals)}

📌 Rules:
• Tap Vote Now to enter the bot and submit your prediction.
• Minimum voting amount: ${formatAmount(MIN_BET_AMOUNT)} ${match.currency}.
• Transfer the exact ${match.currency} amount to the BSC address ${TRANSFER_ADDRESS}.
• Use your Order ID as the transfer remark.
• Votes are counted only after payment confirmation.`;
}

function buildPhotoExtra(caption, keyboard = null, extraOptions = {}) {
  const extra = { caption, ...extraOptions };

  if (keyboard?.reply_markup) {
    extra.reply_markup = keyboard.reply_markup;
  }

  return extra;
}

async function replyWithOptionalPhoto(ctx, imageUrl, text, keyboard = null, extraOptions = {}) {
  const safeText = String(text || "");

  if (imageUrl && safeText.length <= TELEGRAM_CAPTION_SAFE_LIMIT) {
    return ctx.replyWithPhoto(imageUrl, buildPhotoExtra(safeText, keyboard, extraOptions));
  }

  if (imageUrl) {
    const photoExtra = { ...extraOptions };
    if (keyboard?.reply_markup) {
      photoExtra.reply_markup = keyboard.reply_markup;
    }

    await ctx.replyWithPhoto(imageUrl, photoExtra);
  }

  const options = { ...extraOptions };
  if (keyboard?.reply_markup) {
    options.reply_markup = keyboard.reply_markup;
  }

  return ctx.reply(safeText, options);
}

async function sendOptionalPhoto(chatId, imageUrl, text, keyboard = null, extraOptions = {}) {
  const safeText = String(text || "");

  if (imageUrl && safeText.length <= TELEGRAM_CAPTION_SAFE_LIMIT) {
    return bot.telegram.sendPhoto(chatId, imageUrl, buildPhotoExtra(safeText, keyboard, extraOptions));
  }

  if (imageUrl) {
    const photoExtra = { ...extraOptions };
    if (keyboard?.reply_markup) {
      photoExtra.reply_markup = keyboard.reply_markup;
    }

    await bot.telegram.sendPhoto(chatId, imageUrl, photoExtra);
  }

  const options = { ...extraOptions };
  if (keyboard?.reply_markup) {
    options.reply_markup = keyboard.reply_markup;
  }

  return bot.telegram.sendMessage(chatId, safeText, options);
}
async function notifyPublicWorldCupTopic(text, imageUrl = "") {
  if (!PUBLIC_GROUP_CHAT_ID) return null;

  const topicOptions = PUBLIC_WORLD_CUP_TOPIC_ID
    ? { message_thread_id: Number(PUBLIC_WORLD_CUP_TOPIC_ID) }
    : {};

  try {
    return await sendOptionalPhoto(PUBLIC_GROUP_CHAT_ID, imageUrl, text, null, topicOptions);
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

function normalizeApiRecord(record) {
  const remark = pickField(record, UEEX_FIELD_REMARK, ["remark", "memo", "note", "transfer_remark", "chain_tag"]);
  const amount = pickField(record, UEEX_FIELD_AMOUNT, ["num", "amount", "quantity", "value", "money", "volume"]);
  const status = pickField(record, UEEX_FIELD_STATUS, ["status", "state", "audit_status"]);
  const itemId = pickField(record, UEEX_FIELD_ITEM_ID, ["item_id", "itemId", "coin_id", "asset_id", "currency_id"]);
  const exchangeType = pickField(record, UEEX_FIELD_EXCHANGE_TYPE, ["exchange_type", "exchangeType", "transfer_type", "address_type"]);
  const exchangeId = pickField(record, UEEX_FIELD_EXCHANGE_ID, ["exchange_id", "exchangeId", "id", "record_id", "order_id", "tx_id", "txid", "hash"]);
  const fromUid = pickField(record, UEEX_FIELD_FROM_UID, ["from_uid", "from_user_id", "from_userid", "sender_uid", "sender_user_id", "client_user_id", "clientUserId", "user_id"]);
  const toUid = pickField(record, UEEX_FIELD_TO_UID, ["to_uid", "to_user_id", "to_userid", "receiver_uid", "receive_uid", "target_uid", "target_user_id", "collection_uid", "counterparty_uid", "counterparty_user_id", "opposite_uid", "opposite_user_id", "other_uid", "other_user_id", "peer_uid", "peer_user_id"]);
  const accountUid = pickField(record, UEEX_FIELD_ACCOUNT_UID, ["account_uid", "account_user_id", "client_user_id", "clientUserId", "user_uid", "uid", "user_id"]);
  const counterpartyUid = pickField(record, UEEX_FIELD_COUNTERPARTY_UID, ["counterparty_uid", "counterparty_user_id", "opposite_uid", "opposite_user_id", "other_uid", "other_user_id", "peer_uid", "peer_user_id", "target_uid", "target_user_id", "to_uid", "to_user_id"]);
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

function paymentRecordMatchesOrder(record, order) {
  if (!record) return { ok: false, reason: "Record missing" };
  if (record.remark !== order.order_code) return { ok: false, reason: "Remark does not match order ID" };
  if (!decimalEquals(record.amount, order.expected_amount)) return { ok: false, reason: "Amount does not match order amount" };

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
    const matchingRecords = records.filter((record) => record.remark === order.order_code);

    if (!matchingRecords.length) continue;

    for (const record of matchingRecords) {
      const matchResult = paymentRecordMatchesOrder(record, order);

      if (!matchResult.ok) {
        await supabase
          .from("wc_orders")
          .update({
            payment_checked_at: new Date().toISOString(),
            auto_confirm_error: matchResult.reason,
            updated_at: new Date().toISOString()
          })
          .eq("order_code", order.order_code);
        errors.push(`${order.order_code}: ${matchResult.reason}`);
        continue;
      }

      const used = await isPaymentRecordAlreadyUsed(record.exchangeId);
      if (used) {
        errors.push(`${order.order_code}: payment record already used`);
        continue;
      }

      record.paymentFromUid = order.ueex_uid;
      record.paymentToUid = UEEX_RECEIVER_UID;
      await savePaymentRecord(record, order.order_code);
      await confirmOrderByCode(ctx, order.order_code, new Decimal(record.amount), {
        autoConfirmed: true,
        paymentRecord: record
      });
      confirmed += 1;
      break;
    }
  }

  const message = `Payment check completed. Pending checked: ${pendingOrders.length}. Records fetched: ${records.length}. Auto confirmed: ${confirmed}.${errors.length ? `\n\nSkipped:\n${errors.slice(0, 10).join("\n")}` : ""}`;

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
      auto_confirm_error: "Auto-voided after betting time ended",
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

This pending order was automatically voided because betting time ended before payment confirmation.`
      );
    } catch (error) {
      console.error(`Failed to notify auto-voided order ${order.order_code}:`, error.message);
    }
  }

  await notifyAdminGroup(`⏰ Auto-voided ${orders.length} pending order(s) after betting time ended.

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
      "Invalid format.\nExample:\n/worldcup_NED_JPN_0:0_5:5_Others_2026.06.15_00:00_UTC+4_Group-F\n\nFormat:\n/worldcup_Team1_Team2_MinScore_MaxScore_Others_Date_Time_Timezone_Stage\n\nBetting automatically closes 15 minutes before match time."
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
  const bettingEndAt = new Date(matchStartAt.getTime() - 15 * 60 * 1000);

  if (bettingEndAt.getTime() <= now.getTime()) {
    return ctx.reply("Invalid match time. Betting closes 15 minutes before the match, so the betting close time must be in the future.");
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
    betting_end_at: bettingEndAt.toISOString(),
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
Betting closes: 15 minutes before match time
Betting Time Left: ${formatTimeLeft(data.betting_end_at)}`);
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

  const matches = sortMatchesBySchedule((await getAllOpenMatches()).filter(isBettingOpen));

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

  const sent = await replyWithOptionalPhoto(ctx, WORLDCUP_IMAGE_URL, text, keyboard);
  return rememberPrivateMenuMessage(ctx, sent, "matches");
}


async function showMatchesForDate(ctx, dateKey, edit = false) {
  const matches = sortMatchesBySchedule(
    (await getAllOpenMatches()).filter((match) => isBettingOpen(match) && getMatchDateKey(match) === dateKey)
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

  return replyWithOptionalPhoto(ctx, WORLDCUP_IMAGE_URL, text, keyboard);
}

async function startPrivateBet(ctx, matchCode) {
  if (!isPrivateChat(ctx)) {
    return ctx.reply("Please open private chat with the bot to vote.");
  }

  const match = await getMatch(matchCode);

  if (!match) {
    return ctx.reply("Match not found.");
  }

  if (!isBettingOpen(match)) {
    return ctx.reply(isZh(ctx) ? "该比赛已停止下注。" : "Betting for this match is already closed.");
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
  const message = buildMatchMessage(match, totals);
  const keyboard = buildOutcomeKeyboard(match, totals);

  if (edit) {
    return editCallbackMessage(ctx, message, keyboard);
  }

  return replyWithOptionalPhoto(ctx, WORLDCUP_IMAGE_URL, message, keyboard);
}

async function showOutcomeScores(ctx, matchCode, outcome, edit = false) {
  const match = await getMatch(matchCode);

  if (!match) {
    return ctx.answerCbQuery ? ctx.answerCbQuery("Match not found.") : ctx.reply("Match not found.");
  }

  const totals = await getMatchTotals(matchCode, match);
  const message = buildScoreMessage(match, totals, outcome);
  const keyboard = buildScoreKeyboard(match, outcome);

  if (edit) {
    return editCallbackMessage(ctx, message, keyboard);
  }

  return replyWithOptionalPhoto(ctx, WORLDCUP_IMAGE_URL, message, keyboard);
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

function buildAmountPrompt(match, selection, pool, prefix = "") {
  const intro = prefix ? `${prefix}

` : "";

  return `${intro}🔸 Selection: ${formatSelectionWithFlags(match, selection)}
🔸 Pool: ${formatAmount(pool)} ${match.currency}

Please enter your UE voting amount. Minimum: ${formatAmount(MIN_BET_AMOUNT)} ${match.currency}`;
}
async function handleAmountInput(ctx, text, session) {
  const amount = parsePositiveAmount(text);

  if (!amount) {
    return ctx.reply(isZh(ctx) ? "金额格式错误。请输入有效的 UE 金额，例如：1,000 或 1,150.5" : "Invalid amount. Please enter a positive UE amount, for example: 1,000 or 1,150.5", getPrivateMainMenu(ctx));
  }

  if (amount.lt(MIN_BET_AMOUNT)) {
    return ctx.reply(isZh(ctx) ? `最低投票金额为 ${formatAmount(MIN_BET_AMOUNT)} UE。` : `Minimum voting amount is ${formatAmount(MIN_BET_AMOUNT)} UE.`, getPrivateMainMenu(ctx));
  }

  const match = await getMatch(session.matchCode);

  if (!match) {
    clearSession(ctx);
    return ctx.reply(isZh(ctx) ? "未找到比赛，请重新开始。" : "Match not found. Please start again with /worldcup.");
  }

  if (!isBettingOpen(match)) {
    clearSession(ctx);
    return ctx.reply(isZh(ctx) ? "该比赛已停止下注。" : "Betting for this match is already closed.");
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
🔸 选择：${escapeHtml(formatSelectionWithFlags(match, data.selection))}
🔸 金额：${formatAmount(amount)} ${match.currency}

❗️请转账 ${formatAmount(amount)} ${match.currency} 到以下 BSC 地址：\n<code>${escapeHtml(TRANSFER_ADDRESS)}</code>
❗️转账备注：<code>${escapeHtml(data.order_code)}</code>
❗️你的投票将在付款确认后计入。`
    : `⚽️ Match: ${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}

🔸 Match ID: ${match.match_code}
🔸 Order ID: <code>${escapeHtml(data.order_code)}</code>
🔸 UID: <code>${escapeHtml(data.ueex_uid)}</code>
🔸 TG: ${escapeHtml(getTelegramUserLabel(data))}
🔸 Selection: ${escapeHtml(formatSelectionWithFlags(match, data.selection))}
🔸 Amount: ${formatAmount(amount)} ${match.currency}

❗️Please transfer ${formatAmount(amount)} ${match.currency} to the BSC address below:\n<code>${escapeHtml(TRANSFER_ADDRESS)}</code>.
❗️Transfer Remark: <code>${escapeHtml(data.order_code)}</code>
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
🔸 Remark: ${data.order_code}

Confirm:
/confirm_${data.order_code}_${formatAmountForCommand(amount)}

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
  const message = `❌ Order Cancelled

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

  const confirmedMessageText = `⚽️ Match: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}

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

🎉Total Pool: ${formatAmount(getTotalPool(updatedTotals))} ${matchData.currency}`, getLocalizedImageUrl(order.telegram_id, ORDER_CONFIRMED_IMAGE_URL, ORDER_CONFIRMED_IMAGE_URL_ZH));

  return ctx.reply(`✅ Order confirmed: ${orderCode}
UID: ${order.ueex_uid}
Amount: ${formatAmount(amount)} ${matchData.currency}
User notified: ${userNotified ? "yes" : "no"}`);
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

  return confirmOrderByCode(ctx, orderCode, amount);
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

  const userCancelText = `❌ Order Cancelled

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

function calculateSettlement(matchData, orders) {
  const result = matchData.result;
  const feeBps = Number(matchData.fee_bps || PLATFORM_FEE_BPS);

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
  const netPool = totalPool.minus(feeAmount);

  const winners = orders.filter((order) => order.selection === result);
  const payouts = winners.map((order) => {
    const winningAmount = new Decimal(order.confirmed_amount || 0);
    const payoutAmount = winningPool.gt(0)
      ? winningAmount.div(winningPool).mul(netPool)
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
    netPool,
    winningPool,
    winners,
    payouts
  };
}

function buildSettlementPreviewMessage(matchData, settlement) {
  const feePercent = new Decimal(settlement.feeBps).div(100).toFixed();

  const lines = settlement.payouts.map((payout, index) => {
    const order = payout.order;
    const user = order.username ? `@${order.username}` : `UID ${order.ueex_uid}`;

    return `${index + 1}. ${user} / UID ${order.ueex_uid} - Bet ${formatAmount(payout.winningAmount)} ${matchData.currency} - Payout ${formatAmount(payout.payoutAmount)} ${matchData.currency}`;
  });

  return `🏆 Settlement Preview

Match ID: ${matchData.match_code}
Match: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
Result: ${formatSelectionWithFlags(matchData, settlement.result)}

💰 Total Pool: ${formatAmount(settlement.totalPool)} ${matchData.currency}
🏦 Platform Fee ${feePercent}%: ${formatAmount(settlement.feeAmount)} ${matchData.currency}
🎁 Net Pool: ${formatAmount(settlement.netPool)} ${matchData.currency}
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
  const winnerLines = settlement.payouts.map((payout, index) => {
    const order = payout.order;
    return `${index + 1}. ${getTelegramUserLabel(order)} / UID ${order.ueex_uid}
   Vote: ${formatAmount(payout.winningAmount)} ${matchData.currency}
   Payout: ${formatAmount(payout.payoutAmount)} ${matchData.currency}`;
  });

  return `✅ Settlement Completed

⚽️ ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
🔸 Match ID: ${matchData.match_code}
🔸 Result: ${formatSelectionWithFlags(matchData, settlement.result)}

💰 Total Pool: ${formatAmount(settlement.totalPool)} ${matchData.currency}
🏦 Platform Fee ${feePercent}%: ${formatAmount(settlement.feeAmount)} ${matchData.currency}
🎁 Net Pool: ${formatAmount(settlement.netPool)} ${matchData.currency}
🎯 Winning Pool: ${formatAmount(settlement.winningPool)} ${matchData.currency}

Winners:
${winnerLines.length ? winnerLines.join("\n\n") : "No winners."}`;
}

function buildSettlementPublicMessage(matchData, settlement) {
  const feePercent = new Decimal(settlement.feeBps).div(100).toFixed();
  const winnerLines = settlement.payouts.map((payout, index) => {
    const order = payout.order;
    return `${index + 1}. ${getPublicUserLabel(order, index)}
   Vote: ${formatAmount(payout.winningAmount)} ${matchData.currency}
   Payout: ${formatAmount(payout.payoutAmount)} ${matchData.currency}`;
  });

  return `⚽️ ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
🔸 Match ID: ${matchData.match_code}
🔸 Result: ${formatSelectionWithFlags(matchData, settlement.result)}

💰 Total Pool: ${formatAmount(settlement.totalPool)} ${matchData.currency}
🏦 Platform Fee ${feePercent}%: ${formatAmount(settlement.feeAmount)} ${matchData.currency}
🎁 Net Pool: ${formatAmount(settlement.netPool)} ${matchData.currency}
🎯 Winning Pool: ${formatAmount(settlement.winningPool)} ${matchData.currency}

Winners:
${winnerLines.length ? winnerLines.join("\n\n") : "No winners. UEEx will review this match manually."}

Congratulations to all winners! 🎉`;
}

function buildWinningUserSettlementMessage(matchData, order, payout) {
  const voteAmount = new Decimal(order.confirmed_amount || 0);
  const pnl = payout.payoutAmount.minus(voteAmount);
  const pnlSign = pnl.gte(0) ? "+" : "";

  return `⚽️ Match: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
🔸 Result: ${formatSelectionWithFlags(matchData, matchData.result)}
🔸 Your Selection: ${formatSelectionWithFlags(matchData, order.selection)}
🔸 Your Vote: ${formatAmount(voteAmount)} ${matchData.currency}
🔸 Estimated Payout: ${formatAmount(payout.payoutAmount)} ${matchData.currency}
🔸 Total PnL: ${pnlSign}${formatAmount(pnl)} ${matchData.currency}

Rewards will be arranged after final review.`;
}

function buildLosingUserSettlementMessage(matchData, order, noWinnerMode = false) {
  const voteAmount = new Decimal(order.confirmed_amount || 0);

  if (noWinnerMode) {
    return `⚽️ Match: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
🔸 Result: ${formatSelectionWithFlags(matchData, matchData.result)}
🔸 Your Selection: ${formatSelectionWithFlags(matchData, order.selection)}
🔸 Your Vote: ${formatAmount(voteAmount)} ${matchData.currency}

No exact-score winners were found. UEEx will review this match manually.`;
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

async function notifyPublicWorldCupTopicLong(text, imageUrl = "") {
  if (!PUBLIC_GROUP_CHAT_ID) return null;

  const topicOptions = PUBLIC_WORLD_CUP_TOPIC_ID
    ? { message_thread_id: Number(PUBLIC_WORLD_CUP_TOPIC_ID), disable_web_page_preview: true }
    : { disable_web_page_preview: true };

  let lastMessage = null;

  if (imageUrl) {
    try {
      lastMessage = await bot.telegram.sendPhoto(PUBLIC_GROUP_CHAT_ID, imageUrl, topicOptions);
    } catch (error) {
      console.error("Failed to send public settlement image:", error.message);

      if (topicOptions.message_thread_id) {
        try {
          lastMessage = await bot.telegram.sendPhoto(PUBLIC_GROUP_CHAT_ID, imageUrl, { disable_web_page_preview: true });
        } catch (fallbackError) {
          console.error("Failed to send public settlement image fallback:", fallbackError.message);
        }
      }
    }
  }

  for (const chunk of splitLongMessage(text)) {
    try {
      lastMessage = await bot.telegram.sendMessage(PUBLIC_GROUP_CHAT_ID, chunk, topicOptions);
    } catch (error) {
      console.error("Failed to send public settlement chunk:", error.message);

      if (topicOptions.message_thread_id) {
        try {
          lastMessage = await bot.telegram.sendMessage(PUBLIC_GROUP_CHAT_ID, chunk, { disable_web_page_preview: true });
        } catch (fallbackError) {
          console.error("Failed to send public settlement fallback:", fallbackError.message);
        }
      }
    }
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
      : buildLosingUserSettlementMessage(matchData, order, noWinnerMode);
    const imageUrl = payout ? getLocalizedImageUrl(order.telegram_id, WINNER_IMAGE_URL, WINNER_IMAGE_URL_ZH) : getLocalizedImageUrl(order.telegram_id, LOSER_IMAGE_URL, LOSER_IMAGE_URL_ZH);

    try {
      await sendOptionalPhoto(order.telegram_id, imageUrl, message);
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
  const settlement = calculateSettlement(matchData, orders);

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
  const settlement = calculateSettlement(matchData, orders);

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

  const adminMessage = buildSettlementCompletedAdminMessage(matchData, settlement);
  const publicMessage = buildSettlementPublicMessage(matchData, settlement);

  const publicNotifyResult = await notifyPublicWorldCupTopicLong(publicMessage, MATCH_SETTLED_IMAGE_URL_ZH || MATCH_SETTLED_IMAGE_URL);
  const adminFinalMessage = `${adminMessage}

Public Topic Notification: ${publicNotifyResult ? "sent" : "failed or not configured"}`;

  return replyLongMessage(ctx, adminFinalMessage);
}

function getMatchResultDisplay(match) {
  if (!match) return "Not Started";

  if (match.result) {
    return formatSelectionWithFlags(match, match.result);
  }

  if (match.status === "locked") return "In Progress";
  if (match.status === "resulted" || match.status === "settled") {
    return match.result ? formatSelectionWithFlags(match, match.result) : "In Progress";
  }

  return "Not Started";
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


async function showMyVote(ctx) {
  if (isPrivateChat(ctx)) {
    await deleteLastPrivateMenuMessage(ctx, "myvote");
  }

  const { data: orders, error } = await supabase
    .from("wc_orders")
    .select("*")
    .eq("telegram_id", ctx.from.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    const sent = await ctx.reply(`${isZh(ctx) ? "加载投票记录失败" : "Failed to load your votes"}: ${error.message}`, getPrivateMainMenu(ctx));
    return rememberPrivateMenuMessage(ctx, sent, "myvote");
  }

  if (!orders || orders.length === 0) {
    const sent = await replyWithOptionalPhoto(ctx, getLocalizedImageUrl(ctx, MYVOTE_IMAGE_URL, MYVOTE_IMAGE_URL_ZH), isZh(ctx) ? "你还没有世界杯预测订单。" : "You have no World Cup prediction orders yet.", getPrivateMainMenu(ctx));
    return rememberPrivateMenuMessage(ctx, sent, "myvote");
  }

  const matchCodes = [...new Set(orders.map((order) => order.match_code))];

  const { data: matches, error: matchError } = await supabase
    .from("wc_matches")
    .select("*")
    .in("match_code", matchCodes);

  if (matchError) {
    const sent = await ctx.reply(`${isZh(ctx) ? "加载比赛信息失败" : "Failed to load matches"}: ${matchError.message}`, getPrivateMainMenu(ctx));
    return rememberPrivateMenuMessage(ctx, sent, "myvote");
  }

  const confirmedOrders = await getConfirmedOrdersForMatches(matchCodes);
  const matchMap = new Map((matches || []).map((match) => [match.match_code, match]));
  const statsMap = buildMatchStatsMap(matches || [], confirmedOrders);

  let totalVoteAmount = new Decimal(0);
  let totalPnlAmount = new Decimal(0);
  let hasSettledPnl = false;

  const lines = orders.map((order, index) => {
    const match = matchMap.get(order.match_code);
    const stats = statsMap.get(order.match_code);
    const matchTitle = match ? `${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}` : order.match_code;
    const selection = match ? formatSelectionWithFlags(match, order.selection) : order.selection;
    const amount = order.status === "confirmed" ? order.confirmed_amount : order.expected_amount;
    const amountDecimal = new Decimal(amount || 0);
    const totalPool = stats ? stats.totalPool : new Decimal(0);
    const resultDisplay = getMatchResultDisplay(match);
    const pnl = calculateOrderPnl(order, match, stats);
    const pnlValue = calculateOrderPnlValue(order, match, stats);
    const orderStatus = order.status === "confirmed" ? "Confirmed" : order.status === "pending" ? "Pending" : order.status;

    if (["pending", "confirmed"].includes(order.status)) {
      totalVoteAmount = totalVoteAmount.plus(amountDecimal);
    }

    if (pnlValue) {
      totalPnlAmount = totalPnlAmount.plus(pnlValue);
      hasSettledPnl = true;
    }

    return `${index + 1}. ${matchTitle}
🔸 Match ID: ${order.match_code}
🔸 Order: ${order.order_code}
🔸 Selection: ${selection}
🔸 Amount: ${formatAmount(amount)} ${order.currency}
🔸 Total Pool: ${formatAmount(totalPool)} ${order.currency}
🔸 Order Status: ${orderStatus}
🔸 Game Result: ${resultDisplay}
🔸 Total PnL: ${pnl}`;
  });

  const currency = orders[0]?.currency || DEFAULT_CURRENCY;
  const totalPnlText = hasSettledPnl
    ? `${totalPnlAmount.gte(0) ? "+" : ""}${formatAmount(totalPnlAmount)} ${currency}`
    : `0 ${currency}`;

  const body = `${lines.join("\n\n")}\n\n💰 Total Vote Amount: ${formatAmount(totalVoteAmount)} ${currency}\n💎 Total PnL: ${totalPnlText}`;

  const sentMessages = [];

  if (getLocalizedImageUrl(ctx, MYVOTE_IMAGE_URL, MYVOTE_IMAGE_URL_ZH)) {
    const photo = await ctx.replyWithPhoto(getLocalizedImageUrl(ctx, MYVOTE_IMAGE_URL, MYVOTE_IMAGE_URL_ZH), getPrivateMainMenu(ctx));
    sentMessages.push(photo);
  }

  const chunks = splitLongMessage(body, 3500);
  for (let i = 0; i < chunks.length; i += 1) {
    const options = i === chunks.length - 1 ? getPrivateMainMenu() : undefined;
    const sent = await ctx.reply(chunks[i], options);
    sentMessages.push(sent);
  }

  return rememberPrivateMenuMessages(ctx, sentMessages, "myvote");
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
Confirm: /confirm_${order.order_code}_${formatAmountForCommand(order.expected_amount)}`;
  });

  return ctx.reply(`🧾 Pending Orders${matchCode ? ` | ${String(matchCode).toUpperCase()}` : ""}

${lines.join("\n\n")}`);
}

async function showAdminHelp(ctx) {
  const text = `⚽ UEEx World Cup Bot Commands

User:
/worldcup - View matches
/myvote - View my votes

Admin:
/worldcup_MEX_ZAF_7:7:51_0:0_5:5_Others_2026.06.11_23:00_UTC+4_Group - Create match and post it to World Cup topic
/confirm_O000123_1150 - Confirm payment
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
/chatid - Check chat ID
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

  if (payload.startsWith("bet_")) {
    const matchCode = payload.replace(/^bet_/i, "").toUpperCase();

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

bot.command("chatid", async (ctx) => {
  await ctx.reply(`Chat ID: ${ctx.chat.id}`);
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

bot.on("callback_query", async (ctx) => {
  try {
    const data = ctx.callbackQuery?.data || "";

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
          url ? "Please tap Bet Now to open private chat with the bot." : "Please set BOT_USERNAME in Render to enable private betting.",
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

      if (!isBettingOpen(match)) {
        return ctx.answerCbQuery("Betting for this match is already closed.", { show_alert: true });
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

    if (cleaned.startsWith("/")) return;

    const session = getSession(ctx);

    if (!session) return;

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
