// types
declare module "express-session" {
	export interface SessionData {
		user: { [key: string]: any };
	}
}
declare module "http" {
	export interface IncomingMessage {
		originalUrl: string;
        res: any;
	}
}
import { Express, NextFunction, Request } from 'express';
import { Server as SocketIOServer } from 'socket.io';

// imports
import session from "express-session";
import passport from "passport";
import crypto from "crypto";
// import bcrypt from 'bcrypt';
import { OAuth2Strategy } from "passport-oauth";
import axios from "axios";
import cookieParseFactory from "cookie-parser";
const cookieParse = cookieParseFactory();

//modules
import database from "../module/Database.js";
import log from "../module/Logs.js";

//config
import config from "../../config.json" assert { type: "json" };

//auth rules
const sessionAuthentication = session({
	secret: crypto.randomBytes(64).toString("hex"),
	resave: false,
	saveUninitialized: false,
	proxy: config.server.proxy,
});
const passportInit = passport.initialize();
const passportSession = passport.session();

export default class Authentication {
    app: Express;

	constructor(app: Express) {
		//store web server
		this.app = app;

		//setup authentication rules
		this.setup();
	}

	setup() {
		//init authentication
		this.app.use(sessionAuthentication);
		this.app.use(passportInit);
		this.app.use(passportSession);

		//override passport profile function to get user profile from Twitch API
		OAuth2Strategy.prototype.userProfile = function (accessToken: string, done: Function) {
			axios
				.get("https://api.twitch.tv/helix/users", {
					headers: {
						"Client-ID": config.twitch.clientID,
						Accept: "application/vnd.twitchtv.v5+json",
						Authorization: "Bearer " + accessToken,
					},
					responseType: "json",
				})
				.then((response) => {
					//success
					if (response && response.status == 200) {
						//automatic parsing
						if (
							response.headers["content-type"].includes(
								"application/json"
							)
						) {
							done(null, response.data);
						}
						//response isn't considered json from origin server- force parsing
						else {
							done(null, JSON.parse(response.data));
						}
					}
				})
				.catch((error) => {
					if (error.response) {
						//log
						log.error(
							"Fetching Twitch User Profile -> " +
								error.response.status +
								": " +
								error.response.data
						);
					}
				});
		};

		passport.serializeUser(function (user: Express.User, done: Function) {
			done(null, user);
		});

		passport.deserializeUser(function (user: Express.User, done: Function) {
			done(null, user);
		});

		//CRASH ISSUE
		passport.use(
			"twitch",
			new OAuth2Strategy(
				{
					authorizationURL: "https://id.twitch.tv/oauth2/authorize",
					tokenURL: "https://id.twitch.tv/oauth2/token",
					clientID: config.twitch.clientID,
					clientSecret: config.twitch.clientSecret,
					callbackURL: config.twitch.callbackURL,
					state: true,
				},

				async function (accessToken: string, refreshToken: string, profile: {accessToken: string, refreshToken: string, data: any}, done: Function) {
					profile.accessToken = accessToken;
					profile.refreshToken = refreshToken;

					//store users name and ID in database
					var path = "users/" + profile.data[0].id + "/name";
					const pathExists = await database.pathExists(path);
					if (!pathExists) {
						database.setValue(path, profile.data[0].display_name);
					}

					done(null, profile);
				}
			)
		);

		//set route to start OAuth link, this is where you define scopes to request
		this.app.get(
			"/auth/twitch",
			passport.authenticate("twitch", { scope: "user_read" })
		);

		//set route for OAuth redirect
		this.app.get(
			"/auth/twitch/callback",
			passport.authenticate("twitch", {
				successRedirect: "/",
				failureRedirect: "/",
			})
		);
	}

	//websocket authentication rules
	websocketAuthentication(io: SocketIOServer) {
		//authentication
		// instrument(io, {
		//     auth: {
		//         type: config.socketio_admin_dash.auth.type,
		//         username: config.socketio_admin_dash.auth.username,
		//         password: bcrypt.hashSync(
		//             config.socketio_admin_dash.auth.password,
		//             10
		//         ),
		//     },
		// });
		io.use((socket, next) => {
			socket.client.request.originalUrl = socket.client.request.url as string;
			cookieParse(socket.client.request as Request, socket.client.request.res, next as NextFunction);
		});
		io.use((socket, next) => {
			socket.client.request.originalUrl = socket.client.request.url as string;
			sessionAuthentication(
				socket.client.request as Request,
				socket.client.request.res,
				next as NextFunction
			);
		});
		io.use((socket, next) => {
			passportInit(
				socket.client.request as any,
				socket.client.request.res,
				next as NextFunction
			);
		});
		io.use((socket, next) => {
			passportSession(
				socket.client.request as any,
				socket.client.request.res,
				next as NextFunction
			);
		});
	}
}
