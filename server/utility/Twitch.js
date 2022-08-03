// Twitch functions and events

//dependency: file path
const path = require('path');

//get config values
const config = require(path.join(__dirname, '../config/config.json'));

//imports
const utility = require(path.join(__dirname, '../utility/Utility.js'));

//twitch api
const twurpleAuth = require('@twurple/auth');
const twurpleAPI = require('@twurple/api');
const twurpleEvent = require('@twurple/eventsub');
const e = require('express');
const authProvider = new twurpleAuth.ClientCredentialsAuthProvider(
    config.twitch.clientID,
    config.twitch.clientSecret
);
const twitchAPI = new twurpleAPI.ApiClient({ authProvider });

module.exports = {
    //set up event subs
    init: async function (userName) {
        //get user ID from user name
        let userID = await this.getUserIDByName(userName);

        //init listener
        let listener;

        //development
        if (config.server.local) {
            const twurpleEventLocal = require('@twurple/eventsub-ngrok');

            listener = new twurpleEvent.EventSubListener({
                twitchAPI,
                adapter: new twurpleEventLocal.NgrokAdapter(),
                secret: config.streamelements.clientSecret,
            })
        }

        //production
        else {
            listener = new twurpleEvent.EventSubListener({
                twitchAPI,
                adapter: new twurpleEvent.DirectConnectionAdapter({
                        hostName: 'example.com',
                        sslCert: {
                            key: 'aaaaaaaaaaaaaaa',
                            cert: 'bbbbbbbbbbbbbbb'
                        }
                    }),
                secret: config.streamelements.clientSecret,
            })
        }

        //start listener
        await listener.listen();

        //online event
        const onlineSubscription = await listener.subscribeToStreamOnlineEvents(userID, e => {
            console.log(utility.timestampString(`${e.broadcasterDisplayName} just went live!`));
        });
        
        //offline event
        const offlineSubscription = await listener.subscribeToStreamOfflineEvents(userID, e => {
            console.log(utility.timestampString(`${e.broadcasterDisplayName} just went offline`));
        });
    },

    isStreamLive: async function (stream) {
        try {
            live = (await twitchAPI.streams.getStreamByUserName(stream))
                ? true
                : false;
            console.log(
                utility.timestampString('Is ' + stream + ' Live?: ' + live)
            );
        } catch (error) {
            console.log(
                utility.timestampString('Stream Live Check Error: ' + error)
            );
        }
    },

    getUserByName: async function (userName) {
        return await twitchAPI.users.getUserByName(userName);
    },

    getUserIDByName: async function (userName) {
        let user = await this.getUserByName(userName);
        return user.id;
    }
};
