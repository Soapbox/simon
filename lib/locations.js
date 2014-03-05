var path = require('path');

module.exports = {
	hostsFile: process.platform === 'win32' ?
		"C:\\Windows\\system32\\drivers\\etc\\hosts" :
		"/etc/hosts",
	composerVendorFolder: ['vendor'].join(path.sep),
	bowerComponentsFolder: [
		'bower_components'
	].join(path.sep)
};
