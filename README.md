SoapBox Simon
=====

The development interface for SoapBox. Can be used specifically for any project that replies on

* PHP
* Laravel
* Vagrant
* Node.js
* Bower
* Grunt

## Prerequisites

* [Node.js](http://nodejs.org/download/)
* [VirtualBox](https://www.virtualbox.org/wiki/Downloads)
* [Vagrant](http://www.vagrantup.com/downloads.html)

## Getting Started

First download the [latest release tarball](https://github.com/nfrasser/simon/releases/latest), then install globally with NPM:

```bash
npm install -g ~/Downloads/simon-0.0.x.tar.gz
```

You now have access to the `simon` command across your system.

### Creating a `simon.json` file

You need to have a `simon.json` file in your project's root directory before using Simon for development. Here's the sample file with all available options and their defaults:

```js
{
	"hhvm": false,					// Run PHP commands with HHVM instead
	"vagrant": false,				// Run all commands (except Node) on the VM
	"prompt": 'Simon says (enter a command) > ',	// The interactive mode prompt
	"banner": 'SoapBox Simon',			// Value of the banner (set by the CLI)
	"ip": '127.0.0.1',				// Local IP address for project
	"url": 'localhost'				// Local URL for project
}
```

### Options

Once you have your `simon.json` file, navigate to your project's root directory and run `simon help` to view the options you have available:

```bash
$ simon help

  Usage: simon [options] [command]

  Commands:

    help                   Show this help block
    install                Installs all vendor dependencies from NPM, Composer, and Bower
    update                 Updates all vendor dependencies from NPM, Composer, and Bower
    vagrant                Proxies the global vagrant command
    npm                    Proxies the global npm command
    composer               Proxies the global composer command
    artisan                Proxies the local php artisan command
    phpunit                Proxies the local phpunit command
    refresh                Reexecutes migrations and seeds the database
    bower                  Proxies the local bower command
    grunt                  Proxies the local grunt command
    start                  Initialize the development environment
    *                      Run a given Grunt task

  Options:

    -h, --help     output usage information
    -V, --version  output the version number
    -s, --super    Run PHP commands such as PHPUnit and Artisan with HHVM.
    -u, --up       Run non-Node commands on the Vagrant VM by default

```

### Setting up a project for the first time

As soon as you have your project directory, navigate to it and run

```bash
sudo simon add
```

Simon will add the IP address of the site (as specified in `simon.json`) to the hosts file.

If your site requires multiple subdomains, run

```bash
sudo simon add <subdomain>
```

## Usage Simon for SoapBox development

Make sure you have all the above prequisites installed, and that your project has a valid Vagrantfile. Whenever you begin your day of development or switch branches on git, run

```
simon start
```

This does a few things

1. Installs, provitions, and boots up the Vagrant virtual machine that hosts your website
2. Installs Composer dependencies
3. Performs any outstanding database migrations with `artisan`
4. Installs NPM development dependencies (for Grunt)
5. Installs Bower front-end dependencies
6. Runs `npm start`, which is a specified in `package.json` and is usually the default Grunt task

And that's all you should need until someone other than your changes your current branch!

### Running on Vagrant with the `--up` option

When you use Simon's `--up` or `-u` option, all commands (except for most Node.js commands for performance reasons) will be run on the Vagrant virtual machine.

```bash
simon -v start
```

Will perform the startup process above, except that `composer` and `artisan` will run on the VM rather than locally.

### Interactive mode

After running `simon start`, run `simon` without any arguments to enter _interactive mode_. Here you'll be able run some useful SoapBox-related commands in the mini "Simon says" shell.

```bash
simon
```

Interactive mode is optional for day-to-day backend development, but front-end developers will have to keep it running, as it's responsible for running the Grunt watch task recompiles the front-end when a file changes.

From interactive mode you can run most of the commands available from `simon help`
```bash
$ simon
Simon says (enter a command)
refresh

Running php artisan migrate:refresh --seed

***
Copyright © 2014 SoapBox Innovations Inc.

