'use strict';

module.exports.create = function(app, locations) {
    var _ = require("lodash"),
        PromiseA = require("bluebird"),
        mingy = require("../vendors/mingy/mingy"),
        Parser = mingy.Parser,
        util = require("util"),
        moment = require("moment"),
        validator = require('validator')
        ;
    var name = "accounting"
        ;

    function Location() {
        this.name = name;
        this._env = {
        };

        this.parser = this.setupParser();
    }

    Location.prototype.env = function(system) {
        return this._env;
    };

    Location.prototype.parse = function(command, system) {
        var me = this,
            locationInfo = _.get(system, "location.info.accounting")
          ;

        return app.api.parser.run(this.parser, command, system)
            .then(function(output) {
                return output;
            });
    };

    Location.prototype.setupParser = function() {
        var me = this,
            parser = new Parser()
            ;

        parser.setEnv('users', app.api.parser.parser.env.users);

        parser.addCommand('add')
            .set('syntax', ['add <string:accountId> <string:date> <string:comment*>'])
            .set('logic', function(args, env, system) {
                var accountId = args.accountId,
                    date = moment(args.date, "YYYY/MM/DD"),
                    comment = _.trim(args["comment*"]),
                    record,
                    output
                    ;
                if (_.isEmpty(accountId) || accountId.length !== 6 || !_.isFinite(parseInt(accountId))) {
                    output = app.messages["accounting-add-error-account-id"];
                } else if (!date.isValid()) {
                    output = app.messages["accounting-add-error-date"];
                } else {
                    date = {year: date.year(), month: date.month() + 1, day: date.date()};
                    record = app.api.reports.add(system.userId, accountId, date, comment);
                    app.api.reports.save();
                    output = _.clone(app.messages["accounting-add-result"]);
                    output.message = util.format(output.message, record.id);
                }

                return output;
            });

        parser.addCommand('delete')
            .set('syntax', ['delete <string:recordId>'])
            .set('logic', function(args, env, system) {
                var recordId = args.recordId,
                    randomRecord,
                    output
                    ;

                if (app.api.reports.delete(system.userId, recordId)) {
                    app.api.reports.save();
                    randomRecord = app.api.reports.random(system.userId);
                    output = _.clone(app.messages["accounting-delete-result"]);
                    output.message = util.format(
                        output.message,
                        util.format("[id:%s, accountId:%s, date:%s, r:%s]",
                            randomRecord.id,
                            randomRecord.accountId,
                            util.format("%s/%s/%s", randomRecord.date.year, randomRecord.date.month, randomRecord.date.day),
                            randomRecord.comment
                        )
                    );
                } else {
                    output = app.messages["accounting-delete-error"];
                }

                return output;
            });

        parser.addCommand('list')
            .set('syntax', ['list', 'list <string:month>',  'list <string:month> <string:year>'])
            .set('logic', function(args, env, system) {
                var month = args.month,
                    year = args.year,
                    records,
                    text = '',
                    colors =["{black-fg}{grey-bg}", "{white-fg}{magenta-bg}"],
                    output
                    ;
                records = app.api.reports.list(system.userId, month, year);

                if (_.isEmpty(records)) {
                    output = app.messages["accounting-list-error"];
                } else {

                    _.forEach(records, function(record, idx) {
                        text += util.format("%s[%s] %s, %s/%s/%s, %s{/}\n",
                            colors[idx%2],
                            record.id,
                            record.accountId,
                            record.date.year, record.date.month, record.date.day,
                            record.comment
                        );
                    });
                    output = _.clone(app.messages["accounting-list-result"]);
                    output.message = util.format(output.message, text);
                }
                return output;
            });

        parser.addCommand('send')
            .set('syntax', ['send <string:email> <string:recordIds*>'])
            .set('logic', function(args, env, system) {
                var email = args.email,
                    recordIds = args['recordIds*'],
                    records,
                    output
                    ;

                if (!validator.isEmail(email)) {
                    output = app.messages["accounting-send-error"];
                } else {
                    records = _.split(_.split(_.trim(recordIds), " "), ",");
                    records = _.filter(records, function(r){return !_.isEmpty(_.trim(r));});
                    output = app.api.reports.send(system.userId, email, records);
                }

                return output;
            });

        parser.addCommand('menu')
            .set('syntax', ['menu'])
            .set('logic', function(args, env, system) {
               return app.messages["accounting-enter"];
            });

        parser.addCommand('help')
            .set('syntax', ['help', 'h'])
            .set('logic', function(args, env, system) {
                return app.messages["accounting-help"];
            });

        return parser;
    };

    Location.prototype.enter = function(system) {
        var me = this,
            locationInfo = _.get(system, "location.info"),
            info
            ;

        system.screen.setStatusTop(app.messages["accounting-status-top"]);

        if (!_.isObject(locationInfo[me.name])) {
            locationInfo[me.name] = {
                firstTime: true
            };
        }
        info = locationInfo[me.name];

        app.api.log("location.%s.enter:", this.name, system.name, info);
        app.api.parser.push(system, this);

        return PromiseA.resolve(true);
    };

    Location.prototype.describe = function(system) {
        var locationInfo = _.get(system, "location.info"),
            info
            ;

        info = locationInfo[this.name];

        if (info.firstTime === true) {
            info.firstTime = false;
        }

        system.screen.echo(app.messages["accounting-description"]);
        system.screen.echo(app.messages["accounting-enter"]);
    };

    Location.prototype.exit = function(system) {
        app.api.log("location.%s.exit:", this.name, system.name);
        app.api.parser.pop(system);

        system.screen.setStatusTop("");

        return true;
    };

    locations[name] = new Location();
};