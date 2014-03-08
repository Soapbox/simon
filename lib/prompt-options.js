module.exports = {

	// These methods cannot be called from the prompt
	blacklist: [
		'init',
		'configure',
		'start',
		'vagrant',
		'exec',
		'execFile',
		'prompt',
		'add',
		'remove',
		'watch'
	],

	// These methods all result in `process.exit()` if called from the prompt
	quitlist: [
		'stop',
		'exit',
		'quit'
	],

	isBlacklisted: function (method) {
		return this.blacklist.indexOf(method) >= 0;
	},

	isQuitlisted: function (method) {
		return this.quitlist.indexOf(method) >= 0;
	}
};