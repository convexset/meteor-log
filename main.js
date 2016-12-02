import { Meteor } from 'meteor/meteor';
import { EJSON } from 'meteor/ejson';

import { Log } from "meteor/convexset:log";

Log.displayLineNumbers = true;

////////////////////////////////////////////////////////////////////////////////
// Register some exceptions
////////////////////////////////////////////////////////////////////////////////
Log.registerException("invalid-argument", "Your argument is invalid.");
Log.registerException("not-a-number", function nanMessage(item) {
	return `${EJSON.stringify(item)} is not a number.`;
});

const throwNaNException = Log.prepareExceptionThrower("not-a-number", {
	verbosity: 1,
	logLevel: "warn"
});
Log.registerException("item-out-of-range", function oorMessage({
	validRange, item
}) {
	return `Item out of range (item: ${item}, valid range: [${validRange}])`;
});

////////////////////////////////////////////////////////////////////////////////
// Create Some "Prepared" Loggers
////////////////////////////////////////////////////////////////////////////////
/* global logWithVerbosity3: true */
/* global logWithVerbosity7andTag: true */
/* global infoWithVerbosity7andTag: true */
logWithVerbosity3 = Log.log.withParams(3);
var opts = {
	verbosity: 7,
	tags: ["boo", "log"]
};
logWithVerbosity7andTag = Log.log.withParams(opts);
opts.tags = ["boo", "info"];
infoWithVerbosity7andTag = Log.info.withParams(opts);


////////////////////////////////////////////////////////////////////////////////
// Some "additional handler"
////////////////////////////////////////////////////////////////////////////////
Log.registerAdditionalLogHandler(function alsoAlert(opts) {
	if ((opts.tags.indexOf("boo") > -1) && (opts.logLevel === "log")) {
		console.info(["[log|with tag \"boo\"]"].concat(opts.args).join(" "));
	}
});


////////////////////////////////////////////////////////////////////////////////
// Test Logging and Exceptions on Client
////////////////////////////////////////////////////////////////////////////////
if (Meteor.isClient) {
	setTimeout(() => {
		logWithVerbosity3("what LL3");
		logWithVerbosity7andTag("LL7", "zzz", "123");
		infoWithVerbosity7andTag("LL7", "abc");

		throwNaNException("really not a number");
	}, 2000);
}

////////////////////////////////////////////////////////////////////////////////
// Test Exceptions
////////////////////////////////////////////////////////////////////////////////
const TEST_EXCEPTIONS_IN_CALLBACKS = true;
if (TEST_EXCEPTIONS_IN_CALLBACKS) {
	Meteor.setTimeout(function invalidArgumentTest() {
		try {
			Log.throwException("invalid-argument");
		} catch(e) {
			console.log('[Caught]', e);
		}
	}, Math.random() * 10000);

	Meteor.setTimeout(function notANumberTest() {
		// test an exception with some (random) call stack depth
		(function someRecursiveThing(dp = 0) {
			if (Math.random() < 0.25 + dp) {
				Log.throwException("not-a-number", "9", {
					logLevel: "info", // valid choices: "log", "info", "warn", "error"
					verbosity: 7
				});
			} else {
				someRecursiveThing(dp + 0.05);
			}
		})();
	}, Math.random() * 10000);

	Meteor.setTimeout(function itemOutOfRangeTest() {
		Log.throwException("item-out-of-range", {
			item: 10,
			validRange: [0, 1]
		}, {
			logLevel: "error", // valid choices: "log", "info", "warn", "error"
			verbosity: 3
		});
	}, Math.random() * 10000);
}

////////////////////////////////////////////////////////////////////////////////
// test stack trace on client and server
////////////////////////////////////////////////////////////////////////////////
Log.info({
    appendStackTrace: true,
    tags: ["stack-trace"]
}, "Get stack trace.");

////////////////////////////////////////////////////////////////////////////////
// test stack trace getting in methods
////////////////////////////////////////////////////////////////////////////////
if (Meteor.isServer) {
	Meteor.methods({
		"capture-stack-in-method": function() {
			Log.info({
			    appendStackTrace: true,
			    tags: ["stack-trace", "meteor-method"]
			}, "Get stack trace within Meteor Method invocation.");
		}
	});
} else {
	Meteor.call("capture-stack-in-method");
}

////////////////////////////////////////////////////////////////////////////////
// Play with some hooks (need configuration)
////////////////////////////////////////////////////////////////////////////////
if (Meteor.isServer) {
	/* HipChat hook example */
	var HipChatClient = require('hipchat-client');
	/* global hipChatConfig: true */
	hipChatConfig = {
		token: "",
		room_id: 2749584,
		instructions: "Set API token in this object (initially blank). Do not replace the entire object."
	};
	Log.registerAdditionalLogHandler(function alsoHipchat(opts) {
		if ((opts.tags.indexOf("boo") > -1) && (opts.logLevel === "info")) {
			if (!!hipChatConfig.token && !!hipChatConfig.room_id) {
				var hipchat = new HipChatClient(hipChatConfig.token);
				return hipchat.api.rooms.message({
					room_id: hipChatConfig.room_id,
					from: "convexset:log",
					message: `[<code>log</code>|with tag <code>boo</code>] ${opts.args.join(" ")}; Tags: ${opts.tags.join(", ")}`,
					message_format: "html",
					color: "random",
					notify: 1
				}, function(err, res) {
					if (!!err) {
						console.log("[hipchat-client|error]", err);
					}
					if (!!res) {
						console.log("[hipchat-client|result]", res);
					}
				});
			}
		}
	});
}

////////////////////////////////////////////////////////////////////////////////
