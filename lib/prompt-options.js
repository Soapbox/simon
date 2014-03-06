module.exports = {

	// These methods cannot be called from the prompt
	blacklist: [
		'init',
		'vagrant',
		'exec',
		'execFile',
		'prompt'
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