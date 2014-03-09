var readline = require('readline'), // Get a line from input
	message = require('./helpers/message'),
	_  = require('underscore'),
	extend = _.extend,
	debounce = _.debounce;

require('colors');

/**
	Responsible for managing the Prompt for Simon's interactive mode
	@class		Prompt
*/
function Prompt(options) {
	this.constructor = Prompt;
	this.Prompt = Prompt;
	this.configure(options);
	this.init();
}

Prompt.prototype = {

	_runningTasks: null,

	/**
		Readline Interface instance
		@property rli
	*/
	rli: null,

	init: function () {
		var prompt = this;

		this._runningTasks = [];
		this._triggerStreams = [];

		process.on('exit', function () {
			prompt.killRunningTasks();
			if (prompt.rli) {
				prompt.rli.close();
			}
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

	getRl: function () {

		var prompt = this,
			rli = this.rli;

		if (!rli) {
			rli = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
				terminal: true,
				completer: function (line) {
					var hits, completions = prompt.options.commands.slice();
					completions.push.apply(completions, prompt.options.quit);
					completions.push('clear');

					hits = completions.filter(function (c) {
						return c.indexOf(line) === 0;
					});

					// show all completions if none found
					return [hits.length ? hits : completions, line];
				}
			});

			rli.on('close', function () {
				message.warning('Closing prompt');
				prompt.rli = null;
			});

			rli.on('SIGINT', function () {

				// The kill signal (i.e., ^C) was sent

				if (prompt._runningTasks.length) {

					// Just cancel the running tasks
					message.warning('Cancelling running task(s)');
					prompt.killRunningTasks();

				} else {

					// Not running tasks, close the prompt and exit
					rli.close();
					process.exit();

				}

			});

			this.rli = rli;
		}

		return rli;
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

		this.options = options;

		return this.options;

	},

	/**
		Activate the prompt, meaning it's ready to ask for input
		@method activate
	*/
	activate: function () {
		this._isActive = true;
	},

	/**
		Deactivate the prompt, meaning it has to do some processing
		before next asking for input
		@method	deactivate
	*/
	deactivate: function () {
		this._isActive = false;
	},

	/**
		Trigger the prompt text to appear again. Usually called if some output
		displaced the previous prompt.
		@method	trigger
	*/
	trigger: function () {
		var promptTrigger = this._promptTrigger || this._generateTrigger();
		promptTrigger();
	},

	/**
		Being asking for input
		@method ask
		@param	{Object} context In which to look for available methods
	*/
	ask: function (context) {

		var prompt = this,
			text = this.options.text,
			options = this.options,
			rli = this.getRl();

		this.trigger();
		this.activate();

		rli.setPrompt(text.cyan, text.length);
		rli.prompt();

		rli.on('line', function (command) {

			var task, isQuit,
				runningTasks = prompt._runningTasks,
				args = command.trim().split(/\s+/);

			//rli.pause();
			prompt.deactivate();

			if (args.length === 0 || !args[0]) {

				// No command, just prompt again
				prompt.ask(context);
				return;
			}

			// Is this one of the quit commands?
			isQuit = options.quit.indexOf(args[0]) >= 0;

			// Parse
			command = args.shift();
			args = args.join(' ');

			// Check to see if the given command can be called
			if (options.commands.indexOf(command) >= 0 &&
				typeof context[command] === 'function'
			) {

				// Call the given task
				task = context[command].call(context, args);

				if (task && 'on' in task && typeof task.on === 'function') {

					// Defer prompting until the task closes
					runningTasks.push(task);

					task.on('close', function () {

						runningTasks.splice(
							runningTasks.indexOf(task), 1
						);

						if (runningTasks.length === 0) {

							// No more tasks have to finish, prompt again
							prompt.activate();
							rli.prompt();
						}
					});

					return;
				}

			} else if (command.toLowerCase() === 'clear') {

				// Clear the screen!
				process.stdout.write('\u001B[2J\u001B[0;0f');

			} else if (isQuit) {

				// All done!
				rli.close();
				//process.exit();

				return;

			} else {

				// Command not found
				message.warning(
					'The "' + command.bold + '" command was not found or is unavailable'
				);
			}

			// Continue prompting
			prompt.activate();
			rli.prompt();

		});

		return rli;

	},

	/**
		Add a stream that might require the prompt to be triggered
		when the `data` event is called. For example, if a task has
		it's output piping into stdout, add it here to make sure that
		simon still prompts you when something displaces the prompt.

		@method	addTriggerStream
	*/
	addTriggerStream: function (stream) {
		var streams = this._triggerStreams,
			trigger = this._boundTrigger = (
				this._boundTrigger || this.trigger.bind(this)
			);

		if (stream && trigger) {
			stream.on('data', trigger);
			streams.push(stream);
		}

		return stream;
	},

	/**
		Removes a stream added by `addTriggerStream`
		@method removeTriggerStream
	*/
	removeTriggerStream: function (stream) {

		var streams = this._triggerStreams,
			trigger = this._boundTrigger;

		if (stream && trigger) {

			// Remove the stream and disable the trigger
			streams.splice(streams.indexOf(stream), 1);
			stream.removeListener('data', trigger);
		}

		return stream;
	},

	/**
		Create a new trigger function
		@method	_generateTrigger
		@access	private
	*/
	_generateTrigger: function () {

		var trigger, prompt = this;

		// Clear out the previous triggger
		this._clearTrigger();

		// Debounced relogging of the trigger
		trigger = debounce(function () {
			if (prompt._isActive) {
				console.log();
				prompt.getRl().prompt(true);
			}
		}, 3000);


		this._promptTrigger = function () {
			// Make sure it's triggered only when active
			if (prompt._isActive) {
				trigger();
			}
		};

		return this._promptTrigger;
	},

	/**
		Clear the existing trigger fuction
		@method	_clearTrigger
		@access	private
	*/
	_clearTrigger: function () {
		this._promptTrigger = null;
	}

};

Prompt.OPTIONS = require('./options/prompt');
module.exports = new Prompt();
