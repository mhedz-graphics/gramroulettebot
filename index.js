const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();
console.log('Token loaded:', process.env.TELEGRAM_BOT_TOKEN);

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const userData = require('./userdata');

// User states and chat pairs
let waitingUsers = new Set();
let chatPairs = new Map();

// Function to format tokens message
const formatTokensMessage = (userId) => {
    const user = userData.getUser(userId);
    return `💰 Tokens: ${user.tokens}\n` +
           `🎯 Completed chats today: ${user.dailyChats}/3\n` +
           `🎫 Your referral code: ${user.referralCode}`;
};

// Set up bot commands menu
bot.telegram.setMyCommands([
    { command: 'start', description: 'Start the bot' },
    { command: 'search', description: 'Search for a chat partner' },
    { command: 'stop', description: 'End current chat' },
    { command: 'report', description: 'Report user' },
    { command: 'status', description: 'Check current status' },
    { command: 'tokens', description: 'Check your tokens' },
    { command: 'refer', description: 'Use referral code' }
]);

// Basic command handler with keyboard buttons
bot.command('start', (ctx) => {
    ctx.reply('Welcome to GramRoulette bot! 👋\nSelect an option:', 
        Markup.keyboard([
            ['🔍 Search Partner', '❌ End Chat'],
            ['⚠️ Report', '📊 Status'],
            ['💰 Tokens', '❓ Help']
        ])
        .resize()
    );
});

// Handle keyboard button actions
bot.hears('🔍 Search Partner', (ctx) => searchPartner(ctx));
bot.hears('❌ End Chat', (ctx) => stopChat(ctx));
bot.hears('⚠️ Report', (ctx) => {
    const userId = ctx.from.id;
    if (!chatPairs.has(userId)) {
        return ctx.reply('❌ You are not in a chat to report anyone.');
    }
    ctx.reply('⚠️ User reported. Moderators will review this case.');
});
bot.hears('📊 Status', (ctx) => {
    const userId = ctx.from.id;
    let status = '📊 Current Status:\n';
    
    if (chatPairs.has(userId)) {
        status += '- You are in an active chat\n';
    } else if (waitingUsers.has(userId)) {
        status += '- You are waiting for a partner\n';
    } else {
        status += '- You are not in a chat\n';
    }
    
    status += `- Users waiting: ${waitingUsers.size}\n`;
    status += `- Active chats: ${chatPairs.size / 2}`;
    
    ctx.reply(status);
});
bot.hears('💰 Tokens', (ctx) => {
    ctx.reply(formatTokensMessage(ctx.from.id));
});
bot.hears('❓ Help', (ctx) => {
    ctx.reply('Available commands:\n' +
        '🔍 /search - Find a chat partner\n' +
        '❌ /stop - End current chat\n' +
        '⚠️ /report - Report user\n' +
        '📊 /status - Check current status\n' +
        '💰 /tokens - Check your tokens\n' +
        '🎫 /refer <code> - Use referral code\n' +
        '❓ /help - Show this help');
});

// Handle search for chat partner
const searchPartner = (ctx) => {
    const userId = ctx.from.id;
    
    // If user is already in a chat
    if (chatPairs.has(userId)) {
        return ctx.reply('❌ You are already in a chat. Use /stop to end it first.');
    }

    // If user is already waiting
    if (waitingUsers.has(userId)) {
        return ctx.reply('⏳ You are already in the waiting list.');
    }

    // If there are other users waiting
    if (waitingUsers.size > 0) {
        const partnerId = waitingUsers.values().next().value;
        if (partnerId !== userId) {
            waitingUsers.delete(partnerId);
            chatPairs.set(userId, partnerId);
            chatPairs.set(partnerId, userId);
            
            ctx.reply('✅ Chat partner found! You can start chatting now.');
            bot.telegram.sendMessage(partnerId, '✅ Chat partner found! You can start chatting now.');
            return;
        }
    }

    // Add user to waiting list
    waitingUsers.add(userId);
    ctx.reply('🔍 Searching for a chat partner... Please wait.');
};

// Handle stop chat
const stopChat = (ctx) => {
    const userId = ctx.from.id;
    
    if (!chatPairs.has(userId)) {
        waitingUsers.delete(userId);
        return ctx.reply('❌ You are not in a chat.');
    }

    const partnerId = chatPairs.get(userId);
    chatPairs.delete(userId);
    chatPairs.delete(partnerId);
    
    // Register completed chat and give tokens if applicable
    if (userData.registerChat(userId)) {
        ctx.reply('✅ Chat ended. You earned 10 tokens! 🎉');
    } else {
        ctx.reply('✅ Chat ended.');
    }
    bot.telegram.sendMessage(partnerId, '❌ Your chat partner has disconnected.');
};

// Handle message forwarding
bot.on('message', (ctx) => {
    const userId = ctx.from.id;
    
    if (chatPairs.has(userId)) {
        const partnerId = chatPairs.get(userId);
        bot.telegram.sendMessage(partnerId, ctx.message.text);
    }
});

// Handle button actions
bot.action('search', (ctx) => {
    ctx.answerCbQuery();
    searchPartner(ctx);
});

bot.action('stop', (ctx) => {
    ctx.answerCbQuery();
    stopChat(ctx);
});

bot.action('report', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.from.id;
    if (!chatPairs.has(userId)) {
        return ctx.reply('❌ You are not in a chat to report anyone.');
    }
    ctx.reply('⚠️ User reported. Moderators will review this case.');
});

bot.action('status', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.from.id;
    let status = '📊 Current Status:\n';
    
    if (chatPairs.has(userId)) {
        status += '- You are in an active chat\n';
    } else if (waitingUsers.has(userId)) {
        status += '- You are waiting for a partner\n';
    } else {
        status += '- You are not in a chat\n';
    }
    
    status += `- Users waiting: ${waitingUsers.size}\n`;
    status += `- Active chats: ${chatPairs.size / 2}`;
    
    ctx.reply(status);
});

bot.action('help', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('Available commands:\n' +
        '🔍 /search - Find a chat partner\n' +
        '❌ /stop - End current chat\n' +
        '⚠️ /report - Report user\n' +
        '📊 /status - Check current status\n' +
        '💰 /tokens - Check your tokens\n' +
        '🎫 /refer <code> - Use referral code\n' +
        '❓ /help - Show this help');
});

// Command to use referral code
bot.command('refer', (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length !== 2) {
        return ctx.reply('❌ Correct usage: /refer <code>');
    }

    const referralCode = args[1].toUpperCase();
    const result = userData.useReferralCode(ctx.from.id, referralCode);
    ctx.reply(result.message);
});

// Launch the bot
bot.launch()
    .then(() => {
        console.log('Bot is running...');
    })
    .catch((err) => {
        console.error('Bot launch failed:', err);
    });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));