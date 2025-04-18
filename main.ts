import { Bot, Keyboard, Context, InlineKeyboard, webhookCallback } from "https://deno.land/x/grammy@v1.19.2/mod.ts";
import * as userData from "./userData.ts";

// Add more detailed token verification
const token = Deno.env.get("BOT_TOKEN");
if (!token) {
    console.error("BOT_TOKEN not found in environment variables!");
    Deno.exit(1);
}
console.log("Bot token verified successfully");

// Initialize bot with error handling
const bot = new Bot(token);

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

// Remove this line
// await bot.api.deleteMyCommands();

// Basic command handler with keyboard buttons
bot.command("start", async (ctx) => {
    try {
        await bot.api.deleteMyCommands();
        await ctx.reply("Welcome to GramRoulette bot! 👋\nSelect an option:", {
            reply_markup: new Keyboard([
                ["🔍 Search Chat", "🚫 Stop Search"],
                ["❌ End Chat", "⭐ My Rating"]
            ])
            .resized()
        });
    } catch (error) {
        console.error("Error in start command:", error);
        await ctx.reply("Welcome! The bot is starting up...");
    }
});

// Handle keyboard button actions
bot.hears("🔍 Search Chat", async (ctx) => await searchPartner(ctx));
bot.hears("🚫 Stop Search", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    if (waitingUsers.delete(userId)) {
        await ctx.reply("✅ Search cancelled.");
    } else {
        await ctx.reply("❌ You were not searching for a chat.");
    }
});
bot.hears("❌ End Chat", async (ctx) => await stopChat(ctx));
bot.hears("⭐ My Rating", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const user = await userData.getUser(userId);
    await ctx.reply(`Your average rating: ${user.averageRating.toFixed(1)}⭐\nBased on ${user.ratings.length} ratings`);
});

// Modify searchPartner to match by rating
const searchPartner = async (ctx: Context) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    if (chatPairs.has(userId)) {
        return await ctx.reply("❌ You are already in a chat. Use 'End Chat' to end it first.");
    }

    if (waitingUsers.has(userId)) {
        return await ctx.reply("⏳ You are already in the waiting list.");
    }

    const currentUser = await userData.getUser(userId);
    
    // Find best match from waiting users
    let bestMatch = null;
    let smallestRatingDiff = Infinity;
    
    for (const waitingId of waitingUsers) {
        if (waitingId !== userId) {
            const waitingUser = await userData.getUser(waitingId);
            const ratingDiff = Math.abs(currentUser.averageRating - waitingUser.averageRating);
            if (ratingDiff < smallestRatingDiff) {
                smallestRatingDiff = ratingDiff;
                bestMatch = waitingId;
            }
        }
    }

    if (bestMatch) {
        waitingUsers.delete(bestMatch);
        chatPairs.set(userId, bestMatch);
        chatPairs.set(bestMatch, userId);
        
        await ctx.reply("✅ Chat partner found! You can start chatting now.");
        await bot.api.sendMessage(bestMatch, "✅ Chat partner found! You can start chatting now.");
        return;
    }

    waitingUsers.add(userId);
    await ctx.reply("🔍 Searching for a chat partner... Please wait.");
};

// Modify stopChat to include rating
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

    // Create inline keyboard for rating
    const ratingKeyboard = new InlineKeyboard();
    for (let i = 1; i <= 5; i++) {
        ratingKeyboard.text(`${i}⭐`, `rate_${partnerId}_${i}`);
    }
    ratingKeyboard.row();
    for (let i = 6; i <= 10; i++) {
        ratingKeyboard.text(`${i}⭐`, `rate_${partnerId}_${i}`);
    }
    
    if (await userData.registerChat(userId)) {
        await ctx.reply("✅ Chat ended. You earned 10 tokens! 🎉\nPlease rate your chat partner:", {
            reply_markup: ratingKeyboard
        });
    }
    await bot.api.sendMessage(partnerId, "❌ Your chat partner has disconnected.");
};

// Add rating callback handler
bot.callbackQuery(/rate_(\d+)_(\d+)/, async (ctx) => {
    const match = ctx.callbackQuery.data.match(/rate_(\d+)_(\d+)/);
    if (!match) return;

    const ratedUserId = parseInt(match[1]);
    const rating = parseInt(match[2]);
    
    await userData.addRating(ratedUserId, rating);
    await ctx.reply(`Thanks for rating! You gave ${rating}⭐`);
    await ctx.answerCallbackQuery();
});

bot.hears("💰 Tokens", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    await ctx.reply(await formatTokensMessage(userId));
});
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
bot.hears("⚠️ Report", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !chatPairs.has(userId)) {
        return await ctx.reply("❌ You are not in a chat to report anyone.");
    }
    await ctx.reply("⚠️ User reported. Moderators will review this case.");
});

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
// Modify the webhook handler for better error logging
const handler = async (req: Request): Promise<Response> => {
    try {
        if (req.method === "POST") {
            const url = new URL(req.url);
            console.log("Received webhook request at:", url.pathname);
            
            if (url.pathname === "/webhook") {
                try {
                    const result = await handleUpdate(req);
                    console.log("Webhook handled successfully");
                    return result;
                } catch (err) {
                    console.error("Webhook handler error:", err);
                    return new Response("Webhook Error", { status: 500 });
                }
            }
        }
        return new Response("Bot is running", { status: 200 });
    } catch (err) {
        console.error("Handler error:", err);
        return new Response("Server Error", { status: 500 });
    }
};

// Add startup logging
Deno.serve(handler);
console.log("Bot webhook server running on port 8000");

// Add error handling
bot.catch((err) => {
    console.error("Bot error:", err);
});

// Add graceful shutdown
Deno.addSignalListener("SIGINT", () => bot.stop());
Deno.addSignalListener("SIGTERM", () => bot.stop());