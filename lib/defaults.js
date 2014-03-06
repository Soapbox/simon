module.exports = {
	"hhvm": false,								// Run PHP commands with HHVM instead
	"local": false,								// Run all commands locally instead of on the VM
	"prompt": 'Simon says (enter a command): ',	// The interactive mode prompt
	"banner": 'SoapBox Simon',					// Value of the banner (set by the CLI)
	"ip": '127.0.0.1',							// Local IP address for project
	"domain": 'localhost',						// Local URL for project
	"vagrantDir": '/vagrant',					// Name of shared directory on the VM
	"help": function () {
		console.log('    See https://github.com/nfrasser/simon/');
	}
};
