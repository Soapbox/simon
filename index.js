// Command-line interface

var fs = require('fs'),
	configFileName = process.cwd() + path.sep + 'simon.json',
	path,		// Path. http://nodejs.org/api/path.html
	program,	// Commander. Command-line interface provider. https://github.com/visionmedia/commander.js
	Command,	// Constructor class for Commander
	pkg, config, simon;

if (!fs.existsSync(configFileName)) {
	// Make sure simon.json is defined
	console.error(
		'    No simon.json file found. \n' +
		'    Run "simon help" to learn how to set this up'
	);
	process.exit();
}

require('colors');

path = require('path');
program = require('commander');
Command = program.Command;
pkg = require('./package.json');// package.json info
config = require('./simon.json');

// Custom config
config.help = program.outputHelp.bind(program);
config.banner = fs.readFileSync('./lib/banner.txt', {
	encoding: 'utf8'
});

// Instantiate Simon!
simon = require('./simon.js')(config);


// Don't exist when there's an unknown options
Command.prototype.unknownOption = function (flag) {
	console.warn();
	console.warn("  Warning: unknown option `%s'", flag);
	console.warn();
	//process.exit(1);
};

// Parse given commandline arguments
function parseArgs(command) {
	var args = process.argv,
		commandIndex = args.indexOf(command);
	return args.slice(commandIndex + 1);
}

// Find locations of all the files
/*if (!fs.existsSync(locations.hostsFile)) {
	util.error('Warning'.bold.yellow + ': Could not read the hosts file.'.yellow);
	util.error((
		'Please make sure "' + locations.hostsFile + '" exists on your system, ' +
		'or make sure that your system is supported'
	));
}
*/

// Setup for program commands

program.version(pkg.version)
	.option('-s, --super', 'Run PHP commands such as PHPUnit and Artisan with HHVM.')
	.option('-g, --vagrant', 'Run non-Node commands on the Vagrant VM by default');

// Run the default task
program.command('help')
	.description('Show this help block')
	.action(function () {
		simon.help();
	});

// Run the install
program.command('install')
	.description('Installs all vendor dependencies from NPM, Composer, and Bower')
	.action(function () {
		simon.install();
	});

// Run update for all package managers
program.command('update')
	.description('Updates all vendor dependencies from NPM, Composer, and Bower')
	.action(function () {
		simon.update();
	});

// Run NPM
program.command('npm *')
	.description('Proxies the global npm command')
	.action(function (args) {
		args = parseArgs('npm');
		simon.npm.apply(simon, args);
	});

// Run composer
program.command('composer *')
	.description('Proxies the global composer command')
	.action(function (args) {
		args = parseArgs('composer');
		simon.composer.apply(simon, args);
	});

// Run artisan
program.command('artisan *')
	.description('Proxies the local php artisan command')
	.action(function (args) {
		args = parseArgs('artisan');
		simon.artisan.apply(simon, args);
	});

// Run PHPUnit
program.command('phpunit *')
	.description('Proxies the local phpunit command')
	.action(function (args) {
		//args = arguments.length > 1 ? Array.prototype.slice.call(arguments, 0, -1) : [];
		args = parseArgs('phpunit');
		simon.phpunit.apply(simon, args);
	});

// Run refresh
program.command('refresh')
	.description('Reexecutes migrations and seeds the database')
	.action(function () {
		simon.refresh();
	});

/*// Add a new SoapBox
program.command('add <slug>')
	.description('Adds a new local SoapBox at <slug>.soapboxv4.dev')
	.action(function (slug) {
		simon.add(slug);
	});

// Remove a new SoapBox
program.command('remove <slug>')
	.description('Removes the local SoapBox at <slug>.soapboxv4.dev')
	.action(function (slug) {
		simon.remove(slug);
	});
*/

// Run bower
program.command('bower *')
	.description('Proxies the local bower command')
	.action(function (args) {
		args = parseArgs('bower');
		simon.bower.apply(simon, args);
	});

// Run grunt
program.command('grunt *')
	.description('Proxies the local grunt command')
	.action(function (args) {
		args = parseArgs('grunt');
		simon.grunt.apply(simon, args);
	});

// Initialize the app
program.command('start')
	.description('Initialize the development environment')
	.action(function () {
		simon.init();
	});

program.command('init')
	.description('Alias to the start command')
	.action(function () {
		simon.init();
	});

// Run a grunt command
program.command('*')
	.description('Run a given Grunt task')
	.action(function (task) {
		var args = parseArgs(task);
		args.unshift(task);
		simon.grunt.apply(simon, args);
	});

program.on('help', function () {
	console.log('  Run ./simon without arguments to enter ' + 'interactive mode\n'.bold);
});

program.on('help', function () {
	console.log([
		'  If you\'re running a proxy command, make sure you specify any',
		'  options to simon ' + 'before'.bold + ' the command.\n',
		'  In this command, the -s options will be applied to simon, and the --debug',
		'  options will be applied to phpunit:\n',
		'      ./simon -s phpunit --debug\n'
	].join('\n'));
});

config.help =

module.exports = {
	program: program,
	simon: simon
};
