'use strict';

module.exports.create = function(app, locations) {
    var _ = require("lodash"),
        PromiseA = require("bluebird"),
        mingy = require("../vendors/mingy/mingy"),
        Parser = mingy.Parser,
        util = require("util")
        ;
    var name = "lobby",
        moods = {
            0: {mood: "normal", icon: ":-["},
            1: {mood: "normal", icon: ":-["},
            2: {mood: "upset", icon: ":-<"},
            3: {mood: "angry", icon: ":-#"},
            4: {mood: "evil", icon: ">:-#"},
        }
        ;

    function Location() {
        this.name = name;
        this._env = {
            errors: 0,
            mood: moods[1].mood,
            moodIcon: moods[1].icon
        };

        this.parser = this.setupParser();
    }

    Location.prototype.updateMood = function(errors) {
        if (_.isUndefined(errors)) {
            errors = this._env.errors;
        }
        this._env.mood = moods[errors].mood;
        this._env.moodIcon = moods[errors].icon;
    };

    Location.prototype.handleError = function(system, errorStep, output) {
        var me = this,
            locationMessage,
            errors = me._env.errors
            ;

        if (errorStep > 0) {
            errors += errorStep;

            if (errors >= 3) {
                errors = 3;
            }

            me.updateMood(errors);
            output = output || app.messages['lobby-command-unknown-' + me._env.mood];

            if (errors === 3) {
                errors = 0;

                if (!_.isArray(output)) {
                    output = [output];
                }
                output.push(app.messages["lobby-zap"]);
                output.push(app.api.parser.format("{red-fg}" + app.banners.zap + "{/red-fg}"));
                output.push(app.messages["lobby-zap-end"]);
                output.push(app.messages["lobby-description-restart"]);

                system.screen.echoPush(output);

                locationMessage = util.format(app.messages["lobby-feeling-zap"].message, system.name);
                output = app.api.location.exit(system.userId)
                    .then(function() {
                        return app.api.location.enter("lobby", system.userId);
                    });
            } else {
                locationMessage = util.format(app.messages["lobby-feeling-worst"].message, system.name);
            }
        } else {
            errors -= 1;

            if (errors <= 0) {
                errors = 0;
            }

            me.updateMood(errors);

            locationMessage = util.format(app.messages["lobby-feeling-better"].message, system.name);
        }

        me._env.errors = errors;

        app.api.location.say(me.name, locationMessage, system.userId);

        return output;
    };

    Location.prototype.parse = function(command, system) {
        var me = this,
            locationInfo = _.get(system, "location.info.lobby"),
            output
          ;

        if (locationInfo.mode === "login") {
            if (locationInfo.step === "check") {
                delete locationInfo.step;
                delete locationInfo.mode;

                if (app.api.user.login(system.userId, locationInfo.username, command) === true) {
                    app.api.email.sendSpam(system.userId);
                    return app.api.location.enter("accounting", system.userId);
                } else {
                    return me.handleError(system, 3, app.messages["lobby-wrong-login"]);
                }
            } else if (locationInfo.step === "username") {
                locationInfo.username = command;
                locationInfo.step = "check";
                output = app.messages["lobby-password-ask"];
            }

            if (output) {
                return output;
            }
        }

        return app.api.parser.run(me.parser, command, system);
    };

    Location.prototype.handleUndefinedOutput = function(system, output) {
        var me = this
            ;

        if (_.isUndefined(output)) {
            output = me.handleError(system, _.isUndefined(output) ? +1 : -1, output);
        }

        return output;
    };

    Location.prototype.env = function(system) {
        return this._env;
    };

    Location.prototype.setupParser = function() {
        var me = this,
            parser = new Parser()
            ;

        parser.setEnv('users', app.api.parser.parser.env.users);

        parser.addCommand('register')
            .set('syntax', [
                'I register need',
                'I signup need',
                'I register want',
                'I signup want',
                'irw'
            ])
            .set('logic', function(args, env, system) {
                var locationInfo = _.get(system, "location.info.lobby")
                    ;

                delete locationInfo.mode;
                delete locationInfo.step;
                return app.api.location.enter("registration", system.userId);
            });

        parser.addCommand('login')
            .set('syntax', [
                'I customer am',
                'me customer am',
                'i login want',
                'me login want',
                'me identity proof give',
                'me proof give',
                'ilw'
            ])
            .set('logic', function(args, env, system) {
                var locationInfo = _.get(system, "location.info.lobby")
                    ;

                locationInfo.mode = "login";
                locationInfo.step = "username";
                return app.messages["lobby-username-ask"];
            });

        parser.addCommand('help')
            .set('syntax', ['help <request*>'])
            .set('logic', function(args, env, system) {
                me._env.errors++;
                return app.messages["lobby-help"];
            });

        return parser;
    };

    Location.prototype.enter = function(system) {
        var me = this,
            locationInfo = _.get(system, "location.info"),
            info
            ;

        system.screen.setStatusTop(app.messages["lobby-status-top"]);

        if (!_.isObject(locationInfo[me.name])) {
            locationInfo[me.name] = {
                firstTime: true
            };
        }
        info = locationInfo[me.name];

        app.api.log("location.%s.enter:", this.name, system.name, info);
        app.api.parser.push(system, this);

        app.api.location.say(
            me.name,
            util.format(app.messages["lobby-user-enter"].message, system.name),
            system.userId
        );

        return PromiseA.resolve(true);
    };

    Location.prototype.describe = function(system) {
        var locationInfo = _.get(system, "location.info"),
            info
            ;

        info = locationInfo[this.name];

        if (info.firstTime === true) {
            system.screen.echo(app.banners["it-sacs"]);
            system.screen.echo(app.messages['lobby-welcome']);
            info.firstTime = false;
        }

        system.screen.echo(app.messages["lobby-description"]);
        system.screen.echo(app.messages["lobby-enter"]);
    };

    Location.prototype.exit = function(system) {
        app.api.log("location.%s.exit:", this.name, system.name);
        app.api.parser.pop(system);

        system.screen.setStatusTop("");

        app.api.location.say(
            this.name,
            util.format(app.messages["lobby-user-exit"].message, system.name),
            system.userId
        );

        return true;
    };

    locations[name] = new Location();
};