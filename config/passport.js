const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        
        // Check if user exists
        let user = await User.findOne({ email });
        
        if (!user) {
            // Create new user
            user = new User({
                name: profile.displayName,
                email: email,
                password: Math.random().toString(36) + Date.now(),
                role: 'user',
                isBlocked: false
            });
            await user.save();
        }
        
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

module.exports = passport;