var fs = require('fs'),				// File system
	path = require('path'),			// System path
	util = require('util'),			// System shell input/output access
	readline = require('readline'),	// Get a line from input
	events = require('events'),
	cp = require('child_process'),	// Child Process (for running shell commands). http://nodejs.org/docs/latest/api/child_process.html
	eol = require('os').EOL,		// End of Line character
	//pkg = require('./package.json'),// package.json info
	_ = require('underscore');		// Underscore.js for debouncing (http://underscorejs.org)

require('colors');

/**
	The Simon class is responsible for providing the interface for the system
	commands required by SoapBox.

	@class	Simon
	@constructor
*/
function Simon(config) {

	this.constructor = Simon;
	this.configure(config);
	this.Simon = Simon;
	this.init();
}

Simon.prototype = {

	_runningTasks: null,
	_hasPrompt: false,
	_showPrompt: null,
	_rl: null,
	_regExpSafe: /([.?*+\^$\[\](){}|\-\\])/g,

	/**
		Constructor
		@method	init
		@return	{Simon} simon
	*/
	init: function () {

		var simon = this;

		this._runningTasks = [];
		this._rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			terminal: true
		});

		process.on('exit', function () {
			simon._killRunningTasks();
			simon.closeRl();
		});
	},

	configure: function (config) {

		config = _.extend(
			this.config || this.constructor.DEFAULTS,
			config || {}
		);

		config.prompt = ('\n' + config.prompt || '').yellow;

		this.config = config;
		return this.config;
	},

	/**
		Trigger the "enter command" prompt to show up
		@method	_triggerPrompt
		@access	private
	*/
	_triggerPrompt: function () {
		if (this._hasPrompt) {
			this._generateShowPrompt();
			this._showPrompt();
		}
	},

	/**
		Generate a debounced "Simon says" terminal prompt input
		@method	_generateShowPrompt
		@access	private
		@return	{Function} prompt
	*/
	_generateShowPrompt: function () {
		var simon = this;
		this._showPrompt = this._showPrompt || _.debounce(function () {
			util.puts(simon.config.prompt);
		}, 3000);
		return this._showPrompt;
	},

	/**
		Kill all currently running child processes
		@method	_killRunningTasks
		@access	private
	*/
	_killRunningTasks: function () {
		this._runningTasks.map(function (task) {
			task.kill();
		});
		this._runningTasks.length = 0;
	},

	/**
		Format a terminal command to use Vagrant
		@method	_vagrantCommand
		@param	{String} command
		@return	{String} command
	*/
	_vagrantCommand: function (command) {
		var config = this.config.vagrant;

		if (typeof config !== 'object') {
			return command;
		}

		// Single quotes may make this buggy
		return "vagrant ssh -c 'cd " + config.dir + " && " + command.replace(/'/, "\\'") + "'";

	},

	closeRl: function () {
		this._rl.close();
	},

	/**
		Execute a shell command
		@method	exect
		@param	{String} command The command to run
		@param	{Array} [args] The Arguments to pass on to the command
		@param	{Boolean} [vagrant=false] Send the command to vagrant instead
			of the current shell
		@return {ChildProcess} task
	*/
	exec: function (command, args, callback, local) {

		var runningTasks = this._runningTasks,
			showPrompt;

		// Should this command be run locally (instead of on vagrant)?
		local = typeof local === 'undefined' ? (
			!!this.config.local
		) : !!local;

		// If string, make into array
		args = typeof args === 'string' ? [args] : args;

		// Build the command
		if (args && args.length > 0) {
			args = Array.prototype.slice.call(args);
			command += (' ' + args.join(' '));
		}

		if (!local) {

			// Execute this command on the Vagrant VM
			command = this._vagrantCommand(command);
		}

		util.puts(('\n> Running ' + command).cyan);

		// Run the task
		var task = cp.exec(command, {
			cwd: process.cwd()
		}, callback);

		// Redirect the output from this task to the process's stdout
		task.stdout.pipe(process.stdout);
		task.stderr.pipe(process.stderr);

		runningTasks.push(task);
		task.on('exit', function () {
			// Remove this task from the running tasks upon completion
			runningTasks.splice(runningTasks.indexOf(task, 1));
		});

		if (this._hasPrompt) {

			// Get the prompt function
			showPrompt = this._generateShowPrompt();

			// Execute the showPrompt function every time there's an output
			task.stdout.on('data', showPrompt);
			task.stderr.on('data', showPrompt);
		}

		return task;
	},

	/**
		Execute the given file
		@method	execFile
		@param	{String} fileName
		@param	{Array} [args]
		@return {ChildProcess} task
	*/
	execFile: function (fileName, args) {

		var showPrompt;

		if (args && args.length > 0) {
			args = Array.prototype.slice.call(args);
		}

		util.puts((
			'Running ' + path.basename(fileName) + ' ' + args.join(' ')
		).cyan);

		var task = cp.execFile(fileName, args, {
			cwd: process.cwd()
		});

		// Redirect the output from this task to the process's stdout
		task.stdout.pipe(process.stdout);
		task.stderr.pipe(process.stderr);

		if (this._hasPrompt) {

			showPrompt = this._generateShowPrompt();

			task.stdout.on('data', function () {
				showPrompt();
			});
			task.stderr.on('data', function () {
				showPrompt();
			});
		}

		return task;
	},

	/**
		Execute the given Node.js file
		@method	execNodeFile
		@param	{String} fileName
		@param	{Array} args
	*/
	execNodeFile: function (fileName, args) {
		// Node files are always executed locally
		return this.exec('node ' + fileName, args, null, true);
	},

	/**
		Run a series of tasks consecutively. Tasks will not start running until
		the previous task has completed. This method is asynchronous and will
		return an event emitter. Here are the available events.

			'done' - fired when all the tasks have finished successfully.
			'error' - fired when a task did not successfully complete
			'exit' - fired when the tasks are done, with a non-zero code if an error orccured

		Send in an array with the format `[{name: 'taskName', args: [...]}...`
		The tasks will not run until the previous task has finished successfully

		@method	runTasks
		@param	{Array} tasks
		@param	{EventEmitter} _emitter
		@return	{EventEmitter} emitter
	*/
	runTasks: function (tasks, _emitter) {

		var task, simon = this;
		var emitter = _emitter;

		if (!emitter) {

			emitter = new events.EventEmitter();

			// Exit event
			emitter.addListener('exit', function (code) {
				util.puts(('Tasks completed ' + (
					code > 0 ? 'with errors' : 'without errors'
				)).yellow);
				emitter.removeAllListeners();
			});

			// Done event
			emitter.addListener('done', function () {
				util.puts('All tasks completed successfully!'.green);
				emitter.emit('exit', 0);
			});

			// Error event
			emitter.addListener('error', function (task, error) {

				if (!error) {
					error = task;
					task = 'unknown';
				}

				if (error) {
					util.puts(('' + error).red);
				}

				util.puts((
					'The task "' + task + '" was cancelled or encountered an error!'
				).red);
				emitter.emit('exit', 1);
			});
		}

		// Find the first task
		if (tasks.length) {
			try {
				// Attempt to execute the task
				task = this[tasks[0].name].apply(this, tasks[0].args);
			} catch (e) {
				// Send an error function and return
				setImmediate(function (emitter, task) {
					emitter.emit('error', task, e);
				}, emitter, tasks[0].name || 'unknown');
				return emitter;
			}
		}

		if (task) {

			// A task was performed, setup the next one

			task.once('exit', function (code) {

				if (code) {
					// Errored out
					emitter.emit('error', task);

				} else {

					// Success! Run the next task
					simon.runTasks(tasks.slice(1), emitter);
				}
			});
			return task;

		} else {

			// All done, send the 'done' event
			setImmediate(function (emitter) {
				emitter.emit('done');
			}, emitter);
		}

		return emitter;
	},

	/**
		Call the vagrant command
		@method	vagrant
		@return {ChildProcess}
	*/
	vagrant: function () {
		// ALWAYS exectute vagrant locally
		return this.exec('vagrant', arguments, null, true);
	},

	/**
		Call the npm command
		@method	npm
		@return	{ChildProcess}
	*/
	npm: function () {
		// NPM is always executed locally
		return this.exec('npm', arguments, null, true);
	},

	/**
		Call the PHP command. If the `-s` option was used, call HHVM instead!
		@method	php
		@return	{ChildProcess}
	*/
	php: function () {
		if (this.config.hhvm) {
			return this.exec('hhvm', arguments);
		}
		return this.exec('php', arguments);
	},

	/**
		Call the composer command
		@method	composer
		@return	{ChildProcess}
	*/
	composer: function () {
		return this.exec('composer', arguments);
	},

	/**
		Call ./artisan
		@method	artisan
		@return	{ChildProcess}
	*/
	artisan: function () {
		var args = ['artisan'];
		args.push.apply(args, arguments);
		return this.php.apply(this, args);
	},

	/**
		Call the PHPUnit command (must be installed with composer dependencies)
		@method	phpunit
		@return	{ChildProcess}
	*/
	phpunit: function () {
		var args = [[
			this.constructor.LOCATIONS.composerVendorFolder,
			'bin',
			'phpunit'
		].join(path.sep)];
		args.push.apply(args, arguments);
		return this.php.apply(this, args);
	},

	/**
		Call the Grunt command (must be installed with node dependencies)
		@method	phpunit
		@return	{ChildProcess}
	*/
	grunt: function () {
		var fileName = [
			'node_modules',
			'grunt-cli',
			'bin',
			'grunt'
		].join(path.sep);
		return this.execNodeFile(fileName, arguments);
	},

	/**
		Call the Bower command (must be installed with node dependencies)
		@method	bower
		@return	{ChildProcess}
	*/
	bower: function () {
		var fileName = [
			'node_modules',
			'bower',
			'bin',
			'bower'
		].join(path.sep);
		return this.execNodeFile(fileName, arguments);
	},

	/**
		Simon's `start` task - Boots up everything and what everyone.
		Not available from interactive mode.

		@method	start
		@return {EventEmmiter}
	*/
	start: function () {

		var simon = this,
			vagrant = simon.config.vagrant,
			box,
			task;

		// Get the list of boxes

		if (this.config.local || !vagrant || !vagrant.box) {
			return this._start();
		}

		box = vagrant.box;

		task = this.exec('vagrant', [
			'box',
			'list'
		], function (error, stdout, stderr) {

			var boxRegExp;

			// Run vagrant
			if (error || stderr) {
				if (error) {
					console.error((error + ''.red));
				}
				if (stderr) {
					console.error((stderr + ''.red));
				}
				process.exit();
				return;
			}

			boxRegExp = new RegExp(
				'^' + box.name.replace(simon.regExpSafe) + ' ' +
				'\\(' + box.provider.replace(simon.regExpSafe) + '\\)$',
				'm'
			);

			//console.log()
			return simon._start(!boxRegExp.test(stdout));

		}, true);


	},


	_start: function (installBox) {

		var vagrant = this.config.vagrant,
			tasks = [];

		if (installBox && vagrant.box) {
			tasks.push({
				name: 'vagrant',
				args: [
					'box add',
					vagrant.box.name,
					vagrant.box.url
				]
			});
		}

		if (!this.config.local && vagrant) {
			tasks.push({
				name: 'vagrant',
				args: ['up'],
			});
		}

		tasks.push({
			name: 'composer',
			args: ['install'],
		}, {
			name: 'artisan',
			args: ['migrate'],
		}, {
			name: 'npm',
			args: ['install'],
		}, {
			name: 'bower',
			args: ['install'],
		}, {
			name: 'npm',
			args: ['start']
		});

		return this.runTasks(tasks);
	},


	/**
		Run the install methods for all the package managers
		@method	install
		@return {EventEmmiter}
	*/
	install: function () {
		this.runTasks([{
			name: 'npm',
			args: ['install']
		}, {
			name: 'composer',
			args: ['install']
		}, {
			name: 'bower',
			args: ['install']
		}]);
	},

	/**
		Run the update methods for all the package managers
		@method	update
		@return {EventEmmiter}
	*/
	update: function () {
		this.runTasks([{
			name: 'npm',
			args: ['update']
		}, {
			name: 'composer',
			args: ['update']
		}, {
			name: 'bower',
			args: ['update']
		}]);
	},

	/**
		Refresh the database
		@method	install
		@return {EventEmmiter}
	*/
	refresh: function () {
		var task = this.artisan('migrate:refresh --seed');
		task.on('exit', function (code) {
			if (code) {
				util.puts('The database did not refresh successfully'.red);
			} else {
				util.puts('Database refreshed and seeded successfully'.cyan);
			}
		});
		return task;
	},

	/**
		Build the front end end begin watching for changes
		@method @watch
	*/
	watch: function () {
		return this.runTasks([{
			name: 'npm',
			args: ['start']
		}, {
			name: 'grunt',
			args: ['watch']
		}]);
	},

	/**
		Fix permissions on the app/storage folder
		@method @permissions
	*/
	permissions: function () {
		return this.exec('chmod', [
			'-R',
			'+w',
			'app/storage'
		]);
	},

	/**
		Cancel any currently running tasks (including Grunt watch tasks)
		@method	install
		@return {EventEmmiter}
	*/
	cancel: function () {
		this._killRunningTasks();
		this._triggerPrompt();
	},

	/**
		Show the help information
		@method	help
	*/
	help: function () {

		util.puts(('\n' + this.config.banner + '').cyan);

		if (typeof this.config.help === 'function') {
			this.config.help();
		}

		util.puts('    Note: Command-line options may not be available in interactive mode');
		this._triggerPrompt();
	},

	/**
		Proxy to help
		@method	list
	*/
	list: function () {
		this.help();
	},

	/**
		@method add
		@param	{String} [subdomain]
		@return {Boolean} result Was the add successful?
	*/
	add: function (subdomain) {

		var locations = this.constructor.LOCATIONS,

			// Makes a plain string safe for adding to a built up regexp
			regExpSafe = this._regExpSafe,

			ip = this.config.ip,
			domain = this.config.domain,
			url = (subdomain ? subdomain + '.' : '') + domain,

			hosts = fs.readFileSync(locations.hostsFile, {
				encoding: 'utf8'
			}) || '',

			existingMatch;

		// Look for the config URL (with the given subdomain, if any
		existingMatch = new RegExp(
			'^[0-9.]+\\s+(' +
			url.replace(regExpSafe, '\\$1') +
			')$', 'm'
		);

		// Just in case
		this._triggerPrompt();

		try {

			// First check if the slug exists
			if (hosts.match(existingMatch)) {

				// Already exists, replace it with the new IP address
				hosts = hosts.replace(existingMatch, ip + '	$1');

			} else {

				// Split up by the newline
				hosts = hosts.split(eol);

				for (var i = 0; i < hosts.length; i++) {
					// Find the localhost line
					if (/^[0-9.]+\s+localhost$/.test(hosts[i])) {
						break;
					}
				}

				if (i < hosts.length) {

					// Found the localhost line, add the new domain right below it
					hosts.splice(i + 1, 0, ip + '	' + url);

				} else {
					throw 'Invalid hosts file';
				}

				hosts = hosts.join(eol);

			}

			fs.writeFileSync(locations.hostsFile, hosts);

		} catch (e) {
			util.puts(e.toString().red);
			util.puts(('The site "' + url + '" could not be added.').red);
			return false;

		}

		util.puts((
			'Added new site at ' + url.bold
		).green);

		return true;

	},

	/**
		@method remove
		@param	{String} [subdomain]
		@return {Boolean} result Was the removal successful?
	*/
	remove: function (subdomain) {

		var locations = this.constructor.LOCATIONS,

			// Makes a plain string safe for adding to a built up regexp
			regExpSafe = this._regExpSafe,

			//ip = this.config.ip,
			domain = this.config.domain,
			url = (subdomain ? subdomain + '.' : '') + domain,

			hosts = fs.readFileSync(locations.hostsFile, {
				encoding: 'utf8'
			}) || '',

			existingMatch;

		existingMatch = new RegExp(
			eol +
			'[0-9.]+\\s+' +
			url.replace(regExpSafe, '\\$1') +
			eol
		);

		this._triggerPrompt();

		// First check if the slug exists
		if (hosts.match(existingMatch)) {

			try {

				// Attempt replacing
				fs.writeFileSync(
					locations.hostsFile,
					hosts.replace(existingMatch, eol)
				);

				util.puts(('The site "' + url + '" was removed successfully.').green);
				return true;

			} catch (e) {
				// An error occured, probably permissions
				util.puts(e.toString().red);
				util.puts(('The site "' + url + '" could not be removed.').red);
			}
		} else {
			// Doesn't exist
			util.puts(('The site "' + url + '" does not exist').yellow);
			return true;
		}

		return false;
	},

	/**
		Initialise interactive mode!
		@method prompt
	*/
	prompt: function () {

		var simon = this,
			options = simon.constructor.PROMPT_OPTIONS;

		this._hasPrompt = true;

		this._rl.question(

			this._runningTasks.length ? '' : this.config.prompt,
			function (command) {
				var args = command.trim().split(/\s+/),
					hasCommand = false,
					isBlacklisted,
					isQuit;

				if (args.length === 0 || !args[0]) {
					// No command, just prompt again
					simon._triggerPrompt();
					simon.prompt();
					return;
				}

				isBlacklisted = options.isBlacklisted(args[0]);
				isQuit = options.isQuitlisted(args[0]);

				command = args.shift();
				args = args.join(' ');

				// Check to see if the given command can be called
				if (typeof simon[command] === 'function' &&
					!/^_/.test(command) &&			// Can't be private
					!isBlacklisted					// Can't be blacklisted
				) {
					hasCommand = true;
					simon[command].call(simon, args);
				}

				if (isBlacklisted) {
					console.warn((
						'"' + command + '" cannot be called from interactive mode'
					).magenta);
					simon._triggerPrompt();
				} else if (!hasCommand && !isQuit) {

					args = command + ' ' + args;

					// Run the default grunt task
					simon.grunt.call(simon, args);
				}



				if (isQuit) {
					process.exit();
				} else {
					simon.prompt();
				}
			}
		);
	}

};

// Constructor options
Simon.LOCATIONS = require(path.join(__dirname, 'lib', 'locations'));
Simon.PROMPT_OPTIONS = require(path.join(__dirname, 'lib', 'prompt-options'));
Simon.DEFAULTS = require(path.join(__dirname, 'lib', 'defaults.json'));

module.exports = function (config) {
	return new Simon(config || {});
};
