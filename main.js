/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4,
maxerr: 50, browser: true */
/*global $, define, brackets */

define(function (require, exports, module) {
	"use strict";

	var moduleId = "me.apla.brackets-arduino";

	var ExtensionUtils     = brackets.getModule("utils/ExtensionUtils"),
		NodeDomain         = brackets.getModule("utils/NodeDomain"),
		PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
		Dialogs            = brackets.getModule("widgets/Dialogs"),
	    DocumentManager    = brackets.getModule("document/DocumentManager");


	var prefs = PreferencesManager.getExtensionPrefs (moduleId);

//	prefs.definePreference ("board", "object", {});
//	prefs.definePreference ("port", "string", null);

	var stateManager = PreferencesManager.stateManager.getPrefixedSystem (moduleId);

//	prefs.definePreference ("panelVisible", "boolean", false);

//	prefs.definePreference ("patterns", "array", []).on("change", function () {
//	});

	var arduinoDomain = new NodeDomain("arduino", ExtensionUtils.getModulePath(module, "node/ArduinoDomain"));
	ExtensionUtils.loadStyleSheet(module, "style.css");

	function ArduinoExt (require, domain) {
		this.domain = domain;
		this.createUI (require);
	}

	var app = brackets.getModule('utils/AppInit');

	ArduinoExt.prototype.loadNodePart = function () {

	}


	ArduinoExt.prototype.enumerateSerialPorts = function () {
		// TODO: show spinner indicator

		var self = this;

		var arduinoPortDD = $('#arduino-panel ul.arduino-port');
		if (!this.portsDDSubscribed) {
			// can't find the working API for this
			var buttonDD = arduinoPortDD.prev("*[data-toggle=\"dropdown\"]");
			buttonDD.on ('click', function () {
				if (!buttonDD.parent ().hasClass ('open')) {
					self.enumerateSerialPorts ();
				}
			});
//			arduinoPortDD.prev().on ('show.bs.dropdown', function () {
//				console.log (123);
//			});
			this.portsDDSubscribed = true;
		}

		$('<li><a href="#">Updating</a></li>').appendTo(arduinoPortDD);

		this.domain.exec("enumerateSerialPorts")
		.done(function (ports) {
			// TODO: get last used port from preference manager
			// TODO: show warning indicator
			// user must select port prior to launch
			console.log(
				"[brackets-arduino-node] Available ports:",
				ports.join (", ")
			);
			arduinoPortDD.empty ();
			// tr = $('<tr />').appendTo('#arduino-panel tbody');


			ports.forEach (function (portName) {
				$('<li><a href="#">'+portName+"</a></li>")
				.on ('click', self.setPort.bind (self, portName))
				.appendTo(arduinoPortDD);
			});

			//		$('<td />').text(err.message).appendTo(tr);
			//		$('<td />').text(err.filename).appendTo(tr);
			self.setPort ();
		}).fail(function (err) {
			// TODO: show error indicator
			console.error("[brackets-arduino-node] failed to run arduino.enumerateSerialPorts, error:", err);
		});

	}

	ArduinoExt.prototype.setPort = function (portName) {
		// TODO: set port in preferences
		if (!portName) {
			portName = prefs.get ('port');
			// no preference, first launch
			if (!portName)
				return;
		} else {
			prefs.set ('port', portName);
		}
		$('#arduino-panel button.arduino-port').text (portName.replace (/^\/dev\/cu\./, ""));
	}

	ArduinoExt.prototype.showBoardImage = function (boardId, platformName) {
		console.log ("board image", boardId, platformName, this.boardImage);
		if (boardId) {
			throw "unexpected boardId, not implemented yet";
		}

		// TODO: use template
		this.boardImagePopUp = $(
			'<div id="arduino-board-image" class="modal">'
			//				+ '<div class="modal-header">'
			//				+ '<h1 class="dialog-title">{{Strings.AUTHORS_OF}} {{file}}</h1>'
			//				+ '</div>'
			+ '<div class="modal-body"></div><div class="modal-footer">'
			+ '<button data-button-id="close" class="dialog-button btn btn-80">Close</button></div></div>'
		);

		if (this.boardImage) {
			$(".modal-body", this.boardImagePopUp).append (this.boardImage);
		} else {
			$(".modal-body", this.boardImagePopUp).append (
				'<h3>No board image found</h3>'
			);
		}
		Dialogs.showModalDialogUsingTemplate(this.boardImagePopUp).done(function (buttonId) {
			if (buttonId === "ok") {
				// CommandManager.execute("debug.refreshWindow");
			}
		});

	}

	ArduinoExt.prototype.setBoard = function (boardId, platformName) {
		// TODO: set board in preferences
		if (!boardId) {
			var boardPref = prefs.get ('board');
			// no preference, first launch
			if (!boardPref)
				return;
			boardId = boardPref[0];
			platformName = boardPref[1];
		} else {
			prefs.set ('board', [boardId, platformName]);
		}

		var self = this;
		this.boardImage = null;

		var titleButton = $('#arduino-panel button.arduino-board');
		if (this.platforms[platformName])
			titleButton.text (this.platforms[platformName].boards[boardId].name);

		var fs = brackets.getModule("filesystem/FileSystem");
		var boardImageUrl = require.toUrl ('./boards/'+boardId+'.jpg');
		var fileObj = fs.getFileForPath (boardImageUrl);
		fileObj.exists (function (err, exists) {
			if (err || !exists)
				return;
			var bi = new Image ();
			bi.addEventListener ('load',  function () {
				console.log ('load done', arguments);
				self.boardImage = bi;
			}, false);
			bi.addEventListener ('error', function () {
				console.log ('load error', arguments);
			}, false);
			bi.addEventListener ('abort', function () {
				console.log ('load abort', arguments);
			}, false);
			bi.src = encodeURI (boardImageUrl);
		})

	}

	ArduinoExt.prototype.getBoardMeta = function () {
		// TODO: show spinner indicator

		var self = this;

		// TODO: author's module location - use preferences for this
		// TODO: when we can't find arduino ide in default locations gracefully degrade
		this.domain.exec("getBoardsMeta", ["/Applications/devel/Arduino.app"])
		.done(function (platforms) {
			console.log("[brackets-arduino-node] Available boards:");

			self.platforms = platforms;

			$('#arduino-panel ul.arduino-board li').remove();
			// tr = $('<tr />').appendTo('#arduino-panel tbody');
			var arduinoBoardDD = $('#arduino-panel ul.arduino-board');

			Object.keys (platforms).sort().forEach (function (platformName) {
				console.log (platformName);
				$('<li class="dropdown-header">'
				  + platforms[platformName].platform.name + " "
				  + platforms[platformName].platform.version
				  + "</li>").appendTo(arduinoBoardDD);

				var boards = platforms[platformName].boards;
				Object.keys (boards).sort().map (function (boardId) {
					var boardMeta = boards[boardId];

					var boardItem = $('<li><a href="#">'+boardMeta.name+"</a></li>");
					boardItem.appendTo(arduinoBoardDD);
					boardItem.on ('click', self.setBoard.bind (self, boardId, platformName))

					var boardDesc = boardMeta.name + ' (' + boardId
					if ("menu" in boardMeta) {
						boardDesc += ', variants: ';
						var variants = [];
						boardItem.addClass ('dropdown-submenu');
						var submenu = $("<ul class=\"dropdown-menu\">");
						for (var cpuVariant in boardMeta.menu.cpu) {
							variants.push (boardMeta.menu.cpu[cpuVariant].cpu_variant_name);
							submenu.append ($("<li><a href=\"#\">" + boardMeta.menu.cpu[cpuVariant].cpu_variant_name + "</a></li>"));
						}

						boardItem.append (submenu);

						boardDesc += variants.join (",");

					}
					boardDesc += ')';
					console.log (boardDesc);


				});
			});
			self.setBoard();
		}).fail(function (err) {
			// TODO: show error indicator
			console.error("[brackets-arduino-node] failed to run arduino.getBoardMeta, error:", err);
		});

	}

	ArduinoExt.prototype.compile = function () {
		var boardMeta = prefs.get ('board');
		var boardId = boardMeta[0];
		var platformName = boardMeta[1];
		var boardVariation = prefs.get ('boardVariation');
		var options = {};

		var currentDoc = DocumentManager.getCurrentDocument();

		var fullPath = currentDoc.file.fullPath;

		this.domain.exec ("compile", [
			fullPath,
			platformName,
			boardId,
			boardVariation || {},
			options || {}
		])
		.done(function (size) {
			console.log (size);
		}).fail (function (error) {
			console.log (error);
		});

	}

	ArduinoExt.prototype.run = function () {
		// TODO: use template
		var dialogHtml = $(
			'<div id="arduino-board-alert" class="modal">'
			//				+ '<div class="modal-header">'
			//				+ '<h1 class="dialog-title">{{Strings.AUTHORS_OF}} {{file}}</h1>'
			//				+ '</div>'
			+ '<div class="modal-body"></div><div class="modal-footer">'
			+ '<button data-button-id="close" class="dialog-button btn btn-80">Close</button></div></div>'
		);

		$(".modal-body", dialogHtml).append ("<h3>Not implemented yet!</h3>");

		Dialogs.showModalDialogUsingTemplate(dialogHtml).done(function (buttonId) {
			if (buttonId === "ok") {
				// CommandManager.execute("debug.refreshWindow");
			}
		});
	}

	ArduinoExt.prototype.createUI = function (require) {

		var myIcon = $("<a href=\"#\" id=\"arduino-sidebar-icon\"></a>");

		myIcon.appendTo($("#main-toolbar .buttons"));

		var PanelManager = brackets.getModule('view/PanelManager');
		this.panel = PanelManager.createBottomPanel(moduleId+".panel", $(require('text!bottom-panel.html')));

		this.enumerateSerialPorts ();
		this.getBoardMeta ();

		this.panel.toggle = function () {
			if (this.isVisible ()) {
				this.hide ();
			} else {
				this.show ();
			}
			stateManager.set ('panelVisibility', this.isVisible());
		}

		var lastPanelState = stateManager.get ('panelVisibility');
		this.panel.setVisible (lastPanelState);

		myIcon.on ("click", this.panel.toggle.bind (this.panel));
		// we call toggle because you cannot click on close button on hidden panel
		$('#arduino-panel .close').on('click', this.panel.toggle.bind (this.panel));

		var titleButton = $('#arduino-panel button.arduino-board');
		titleButton.on ('click', this.showBoardImage.bind (this, null, null));

		var compileButton = $('#arduino-panel button.arduino-compile');
		compileButton.on ('click', this.compile.bind (this, null, null));

		var runButton = $('#arduino-panel button.arduino-run');
		runButton.on ('click', this.run.bind (this, null, null));

		$(this.domain).on ('log', function (event, message) {
//			console.log (message);
			$('#arduino-panel .table-container table tbody').append ("<tr><td>"+message+"</td></tr>");
		});
	}


	app.appReady(function(){
		//		$(brackets.getModule('document/DocumentManager')).on('documentSaved', onDocumentSaved);

		var arduinoExt = new ArduinoExt (require, arduinoDomain);
	});

});
