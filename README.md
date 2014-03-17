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

Install simon globally with NPM

```
sudo npm install -g soapbox-simon
```

You now have access to the `simon` command across your system.

### Updating Simon

```
sudo npm update -g soapbox-simon
```


### Creating a `simon.json` file

You need to have a `simon.json` file in your project's root directory before using Simon for development. Here's the sample file with all available options and their defaults:

```json
{
    "hhvm": false,
    "local": false,
    "banner": "SoapBox Simon",
    "ip": "127.0.0.1",
    "domain": "localhost",
    "prompt": {
        "text": "Simon says > ",
        "commands": [
            "..."
        ]
    },
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

* **`hhvm`**: If true, will run all PHP commands (including PHPUnit and Composer) with the [HipHop Virtual Machine](http://www.hhvm.com/). Same as using the `--super` option.

* **`local`**: If true, will not ssh into the Vagrant VM before running a command. Note that all Node commands (including NPM, Grunt, and Bower) _always_ run locally.

* **`prompt`**: Options for the [Prompt](https://github.com/nfrasser/simon/blob/master/lib/prompt.js) class, which powers interactive mode.

* **`ip`**: IP address of the Vagrant machine. Should be the same as the IP on `config.vm.network` in the Vagrantfile.

* **`domain`**: Domain name that resolves to the `ip`.

* **`vagrant`**: Configuration hash for Vagrant. If set to `false`, Simon will not attempt to install a Vagrant VM and will attempt to run all commands locally.


### Commands and Options

Once you have your `simon.json` file, navigate to your project's root directory and run `simon help` to view the options you have available:

```
$ simon help

  Usage: simon [options] [command]

  Commands:

    add                    Add a new website for the current project
    artisan                Run the local php artisan command
    bower                  Run the bower command
    composer               Run the composer command
    grunt                  Run grunt command
    help                   Show this help block
    install                Install all vendor dependencies from NPM, Composer, and Bower
    npm                    Run the npm command
    permissions            Fix permissions on the app/storage folder (UNIX only)
    php                    Run the php command
    phpunit                Run the local phpunit command
    refresh                Rollback and reapply migrations, seed the database
    remove                 Remove the website for the current project
    ssh <cmd>              Run the given command on the Vagrant VM
    start                  Initialize the development environment
    update                 Update all vendor dependencies from NPM, Composer, and Bower
    vagrant                Run the vagrant command
    *                      Run a given Grunt task

  Options:

    -h, --help          output usage information
    -V, --version       output the version number
    -i, --interactive   Jump right into interactive mode.
    -l, --local         Run all commands locally instead of on the Vagrant VM.
    -s, --super         Run PHP commands such as PHPUnit and Artisan with HHVM.
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

If you're getting permission errors or white screens, running this might fix it.

```
simon permissions
simon -l permissions
```


### Interactive mode

After running `simon start`, run `simon` without any arguments to enter _interactive mode_. Here you'll be able run some useful SoapBox-related commands in the mini "Simon says" shell.

```
simon
```

Interactive mode is optional for day-to-day backend development, but front-end developers will have to keep it running. It's responsible for running the Grunt watch task recompiles the front-end when a file changes.

From interactive mode you can run most of the commands available from `simon help`

```
$ simon
Simon says > refresh
> Running php artisan migrate:refresh --seed

...

> Database refreshed and seeded successfully
Simon says >
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

