import Phaser from "phaser";
import WebFont from "webfontloader";
import ColorScheme from "../../utility/ColorScheme";
import $ from "jquery";

//
// This is meant for loading in any data, such as a save game state, prior to entering the main menu.
//

// loaded room data
let roomData: {
	[room: string]: roomInfo;
} = {};

// types
interface roomInfo {
	music: string | undefined;
	layers: Array<roomLayer>;
}
interface roomLayer {
	texture: {
		key: string;
		path: string;
	};
}

export default class Load extends Phaser.Scene {
	constructor() {
		super({
			key: "Load",
			pack: {
				files: [
					{
						type: "json",
						key: "textureData",
						url: "/data/texture.json",
					},
					{
						type: "json",
						key: "playerData",
						url: "/data/player.json",
					},
					{
						type: "json",
						key: "itemData",
						url: "/data/item.json",
					},
					{
						type: "json",
						key: "eventDefaultData",
						url: "/data/event/default.json",
					},
				],
			},
		});
	}

	async preload() {
		// begin loading screen
		this.runLoadingScreen(this);

		// load global textures
		const textureData = this.cache.json.get("textureData");
		Object.keys(textureData).forEach((key) => {
			// texture
			if (typeof textureData[key] === "string") {
				this.load.image(key, textureData[key]);
				return;
			}

			// sprite sheet
			if (textureData[key].type === "spritesheet") {
				this.load.spritesheet(key, textureData[key].texture, {
					frameWidth: Number(textureData[key].frameWidth),
					frameHeight: Number(textureData[key].frameHeight),
				});
				return;
			}
		});

		// load room
		const roomsDefaultData = this.cache.json.get("eventDefaultData").rooms;
		Object.keys(roomsDefaultData).forEach(async (room) => {
			// get room data
			await $.getJSON("../../" + roomsDefaultData[room]).then(
				(roomInfo: roomInfo) => {
					// save room data
					roomData[room] = roomInfo;

					// load room textures
					Object.keys(roomInfo.layers).forEach((layer) => {
						this.load.image(
							roomInfo.layers[layer as any].texture.key,
							"../../" +
								roomInfo.layers[layer as any].texture.path
						);
					});
				}
			);
		});
		this.registry.set("roomData", roomData);

		// load font
		WebFont.load({
			custom: {
				families: ["Burbin"],
				urls: ["/site/css/styles.css"],
			},
		});
	}

	create() {
		// Menu
		this.scene.start("Game");
	}

	runLoadingScreen(scene: Phaser.Scene) {
		// set background color
		scene.cameras.main.setBackgroundColor(ColorScheme.Blue);

		// create progress bar
		let boxWidth = 600;
		let boxHeight = 80;
		let barWidth = 580;
		let barHeight = 60;
		let progressBar = scene.add.graphics();
		let progressBox = scene.add.graphics();
		progressBox.fillStyle(ColorScheme.DarkBlue, 1);
		progressBox.fillRoundedRect(
			scene.sys.game.canvas.width / 2 - boxWidth / 2,
			scene.sys.game.canvas.height / 2 - boxHeight / 2,
			boxWidth,
			boxHeight,
			15
		);

		// continue progress bar
		scene.load.on("progress", function (value: number) {
			progressBar.clear();
			progressBar.fillStyle(ColorScheme.LightBlue, 1);
			progressBar.fillRoundedRect(
				scene.sys.game.canvas.width / 2 - barWidth / 2,
				scene.sys.game.canvas.height / 2 - barHeight / 2,
				barWidth * value,
				barHeight,
				15
			);
		});

		// remove progress bar
		scene.load.on("complete", function () {
			progressBar.destroy();
			progressBox.destroy();
		});
	}
}
