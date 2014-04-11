module.exports = {

	log: function (message, prefix) {
		prefix = prefix || (
			// Default simon prefix
			process.platform === 'darwin' ? '📣 ' : '[simon]'.cyan
		);
		message = prefix + ' ' + message;
		console.log(message);
		return message;
	},

	success: function (message) {
		return this.log(message.green);
	},

	error: function (message) {
		return this.log(message.red);
	},

	warning: function (message) {
		return this.log(message.yellow);
	},

	info: function (message) {
		return this.log(message.cyan);
	},

	say: function (author, message) {
		return this.log(author.magenta.bold + ': ' + message, '💬');
	}
};
