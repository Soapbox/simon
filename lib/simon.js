var fs = require('fs'),				// File system
	path = require('path'),			// System path
	events = require('events'),
	cp = require('child_process'),	// Child Process (for running shell commands). http://nodejs.org/docs/latest/api/child_process.html
	eol = require('os').EOL,		// End of Line character
	extend = require('underscore').extend; // Underscore.js (http://underscorejs.org)

var message = require('./helpers/message'),
	interactivePrompt = require('./prompt');

require('colors');

/**
	The Simon class is responsible for providing the interface for the system
	commands required by SoapBox.

	@class	Simon
	@constructor
*/
function Simon(options) {

	this.constructor = Simon;
	this.Simon = Simon;
	this._prompt = interactivePrompt;

	this.configure(options);

	this.init();
}

Simon.prototype = {

	_runningTasks: null,
	_regExpSafe: /([.?*+\^$\[\](){}|\-\\])/g,

	/**
		Constructor
		@method	init
		@return	{Simon} simon
	*/
	init: function () {

		var simon = this;

		this._runningTasks = [];

		process.on('exit', function () {
			simon.killRunningTasks();
		});
	},

	/**
		Kill any killable task
		@method killRunningTasks
	*/
	killRunningTasks: function () {
		this._runningTasks.map(function (task) {
			if ('kill' in task) {
				task.kill();
			}
		});
		this._runningTasks.length = 0;
	},

	/**
		Configuration options
		@method	configure
		@param	{Hash} options
		@return {Hash} this.options
	*/
	configure: function (options) {

		options = extend(
			this.options || this.constructor.OPTIONS,
			options
		);

		if (options.prompt) {
			options.prompt = this._prompt.configure(options.prompt);
		}

		this.options = options;
		return this.options;
	},


	/**
		Format a terminal command to use Vagrant
		@method	_vagrantCommand
		@param	{String} command
		@return	{String} command
	*/
	_vagrantCommand: function (command) {
		var config = this.options.vagrant;

		if (typeof config !== 'object') {
			return command;
		}

		// Single quotes may make this buggy
		return "vagrant ssh -c 'cd " + config.dir + " && " + command.replace(/'/, "\\'") + "'";

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

		var prompt = this._prompt,
			runningTasks = this._runningTasks;

		// Should this command be run locally (instead of on vagrant)?
		local = typeof local === 'undefined' ? (
			!!this.options.local
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

		message.info('Running ' + command.bold);

		// Run the task
		var task = cp.exec(command, {
			cwd: process.cwd()
		}, callback);

		// Redirect the output from this task to the process's stdout
		task.stdout.pipe(process.stdout);
		task.stderr.pipe(process.stderr);

		runningTasks.push(task);

		// Make sure the prompt knows that these tasks might break input
		if (prompt) {
			prompt.addTriggerStream(task.stdout);
			prompt.addTriggerStream(task.stderr);
		}

		task.on('close', function (code) {

			if (code) {
				message.warning('The ' + command.bold + ' task may not have completed successfully');
			} else {
				message.success('The task was completed successfully');
			}
			// Remove this task from the running tasks upon completion
			runningTasks.splice(runningTasks.indexOf(task), 1);

			// The streams no longer output anything, make sure the prompt knows
			if (prompt) {
				prompt.removeTriggerStream(task.stdout);
				prompt.removeTriggerStream(task.stderr);
			}

		});


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
			'close' - fired when the tasks are done, with a non-zero code if an error orccured

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
			emitter.addListener('close', function (code) {
				message.info('Tasks completed ' + (
					code > 0 ? 'with errors' : 'without errors'
				));
				emitter.currentTask = null;
				//setImmediate(emitter.removeAllListeners.bind(emitter));
			});

			// Done event
			emitter.addListener('done', function () {
				emitter.emit('close', 0);
			});

			// Error event
			emitter.addListener('error', function (task, error) {

				if (!error) {
					error = task;
					task = 'unknown';
				}

				if (error && 'toString' in error) {
					console.log(error.toString().red);
				}

				message.error(
					'The task "' + task.bold + '" was cancelled or encountered an error!'
				);

				emitter.emit('close', 1);
			});

			emitter.kill = function () {
				if (emitter.currentTask) {
					return emitter.currentTask.kill();
				}
			};
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

			emitter.currentTask = task;

			// A task was performed, setup the next one

			task.once('close', function (code) {

				if (code) {
					// Errored out
					emitter.emit('error', task);

				} else {

					// Success! Run the next task
					simon.runTasks(tasks.slice(1), emitter);
				}
			});
			//return emm;

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
		var args = Array.prototype.slice.apply(arguments);
		args.push('--color always');
		return this.exec('npm', args, null, true);
	},

	/**
		Call the PHP command. If the `-s` option was used, call HHVM instead!
		@method	php
		@return	{ChildProcess}
	*/
	php: function () {
		if (this.options.hhvm) {
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
		var args = Array.prototype.slice.apply(arguments);
		args.push('--ansi');
		return this.exec('composer', args);
	},

	/**
		Call ./artisan
		@method	artisan
		@return	{ChildProcess}
	*/
	artisan: function () {
		var args = ['artisan'];
		args.push.apply(args, arguments);
		args.push('--ansi');
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
		args.push('--colors');
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
			vagrant = simon.options.vagrant,
			box,
			task;

		// Get the list of boxes

		if (this.options.local || !vagrant || !vagrant.box) {
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

		var vagrant = this.options.vagrant,
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

		if (!this.options.local && vagrant) {
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
		return this.runTasks([{
			name: 'npm',
			args: ['install']
		}, {
			name: 'composer',
			args: ['install']
		}, {
			name: 'bower',
			args: ['install']
		}, {
			name: 'npm',
			args: ['start']
		}]);
	},

	/**
		Run the update methods for all the package managers
		@method	update
		@return {EventEmmiter}
	*/
	update: function () {
		return this.runTasks([{
			name: 'npm',
			args: ['update']
		}, {
			name: 'npm',
			args: ['install']
		}, {
			name: 'composer',
			args: ['update']
		}, {
			name: 'composer',
			args: ['install']
		}, {
			name: 'bower',
			args: ['update']
		}, {
			name: 'bower',
			args: ['install']
		}, {
			name: 'npm',
			args: ['start']
		}]);
	},

	/**
		Refresh the database
		@method	install
		@return {EventEmmiter}
	*/
	refresh: function () {
		var task = this.artisan('migrate:refresh --seed');
		task.on('close', function (code) {
			if (code) {
				message.error('The database did not refresh successfully');
			} else {
				message.success('Database refreshed and seeded successfully');
			}
		});
		return task;
	},

	ssh: function () {
		var args = Array.prototype.slice.apply(arguments),
			command = args.shift();
		// Execute the given command, but NOT locally
		return this.exec(command, args, null, false);
	},

	/**
		Build the front end end begin watching for changes
		@method @watch
	*/
	watch: function () {
		return this.grunt('watch');
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
		Show the help information
		@method	help
	*/
	help: function () {
		console.log(('\n' + this.options.banner + '').cyan);
		if (typeof this.options.help === 'function') {
			this.options.help();
		}
		console.log('  In interactive mode, hit TAB to show autocompletions');
		console.log('  Note: Command-line options are not available in interactive mode\n');
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

			ip = this.options.ip,
			domain = this.options.domain,
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
			message.error(e + '');
			message.error('The site "' + url + '" could not be added.');
			return false;

		}

		message.success('Added new site at ' + url.bold);

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

			//ip = this.options.ip,
			domain = this.options.domain,
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

		// First check if the slug exists
		if (hosts.match(existingMatch)) {

			try {

				// Attempt replacing
				fs.writeFileSync(
					locations.hostsFile,
					hosts.replace(existingMatch, eol)
				);

				message.success('The site "' + url.bold + '" was removed successfully.');
				return true;

			} catch (e) {
				// An error occured, probably permissions
				message.error(e + '');
				message.error('The site "' + url + '" could not be removed.');
			}
		} else {
			// Doesn't exist
			message.warning('The site "' + url + '" does not exist');
			return true;
		}

		return false;
	},

	/**
		Initialise interactive mode!
		@method prompt
	*/
	prompt: function () {
		var rli = this._prompt.ask(this);
		rli.on('close', this.killRunningTasks.bind(this));
		return rli;
	}

};

// Constructor options
Simon.LOCATIONS = require('./options/locations');
Simon.OPTIONS = require('./options/simon');

module.exports = new Simon();
