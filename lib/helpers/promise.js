var isArray = require('lodash').isArray;
var Promise = require('rsvp').Promise;

/**
  Make an RSVP promise out of a generic node function that takes a callback as
  its last argument.

  First argument is either (a) the function to call or (b) an array where the
  first element is the context, and the second is the function to call.

  Do not pass in the standard callback argument at the end
*/
module.exports = function promise(fn) {
  var context = this;
  var args = Array.prototype.slice.call(arguments, 1);

  if (isArray(fn)) { // can replace with `fn instanceof Array`
    // context is first param, function is second
    context = fn[0];
    fn = fn[1];
  }

  if (typeof fn !== 'function') {
    throw new Error("First argument for promise.make must be a function");
  }

  // Return the promise
  return new Promise(function (resolve, reject) {
    args.push(function (err, result) {
      if (err) { return reject(err); }
      return resolve(result);
    });
    fn.apply(context, args);
  });
};
