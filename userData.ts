interface User {
    id: number;
    tokens: number;
    dailyChats: number;
    referralCode: string;
    lastChatDate: string;
    usedReferral: boolean;
}

const users = new Map<number, User>();

function generateReferralCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
}

export async function getUser(userId: number): Promise<User> {
    if (!users.has(userId)) {
        users.set(userId, {
            id: userId,
            tokens: 10,
            dailyChats: 0,
            referralCode: generateReferralCode(),
            lastChatDate: getTodayDate(),
            usedReferral: false
        });
    }
    return users.get(userId)!;
}

export async function registerChat(userId: number): Promise<boolean> {
    const user = await getUser(userId);
    const today = getTodayDate();
    
    if (user.lastChatDate !== today) {
        user.dailyChats = 0;
        user.lastChatDate = today;
    }

    if (user.dailyChats >= 3) {
        return false;
    }

    user.dailyChats++;
    user.tokens += 10;
    return true;
}

export async function useReferralCode(userId: number, code: string): Promise<{ success: boolean; message: string }> {
    const user = await getUser(userId);
    
    if (user.usedReferral) {
        return {
            success: false,
            message: "❌ You have already used a referral code."
        };
    }

    const referrer = Array.from(users.values()).find(u => u.referralCode === code);
    if (!referrer || referrer.id === userId) {
        return {
            success: false,
            message: "❌ Invalid referral code."
        };
    }

    user.tokens += 20;
    user.usedReferral = true;
    referrer.tokens += 30;

    return {
        success: true,
        message: "✅ Referral code applied! You received 20 tokens."
    };
}