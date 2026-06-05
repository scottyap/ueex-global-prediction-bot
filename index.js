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
const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || "UE";
const PLATFORM_FEE_BPS = Number(process.env.PLATFORM_FEE_BPS || 500);
const MAX_OPEN_MATCHES_SHOWN = Number(process.env.MAX_OPEN_MATCHES_SHOWN || 500);
const LIVE_UPDATE_INTERVAL_MS = Number(process.env.LIVE_UPDATE_INTERVAL_MS || 30000);
const MIN_BET_AMOUNT = new Decimal(process.env.MIN_BET_AMOUNT || 1000);
const BOT_USERNAME = (process.env.BOT_USERNAME || "").replace(/^@/, "");
const AUTO_CONFIRM_ENABLED = String(process.env.AUTO_CONFIRM_ENABLED || "false").toLowerCase() === "true";
const PAYMENT_CHECK_INTERVAL_MS = Number(process.env.PAYMENT_CHECK_INTERVAL_MS || 30000);
const UEEX_PAYMENT_ITEM_ID = Number(process.env.UEEX_PAYMENT_ITEM_ID || 1304);
const UEEX_RECEIVER_UID = process.env.UEEX_RECEIVER_UID || RECEIVER_UID;
const UEEX_INTERNAL_EXCHANGE_TYPE = Number(process.env.UEEX_INTERNAL_EXCHANGE_TYPE || 1);
const UEEX_SUCCESS_STATUS = process.env.UEEX_SUCCESS_STATUS || "success";
const WORLDCUP_IMAGE_URL = process.env.WORLDCUP_IMAGE_URL || "";
const PENDING_ORDER_IMAGE_URL = process.env.PENDING_ORDER_IMAGE_URL || "";
const ORDER_CONFIRMED_IMAGE_URL = process.env.ORDER_CONFIRMED_IMAGE_URL || "";
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

function getSessionKey(ctx) {
  return `${ctx.chat?.id || "unknown"}:${ctx.from?.id || "unknown"}`;
}
function getPrivateMenuKey(ctx) {
  return `${ctx.chat?.id || "unknown"}:${ctx.from?.id || "unknown"}`;
}

async function deleteLastPrivateMenuMessage(ctx) {
  if (!ctx || !isPrivateChat(ctx)) return;

  const key = getPrivateMenuKey(ctx);
  const messageId = privateMenuMessageStore.get(key);

  if (!messageId) return;

  try {
    await ctx.telegram.deleteMessage(ctx.chat.id, messageId);
  } catch (error) {
    // Ignore delete failures, for example if the user already deleted the message.
  } finally {
    privateMenuMessageStore.delete(key);
  }
}

function rememberPrivateMenuMessage(ctx, sentMessage) {
  if (ctx && isPrivateChat(ctx) && sentMessage?.message_id) {
    privateMenuMessageStore.set(getPrivateMenuKey(ctx), sentMessage.message_id);
  }

  return sentMessage;
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
  const raw = String(value || "").trim();

  if (!/^\d+(\.\d{1,8})?$/.test(raw)) return null;

  try {
    const amount = new Decimal(raw);
    if (!amount.isFinite() || amount.lte(0)) return null;
    return amount;
  } catch (error) {
    return null;
  }
}

function formatAmount(value, maxDp = 8) {
  const decimal = new Decimal(value || 0);

  if (decimal.isZero()) return "0";

  const fixed = decimal.toDecimalPlaces(maxDp, Decimal.ROUND_DOWN).toFixed();
  const cleaned = fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

  return cleaned || "0";
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

function getPrivateMainMenu() {
  return Markup.keyboard([
    ["⚽ Matches", "📊 My Vote"],
    ["📜 Rules", "🛟 Support"]
  ]).resize();
}

function getSupportKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.url("Contact @UEEx_JJ", "https://t.me/UEEx_JJ")]
  ]);
}

function buildRulesMessage() {
  return `📜 World Cup Prediction Rules

1. Tap Matches and select a match day, match, prediction type, exact score, and UE voting amount.
2. Minimum voting amount: ${formatAmount(MIN_BET_AMOUNT)} UE.
3. After creating a pending order, transfer the exact UE amount to UID ${UEEX_RECEIVER_UID}.
4. Use your Order ID as the transfer remark. Orders are counted only after payment confirmation.
5. If your transfer amount, UID, or remark is incorrect, your vote may not be confirmed automatically.
6. After the match result is recorded, winning users share the net pool according to their confirmed voting amount.
7. Platform fee: ${formatAmount(new Decimal(PLATFORM_FEE_BPS).div(100))}%.
8. UEEx reserves the right to review abnormal activity, invalid payments, and final reward eligibility.`;
}

