import { Bot, Keyboard, Context, InlineKeyboard, webhookCallback } from "grammy/mod.ts";
import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";
import * as userData from "./userData.ts";

// Load environment variables
const env = await load();
const bot = new Bot(env["TELEGRAM_BOT_TOKEN"] || "");

// User states and chat pairs
const waitingUsers = new Set<number>();
const chatPairs = new Map<number, number>();

// Function to format tokens message
const formatTokensMessage = async (userId: number) => {
    const user = await userData.getUser(userId);
    return `💰 Tokens: ${user.tokens}\n` +
           `🎯 Completed chats today: ${user.dailyChats}/3\n` +
           `🎫 Your referral code: ${user.referralCode}`;
};

// Set up bot commands menu
await bot.api.setMyCommands([
    { command: "start", description: "Start the bot" },
    { command: "search", description: "Search for a chat partner" },
    { command: "stop", description: "End current chat" },
    { command: "report", description: "Report user" },
    { command: "status", description: "Check current status" },
    { command: "tokens", description: "Check your tokens" },
    { command: "refer", description: "Use referral code" }
]);

// Basic command handler with keyboard buttons
bot.command("start", async (ctx) => {
    await ctx.reply("Welcome to GramRoulette bot! 👋\nSelect an option:", {
        reply_markup: new Keyboard([
            ["🔍 Search Partner", "❌ End Chat"],
            ["⚠️ Report", "📊 Status"],
            ["💰 Tokens", "❓ Help"]
        ])
        .resized()
    });
});

// Handle keyboard button actions
// Update keyboard button handlers
bot.hears("🔍 Search Partner", async (ctx) => await searchPartner(ctx));
bot.hears("❌ End Chat", async (ctx) => await stopChat(ctx));
bot.hears("⚠️ Report", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !chatPairs.has(userId)) {
        return await ctx.reply("❌ You are not in a chat to report anyone.");
    }
    await ctx.reply("⚠️ User reported. Moderators will review this case.");
});

// Handle search for chat partner
const searchPartner = async (ctx: Context) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    if (chatPairs.has(userId)) {
        return await ctx.reply("❌ You are already in a chat. Use /stop to end it first.");
    }

    if (waitingUsers.has(userId)) {
        return await ctx.reply("⏳ You are already in the waiting list.");
    }

    if (waitingUsers.size > 0) {
        const partnerId = waitingUsers.values().next().value;
        if (partnerId !== userId) {
            waitingUsers.delete(partnerId);
            chatPairs.set(userId, partnerId);
            chatPairs.set(partnerId, userId);
            
            await ctx.reply("✅ Chat partner found! You can start chatting now.");
            await bot.api.sendMessage(partnerId, "✅ Chat partner found! You can start chatting now.");
            return;
        }
    }

    waitingUsers.add(userId);
    await ctx.reply("🔍 Searching for a chat partner... Please wait.");
};

// Handle stop chat
const stopChat = async (ctx: Context) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    if (!chatPairs.has(userId)) {
        waitingUsers.delete(userId);
        return await ctx.reply("❌ You are not in a chat.");
    }

    const partnerId = chatPairs.get(userId);
    if (!partnerId) return;
    
    chatPairs.delete(userId);
    chatPairs.delete(partnerId);
    
    if (await userData.registerChat(userId)) {
        await ctx.reply("✅ Chat ended. You earned 10 tokens! 🎉");
    } else {
        await ctx.reply("✅ Chat ended.");
    }
    await bot.api.sendMessage(partnerId, "❌ Your chat partner has disconnected.");
};

// Handle message forwarding
bot.on("message", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !chatPairs.has(userId)) return;
    
    const partnerId = chatPairs.get(userId);
    if (!partnerId) return;
    
    const text = ctx.message?.text;
    if (text) {
        await bot.api.sendMessage(partnerId, text);
    }
});

// Replace the bot.start() section with this webhook setup
const handleUpdate = webhookCallback(bot, "std/http");

// Replace the Deno.serve section with this:
const handler = async (req: Request): Promise<Response> => {
    if (req.method === "POST") {
        const url = new URL(req.url);
        if (url.pathname === "/webhook") {
            try {
                return await handleUpdate(req);
            } catch (err) {
                console.error(err);
                return new Response("Error", { status: 500 });
            }
        }
    }
    return new Response("Bot is running", { status: 200 });
};

Deno.serve(handler);
console.log("Webhook server running on port 8000");

// Add error handling
bot.catch((err) => {
    console.error("Bot error:", err);
});

// Add graceful shutdown
Deno.addSignalListener("SIGINT", () => bot.stop());
Deno.addSignalListener("SIGTERM", () => bot.stop());

// Move all command handlers before bot.start()
bot.hears("📊 Status", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    let status = "📊 Current Status:\n";
    if (chatPairs.has(userId)) {
        status += "- You are in an active chat\n";
    } else if (waitingUsers.has(userId)) {
        status += "- You are waiting for a partner\n";
    } else {
        status += "- You are not in a chat\n";
    }
    
    status += `- Users waiting: ${waitingUsers.size}\n`;
    status += `- Active chats: ${chatPairs.size / 2}`;
    
    await ctx.reply(status);
});

bot.hears("💰 Tokens", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    await ctx.reply(await formatTokensMessage(userId));
});

bot.hears("❓ Help", async (ctx) => {
    await ctx.reply("Available commands:\n" +
        "🔍 /search - Find a chat partner\n" +
        "❌ /stop - End current chat\n" +
        "⚠️ /report - Report user\n" +
        "📊 /status - Check current status\n" +
        "💰 /tokens - Check your tokens\n" +
        "🎫 /refer <code> - Use referral code\n" +
        "❓ /help - Show this help");
});

// Add search command handler
bot.command("search", (ctx) => searchPartner(ctx));

// Add stop command handler
bot.command("stop", (ctx) => stopChat(ctx));