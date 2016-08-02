# Log

This package enables unified logging between development and production. In development, display can be controlled via a verbosity number. In production, recent log messages are stored and can be retrieved to support error reporting.

A log message is displayed if in development mode (this can be changed) and the message verbosity level is at most the selected verbosity level.

It also supports the "structured management of exception throwing" (see below).

Messages are stored in a client-side collection to support client debugging and end-user reporting. On the server, similar provisions are made albeit with more flexibility to enable choices like "off-site (different Meteor server) recording" (esp. in production).

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

## Table of Contents

- [Usage:](#usage)
  - [Basics](#basics)
  - [Capturing the stack](#capturing-the-stack)
  - [Temporary Nuance in Display](#temporary-nuance-in-display)
  - [Client-side Recording](#client-side-recording)
  - [Server-side Recording](#server-side-recording)
  - [Using "Prepared Parameters" (Partial Application for Loggers)](#using-prepared-parameters-partial-application-for-loggers)
  - [Additional Hooks](#additional-hooks)
- [Structured Exception Throwing](#structured-exception-throwing)
  - [Partial Application](#partial-application)
- [Beyond `Meteor.isDevelopment`](#beyond-meteorisdevelopment)
- [Additional Usage Hints](#additional-usage-hints)
- [Implementation Patterns](#implementation-patterns)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Usage:

Begin with:
```javascript
import { Log } from "meteor/convexset:log";
```

### Basics

Simple logging:
```javascript
Log.info(/* verbosity level: */ 5, "This is message number", 1);
Log.warn(/* verbosity level: */ 2, "This is message number", 2);
Log.error(/* verbosity level: */ 1, "This is message number", 3);
Log.log(/* verbosity level: */ 6, "This is message number", 4); /* not displayed on screen */
```

Note that the default verbosity level is `5`, so the last message above (via `Log.log`) will not be displayed.

To set the verbosity level, simply do:
```javascript
Log.verbosity = 2;  // fewer messages than the default of 5
```

Generally, more important messages should be logged with a **lower** verbosity level.

Logging with tags:
```javascript
Log.info({
    verbosity: 3,
    tags: ["cats", "pets"]
}, "I have one cat.");
```

### Capturing the stack

Simply use set the `appendStackTrace` option to `true` (default: `false):
```javascript
Log.info({
    appendStackTrace: true
}, "Stack trace:");
```
and a stack-trace will be appended to the list of arguments passed into the logger.

### Temporary Nuance in Display

To add a, typically, temporary filter on what to display (e.g.: to focus on one component), simply add a filter like so:
```javascript
Log.currentDisplayFilter = function({verbosity, tags, record}) {
    // contains a certain tag
    return tags.indexOf("hungry-hungry-hippos") !== -1;
};
```
Tags are perhaps the most useful way to use this tool.

The `Log.currentDisplayFilter` is invoked with a single argument taking the form of objects (with 4 keys) looking like:
```
{
    logLevel: "log",  // one of "log", "info", "warn" or "error"
    verbosity: 5,
    tags: ["something", "something-else"],
    record: true
}
```
Note that exceptions are tagged with `"exception"` and the name of the exception.

To unset:
```javascript
Log.currentDisplayFilter = null;
```

### Client-side Recording

Setting the number of hours of data to keep (default: 0.5):
```javascript
Log.hoursOfDataToKeep = 2.5;  // Keep two and a half hours of data
```

Showing history of log messages (including those that were not displayed), use `Log.allRecords`. For example:
```
Log.allRecords.forEach(x => console.log(x))
```
To obtain everything in serialized form use `Log.allRecordsSerialized`.


To not store a message on the client (possibly because of frequency concerns):
```javascript
Log.info({
    verbosity: 3,
    tags: ["cats", "pets"],
    record: false /* default: true */
}, "I have one cat.");
```

### Server-side Recording

Server-side recording can be set-up as follows:
```javascript
Log.storeServerMessages({
    collection: someCollection,
    timeToLiveInHours: 24,
    additionalLoggingPredicate: () => true,
    publications: [
        {
            pubName: "log-all",
            selector: {},
            pubAuthFunction: function () {
                return !!this.userId;
            }
        }, {
            pubName: "log-100",
            selector: {},
            options: {
                limit: 100,
                sort: {
                    ts: 1
                }
            }
            pubAuthFunction: function () {
                return !!this.userId;
            }
        },
    ]
});
```

To elaborate on the options:
 - `collection`:
   - default: `new Meteor.Collection(null)`
   - For logging on a different server, use something like `new Meteor.Collection("log", { /* connection: ... */ })`
 - `timeToLiveInHours`: 
   - default: `24`
 - `additionalLoggingPredicate`: 
   - default: `24`
 - `publications`: an array of objects that describe the publications to create
   - default: `[]`
   - Keys:
     - `pubName`: the name of the publication to create Defaults to `"log"`.
     - `selector`: the selector for items to return. Defaults to `{}`. See [this](http://docs.meteor.com/api/collections.html#Mongo-Collection-find) for more info.
     - `options`: options for the relevant [find query](http://docs.meteor.com/api/collections.html#Mongo-Collection-find). Defaults to `{sort: {ts: 1}}`.
     - `pubAuthFunction`: authorization function for publication; this should return `true` if authorized and `false` otherwise. Will be invoked with the usual context for Meteor publications (i.e.: the usual `this`). Defaults to `() => true`.


### Using "Prepared Parameters" (Partial Application for Loggers)

Where a set of parameters are repeated frequently, especially a set of tags coupled with a verbosity level (even a decision whether to store the log record), a "partially applied" logger maybe prepared with those parameters pre-specified. In particular, with:
```javascript
const catLogger = Log.info.withParams({
    verbosity: 3,
    tags: ["cats", "pets"],
    record: false
});
```
..., the code
```javascript
catLogger("I have one cat.");
catLogger("You have two cats.");
```
is equivalent to:
```javascript
Log.info({
    verbosity: 3,
    tags: ["cats", "pets"],
    record: false
}, "I have one cat.");

Log.info({
    verbosity: 3,
    tags: ["cats", "pets"],
    record: false
}, "You have two cats.");
```

"Partially applied loggers" may be generated by calling `withParams` on `Log.log`, `Log.info`, `Log.warn` and `Log.error`.


### Additional Hooks

One can get some additional code to run whenever `Log.log`, `Log.info`, `Log.warn` or `Log.error` are called by registering handlers like so:
```javascript
Log.registerAdditionalLogHandler(function({ args, logLevel, verbosity, tags, record }) {
    /* do something */
})
```

Each added hook is invoked with a single argument taking the form of objects (with 5 keys) looking like:
```javascript
{
    args: ["the logging arguments", "passed into", 1, "of", 4, "log functions"],
    logLevel: "info",
    verbosity: 8,
    tags: ["something", "something-else"],
    record: true
}
// as a result of Log.info({
//     verbosity: 8,
//     tags: ["something", "something-else"],
// }, "the logging arguments", "passed into", 1, "of", 4, "log functions");
```

The handlers are fired after logging and recording (into collections, where applicable) happen.

See example app (which is more akin to a dump truck than an "app") for an instance of using an additional log handler to send messages of a certain type (by `logLevel` and `tags`) to a chat room. (This is useful for alerting customer support of something bad happening that would probably require a quick response... Or to give the illusion of rapid and effective response.)


## Structured Exception Throwing

One should not have to repeat or repeatedly generate messages for exceptions. It should be "write once, use everywhere". Therefore, consider the following.

Exceptions should be registered using `Log.registerException` as follows:
```javascript
Log.registerException(exceptionName, exceptionMessage);

// Specifically
Log.registerException("invalid-argument", "Your argument is invalid.");
Log.registerException("not-a-number", function nanMessage(item) {
    return `${item} is not a number.`;
});
Log.registerException("item-out-of-range", function oorMessage({validRange, item}) {
    return `Item out of range (item: ${item}, valid range: ${validRange})`;
});
```

Generally speaking, if the exception message argument is a function, it will be taken to be a function of one argument (note the use of destructuring in the last example.)

To throw an exception, simply do:
```javascript
Log.throwException("invalid-argument");
// or
Log.throwException("not-a-number", "9");
// or
Log.throwException("item-out-of-range", {
    item: 10,
    validRange: [0, 1]
});
```

(Note that an exception with code `"exception-not-registered"` will be thrown in the case of an exception that has not been registered using `Log.registerException`.)

To just generate the exception message, use `Log.generateExceptionMessage` instead of `Log.throwException`.

What will happen is that a message at "log level" `error` will be logged with verbosity level `0` (and it will be given two tags `"exception"` and the name of the exception). The stack trace will also be included. You may customize verbosity and log level as follows:
```javascript
Log.throwException("invalid-argument", null, {
    logLevel: "warn",  // valid choices: "log", "info", "warn", "error"
    verbosity: 7
});
// or
Log.throwException("not-a-number", "9", {
    logLevel: "warn",  // valid choices: "log", "info", "warn", "error"
    verbosity: 7
});
// or
Log.throwException("item-out-of-range", {
    item: 10,
    validRange: [0, 1]
}, {
    logLevel: "error",  // valid choices: "log", "info", "warn", "error"
    verbosity: 7
});
```

### Partial Application

Partial application support is available for exceptions as well. See the following examples:
```javascript
const throwNaNException = Log.prepareExceptionThrower("not-a-number", {
  verbosity: 1,
  logLevel: "warn"
});
// invoke with: throwNaNException("7");

const throwNaNException_Simpler = Log.prepareExceptionThrower("not-a-number");
// invoke with: throwNaNException("7");
```
Specifically, to prepare an "exception thrower", pass in the name of the exception and an optional set of parameters that one might otherwise pass as the third parameter of `Log.throwException`.

Simply invoke the returned "exception thrower" to throw the exception. If the exception takes a `data` parameter, pass in that data as the sole argument.


## Beyond `Meteor.isDevelopment`

By default, the criterion for the display of log

To log under different circumstances set a different "display predicate" as follows:
```javascript
Log.displayPredicate = function display30PercentOfMessagesAtRandomAndOnlyIfInDevMode() {
    return (Math.random() < 0.3) && Meteor.isDevelopment;
}
```

(Verbosity requirements still apply.)


## Additional Usage Hints

One might like to have a (client-side) file with:
```
import { Log } from "meteor/validatis:log";

Meteor.startup(function() {
    if (Meteor.isDevelopment) {
        _Log = Log;
    }
});
```

## Implementation Patterns

 - Detailed logging and verbosity level shifting for development
   * Initial development at high verbosity and status messages (tagged by component) with similar verbosity levels
   * Down-shifting verbosity for preventing display overload as the code for the component stabilizes
   * Viewing detailed log messages by tag and other things during development without needing to restart to reproduce errors
   * Being able to "focus" in development by setting/unsetting `Log.currentDisplayFilter`
 - Bug report data capture using the client side collection
 - It is not possible to not expose `Log` on the client in production (c.f.: `Packages`). Too much detail makes reverse engineering your product easier. Strike a balance.
 - Off-site server recording in production (to not overload the main production database)
 - Hooking of additional handlers whenever logging methods are called
   * e.g.: on-screen notifications
   * e.g.: major issues -> Slack/HipChat/IM
 - Clean exception handling