async function showRules(ctx) {
  if (isPrivateChat(ctx)) {
    await deleteLastPrivateMenuMessage(ctx);
  }

  const sent = await ctx.reply(buildRulesMessage(), getPrivateMainMenu());
  return rememberPrivateMenuMessage(ctx, sent);
}

async function showSupport(ctx) {
  if (isPrivateChat(ctx)) {
    await deleteLastPrivateMenuMessage(ctx);
  }

  const sent = await ctx.reply("🛟 Need help? Contact UEEx support below.", getSupportKeyboard());
  return rememberPrivateMenuMessage(ctx, sent);
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
  return Markup.inlineKeyboard([
    [Markup.button.callback(getOutcomeCallbackLabel(match, "A", totals), `wcoutcome:${match.match_code}:A`)],
    [Markup.button.callback(getOutcomeCallbackLabel(match, "DRAW", totals), `wcoutcome:${match.match_code}:DRAW`)],
    [Markup.button.callback(getOutcomeCallbackLabel(match, "B", totals), `wcoutcome:${match.match_code}:B`)]
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

  rows.push([Markup.button.callback("⬅️ Back", `wcmatch:${match.match_code}`)]);

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
• Transfer the exact ${match.currency} amount to UID ${match.receiver_uid}.
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

async function replyWithOptionalPhoto(ctx, imageUrl, text, keyboard = null) {
  if (imageUrl) {
    return ctx.replyWithPhoto(imageUrl, buildPhotoExtra(text, keyboard));
  }

  if (keyboard) {
    return ctx.reply(text, keyboard);
  }

  return ctx.reply(text);
}

async function sendOptionalPhoto(chatId, imageUrl, text, keyboard = null, extraOptions = {}) {
  if (imageUrl) {
    return bot.telegram.sendPhoto(chatId, imageUrl, buildPhotoExtra(text, keyboard, extraOptions));
  }

  const options = { ...extraOptions };
  if (keyboard?.reply_markup) {
    options.reply_markup = keyboard.reply_markup;
  }

  return bot.telegram.sendMessage(chatId, text, options);
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
  const match = cleaned.match(/^\/worldcup_([A-Za-z0-9]+)_([A-Za-z0-9]+)_(\d+):(\d+):(\d+)_([0-9]+:[0-9]+)_([0-9]+:[0-9]+)_([A-Za-z0-9]+)_([0-9]{4}\.[0-9]{2}\.[0-9]{2})_([0-9]{1,2}:[0-9]{2})_(UTC[+-]\d{1,2})_([A-Za-z0-9-]+)$/i);

  if (!match) {
    return ctx.reply(
      "Invalid format.\nExample:\n/worldcup_MEX_ZAF_7:7:51_0:0_5:5_Others_2026.06.11_23:00_UTC+4_Group\n\nFormat:\n/worldcup_Team1_Team2_Days:Hours:Minutes_MinScore_MaxScore_Others_Date_Time_Timezone_Stage"
    );
  }

  const teamA = normalizeTeam(match[1]);
  const teamB = normalizeTeam(match[2]);
  const days = Number(match[3]);
  const hours = Number(match[4]);
  const minutes = Number(match[5]);
  const startScore = match[6] || "0:0";
  const endScore = match[7] || "5:5";
  const lastOption = match[8] || "Others";
  const matchDate = match[9];
  const matchTime = match[10];
  const matchTimezone = match[11].toUpperCase();
  const matchStage = match[12];
  const selectionOptions = generateScoreOptions(startScore, endScore, lastOption);

  if (!teamA || !teamB || teamA === teamB) {
    return ctx.reply("Invalid teams. Example: /worldcup_MEX_ZAF_7:7:51_0:0_5:5_Others_2026.06.11_23:00_UTC+4_Group");
  }

  if (
    days < 0 ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    days * 1440 + hours * 60 + minutes <= 0
  ) {
    return ctx.reply("Invalid betting time. Use Days:Hours:Minutes, for example: 7:7:51");
  }

  const timeParts = matchTime.split(":").map(Number);
  if (timeParts.length !== 2 || timeParts[0] < 0 || timeParts[0] > 23 || timeParts[1] < 0 || timeParts[1] > 59) {
    return ctx.reply("Invalid match time. Example: 23:00");
  }

  if (!selectionOptions || selectionOptions.length < 2) {
    return ctx.reply("Invalid score range. Example: 0:0_5:5_Others");
  }

  const matchCode = await generateUniqueCode("WC", "wc_matches", "match_code");
  const now = new Date();
  const bettingEndAt = new Date(now.getTime() + (days * 1440 + hours * 60 + minutes) * 60 * 1000);

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
      live_message_id: liveMessage.message_id,
      updated_at: new Date().toISOString()
    })
    .eq("match_code", data.match_code);

  return ctx.reply(`✅ Match created and posted to the World Cup topic.\n\nMatch ID: ${data.match_code}\nMatch: ${formatTeamWithFlag(teamA)} vs ${formatTeamWithFlag(teamB)}\nMatch Time: ${matchDate} ${matchTime} ${matchTimezone}\nStage: ${matchStage}\nBetting closes in ${days}d ${hours}h ${minutes}m.`);
}

async function showWorldCupEntry(ctx) {
  return showOpenMatches(ctx);
}

async function showOpenMatches(ctx) {
  if (isPrivateChat(ctx)) {
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
    await deleteLastPrivateMenuMessage(ctx);
  }

  const matches = sortMatchesBySchedule((await getAllOpenMatches()).filter(isBettingOpen));

  if (!matches.length) {
    const message = "No open World Cup prediction matches are available now.";
    if (edit) return editCallbackMessage(ctx, message, null);
    const sent = await ctx.reply(message, getPrivateMainMenu());
    return rememberPrivateMenuMessage(ctx, sent);
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
        `${getMatchDayLabel(dateKey)} • ${count} match${count > 1 ? "es" : ""}`,
        `wcdate:${encodeDateKey(dateKey)}`
      )
    ]);
  }

  const text = "🏆 Upcoming Matches\n\nPlease select a match day:";
  const keyboard = Markup.inlineKeyboard(rows);

  if (edit) {
    return editCallbackMessage(ctx, text, keyboard);
  }

  const sent = await replyWithOptionalPhoto(ctx, WORLDCUP_IMAGE_URL, text, keyboard);
  return rememberPrivateMenuMessage(ctx, sent);
}

