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
const MAX_OPEN_MATCHES_SHOWN = Number(process.env.MAX_OPEN_MATCHES_SHOWN || 20);
const LIVE_UPDATE_INTERVAL_MS = Number(process.env.LIVE_UPDATE_INTERVAL_MS || 30000);

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

function getSessionKey(ctx) {
  return `${ctx.chat?.id || "unknown"}:${ctx.from?.id || "unknown"}`;
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

function normalizeTeam(team) {
  return String(team || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

const TEAM_FLAG_MAP = {
  ARG: "🇦🇷", AUS: "🇦🇺", AUT: "🇦🇹", BEL: "🇧🇪", BRA: "🇧🇷", CAN: "🇨🇦",
  CHI: "🇨🇱", CHN: "🇨🇳", COL: "🇨🇴", CRO: "🇭🇷", CZE: "🇨🇿", DEN: "🇩🇰",
  ECU: "🇪🇨", ENG: "🏴", ESP: "🇪🇸", FRA: "🇫🇷", GER: "🇩🇪", GHA: "🇬🇭",
  IRN: "🇮🇷", ITA: "🇮🇹", JPN: "🇯🇵", KOR: "🇰🇷", MAR: "🇲🇦", MEX: "🇲🇽",
  NED: "🇳🇱", NGA: "🇳🇬", POL: "🇵🇱", POR: "🇵🇹", QAT: "🇶🇦", RUS: "🇷🇺",
  SEN: "🇸🇳", SRB: "🇷🇸", SUI: "🇨🇭", TUN: "🇹🇳", UKR: "🇺🇦", URU: "🇺🇾",
  USA: "🇺🇸", WAL: "🏴", KSA: "🇸🇦"
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
  return `${getTeamFlag(match.team_a)} ${labelForSelection(match, selection)} ${getTeamFlag(match.team_b)}`;
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
  if (selection === "A") return `${match.team_a} Win`;
  if (selection === "B") return `${match.team_b} Win`;
  if (selection === "DRAW") return "Draw";
  if (String(selection).toUpperCase() === "OTHERS") return "Others";
  return String(selection || "Unknown");
}

function formatSelectionButtonLabel(match, option, amount) {
  return `${formatSelectionWithFlags(match, option)} | ${formatAmount(amount)} ${match.currency}`;
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

function generateScoreOptions(startScore, endScore, lastOption) {
  const start = parseScoreValue(startScore);
  const end = parseScoreValue(endScore);

  if (!start || !end) return null;
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

  const finalOption = String(lastOption || "Others").trim() || "Others";
  return [...scores, finalOption];
}

function resultInputToSelection(match, input) {
  const raw = String(input || "").trim();
  const options = getSelectionOptions(match);

  const exact = options.find((option) => option.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;

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

function buildMatchKeyboard(match, totals) {
  const options = getSelectionOptions(match);
  const rows = options.map((option) => [
    Markup.button.callback(
      formatSelectionButtonLabel(match, option, totals[option] || 0),
      `wcsel:${match.match_code}:${option}`
    )
  ]);

  return Markup.inlineKeyboard(rows);
}

function buildMatchMessage(match, totals) {
  const totalPool = getTotalPool(totals);
  const statusText = isBettingOpen(match) ? "Open" : match.status === "open" ? "Closed" : match.status.toUpperCase();

  return `⚽ World Cup Prediction

🔸 Match ID: ${match.match_code}
🔸 Match: ${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}
🔸 Status: ${statusText}
🔸 Betting Time Left: ${formatTimeLeft(match.betting_end_at)}

🎉Total Pool: ${formatAmount(totalPool)} ${match.currency}`;
}

async function updateLiveMatchMessage(matchCode) {
  const match = await getMatch(matchCode);

  if (!match || !match.live_message_id || !match.chat_id) return;

  const totals = await getMatchTotals(matchCode, match);

  try {
    await bot.telegram.editMessageText(
      match.chat_id,
      match.live_message_id,
      undefined,
      buildMatchMessage(match, totals),
      buildMatchKeyboard(match, totals)
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
  if (!(await requireAdmin(ctx))) return;

  if (!isGroupChat(ctx)) {
    return ctx.reply("Please create matches inside the target Telegram group.");
  }

  const cleaned = cleanCommandText(text);
  const match = cleaned.match(/^\/worldcup_([A-Za-z0-9]+)_([A-Za-z0-9]+)_(\d+)_(\d+)_(\d+)_([0-9]+:[0-9]+)_([0-9]+:[0-9]+)_([A-Za-z0-9]+)$/i);

  if (!match) {
    return ctx.reply("Invalid format.\nExample: /worldcup_FRA_BRA_1_1_20_0:0_3:3_Others");
  }

  const teamA = normalizeTeam(match[1]);
  const teamB = normalizeTeam(match[2]);
  const days = Number(match[3]);
  const hours = Number(match[4]);
  const minutes = Number(match[5]);
  const selectionOptions = generateScoreOptions(match[6], match[7], match[8]);

  if (!teamA || !teamB || teamA === teamB) {
    return ctx.reply("Invalid teams. Example: /worldcup_FRA_BRA_1_1_20_0:0_3:3_Others");
  }

  if (
    days < 0 ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    days * 1440 + hours * 60 + minutes <= 0
  ) {
    return ctx.reply("Invalid betting time. Example: /worldcup_FRA_BRA_1_1_20_0:0_3:3_Others");
  }

  if (!selectionOptions || selectionOptions.length < 2) {
    return ctx.reply("Invalid score range. Example: /worldcup_FRA_BRA_1_1_20_0:0_3:3_Others");
  }

  const matchCode = await generateUniqueCode("WC", "wc_matches", "match_code");
  const now = new Date();
  const bettingEndAt = new Date(now.getTime() + (days * 1440 + hours * 60 + minutes) * 60 * 1000);

  const payload = {
    match_code: matchCode,
    chat_id: ctx.chat.id,
    team_a: teamA,
    team_b: teamB,
    currency: DEFAULT_CURRENCY,
    receiver_uid: RECEIVER_UID,
    fee_bps: PLATFORM_FEE_BPS,
    selection_options: selectionOptions,
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
  const liveMessage = await ctx.reply(
    buildMatchMessage(data, totals),
    buildMatchKeyboard(data, totals)
  );

  await supabase
    .from("wc_matches")
    .update({
      live_message_id: liveMessage.message_id,
      updated_at: new Date().toISOString()
    })
    .eq("match_code", data.match_code);

  return ctx.reply(`✅ Match created: ${data.match_code}\n${formatTeamWithFlag(teamA)} vs ${formatTeamWithFlag(teamB)}\nBetting closes in ${days}d ${hours}h ${minutes}m.`);
}

async function showWorldCupEntry(ctx) {
  if (!isGroupChat(ctx)) {
    return ctx.reply("Please use /worldcup inside the official Telegram group.");
  }

  const user = await getUserByTelegramId(ctx.from.id);

  if (!user) {
    await deleteStoredPrompt(ctx);

    const prompt = await ctx.reply(
      `Please enter your UEEx UID.`,
      {
        reply_markup: {
          force_reply: true,
          selective: true
        }
      }
    );

    setSession(ctx, { step: "awaiting_uid", promptMessageId: prompt.message_id });
    return;
  }

  return showOpenMatches(ctx);
}

async function showOpenMatches(ctx) {
  const matches = await getOpenMatches(ctx.chat.id);
  const openMatches = matches.filter(isBettingOpen);

  if (!openMatches.length) {
    return ctx.reply("No open World Cup prediction matches are available now.");
  }

  const keyboard = openMatches.map((match) => [
    Markup.button.callback(
      `${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)} (${match.match_code})`,
      `wcmatch:${match.match_code}`
    )
  ]);

  return ctx.reply(
    "⚽ World Cup Prediction\n\nPlease select a match:",
    Markup.inlineKeyboard(keyboard)
  );
}

async function showSelectedMatch(ctx, matchCode, edit = false) {
  const match = await getMatch(matchCode);

  if (!match) {
    return ctx.answerCbQuery ? ctx.answerCbQuery("Match not found.") : ctx.reply("Match not found.");
  }

  const totals = await getMatchTotals(matchCode, match);
  const message = buildMatchMessage(match, totals);
  const keyboard = buildMatchKeyboard(match, totals);

  if (edit && ctx.editMessageText) {
    return ctx.editMessageText(message, keyboard);
  }

  return ctx.reply(message, keyboard);
}

async function handleAmountInput(ctx, text, session) {
  const amount = parsePositiveAmount(text);

  if (!amount) {
    return ctx.reply("Invalid amount. Please enter a positive UE amount, for example: 100 or 1150.5");
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

  clearSession(ctx);

  const pendingMessage = await ctx.reply(`✅ Pending Order Created

Order ID: ${data.order_code}
UID: ${data.ueex_uid}
TG: ${getTelegramUserLabel(data)}
Match: ${formatTeamWithFlag(match.team_a)} vs ${formatTeamWithFlag(match.team_b)}
Selection: ${formatSelectionWithFlags(match, data.selection)}
Amount: ${formatAmount(amount)} ${match.currency}

Please transfer ${formatAmount(amount)} ${match.currency} via UEEx internal transfer to UID ${match.receiver_uid}.

Your vote will only be counted after admin confirmation.

Admin confirmation command:
/confirm_${data.order_code}_${formatAmount(amount)}`);

  await supabase
    .from("wc_orders")
    .update({
      pending_chat_id: ctx.chat.id,
      pending_message_id: pendingMessage.message_id,
      updated_at: new Date().toISOString()
    })
    .eq("order_code", data.order_code);

  return pendingMessage;
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
      confirmed_by: ctx.from.id,
      confirmed_at: new Date().toISOString(),
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

  return ctx.reply(`✅ Order Confirmed

Order ID: ${orderCode}
UID: ${order.ueex_uid}
TG: ${getTelegramUserLabel(order)}
Match: ${formatTeamWithFlag(matchData.team_a)} vs ${formatTeamWithFlag(matchData.team_b)}
Selection: ${formatSelectionWithFlags(matchData, order.selection)}
Confirmed Amount: ${formatAmount(amount)} ${matchData.currency}`);
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
  const commandMatch = cleaned.match(/^\/result_(WC[A-Z0-9]+)_([A-Za-z0-9:]+)$/i);

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
  if (!match) return "未开始";

  if (match.result) {
    return formatSelectionWithFlags(match, match.result);
  }

  if (match.status === "locked") return "进行中";
  if (match.status === "resulted" || match.status === "settled") return match.result ? formatSelectionWithFlags(match, match.result) : "进行中";

  return "未开始";
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
  const { data: orders, error } = await supabase
    .from("wc_orders")
    .select("*")
    .eq("telegram_id", ctx.from.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return ctx.reply(`Failed to load your votes: ${error.message}`);
  }

  if (!orders || orders.length === 0) {
    return ctx.reply("You have no World Cup prediction orders yet.");
  }

  const matchCodes = [...new Set(orders.map((order) => order.match_code))];

  const { data: matches, error: matchError } = await supabase
    .from("wc_matches")
    .select("*")
    .in("match_code", matchCodes);

  if (matchError) {
    return ctx.reply(`Failed to load matches: ${matchError.message}`);
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
🔸 比赛赛果：${resultDisplay}
🔸 总盈亏：${pnl}`;
  });

  return ctx.reply(`📊 My Votes

${lines.join("\n\n")}`);
}

async function showAdminHelp(ctx) {
  const text = `⚽ UEEx World Cup Bot Commands

User:
/worldcup - Join prediction
/myvote - View my votes

Admin:
/worldcup_FRA_BRA_1_1_20_0:0_3:3_Others - Create match
/confirm_O000123_1150 - Confirm payment
/void_O000123 - Void order
/lock_WC0001 - Lock match
/result_WC0001_0:0 - Record result
/preview_WC0001 - Generate settlement preview
/settle_WC0001 - Publish settlement
/chatid - Check chat ID
/ping - Test bot`;

  return ctx.reply(text);
}

bot.start(async (ctx) => {
  await ctx.reply("UEEx World Cup Bot is running. Send /worldcup in the group to join.");
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

bot.command("myvote", async (ctx) => {
  try {
    await showMyVote(ctx);
  } catch (error) {
    console.error("Myvote error:", error);
    await ctx.reply(`Error: ${error.message}`);
  }
});

bot.on("callback_query", async (ctx) => {
  try {
    const data = ctx.callbackQuery?.data || "";

    if (data.startsWith("wcmatch:")) {
      const matchCode = data.split(":")[1];
      await ctx.answerCbQuery();
      return showSelectedMatch(ctx, matchCode, true);
    }

    if (data.startsWith("wcsel:")) {
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

      const prompt = await ctx.reply(
        `Selection: ${formatSelectionWithFlags(match, selection)}\n\nPlease enter your expected ${match.currency} amount.`,
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
      return confirmOrder(ctx, cleaned);
    }

    if (/^\/void_/i.test(cleaned)) {
      return voidOrder(ctx, cleaned);
    }

    if (/^\/lock_/i.test(cleaned)) {
      return lockMatch(ctx, cleaned);
    }

    if (/^\/result_/i.test(cleaned)) {
      return setMatchResult(ctx, cleaned);
    }

    if (/^\/preview_/i.test(cleaned)) {
      return previewSettlement(ctx, cleaned);
    }

    if (/^\/settle_/i.test(cleaned)) {
      return settleMatch(ctx, cleaned);
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

        const prompt = await ctx.reply(
          `✅ UID confirmed: ${uid}\n\nSelection: ${formatSelectionWithFlags(match, session.nextSelection)}\n\nPlease enter your expected ${match.currency} amount.`,
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

      clearSession(ctx);
      await ctx.reply(`✅ UID confirmed: ${uid}`);
      return showOpenMatches(ctx);
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
  } catch (error) {
    console.error("Startup error:", error);
  }
});
