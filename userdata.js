const fs = require('fs');
const path = require('path');

class UserData {
    constructor() {
        this.dataPath = path.join(__dirname, 'userdata.json');
        this.data = this.loadData();
    }

    loadData() {
        try {
            if (fs.existsSync(this.dataPath)) {
                return JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
        return {};
    }

    saveData() {
        try {
            fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving user data:', error);
        }
    }

    generateReferralCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    getUser(userId) {
        if (!this.data[userId]) {
            this.data[userId] = {
                tokens: 100,
                dailyChats: 0,
                lastChatDate: null,
                referralCode: this.generateReferralCode(),
                referredBy: null
            };
            this.saveData();
        }
        return this.data[userId];
    }

    registerChat(userId) {
        const user = this.getUser(userId);
        const today = new Date().toDateString();
        
        if (user.lastChatDate !== today) {
            user.dailyChats = 0;
            user.lastChatDate = today;
        }

        if (user.dailyChats < 3) {
            user.dailyChats++;
            user.tokens += 10;
            this.saveData();
            return true;
        }
        return false;
    }

    useReferralCode(userId, code) {
        const user = this.getUser(userId);
        
        if (user.referredBy) {
            return { success: false, message: "You have already used a referral code." };
        }

        for (const [refId, refUser] of Object.entries(this.data)) {
            if (refUser.referralCode === code && refId !== userId.toString()) {
                user.referredBy = refId;
                user.tokens += 50;
                this.data[refId].tokens += 30;
                this.saveData();
                return { success: true, message: "✅ Referral code applied! You got 50 tokens!" };
            }
        }
        
        return { success: false, message: "❌ Invalid referral code." };
    }
}

module.exports = new UserData();