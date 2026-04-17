const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: { 
        type: String, 
        required: true, 
        unique: true, 
        uppercase: true,
        trim: true 
    },
    description: { 
        type: String, 
        default: '' 
    },
    discountType: { 
        type: String, 
        enum: ['percentage', 'fixed'], 
        default: 'percentage' 
    },
    discountValue: { 
        type: Number, 
        required: true,
        min: 0 
    },
    minOrderAmount: { 
        type: Number, 
        default: 0,
        min: 0 
    },
    maxDiscountAmount: { 
        type: Number, 
        default: null 
    },
    usageLimit: { 
        type: Number, 
        default: null
    },
    perUserLimit: { 
        type: Number, 
        default: 1
    },
    usedCount: { 
        type: Number, 
        default: 0 
    },
    userUsage: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        usedCount: { type: Number, default: 0 },
        usedAt: { type: Date, default: Date.now }
    }],
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    visibility: {
        type: String,
        enum: ['public', 'private', 'hidden'],
        default: 'public'
    },
    showOnWebsite: { 
        type: Boolean, 
        default: true 
    },
    applicableUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    applicableNotes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Note',
        default: null
    }],
    shareableLink: { 
        type: String,
        default: null
    },
    shareCount: { 
        type: Number, 
        default: 0 
    },
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1, endDate: 1, startDate: 1 });
couponSchema.index({ visibility: 1, showOnWebsite: 1 });

couponSchema.pre('save', function(next) {
    if (!this.shareableLink) {
        this.shareableLink = `/coupon/${this.code}`;
    }
    next();
});

couponSchema.methods.isValid = async function(userId, amount = 0, noteId = null) {
    const now = new Date();
    
    if (!this.isActive) {
        return { valid: false, message: 'Coupon is inactive' };
    }
    
    if (now < this.startDate) {
        return { valid: false, message: 'Coupon has not started yet' };
    }
    
    if (now > this.endDate) {
        return { valid: false, message: 'Coupon has expired' };
    }
    
    if (this.usageLimit && this.usedCount >= this.usageLimit) {
        return { valid: false, message: 'Coupon usage limit reached' };
    }
    
    if (userId && this.perUserLimit) {
        const userUsage = this.userUsage.find(u => u.userId && u.userId.toString() === userId.toString());
        if (userUsage && userUsage.usedCount >= this.perUserLimit) {
            return { valid: false, message: 'You have already used this coupon maximum times' };
        }
    }
    
    if (this.visibility === 'private' && this.applicableUsers && this.applicableUsers.length > 0 && userId) {
        const isAllowed = this.applicableUsers.some(id => id.toString() === userId.toString());
        if (!isAllowed) {
            return { valid: false, message: 'This coupon is not available for you' };
        }
    }
    
    if (amount > 0 && this.minOrderAmount > 0 && amount < this.minOrderAmount) {
        return { valid: false, message: `Minimum order amount should be ₹${this.minOrderAmount}` };
    }
    
    if (noteId && this.applicableNotes && this.applicableNotes.length > 0) {
        const isApplicable = this.applicableNotes.some(id => id.toString() === noteId.toString());
        if (!isApplicable) {
            return { valid: false, message: 'Coupon not applicable for this note' };
        }
    }
    
    return { valid: true, message: 'Coupon is valid' };
};

couponSchema.methods.calculateDiscount = function(amount) {
    let discount = 0;
    
    if (this.discountType === 'percentage') {
        discount = (amount * this.discountValue) / 100;
        if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
            discount = this.maxDiscountAmount;
        }
    } else {
        discount = Math.min(this.discountValue, amount);
    }
    
    return Math.floor(discount);
};

couponSchema.methods.applyCoupon = async function(userId) {
    this.usedCount += 1;
    
    if (userId) {
        const userUsageIndex = this.userUsage.findIndex(u => u.userId && u.userId.toString() === userId.toString());
        if (userUsageIndex >= 0) {
            this.userUsage[userUsageIndex].usedCount += 1;
            this.userUsage[userUsageIndex].usedAt = new Date();
        } else {
            this.userUsage.push({ userId, usedCount: 1, usedAt: new Date() });
        }
    }
    
    await this.save();
};

module.exports = mongoose.model('Coupon', couponSchema);