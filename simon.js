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

		config.prompt = (config.prompt || '').yellow;

		if (!config.help) {
			console.warn(
				'Warning: The "help" function was not included with the config'.yellow
			);
		}

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
			this._showPrompt = this._showPrompt || this._generateShowPrompt();
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
		return _.debounce(function () {
			util.puts('\n' + simon.config.prompt);
		}, 3000);
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
	exec: function (command, args, vagrant) {

		var runningTasks = this._runningTasks,
			showPrompt;

		vagrant = typeof vagrant === 'undefined' ? (
			this.config.vagrant || false
		) : !!vagrant;

		if (args && args.length > 0) {
			args = Array.prototype.slice.call(args);
			command += (' ' + args.join(' '));
		}

		if (vagrant) {

			// Execute this command on the VM
			command = "vagrant ssh -c 'cd /vagrant && " + command.replace(/'/, "\\'") + "'";
		}

		util.puts(('Running ' + command).cyan);

		var task = cp.exec(command, {
			cwd: process.cwd()
		});

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
			showPrompt = this._showPrompt || this._generateShowPrompt();
			this.showPrompt = showPrompt;

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

			showPrompt = this._showPrompt || this._generateShowPrompt();
			this._showPrompt = showPrompt;

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
		return this.exec('node ' + fileName, args, false);
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
			});

			// Done event
			emitter.addListener('done', function () {
				util.puts('All tasks completed successfully!'.green);
				emitter.emit('exit', 0);
			});

			// Error event
			emitter.addListener('error', function (task, error) {

				if (error) {
					util.puts(('' + error).red);
				}

				util.puts((
					'The ' + task + ' was cancelled or encountered an error!'
				).red);
				emitter.emit('exit', 1);
			});
		}

		// Find the first task
		if (tasks.length) {
			try {
				// Attempt to execute the task
				task = this[tasks[0].name](tasks[0].args);
			} catch (e) {
				// Send an error function and return
				setImmediate(function (emitter) {
					emitter.emit('error', tasks[0].name || 'unknown', e);
				}, emitter);
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
		// Do NOT use vagrant to execute vagrant
		return this.exec('vagrant', arguments, false);
	},

	/**
		Call the npm command
		@method	npm
		@return	{ChildProcess}
	*/
	npm: function () {
		// NPM is always executed locally
		return this.exec('npm', arguments, false);
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
			'vendor',
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
		Simon's `start` task - Boots up everything and what everyone
		@method	start
		@return {EventEmmiter}
	*/
	start: function () {
		this.runTasks([{
			name: 'vagrant',
			args: ['up'],
		}, {
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
		}]);
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
		description
		@class		class
		@extends	extends
		@namespace	namespace
	*/
	rewatch: function () {
		this._killRunningTasks();
		return this.grunt();
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

		util.puts((this.config.banner + '').cyan);

		if (typeof this.config.help === 'function') {
			this.config.help();
		}

		util.puts('    Note: Command-line options may not be available in interactive mode\n');
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
		TODO: Make this environment-agnostic
		@method add
		@return {Boolean} result Was the add successful?
	*/
	add: function (name) {

		var locations = this.constructor.LOCATIONS,
			hosts = fs.readFileSync(locations.hostsFile, {
			encoding: 'utf8'
		}) || '';

		var existingMatch = new RegExp(
			'^127\\.0\\.0\\.1\\s+' + name + '\\.soapboxv4\\.dev$', 'm'
		);

		this._triggerPrompt();

		// First check if the slug exists
		if (hosts.match(existingMatch)) {

			// Already exists
			util.puts(('SoapBox "' + name + '" already exists').yellow);
			return true;

		} else {

			// Split up by the newline
			hosts = hosts.split(eol);

			for (var i = 0; i < hosts.length; i++) {
				// Find the localhost
				if (/^127\.0\.0\.1\s+localhost$/m.test(hosts[i])) {
					break;
				}
			}

			try {

				if (i < hosts.length) {

					// Found the localhost line, add the new SoapBox right below it
					hosts.splice(i + 1, 0, '127.0.0.1   ' + name + '.soapboxv4.dev');

					fs.writeFileSync(locations.hostsFile, hosts.join(eol));

					util.puts((
						'Added new SoapBox at ' + (
							'http://' + name + '.soapboxv4.dev/'
						).bold
					).green);

					return true;

				} else {
					throw 'The hosts file does not contain the line "127.0.0.1  localhost';
				}

			} catch (e) {
				util.puts(e.toString().red);
				util.puts(('The SoapBox "' + name + '" could not be added.').red);
			}
		}

		return false;

	},

	/**
		TODO: Make this environment agnostic
		@method remove
		@return {Boolean} result Was the removal successful?
	*/
	remove: function (name) {

		var locations = this.constructor.LOCATIONS,
			hosts = fs.readFileSync(locations.hostsFile, {
			encoding: 'utf8'
		}) || '';

		var existingMatch = new RegExp(eol + '[0-9.]+\\s+' + name + '\\.soapboxv4\\.dev' + eol);
		this._triggerPrompt();

		// First check if the slug exists
		if (hosts.match(existingMatch)) {
			try {
				fs.writeFileSync(
					locations.hostsFile,
					hosts.replace(existingMatch, '\n')
				);
				util.puts(('The SoapBox "' + name + '" was removed successfully.').green);
				return true;
			} catch (e) {
				util.puts(e.toString().red);
				util.puts(('The SoapBox "' + name + '" could not be removed.').red);
			}
		} else {
			// Doesn't exist
			util.puts(('SoapBox "' + name + '" does not exist').yellow);
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
				var args = command.trim().split(/\s+/), hasCommand = false,
					isQuit = options.isQuitlisted(command);

				command = args.shift();
				args = args.join(' ');


				// Check to see if the given command can be called
				if (typeof simon[command] === 'function' &&
					!/^_/.test(command) &&			// Can't be private
					!options.isBlacklisted(command)	// Can't be blacklisted
				) {
					hasCommand = true;
					simon[command].call(simon, args);
				}


				if (!hasCommand && !isQuit) {

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
Simon.DEFAULTS = require(path.join(__dirname, 'lib', 'defaults'));

module.exports = function (config) {
	return new Simon(config || {});
};
