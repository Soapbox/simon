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

First download the [latest tarball](https://github.com/nfrasser/simon/releases/latest), then install globally with NPM

```
npm install -g ~/Downloads/simon-0.0.x.tar.gz
```

You now have access to the `simon` command across your system.

### Updating Simon

To update Simon you'll have to remove the currently installed package
```
npm uninstall -g soapbox-simon
```

then follow the installation steps above for the latest release.


### Creating a `simon.json` file

You need to have a `simon.json` file in your project's root directory before using Simon for development. Here's the sample file with all available options and their defaults:

```json
{
	"hhvm": false,
	"local": false,
	"prompt": "Simon says (enter a command): ",
	"ip": "127.0.0.1",
	"domain": "localhost",
	"vagrant": {
		"dir": "/vagrant",
		"box": {
			"name": "precise64",
			"provider": "virtualbox",
			"url": "http://files.vagrantup.com/precise64.box"
		}
	}
}
```

Here's what each of these do

**`hhvm`** If true, will run all PHP commands (including PHPUnit and Composer) with the [HipHop Virtual Machine](http://www.hhvm.com/). Same as using the `--super` option.

**`local`** If true, will not ssh into the Vagrant VM before running a command. Note that all Node commands (including NPM, Grunt, and Bower) _always_ run locally.

**`prompt`** The question Simon asks you during interactive mode.

**`ip`** IP address of the Vagrant machine. Should be the same as the IP on `config.vm.network` in the Vagrantfile.

**`domain`** Domain name that resolves to the `ip`.

**`vagrant`** Configuration hash for Vagrant. If set to `false`, Simon will not attempt to install a Vagrant VM and will attempt to run all commands locally.


### Commands and Options

Once you have your `simon.json` file, navigate to your project's root directory and run `simon help` to view the options you have available:

```
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
    add                    Adds a new website for the current project
    remove                 Removes the website for the current project
    bower                  Proxies the local bower command
    grunt                  Proxies the local grunt command
    permissions            Fix permissions on the app/storage folder (UNIX only)
    start                  Initialize the development environment
    *                      Run a given Grunt task

  Options:

    -h, --help          output usage information
    -V, --version       output the version number
    -s, --super         Run PHP commands such as PHPUnit and Artisan with HHVM.
    -l, --local         Run all commands locally instead of on the Vagrant VM.
    --subdomain [slug]  Specify a subdomain for the "add" and "remove" commands

```

### Setting up a project for the first time

As soon as you have your project directory, navigate to it and run

```
sudo simon add
```

Simon will add the IP address of the site (as specified in `simon.json`) to the hosts file.

If your site requires multiple subdomains, run

```
sudo simon add --subdomain <subdomain>
```

## Using Simon for SoapBox development

Make sure you have all the above prequisites installed, and that your project has valid Vagrantfile and simon.json files. Whenever you begin your day of development or switch branches on git, run

```
simon start
```

This does a few things

1. Installs, provisions, and boots up the Vagrant virtual machine that hosts your website
2. Installs Composer dependencies
3. Performs any outstanding database migrations with `artisan`
4. Installs NPM development dependencies (for Grunt)
5. Installs Bower front-end dependencies
6. Runs `npm start` (which is a specified in the project's `package.json` and is usually the default Grunt task)

And that's all you should need until the current branch changes!

### Interactive mode

After running `simon start`, run `simon` without any arguments to enter _interactive mode_. Here you'll be able run some useful SoapBox-related commands in the mini "Simon says" shell.

```
simon
```

Interactive mode is optional for day-to-day backend development, but front-end developers will have to keep it running. It's responsible for running the Grunt watch task recompiles the front-end when a file changes.

From interactive mode you can run most of the commands available from `simon help`

```
$ simon
Simon says (enter a command):
refresh

> Running php artisan migrate:refresh --seed

...

Database refreshed and seeded successfully

Simon says (enter a command):

```

You can also run interactive mode with the command-line options. For example, running `simon -l` will ensure that the `artisan` interactive command always calls `php artisan` on the host machine.

You can safely exit out of interactive mode at any time by typing `stop` or `exit`.

### Running commands on the host machine with the `--local` option

By default, all of Simon's commands (except for most Node.js commands for performance reasons) run on the Vagrant VM. When you use Simon's `--local` or `-l` option, all commands will run on your local machine.

For example

```
simon -l start
```

will perform the startup process above, except  `composer` and `artisan` will run locally rather than on the VM.


***
Copyright © 2014 SoapBox Innovations Inc.

