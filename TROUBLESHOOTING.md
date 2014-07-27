# Troubleshooting

This guide will walk you through some common problems you'll run into while
using Simon, and provide possible fixes.

* [General advice](#General-advice)
* [Vagrant fails to boot after creating a new VM](#Vagrant-fails-to-boot-after-creating-a-new-VM)
* [Composer asks to update itself](#Composer-asks-to-update-itself)
* [Composer asks for GitHub credentials](#Composer-asks-for-GitHub credentials)
* [`composer install` cannot find a vendor package](#composer-install-cannot-find-a-vendor-package)
* [Conflicts with `.min` files](#Conflicts-with-.min-files)
* [(Safely) Nuke everything and start fresh](#Safely-Nuke-everything-and-start-fresh)

***

## General advice

* Keep your development environment up to date
* Running `simon update` once in a while should fix a lot of problems
* Composer is not your friend, but be really nice to it

***

## Vagrant fails to boot after creating a new VM

Some VMs, particularly the one we use at SoapBox, will throw this error the
first time you run `simon start`:

```
The guest machine entered an invalid state while waiting for it
to boot. Valid states are 'starting, running'. The machine is in the
'poweroff' state. Please verify everything is configured
properly and try again.

If the provider you're using has a GUI that comes with it,
it is often helpful to open that and watch the machine, since the
GUI often has more helpful error messages than Vagrant can retrieve.
For example, if you're using VirtualBox, run `vagrant up` while the
VirtualBox GUI is open.
```

For SoapBox projects, you just have to disable the USB controller when this,
happens:

1. Open the VirtualBox GUI

2. Select the required VM from the sidebar (usually begins with the same name
	as your project directory)

3. Select "Settings" from the toolbar

4. Navigate to Ports > USB and uncheck "Enable USB Controller"
![Uncheck "Enable USB Controller"](https://cloud.githubusercontent.com/assets/1693461/3714677/bc80d5a4-15b6-11e4-84fb-3460f2297e27.png)

5. Run `simon start` again


***

## Composer asks to update itself

Every 30 days Composer will warn you that it's out of date and requires an
update. This is a bit tricky to do on the VM, but fortunately we came up with
a quick command for this.

Run this from the Terminal (on your local machine)

```
vagrant ssh -c 'sudo $(which composer) self-update'
```

***

## Composer asks for GitHub credentials

Happens sometimes when you're doing too many installs. Simon won't direct your
input into composer so you'll have to do this manually.

1. Log into the VM with `vagrant ssh`
2. Navigate to your project's directory on the VM (usually `cd /vagrant`)
3. Run `composer install` or `composer update`
4. Enter your credentials as usual, and let it do its thing
5. When Composer is done hit `⌃D` to log out of the VM

***

## `composer install` cannot find a vendor package

Then throws an error. This happens sometimes after you sync or rebase your
branch, and not all dependencies used by artisan were installed.

Run this from your Terminal

```
simon composer update --no-scripts
simon start
```

***

## Conflicts with `.min` files

Sometimes the front-end guys decide it's a good idea to push minified assets to
GitHub. When this happens, run whatever command builds the front end. In the
case of SoapBox apps, this will be

```
simon dist
```

***

## (Safely) Nuke everything and start fresh

For when you're having one of those days.

Note the comment for removing Bower components

```sh
rm -rf vendor           # Remove composer dependencies
rm -rf node_modules     # Remove node modules

# Change folder name to 'client/vendor' for SoapBox projects
rm -rf bower_components

vagrant destroy         # Destroy the VM
git reset --hard HEAD   # Reset your current branch
simon start             # Try again
```

And if that doesn't work

1. Restart your computer
2. Format your hard drive
3. Recompile the kernel
4. Delete system32
5. Switch to Lisp
