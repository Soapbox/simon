module.exports = {
	hhvm: false,
	vagrant: true,
	prompt: 'Simon says (enter a command): ',
	banner: 'SoapBox Simon',
	ip: '127.0.0.1',
	domain: 'localhost',
	vagrantDir: '/vagrant',
	help: function () {
		console.log('    See https://github.com/nfrasser/simon/');
	}
};
