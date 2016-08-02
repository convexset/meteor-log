import { Template } from 'meteor/templating';
import { Log } from "meteor/convexset:log";
import './table.html';

const LogTableTemplate = Template["convexset:log/table"];

// allow custom styling
["table", "thead", "tbody", "tr", "th", "td"].forEach(function(elemType) {
	LogTableTemplate.helpers({
		[`${elemType}Classes`]: () => (Template.currentData() || {})[`${elemType}Classes`] || "",
		[`${elemType}Attributes`]: () => (Template.currentData() || {})[`${elemType}Attributes`] || {},
	});
});

function leftPadNum(n) {
	var s = n.toString();
	while (s.length < 2) {
		s = "0" + s;
	}
	return s;
}

function realType(t) {
	return Object.prototype.toString.call(t).match(/\[object ([a-zA-Z]+)\]/)[1];
}

function wrapTag(tag, content, attrs = {}) {
	var attrString = Object.keys(attrs).map(k => `${k}="${attrs[k]}"`).join(" ");
	return `<${tag} ${attrString}>${content}</${tag}>`;
}

function msgTransform(o, isSubObject = false) {
	switch (realType(o)) {
		case "Object":
			return wrapTag("table",
				Object.keys(o)
				.map(function(k) {
					return {
						key: k,
						value: msgTransform(o[k], true)
					};
				})
				.map(function(kvp) {
					return wrapTag("tr",
						wrapTag("td", kvp.key) +
						wrapTag("td", kvp.value)
					);
				})
				.join("\n"), {
					border: 1
				}
			);
		case "Array":
			return '[' + o.map(msgTransform, isSubObject).join(', ') + ']';
		case "String":
			if (o.indexOf('\n') === -1) {
				return o;
			} else {
				return wrapTag("table",
					o.split("\n")
					.map(s => wrapTag("tr", wrapTag("td", wrapTag("pre", s, {
						style: "margin:0;"
					}), {
						style: "padding:0; margin:0;"
					})))
					.join("\n"), {
						border: 0,
						style: "border-collapse: collapse;"
					}
				);
			}
		default:
			return o.toString();
	}
}

function tsTransform(ts) {
	// var date = [ts.getFullYear(), ts.getMonth() + 1, ts.getDate()].map(leftPadNum).join("-");
	var time = [ts.getHours(), ts.getMinutes(), ts.getSeconds()].map(leftPadNum).join(":");
	// var tz = (ts.getTimezoneOffset() >= 0 ? "GMT+" : "GMT-") + Math.abs(ts.getTimezoneOffset() / 60);
	// return `${date} ${time} ${tz}`;
	return wrapTag("code", time);
}

LogTableTemplate.onCreated(function() {
	this.tsTransform = (Template.currentData() || {}).tsTransform || tsTransform;
	this.msgTransform = (Template.currentData() || {}).msgTransform || msgTransform
});

LogTableTemplate.helpers({
	clientLog: () => Log.allRecords.map(function(logEntry) {
		var ret = {
			v: logEntry.v,
			ll: logEntry.ll,
			tags: logEntry.tags,
		};
		ret.ts = Template.instance().tsTransform(logEntry.ts);
		ret.msg = EJSON.parse(logEntry.msg).map(Template.instance().msgTransform).join(" ");
		return ret;
	}),
});