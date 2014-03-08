var readline = require('readline'), // Get a line from input
	util = require('util'),
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

	init: function () {
		var prompt = this;

		this._runningTasks = [];
		this._triggerStreams = [];

		process.on('exit', function () {
			prompt._runningTasks.map(function (task) {
				if ('kill' in task) {
					task.kill();
				}
			});
			prompt._runningTasks.length = 0;
		});
	},

	getRl: function () {
		this.rl = this.rl || readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			terminal: true
		});
		return this.rl;
	},

	closeRl: function () {
		var rl = this.rl;
		if (this.rl) {
			rl.close();
		}
	},

	/**
		Configuration options
		@method	configure
		@param	{Hash} options
		@return {Hash} this.options
	*/
	configure: function (options) {

		if (options && 'text' in options && this.options) {
			this.options._hasText = false;
		}

		options = extend(
			this.options || this.constructor.OPTIONS,
			options
		);

		if (!options._hasText) {

			// Format
			options.text = options.text.grey;
			options._hasText = true;
		}

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
			options = this.options,
			rl = this.getRl();

		this.trigger();
		this.activate();

		return rl.question(this.options.text, function (command) {

			var task, isQuit,
				runningTasks = prompt._runningTasks,
				args = command.trim().split(/\s+/);

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

				if ('on' in task && typeof task.on === 'function') {

					// Defer prompting until the task closes

					runningTasks.push(task);

					task.on('close', function () {

						runningTasks.splice(
							runningTasks.indexOf(task), 1
						);

						if (runningTasks.length === 0) {

							// No more tasks have to finish, prompt again
							prompt.ask(context);
						}
					});
					return;
				}

			} else if (isQuit) {

				// All done!
				prompt.closeRl();
				process.exit();
				return;

			} else {

				// Command not found
				message.warning('The "' + command.bold + '" command is unavailable');
			}

			// Continue prompting
			prompt.ask(context);

		});
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
			streams.splice(streams.indexOf(stream), 1).map(function (removed) {
				removed.off('data', trigger);
			}, this);
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
				util.print(prompt.options.text);
			}
		}, 3000);


		this._promptTrigger = function () {
			// Make sure it's triggered only when active
			if (prompt._isActive) {
				trigger();
			}
		};

		// Prevents background tasks that pipe to stdio from breaking the prompt
		process.stdout.on('data', this._promptTrigger);
		process.stderr.on('data', this._promptTrigger);

		return this._promptTrigger;
	},

	/**
		Clear the existing trigger fuction
		@method	_clearTrigger
		@access	private
	*/
	_clearTrigger: function () {
		var trigger = this._promptTrigger;

		if (trigger) {
			process.stdout.removeListener('data', trigger);
			process.stderr.removeListener('data', trigger);
		}

		this._promptTrigger = null;
	}

};

Prompt.OPTIONS = require('./options/prompt');
module.exports = new Prompt();
