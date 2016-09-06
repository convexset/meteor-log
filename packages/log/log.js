////////////////////////////////////////////////////////////////////////////////
// Boiler Plate
////////////////////////////////////////////////////////////////////////////////
import { checkNpmVersions } from 'meteor/tmeasday:check-npm-versions';
checkNpmVersions({  
	'package-utils': '^0.2.1',
	'underscore': '^1.8.3'
});  // package name can be omitted
const PackageUtilities = require('package-utils');
const _ = require('underscore');

import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { EJSON } from 'meteor/ejson';
import { DDP } from 'meteor/ddp-client';

////////////////////////////////////////////////////////////////////////////////
// Safely Stringifying Things
////////////////////////////////////////////////////////////////////////////////

function safeStringify(o) {
	return EJSON.stringify(stripCircularDeps(o), {canonical: true});
}

function stripCircularDeps(o, priors, paths, currPath) {
	let _o;
	if (typeof o !== 'object') {
		return o;
	}
	if (typeof priors === 'undefined') {
		return stripCircularDeps(o, [o], ['@'], '@');
	}

	const keysToProceedWith = [];
	if (_.isArray(o)) {
		_o = [];
		o.forEach((item, idx) => {
			if (priors.indexOf(item) > -1) {
				// circular dep: snip!
				_o.push(`*** circular dependency (${paths[priors.indexOf(item)]}) ***`);
			} else if (typeof item === 'object') {
				keysToProceedWith.push(idx);
				priors.push(item);
				paths.push(`${currPath}.${idx}`);
				_o.push(void 0);
			} else {
				// not an object
				_o.push(item);
			}
		});
		keysToProceedWith.forEach(idx => {
			_o[idx] = stripCircularDeps(o[idx], priors, paths, `${currPath}.${idx}`);
		});
	} else {
		_o = {};
		Object.keys(o).forEach(k => {
			if (priors.indexOf(o[k]) > -1) {
				// circular dep: snip!
				_o[k] = `*** circular dependency (${paths[priors.indexOf(o[k])]}) ***`;
			} else if (typeof o[k] === 'object') {
				keysToProceedWith.push(k);
				priors.push(o[k]);
				paths.push(`${currPath}.${k}`);
			} else {
				// not an object
				_o[k] = o[k];
			}
		});
		keysToProceedWith.forEach(k => {
			_o[k] = stripCircularDeps(o[k], priors, paths, `${currPath}.${k}`);
		});
	}
	return _o;
}

////////////////////////////////////////////////////////////////////////////////
// The Main Event
////////////////////////////////////////////////////////////////////////////////

function epochViaDelta(delta = 0) {
	return (new Date()).getTime() + delta;
}

function getLineNumber() {
	var line = (new Error("not-really-an-exception")).stack.split("\n")[4];  // 0: Error: not-really-an-exception
	                                                                         // 1: here
	                                                                         // 2: where getLineNumber is called
	                                                                         // 3: where log is called
	                                                                         // 4: what we want
	if (line.indexOf(' (') >= 0) {
		// e.g.: "    at itemOutOfRangeTest (http://localhost:3000/app/app.js?hash=573089fd35d5074ef50256d09685cf30748031a2:225:8)"
    	let s = line.split(' (')[1];
		return s.substring(0, s.length - 1);
	} else {
		// e.g.: "    at http://localhost:3000/packages/meteor.js?hash=ae8b8affa9680bf9720bd8f7fa112f13a62f71c3:464:45"
		return line.split('at ')[1];
	}
}