async function showMatchesForDate(ctx, dateKey, edit = false) {
  const matches = sortMatchesBySchedule(
    (await getAllOpenMatches()).filter((match) => isBettingOpen(match) && getMatchDateKey(match) === dateKey)
  );

  if (!matches.length) {
    const message = "No open matches are available for this date.";
    if (edit) return editCallbackMessage(ctx, message, Markup.inlineKeyboard([[Markup.button.callback("⬅️ Back to dates", "wcdates")]]));
    return ctx.reply(message, Markup.inlineKeyboard([[Markup.button.callback("⬅️ Back to dates", "wcdates")]]));
  }

  const lines = matches.map((match) => {
    const timeText = match.match_timezone ? `${match.match_time || "TBD"} ${match.match_timezone}` : (match.match_time || "TBD");
    const stageText = match.match_stage ? ` | ${String(match.match_stage).replace(/-/g, " ")}` : "";
    return `${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)} • ${timeText}${stageText}`;
  });

  const rows = matches.map((match) => [
    Markup.button.callback(getMatchListButtonLabel(match), `wcmatch:${match.match_code}`)
  ]);
  rows.push([Markup.button.callback("⬅️ Back to dates", "wcdates")]);

  const text = `📅 ${getMatchDayLabel(dateKey)}\n\n${lines.join("\n")}`;
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
    return ctx.reply("Betting for this match is already closed.");
  }

  const user = await getUserByTelegramId(ctx.from.id);

  if (!user) {
    await deleteStoredPrompt(ctx);

    const prompt = await ctx.reply("Please enter your UEEx UID.", {
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

  return `${intro}Selection: ${formatSelectionWithFlags(match, selection)}
Pool: ${formatAmount(pool)} ${match.currency}

Please enter your UE voting amount. Minimum: ${formatAmount(MIN_BET_AMOUNT)} ${match.currency}.`;
}
async function handleAmountInput(ctx, text, session) {
  const amount = parsePositiveAmount(text);

  if (!amount) {
    return ctx.reply("Invalid amount. Please enter a positive UE amount, for example: 1000 or 1150.5");
  }

  if (amount.lt(MIN_BET_AMOUNT)) {
    return ctx.reply(`Minimum voting amount is ${formatAmount(MIN_BET_AMOUNT)} UE.`);
  }

  const match = await getMatch(session.matchCode);

  if (!match) {
    clearSession(ctx);
    return ctx.reply("Match not found. Please start again with /worldcup.");
  }

  if (!isBettingOpen(match)) {
    clearSession(ctx);
    return ctx.reply("Betting for this match is already closed.");
  }

  const userRecord = await getUserByTelegramId(ctx.from.id);

  if (!userRecord) {
    clearSession(ctx);
    return ctx.reply("Please bind your UEEx UID first with /worldcup.");
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

  const pendingMessageText = `⚽️ Match: ${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}

🔸 Order ID: ${data.order_code}
🔸 UID: ${data.ueex_uid}
🔸 TG: ${getTelegramUserLabel(data)}
🔸 Selection: ${formatSelectionWithFlags(match, data.selection)}
🔸 Amount: ${formatAmount(amount)} ${match.currency}

❗️Please transfer ${formatAmount(amount)} ${match.currency} via UEEx internal transfer to UID ${match.receiver_uid}.
❗️Transfer Remark: ${data.order_code}
❗️Your vote will be counted after payment confirmation.`;

  const pendingMessage = await replyWithOptionalPhoto(
    ctx,
    PENDING_ORDER_IMAGE_URL,
    pendingMessageText,
    Markup.inlineKeyboard([
      [Markup.button.callback("❌ Cancel", `wccancel:${data.order_code}`)]
    ])
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
/confirm_${data.order_code}_${formatAmount(amount)}

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

  return editCallbackMessage(ctx, message);
}

async function confirmOrderByCode(ctx, orderCode, amount, options = {}) {
  const { autoConfirmed = false } = options;

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

  const { error: updateError } = await supabase
    .from("wc_orders")
    .update({
      confirmed_amount: amount.toFixed(),
      status: "confirmed",
      confirmed_by: ctx.from?.id || null,
      confirmed_at: new Date().toISOString(),
      auto_confirmed: autoConfirmed,
      payment_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
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

🔸 Order ID: ${orderCode}
🔸 UID: ${order.ueex_uid}
🔸 TG: ${getTelegramUserLabel(order)}
🔸 Selection: ${formatSelectionWithFlags(matchData, order.selection)}
🔸 Confirmed Amount: ${formatAmount(amount)} ${matchData.currency}

📊 Send /myvote to view your vote details.`;

  let userNotified = true;

  try {
    await sendOptionalPhoto(order.telegram_id, ORDER_CONFIRMED_IMAGE_URL, confirmedMessageText);
  } catch (error) {
    userNotified = false;
    console.error("Failed to notify user after confirmation:", error.message);
  }

  await notifyAdminGroup(`✅ Order Confirmed

⚽️ Match: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}

🔸 Order ID: ${orderCode}
🔸 UID: ${order.ueex_uid}
🔸 TG: ${getTelegramUserLabel(order)}
🔸 Selection: ${formatSelectionWithFlags(matchData, order.selection)}
🔸 Confirmed Amount: ${formatAmount(amount)} ${matchData.currency}
🔸 User Notified: ${userNotified ? "yes" : "no"}`, ctx);

  const updatedTotals = await getMatchTotals(order.match_code, matchData);
  await notifyPublicWorldCupTopic(`✅ Order Confirmed

⚽️ ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
🔸 Selection: ${formatSelectionWithFlags(matchData, order.selection)}
🔸 Amount: ${formatAmount(amount)} ${matchData.currency}

🎉Total Pool: ${formatAmount(getTotalPool(updatedTotals))} ${matchData.currency}`, ORDER_CONFIRMED_IMAGE_URL);

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

  if (order.status === "settled") {
    return ctx.reply("Settled orders cannot be voided.");
  }

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

  await updateLiveMatchMessage(order.match_code);

  return ctx.reply(`✅ Order voided: ${orderCode}`);
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
Result: ${labelForSelection(matchData, settlement.result)}

Total Pool: ${formatAmount(settlement.totalPool)} ${matchData.currency}
Platform Fee ${feePercent}%: ${formatAmount(settlement.feeAmount)} ${matchData.currency}
Net Pool: ${formatAmount(settlement.netPool)} ${matchData.currency}
Winning Pool: ${formatAmount(settlement.winningPool)} ${matchData.currency}

Winners:
${lines.length ? lines.join("\n") : "No winners."}

Use /settle_${matchData.match_code} to publish final result.`;
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

  return ctx.reply(buildSettlementPreviewMessage(matchData, settlement));
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

  const { data: settlement, error: settlementError } = await supabase
    .from("wc_settlements")
    .select("*")
    .eq("match_code", matchCode)
    .maybeSingle();

  if (settlementError || !settlement) {
    return ctx.reply(`No settlement preview found. Please run /preview_${matchCode} first.`);
  }

  if (settlement.status === "settled") {
    return ctx.reply("This match has already been settled.");
  }

  const { data: payouts, error: payoutsError } = await supabase
    .from("wc_payouts")
    .select("*")
    .eq("match_code", matchCode)
    .order("payout_amount", { ascending: false });

  if (payoutsError) {
    return ctx.reply(`Failed to load payouts: ${payoutsError.message}`);
  }

  await supabase
    .from("wc_settlements")
    .update({
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

  const lines = (payouts || []).map((payout, index) => {
    const user = payout.username ? `@${payout.username}` : `UID ${payout.ueex_uid}`;
    return `${index + 1}. ${user} / UID ${payout.ueex_uid} - ${formatAmount(payout.payout_amount)} ${payout.currency}`;
  });

  return ctx.reply(`🎉 World Cup Prediction Settled

Match ID: ${matchCode}
Match: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
Result: ${labelForSelection(matchData, settlement.result)}

Total Pool: ${formatAmount(settlement.total_pool)} ${matchData.currency}
Platform Fee: ${formatAmount(settlement.fee_amount)} ${matchData.currency}
Net Pool: ${formatAmount(settlement.net_pool)} ${matchData.currency}

Payouts:
${lines.length ? lines.join("\n") : "No winners."}

Admins will arrange reward distribution manually.`);
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

function calculateOrderPnl(order, match, stats) {
  if (!match || order.status !== "confirmed" || !match.result) return "-";

  const amount = new Decimal(order.confirmed_amount || 0);

  if (order.selection !== match.result) {
    return `-${formatAmount(amount)} ${order.currency}`;
  }

  if (!stats || !stats.winningPool || stats.winningPool.lte(0)) return "-";

  const payout = amount.div(stats.winningPool).mul(stats.netPool);
  const pnl = payout.minus(amount);
  const sign = pnl.gte(0) ? "+" : "";

  return `${sign}${formatAmount(pnl)} ${order.currency}`;
}

async function showMyVote(ctx) {
  if (isPrivateChat(ctx)) {
    await deleteLastPrivateMenuMessage(ctx);
  }

  const { data: orders, error } = await supabase
    .from("wc_orders")
    .select("*")
    .eq("telegram_id", ctx.from.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    const sent = await ctx.reply(`Failed to load your votes: ${error.message}`);
    return rememberPrivateMenuMessage(ctx, sent);
  }

  if (!orders || orders.length === 0) {
    const sent = await ctx.reply("You have no World Cup prediction orders yet.");
    return rememberPrivateMenuMessage(ctx, sent);
  }

  const matchCodes = [...new Set(orders.map((order) => order.match_code))];

  const { data: matches, error: matchError } = await supabase
    .from("wc_matches")
    .select("*")
    .in("match_code", matchCodes);

  if (matchError) {
    const sent = await ctx.reply(`Failed to load matches: ${matchError.message}`);
    return rememberPrivateMenuMessage(ctx, sent);
  }

  const confirmedOrders = await getConfirmedOrdersForMatches(matchCodes);
  const matchMap = new Map((matches || []).map((match) => [match.match_code, match]));
  const statsMap = buildMatchStatsMap(matches || [], confirmedOrders);

  const lines = orders.map((order, index) => {
    const match = matchMap.get(order.match_code);
    const stats = statsMap.get(order.match_code);
    const matchTitle = match ? `${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}` : order.match_code;
    const selection = match ? formatSelectionWithFlags(match, order.selection) : order.selection;
    const amount = order.status === "confirmed" ? order.confirmed_amount : order.expected_amount;
    const totalPool = stats ? stats.totalPool : new Decimal(0);
    const resultDisplay = getMatchResultDisplay(match);
    const pnl = calculateOrderPnl(order, match, stats);
    const orderStatus = order.status === "confirmed" ? "Confirmed" : order.status === "pending" ? "Pending" : order.status;

    return `${index + 1}. ${matchTitle}
🔸 Order: ${order.order_code}
🔸 Selection: ${selection}
🔸 Amount: ${formatAmount(amount)} ${order.currency}
🔸 Total Pool: ${formatAmount(totalPool)} ${order.currency}
🔸 Order Status: ${orderStatus}
🔸 Game Result: ${resultDisplay}
🔸 Total PnL: ${pnl}`;
  });

  const sent = await ctx.reply(`📊 My Votes

${lines.join("\n\n")}`, getPrivateMainMenu());
  return rememberPrivateMenuMessage(ctx, sent);
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
Confirm: /confirm_${order.order_code}_${formatAmount(order.expected_amount)}`;
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
/void_O000123 - Void order
/lock_WC0001 - Lock match
/result_WC0001_0:0 - Record result
/preview_WC0001 - Generate settlement preview
/settle_WC0001 - Publish settlement
/pending - View latest pending orders in admin group/private
/pending_WC0001 - View pending orders for a match
/chatid - Check chat ID
/ping - Test bot`;

  return ctx.reply(text);
}

bot.start(async (ctx) => {
  const text = getMessageText(ctx);
  const payload = text.split(/\s+/)[1] || "";

  if (isPrivateChat(ctx)) {
    await ctx.reply("UEEx World Cup Bot is running. Use the buttons below anytime.", getPrivateMainMenu());
  }

  if (payload.startsWith("bet_")) {
    const matchCode = payload.replace(/^bet_/i, "").toUpperCase();
    return startPrivateBet(ctx, matchCode);
  }

  if (isPrivateChat(ctx)) {
    return showMatchDateSelection(ctx);
  }

  return ctx.reply("UEEx World Cup Bot is running. Send /worldcup to view open matches.");
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

    if (data === "wcdates") {
      if (!isPrivateChat(ctx)) {
        return ctx.answerCbQuery("Please use private chat with the bot.", { show_alert: true });
      }

      await ctx.answerCbQuery();
      return showMatchDateSelection(ctx, true);
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
          `Please enter your UEEx UID first.`,
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
        buildAmountPrompt(match, selection, selectionPool),
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

    if (/^\/pending(?:_(WC[A-Z0-9]+))?$/i.test(cleaned)) {
      const pendingMatch = cleaned.match(/^\/pending(?:_(WC[A-Z0-9]+))?$/i);
      return showPendingOrders(ctx, pendingMatch?.[1] || null);
    }

    if (isPrivateChat(ctx) && ["⚽ Matches", "Matches", "matches", "🎮 Game", "Game", "game"].includes(cleaned)) {
      clearSession(ctx);
      return showMatchDateSelection(ctx);
    }

    if (isPrivateChat(ctx) && ["📜 Rules", "Rules", "rules", "Rule", "rule"].includes(cleaned)) {
      clearSession(ctx);
      return showRules(ctx);
    }

    if (isPrivateChat(ctx) && ["🛟 Support", "Support", "support", "Help", "help"].includes(cleaned)) {
      clearSession(ctx);
      return showSupport(ctx);
    }

    if (isPrivateChat(ctx) && ["📊 My Vote", "My Vote", "my vote", "My Votes", "my votes"].includes(cleaned)) {
      clearSession(ctx);
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
          buildAmountPrompt(match, session.nextSelection, selectionPool, `✅ UID confirmed: ${uid}`),
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
        await ctx.reply(`✅ UID confirmed: ${uid}`);
        return showSelectedMatch(ctx, nextMatchCode);
      }

      clearSession(ctx);
      await ctx.reply(`✅ UID confirmed: ${uid}`);
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
    console.log(`Live match updater interval: ${LIVE_UPDATE_INTERVAL_MS} ms`);
    console.log(`Auto confirmation enabled: ${AUTO_CONFIRM_ENABLED ? "ON" : "OFF"}; interval: ${PAYMENT_CHECK_INTERVAL_MS} ms; item_id: ${UEEX_PAYMENT_ITEM_ID}; receiver_uid: ${UEEX_RECEIVER_UID}; internal_exchange_type: ${UEEX_INTERNAL_EXCHANGE_TYPE}; success_status: ${UEEX_SUCCESS_STATUS}`);
  } catch (error) {
    console.error("Startup error:", error);
  }
});
