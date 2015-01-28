var path = require ('path');
var util = require ('util');
var fs   = require ('fs');

var exec = require ('child_process').exec;

var EventEmitter = require ('events').EventEmitter;

var common  = require ('./common');
var ArduinoData = require ('./data');

var sp;

var Arduino;

function ArduinoUploader (compiler, platformId, boardId, boardVariant, options) {

	// TODO: make use of instance property (instance populated on successful config read)
	Arduino = new ArduinoData ();

	var boardsData = Arduino.boardData[platformId];

	var platform = boardsData.platform; // arduino:avr.platform
	var board = JSON.parse (JSON.stringify (boardsData.boards[boardId])); // arduino:avr.boards.uno

	var boardBuild = board.build; // arduino:avr.boards.uno.build

	this.boardsData = boardsData;

	this.platformId = platformId;

	this.platform = platform; // arduino:avr.platform

	var currentStage = "upload";

	var tool = common.createDict (Arduino, platformId, boardId, boardVariant, options, currentStage);

	common.pathToVar (tool, 'build.path', compiler.buildFolder);
	common.pathToVar (tool, 'build.project_name', compiler.projectName);

	//	common.pathToVar (conf, 'build.arch', platformId.split (':')[1]);
	common.pathToVar (tool, 'build.arch', platformId.split (':')[1].toUpperCase ());

//	console.log (conf.upload);
//
//	console.log (conf.tools[conf.upload.tool]);

//	console.log (tool);

	if (tool.upload.params && tool.upload.params.verbose) {
		if (options.verbose) {
			tool.upload.verbose = tool.upload.params.verbose; // or quiet
		} else {
			tool.upload.verbose = tool.upload.params.quiet;
		}
	}

	common.pathToVar (tool, 'serial.port', options.serial.port);

	this.initSerial ();

//	if (!tool.upload.protocol) {
		// if no protocol is specified for this board, assume it lacks a
		// bootloader and upload using the selected programmer.
		// TODO: emit error
		// TODO: use programmer
//		return;
//	}

	// have event subscription issues without this
	process.nextTick (this.prepareCmd.bind (this, tool));
}

util.inherits (ArduinoUploader, EventEmitter);

ArduinoUploader.prototype.initSerial = function () {
	try {
		// https://github.com/voodootikigod/node-serialport
		// HOWTO built THAT on mac (got idea from https://github.com/jasonsanjose/brackets-sass/tree/master/node):
		// 1) cd <extension-folder>/node; npm install node-gyp node-pre-gyp serialport
		// 2) cd node_modules/serialport
		// 3) /Applications/devel/Brackets.app/Contents/MacOS/Brackets-node ../../node_modules/node-pre-gyp/bin/node-pre-gyp --arch=ia32 rebuild

		// current binaries got from http://node-serialport.s3.amazonaws.com
		sp = require("serialport");
	} catch (e) {
		console.log ("cannot load serialport module", e);
	}
}


ArduinoUploader.prototype.prepareCmd = function (tool) {
	var recipe = tool.upload.pattern;

	this.emit ('log', 'upload', "using port: "+tool.serial.port);

	console.log (recipe);

	var cmd = common.replaceDict (recipe, tool);

	console.log (cmd);

	if (tool.upload.use_1200bps_touch) {
		this.emit ('log', 'upload', "dancing 1200 bod");
		this.danceSerial1200 (tool, this.runCmd.bind (this, cmd, tool));
	} else {
		this.runCmd (cmd, tool);
	}
}

ArduinoUploader.prototype.danceSerial1200 = function (tool, cb) {
	var timeout = 400;
	// taken from electon ide
	sp.list (function (err, list1) {
		console.log("list 1 is ",list1);
		//open port at 1200 baud
		var port = new sp.SerialPort (tool.serial.port, { baudrate: 1200 });
		port.on ('open', function() {
			console.log ("opened at 1200bd");
			//close port
			port.flush (function () {
				port.close (function () {
					console.log ("did a successful close");
					console.log ("closed at 1200bd");
					//wait 300ms
					if (tool.upload.wait_for_upload_port) {
						setTimeout (function() {
							console.log ("doing a second list");
							//scan for ports again
							scanForPortReturn (list1, function(ppath) {
								console.log("got new path",ppath);

								cb();
							})
						}, timeout);
					} else {
						cb ();
					}
				})
			});

		});

	});

}

ArduinoUploader.prototype.runCmd = function (cmd, tool) {
	var scope = 'upload';
	this.emit ('log', scope, cmd);

	var env = common.prepareEnv (
		path.resolve (tool.runtime.ide.path),
		path.resolve (tool.runtime.platform.path)
	);

	var child = exec(cmd, {env: env}, (function (error, stdout, stderr) {
		// The callback gets the arguments (error, stdout, stderr).
		// On success, error will be null. On error, error will be an instance
		// of Error and error.code will be the exit code of the child process,
		// and error.signal will be set to the signal that terminated the process.
		// console.log('stdout: ' + stdout);
		// console.log('stderr: ' + stderr);
		if (error !== null) {
//			console.log ('******************', scope.toUpperCase(), cmd);
//			console.log ('******************', scope.toUpperCase(), 'exec error: ', error, 'stderr', stderr);
			error.scope  = scope;
			error.cmd    = cmd;
			error.stderr = stderr;
			this.emit ('error', error);
			return;
		}
		this.emit ('log', scope, 'done');
		this.emit ('done');
	}).bind (this));
}


module.exports = ArduinoUploader;