const Log = (function() {
	var _logConstr = function Log() {};
	var _log = new _logConstr();

	////////////////////////////////////////////////////////////////////////////
	// Client Side Recording
	////////////////////////////////////////////////////////////////////////////
	if (Meteor.isClient) {
		var _clientCollection = new Mongo.Collection(null);
		var hoursToKeep = 0.5;

		Meteor.startup(function() {
			function cleanUpCollection() {
				_clientCollection.remove({
					ts: {
						$lt: new Date(epochViaDelta(-1000 * 60 * 60 * hoursToKeep))
					}
				});
			}

			var clearingIntervalId;

			PackageUtilities.addPropertyGetterAndSetter(_log, "hoursOfDataToKeep", {
				get: () => hoursToKeep,
				set: function(value) {
					if (!!clearingIntervalId) {
						Meteor.clearInterval(clearingIntervalId);
						clearingIntervalId = null;
					}
					hoursToKeep = value;
					cleanUpCollection();
					clearingIntervalId = Meteor.setInterval(cleanUpCollection, 1000 * 60 * 60 * hoursToKeep * 0.1);
				}
			});
		});

		PackageUtilities.addPropertyGetter(_log, "allRecords", function allRecords() {
			return _clientCollection.find({
				ts: {
					$gte: new Date(epochViaDelta(-1000 * 60 * 60 * hoursToKeep))
				}
			}, {
				sort: {
					ts: 1
				}
			}).fetch();
		});

		PackageUtilities.addPropertyGetter(_log, "allRecordsSerialized", function allRecordsSerialized() {
			return safeStringify(_log.allRecords);
		});

		PackageUtilities.addImmutablePropertyFunction(_log, "getRecordsWithTag", function getRecordsWithTag(tag) {
			return _clientCollection.find({
				ts: {
					$gte: new Date(epochViaDelta(-1000 * 60 * 60 * hoursToKeep))
				},
				tags: tag
			}, {
				sort: {
					ts: 1
				}
			}).fetch();
		});

		PackageUtilities.addImmutablePropertyFunction(_log, "getRecordsWithSomeTagInList", function getRecordsWithSomeTagInList(tags) {
			tags = _.toArray(arguments).reduce((acc, x) => acc.concat(x), []);
			return _clientCollection.find({
				ts: {
					$gte: new Date(epochViaDelta(-1000 * 60 * 60 * hoursToKeep))
				},
				tags: {
					$in: tags
				}
			}, {
				sort: {
					ts: 1
				}
			}).fetch();
		});

		PackageUtilities.addImmutablePropertyFunction(_log, "getRecordsWithAllTags", function getRecordsWithTag(tags) {
			tags = _.toArray(arguments).reduce((acc, x) => acc.concat(x), []);
			if (tags.length === 0) {
				return _log.allRecords;
			}
			return _clientCollection.find({
				ts: {
					$gte: new Date(epochViaDelta(-1000 * 60 * 60 * hoursToKeep))
				},
				tags: {
					$all: tags
				}
			}, {
				sort: {
					ts: 1
				}
			}).fetch();
		});

		PackageUtilities.addImmutablePropertyFunction(_log, "displayRecords", function displayRecords(records) {
			(_.isArray(records) ? records : [records]).forEach(function(record) {
				var item = EJSON.parse(record.msg);
				if (!Meteor.isProduction) {
					item = item.concat([`\n\t\tat ${record['@']}`]);
				}
				console[record.ll].apply(console, item);
			});
		});
	}


	////////////////////////////////////////////////////////////////////////////
	// Server Side Recording
	////////////////////////////////////////////////////////////////////////////
	if (Meteor.isServer) {
		var _storeServerMessagesCalled = false;
		var _serverCollection;
		var _additionalLoggingPredicate;
		PackageUtilities.addImmutablePropertyFunction(_log, "storeServerMessages", function storeServerMessages({
			collection = new Mongo.Collection(null),
			timeToLiveInHours = 24,
			additionalLoggingPredicate = () => true,
			publications = []
		} = {}) {
			if (_storeServerMessagesCalled) {
				throw new Meteor.Error("store-server-messages-already-called", ".storeServerMessages should be called at most once");
			}
			if (!(collection instanceof Mongo.Collection)) {
				throw new Meteor.Error("invalid-collection", "Please pass a Mongo.Collection instance");
			}

			if (!_.isFunction(additionalLoggingPredicate)) {
				throw new Meteor.Error("invalid-logging-predicate", "additionalLoggingPredicate should be a function");
			}

			if (!_.isArray(publications)) {
				throw new Meteor.Error("invalid-publications", "publications should be an array of objects (see documentation)");
			}

			_additionalLoggingPredicate = additionalLoggingPredicate;

			_serverCollection = collection;
			_serverCollection._ensureIndex({
				ts: 1
			}, {
				expireAfterSeconds: timeToLiveInHours * 60 * 60
			});

			_storeServerMessagesCalled = true;

			publications.forEach(function createPublication({
				pubName = "log",
				selector = {},
				options = {
					sort: {
						ts: 1
					}
				},
				pubAuthFunction = () => true,
			} = {}) {
				if ((typeof pubName !== "string") && (pubName !== null)) {
					throw new Meteor.Error("invalid-publication-name", "pubName should be a string or null (in the case of null or \"\", no publication will be created)");
				}
				if (!_.isFunction(pubAuthFunction)) {
					throw new Meteor.Error("invalid-publication-auth-function", "pubAuthFunction should be a function");
				}
				Meteor.publish(pubName, function logPublication() {
					if (pubAuthFunction.call(this)) {
						return _serverCollection.find(selector, options);
					} else {
						this.ready();
					}
				});
			});
		});
	}

	////////////////////////////////////////////////////////////////////////////
	// Display Matters
	////////////////////////////////////////////////////////////////////////////
	var _verbosity = 5;
	PackageUtilities.addPropertyGetterAndSetter(_log, "verbosity", {
		get: () => _verbosity,
		set: (value) => {
			_verbosity = value;
		}
	});

	let _displayLineNumbers = false;
	PackageUtilities.addPropertyGetterAndSetter(_log, 'displayLineNumbers', {
		get: () => _displayLineNumbers,
		set: (value) => {
			_displayLineNumbers = !!value;
		}
	});
	let _excludeLineNumbersWith = [];
	PackageUtilities.addPropertyGetterAndSetter(_log, 'excludeLineNumbersWith', {
		get: () => {
			setTimeout(() => {
				// in case someone decides to do Log.excludeLineNumbersWith.push('xxx');
				_excludeLineNumbersWith = _excludeLineNumbersWith.map(x => x.toLowerCase());
			}, 0);
			return _excludeLineNumbersWith;
		},
		set: (value) => {
			if (_.isArray(value)) {
				_excludeLineNumbersWith = value.map(x => x.toLowerCase());
			} else {
				_excludeLineNumbersWith = [value.toString().toLowerCase()];
			}
		}
	});


	var _isDevelopment = !!Meteor.isDevelopment;
	Meteor.startup(function() {
		// just in case someone messes with this on the client
		_isDevelopment = Meteor.isDevelopment;
	});
	var _displayPredicate = () => _isDevelopment;
	PackageUtilities.addPropertyGetterAndSetter(_log, "displayPredicate", {
		get: () => _displayPredicate,
		set: function(pred) {
			if (!_.isFunction(pred)) {
				throw new Meteor.Error("logging-display-predicate-should-be-a-function");
			}
			_displayPredicate = pred;
		}
	});


	////////////////////////////////////////////////////////////////////////////
	// Additional Display Filter
	////////////////////////////////////////////////////////////////////////////
	var _currentDisplayFilter = null;
	PackageUtilities.addPropertyGetterAndSetter(_log, "currentDisplayFilter", {
		get: () => _currentDisplayFilter,
		set: function(fn) {
			if (_.isFunction(fn) || (fn === null) || (typeof fn === "undefined")) {
				_currentDisplayFilter = fn;
			} else {
				throw new Meteor.Error("invalid-display-filter", "Pass in a predicate, or null/undefined (void 0) to not use a filter");
			}
		}
	});


	////////////////////////////////////////////////////////////////////////////
	// Additional Log Handlers
	////////////////////////////////////////////////////////////////////////////
	var _additionalLogHandlers = [];
	PackageUtilities.addImmutablePropertyFunction(_log, "registerAdditionalLogHandler", function(fn) {
		if (_.isFunction(fn)) {
			_additionalLogHandlers.push(fn);
		} else {
			throw new Meteor.Error("additional-log-handlers-should-be-functions");
		}
	});


	////////////////////////////////////////////////////////////////////////////
	// Logging proper
	////////////////////////////////////////////////////////////////////////////
	const LOG_LEVELS = ["log", "info", "warn", "error"];

	function isValidLogLevel(ll) {
		return LOG_LEVELS.indexOf(ll) !== -1;
	}
	LOG_LEVELS.forEach(function(logLevel) {
		var logFunction = function logger(verbosityOrOptions, ...args) {
			// Handle Options
			var options;
			if (_.isObject(verbosityOrOptions)) {
				options = verbosityOrOptions;
			} else {
				if (_.isNumber(verbosityOrOptions)) {
					options = {
						verbosity: verbosityOrOptions
					};
				} else {
					throw new Meteor.Error("invalid-logging-options");
				}
			}

			options = _.extend({
				verbosity: 5,
				tags: [],
				record: true,
				appendStackTrace: false,
				recordStackTrace: false
			}, options, {
				logLevel: logLevel,
				args: args
			});

			// Obtain stack trace and remove reference to this function
			let _stackTraceArr = (new Meteor.Error("not-an-exception")).stack.split("\n");
			_stackTraceArr.splice(0, 2);
			let stackTrace = _stackTraceArr.join("\n");

			if (options.appendStackTrace) {
				args.push(stackTrace);
			}

			var lineNumber = getLineNumber();

			if (_displayPredicate() && ((!_.isFunction(_currentDisplayFilter)) || _currentDisplayFilter(options)) && (options.verbosity <= _verbosity)) {
				// possibly display if in dev mode and verbosity level is right
				let displayLineNumbersHere = _displayLineNumbers;
				const lineNumberLC = lineNumber.toLowerCase();
				_excludeLineNumbersWith.forEach(function(item) {
					if (displayLineNumbersHere && lineNumberLC.indexOf(item) > -1) {
						displayLineNumbersHere = false;
					}
				});
				const displayArgs = (!displayLineNumbersHere && !Meteor.isProduction) ? args : args.concat([`\n\t\tat ${lineNumber}`]);
				console[logLevel].apply(console, displayArgs);
			}

			if (options.record) {
				// if recording is not suppressed
				var record = {
					msg: safeStringify(args),
					ts: new Date(),
					v: options.verbosity,
					ll: logLevel
				};
				if (options.recordStackTrace) {
					record['stack'] = stackTrace;
				}
				if (!Meteor.isProduction) {
					record['@'] = lineNumber;
				}
				if (_.isArray(options.tags)) {
					var _tags = options.tags
						.filter(x => typeof x === "string")
						.map(x => x.trim())
						.filter(x => x.length > 0);
					if (_tags.length > 0) {
						record.tags = _tags;
					}
				}

				if (Meteor.isClient) {
					// record if on client
					_clientCollection.insert(record);
				}

				if (Meteor.isServer && !!_serverCollection) {
					// record if on server
					var context = DDP._CurrentInvocation.getOrNullIfOutsideFiber();
					if (!!context) {
						// add connection info
						_.extend(record, {
							uId: context.userId,
							cId: context.connection && context.connection.id
						});
						if (!!context.connection) {
							var clientAddress = context.connection.clientAddress || "127.0.0.1";
							var xFwdFor = context.connection.httpHeaders && context.connection.httpHeaders['x-forwarded-for'];
							if (clientAddress !== "127.0.0.1") {
								record.ca = clientAddress;
							} else {
								record.xf = xFwdFor;
							}
						}
					}
					_serverCollection.insert(record);
				}
			}

			_additionalLogHandlers.forEach(fn => fn(options));
		};

		PackageUtilities.addImmutablePropertyFunction(logFunction, "withParams", function withParams(verbosityOrOptions) {
			var _verbosityOrOptions = PackageUtilities.deepCopy(verbosityOrOptions);
			return function loggerWithParams(...args) {
				return logFunction.apply(this, [_verbosityOrOptions].concat(args));
			};
		});

		PackageUtilities.addImmutablePropertyFunction(_log, logLevel, logFunction);
	});


	////////////////////////////////////////////////////////////////////////////
	// Exceptions
	////////////////////////////////////////////////////////////////////////////
	var registeredExceptions = {};
	PackageUtilities.addImmutablePropertyFunction(_log, "registerException", function registerException(exceptionName, exceptionMessage) {
		if (typeof exceptionName !== "string") {
			throw new Meteor.Error("exception-name-should-be-a-string");
		}
		if ((typeof exceptionMessage !== "string") && (!_.isFunction(exceptionMessage))) {
			throw new Meteor.Error("exception-message-should-be-a-string-or-function");
		}

		if (!!registeredExceptions[exceptionName]) {
			console.warn(`An exception with name ${exceptionName} has already been registered. Overwriting exceptionMessage.`);
		}
		registeredExceptions[exceptionName] = exceptionMessage;
	});

	PackageUtilities.addImmutablePropertyFunction(_log, "generateExceptionMessage", function generateExceptionMessage(exceptionName, data) {
		if (!registeredExceptions[exceptionName]) {
			throw new Meteor.Error("exception-not-registered");
		}
		return _.isFunction(registeredExceptions[exceptionName]) ? registeredExceptions[exceptionName](data) : registeredExceptions[exceptionName];
	});

	PackageUtilities.addImmutablePropertyFunction(_log, "throwException", function throwException(exceptionName, data, additionalOptions) {
		var msg = _log.generateExceptionMessage(exceptionName, data);
		additionalOptions = _.extend({
			logLevel: "error",
			verbosity: 0
		}, additionalOptions);

		if (!isValidLogLevel(additionalOptions.logLevel)) {
			throw new Meteor.Error("invalid-log-level", "Allowed log levels: " + LOG_LEVELS.join(", "));
		}

		// Obtain stack trace and remove reference to this function
		var _stackTraceArr = (new Meteor.Error(exceptionName)).stack.split("\n");
		_stackTraceArr.splice(1, 1);
		var stackTrace = _stackTraceArr.join("\n");

		_log[additionalOptions.logLevel]({
			verbosity: additionalOptions.verbosity,
			tags: ["exception", exceptionName]
		}, `[${exceptionName}] ${msg}`, {
			exception: exceptionName,
			message: msg,
			stack: stackTrace
		});

		// Use revised stack trace
		var exception = new Meteor.Error(exceptionName, msg, stackTrace);

		exception.stack = stackTrace;
		throw exception;
	});

	PackageUtilities.addImmutablePropertyFunction(_log, "makeException", function makeException(exceptionName, data) {
		var msg = _log.generateExceptionMessage(exceptionName, data);

		// Obtain stack trace and remove reference to this function
		var _stackTraceArr = (new Meteor.Error(exceptionName)).stack.split("\n");
		_stackTraceArr.splice(1, 1);
		var stackTrace = _stackTraceArr.join("\n");

		// Use revised stack trace
		var exception = new Meteor.Error(exceptionName, msg, stackTrace);
		exception.stack = stackTrace;
		throw exception;
	});

	PackageUtilities.addImmutablePropertyFunction(_log, "prepareExceptionThrower", function prepareExceptionThrower(exceptionName, additionalOptions) {
		var _additionalOptions = PackageUtilities.deepCopy(additionalOptions);
		return function exceptionThrower(data) {
			return _log.throwException(exceptionName, data, _additionalOptions);
		};
	});


	////////////////////////////////////////////////////////////////////////////

	return _log;
})();


////////////////////////////////////////////////////////////////////////////////
// Exports
////////////////////////////////////////////////////////////////////////////////

export {
	Log,
	safeStringify,
	stripCircularDeps
};

////////////////////////////////////////////////////////////////////////////////