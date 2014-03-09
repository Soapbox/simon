/**
	SoapBox Simon CLI implementation
*/

var fs = require('fs'),
	path = require('path'),	// Path. http://nodejs.org/api/path.html
	configFileName = path.join(process.cwd(), 'simon.json'), // Current project simon.json
	program,	// Commander. Command-line interface provider. https://github.com/visionmedia/commander.js
	Command,	// Constructor class for Commander
	pkg, config, simon;

require('colors');

program = require('commander');
Command = program.Command;
pkg = require('./package.json'); // package.json info

// Instantiate Simon!
simon = require('./lib/simon');

// Don't exist when there's an unknown options (could belong to the proxy)
Command.prototype.unknownOption = function (flag) {
	console.warn();
	console.warn("  Warning: unknown option `%s'", flag);
	console.warn();
	//process.exit(1);
};

// Parse given commandline arguments
// Makes sure that the executed commands get the right args
function parseArgs(command) {
	var args = process.argv,
		commandIndex = command ? args.indexOf(command) : -1;
	return args.slice(commandIndex + 1);
}

// Perform configuration based on simon.json
function configureSimon(simon, config, program, skipSimonJsonCheck) {

	if (!skipSimonJsonCheck && !fs.existsSync(configFileName)) {

		// Make sure simon.json is defined
		console.error([
			'',
			'  No simon.json file found. Visit',
			'    https://github.com/nfrasser/simon',
			'  To find out how to set this up\n'
		].join('\n'));

		process.exit();
	}

	config = config || require(configFileName);

	// Perform configuration
	if (program.local) {
		config.local = true;
	}
	if (program.super) {
		config.hhvm = true;
	}

	// Simon's help method will be the commander's help
	config.help = program.outputHelp.bind(program);

	// Get the banner
	config.banner = fs.readFileSync(
		path.join(
			__dirname, 'lib', 'options', 'banner.txt'), {
			encoding: 'utf8'
		}
	);

	// Perform configuation
	simon.configure(config);

	return simon;
}


// Setup for program commands

program.version(pkg.version)
	.option('-s, --super', 'Run PHP commands such as PHPUnit and Artisan with HHVM.')
	.option('-l, --local', 'Run all commands locally instead of on the Vagrant VM.')
	.option('-i, --interactive', 'Jump right into interactive mode.')
	.option('--subdomain [slug]', 'Specify a subdomain for the "add" and "remove" commands');

// Run the default task
program.command('help')
	.description('Show this help block')
	.action(function () {
		configureSimon(simon, config, program, true);
		simon.help();
	});

// Run the install
program.command('install')
	.description('Installs all vendor dependencies from NPM, Composer, and Bower')
	.action(function () {
		configureSimon(simon, config, program);
		simon.install();
	});

// Run update for all package managers
program.command('update')
	.description('Updates all vendor dependencies from NPM, Composer, and Bower')
	.action(function () {
		configureSimon(simon, config, program);
		simon.update();
	});

// Run Vagrant
program.command('vagrant *')
	.description('Proxies the global vagrant command')
	.action(function (args) {
		configureSimon(simon, config, program);
		args = parseArgs('vagrant');
		simon.vagrant.apply(simon, args);
	});

// Run a command on the Vagrant VM
program.command('ssh <cmd>')
	.description('Run the given command on the Vagrant VM')
	.action(function (/*cmd*/) {
		configureSimon(simon, config, program);
		var args = parseArgs('ssh');
		simon.ssh.call(simon, args.join(' '));
	});

// Run NPM
program.command('npm *')
	.description('Proxies the global npm command')
	.action(function (args) {
		configureSimon(simon, config, program);
		args = parseArgs('npm');
		simon.npm.apply(simon, args);
	});

// Run composer
program.command('php *')
	.description('Proxies the global php command')
	.action(function (args) {
		configureSimon(simon, config, program);
		args = parseArgs('php');
		simon.php.apply(simon, args);
	});

// Run composer
program.command('composer *')
	.description('Proxies the global composer command')
	.action(function (args) {
		configureSimon(simon, config, program);
		args = parseArgs('composer');
		simon.composer.apply(simon, args);
	});

// Run artisan
program.command('artisan *')
	.description('Proxies the local php artisan command')
	.action(function (args) {
		configureSimon(simon, config, program);
		args = parseArgs('artisan');
		simon.artisan.apply(simon, args);
	});

// Run PHPUnit
program.command('phpunit *')
	.description('Proxies the local phpunit command')
	.action(function (args) {
		//args = arguments.length > 1 ? Array.prototype.slice.call(arguments, 0, -1) : [];
		configureSimon(simon, config, program);
		args = parseArgs('phpunit');
		simon.phpunit.apply(simon, args);
	});

// Run refresh
program.command('refresh')
	.description('Reexecutes migrations and seeds the database')
	.action(function () {
		configureSimon(simon, config, program);
		simon.refresh();
	});

// Add the currently configured domain to the hosts file
program.command('add')
	.description('Adds a new website for the current project')
	.action(function () {
		configureSimon(simon, config, program);
		simon.add(program.subdomain);
	});

// Remove the currently configured domain from the hosts file
program.command('remove')
	.description('Removes the website for the current project')
	.action(function () {
		configureSimon(simon, config, program);
		simon.remove(program.subdomain);
	});


// Run bower
program.command('bower *')
	.description('Proxies the local bower command')
	.action(function (args) {
		configureSimon(simon, config, program);
		args = parseArgs('bower');
		simon.bower.apply(simon, args);
	});

// Run grunt
program.command('grunt *')
	.description('Proxies the local grunt command')
	.action(function (args) {
		configureSimon(simon, config, program);
		args = parseArgs('grunt');
		simon.grunt.apply(simon, args);
	});

// Fix permissions on the app/storage folder
program.command('permissions')
	.description('Fix permissions on the app/storage folder (UNIX only)')
	.action(function () {
		configureSimon(simon, config, program);
		simon.permissions();
	});

// Initialize the app
program.command('start')
	.description('Initialize the development environment')
	.action(function () {
		configureSimon(simon, config, program);
		simon.start();
	});

// Run a grunt command
program.command('*')
	.description('Run a given Grunt task')
	.action(function (task) {
		var args = parseArgs(task);
		configureSimon(simon, config, program);
		args.unshift(task);
		simon.grunt.apply(simon, args);
	});


program.on('help', function () {
	console.log('  Run simon without arguments to enter ' + 'interactive mode\n'.bold);
	console.log([
		'  If you\'re running a proxy command, make sure you specify any',
		'  options to simon ' + 'before'.bold + ' the command you want to call.\n',
		'  In this command, the -s options will be applied to simon, and the --debug',
		'  options will be applied to phpunit:\n',
		'      simon -s phpunit --debug\n'
	].join('\n'));
});

program.parse(process.argv);

module.exports = {
	program: program,
	simon: simon,
	options: config,
	configure: configureSimon,
	parse: parseArgs
};
