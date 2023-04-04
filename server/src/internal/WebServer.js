//imports
import express from "express";
import ViteExpress from "vite-express";
import http from "http";

//server classes
import Authentication from "../internal/Authentication.js";
import Connections from "../internal/Connections.js";

//modules
import log from "../module/Logs.js";

//config
import config from "../../config.json" assert { type: "json" };

// html path
let htmlPath =
	process.env.NODE_ENV === "production"
		? config.paths.production.html
		: config.paths.development.html;

export default class WebServer {
	constructor() {
		//init web server
		this.app = express();
		ViteExpress.config({ mode: process.env.NODE_ENV });

		//setup web server
		this.setup();
	}

	setup() {
		//proxy setting
		this.app.set("trust proxy", config.server.proxy);

		//serve client files (html/css/js/assets)
		this.app.use(
			"/",
			express.static(config.paths[process.env.NODE_ENV].client)
		);

		//setup authentication rules
		this.auth = new Authentication(this.app);

		//detect authentication and serve game page
		this.app.get("/", function (req, res) {
			//successfully authenticated
			if (
				(req.session &&
					req.session.passport &&
					req.session.passport.user) ||
				config.server.bypassAuth
			) {
				// res.sendFile("./index.html", { root: htmlPath });
				res.sendFile("index.html", { root: htmlPath });
			}

			//request authentication
			else {
				// res.sendFile("auth.html", { root: htmlPath });
				res.sendFile("index.html", { root: htmlPath });
			}
		});

		//full screen game
		this.app.get("/game", function (req, res) {
			//successfully authenticated
			if (
				(req.session &&
					req.session.passport &&
					req.session.passport.user) ||
				config.server.bypassAuth
			) {
				res.sendFile("game.html", { root: htmlPath });
			}

			//request authentication
			else {
				res.sendFile("auth.html", { root: htmlPath });
			}
		});

		//logout
		this.app.get("/logout", function (req, res) {
			req.logout(function (err) {
				if (err) {
					return next(err);
				}
				res.redirect("/");
			});
		});

		//setup connections (discord)
		new Connections(this.app);

		//start web server
		this.httpServer = http.createServer(this.app);
		ViteExpress.listen(this.app, config.server.port, () => {
			//log
			log.info("Web Server Initialized On Port: " + config.server.port);
		});
	}
}
