interface User {
    tokens: number;
    dailyChats: number;
    referralCode: string;
    ratings: number[];
    averageRating: number;
}

const users = new Map<number, User>();

export async function getUser(userId: number): Promise<User> {
    if (!users.has(userId)) {
        users.set(userId, {
            tokens: 0,
            dailyChats: 0,
            referralCode: generateReferralCode(),
            ratings: [],
            averageRating: 5 // Default rating
        });
    }
    return users.get(userId)!;
}

export async function addRating(userId: number, rating: number): Promise<void> {
    const user = await getUser(userId);
    user.ratings.push(rating);
    user.averageRating = user.ratings.reduce((a, b) => a + b, 0) / user.ratings.length;
}

export async function registerChat(userId: number): Promise<boolean> {
    const user = await getUser(userId);
    if (user.dailyChats < 3) {
        user.tokens += 10;
        user.dailyChats += 1;
        return true;
    }
    return false;
}

export async function useReferralCode(userId: number, code: string): Promise<{success: boolean, message: string}> {
    const user = await getUser(userId);
    if (user.tokens > 0) {
        return {
            success: false,
            message: "❌ You can only use referral codes when you have 0 tokens."
        };
    }
    
    user.tokens += 5;
    return {
        success: true,
        message: "✅ Referral code used successfully! You got 5 tokens."
    };
}

function generateReferralCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}