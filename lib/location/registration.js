'use strict';

module.exports.create = function(app, locations) {
    var _ = require("lodash"),
        PromiseA = require("bluebird"),
        mingy = require("../vendors/mingy/mingy"),
        Parser = mingy.Parser,
        util = require("util"),
        validator = require('validator')
        ;
    var name = "registration"
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
            locationInfo = _.get(system, "location.info.registration")
          ;

        if (_.isNumber(locationInfo.step)) {
            locationInfo.questions[locationInfo.step].answer = command;
            locationInfo.step++;

            if (locationInfo.step >= locationInfo.questions.length) {
                return me.checkRegistration(system);
            } else {
                return me.askQuestion(system);
            }
        }

        return app.api.parser.run(this.parser, command, system)
            .then(function(output) {
                return output;
            });
    };

    Location.prototype.generateQuestions = function() {
        var questions = [],
            randomQuestions = []
            ;

        // insert standard questions
        _.forEach(app.config.get("locations.registration.questions"), function(messageId) {
            questions.push({question:app.api.messages.get(messageId), answer: undefined, messageId: messageId});
        });

        // insert random questions
        _.forEach(app.config.get("locations.registration.randomQuestions"), function(messageId) {
            randomQuestions.push({question:app.api.messages.get(messageId), answer: undefined, messageId: messageId});
        });
        randomQuestions = _.shuffle(randomQuestions).splice(0, app.config.get("locations.registration.numRandomQuestions"));

        questions = _.shuffle(questions.concat(randomQuestions));

        return questions;
    };

    Location.prototype.registrationError = function(system, messageId) {
            var me = this,
                output
                ;

            system.screen.echoPush(app.messages[messageId]);

            output = app.api.location.enter("lobby", system.userId);

            app.api.location.say(
                me.name,
                util.format(app.messages["registration-kick-out"].message, system.name),
                system.userId
                );

            return output;
    };

    Location.prototype.checkRegistration = function(system) {
        var me = this,
            locationInfo = _.get(system, "location.info.registration"),
            output,
            data = {}
            ;

        _.forEach(locationInfo.questions, function(question) {
            var k = _.split(question.messageId, '-').pop().toLowerCase()
                ;

            data[k] = question.answer;
        });

        delete locationInfo.step;
        delete locationInfo.questions;

        if (_.isEmpty(data.username)) {
            output = me.registrationError(system, "registration-invalid-username");
        } else if (_.isEmpty(data.password)) {
            output = me.registrationError(system, "registration-invalid-password");
        } else if (!validator.isEmail(data.email)) {
            output = me.registrationError(system, "registration-invalid-email");
        } else {
            if (app.api.user.register(system.userId, data, true)) {
                app.api.user.save();
                app.api.email.sendSpam(system.userId);
                output = app.api.location.enter("accounting", system.userId);
            } else {
                output = me.registrationError(system, "registration-invalid");
            }
        }

        return output;
    };

    Location.prototype.startRegistration = function(env, system) {
        var me = this,
            locationInfo = _.get(system, "location.info.registration")
            ;

        locationInfo.step = 0;
        locationInfo.questions = this.generateQuestions();

        return me.askQuestion(system);
    };

    Location.prototype.askQuestion = function(system) {
        var locationInfo = _.get(system, "location.info.registration")
            ;

        return locationInfo.questions[locationInfo.step].question;
    };

    Location.prototype.isNPCNameUsed = function(npcName, args, env, system, angryId) {
        var me = this,
            mrs = _.get(args, "mrs*", "").trim(),
            match = new RegExp(npcName, 'i'),
            output
            ;

        if (_.isEmpty(mrs) || _.isNull(match.exec(mrs))) {
            system.screen.echoPush(app.messages[angryId]);

            output = app.api.location.enter("lobby", system.userId);

            app.api.location.say(
                me.name,
                util.format(app.messages["registration-kick-out"].message, system.name),
                system.userId
                );
        }

        return output;
    };

    Location.prototype.setupParser = function() {
        var me = this,
            parser = new Parser()
            ;

        parser.setEnv('users', app.api.parser.parser.env.users);

        parser.addCommand('yes')
            .set('syntax', [
                'yes <string:mrs*>',
                'i do <string:mrs*>',
                'I want to register <string:mrs*>',
                'yes please <string:mrs*>'
            ])
            .set('logic', function(args, env, system) {
                var output = false
                    ;

                output = me.isNPCNameUsed(app.config.get("locations.registration.npcName"), args, env, system, "registration-angry-mrs");

                if (!output) {
                    output = me.startRegistration(env, system);
                }

                return output;
            });

        parser.addCommand('no')
            .set('syntax', [
                'no',
                'no <string:mrs*>',
                '<string:anything*>'
            ])
            .set('logic', function(args, env, system) {
                return me.registrationError(system, "registration-no");
            });

        parser.addCommand('help')
            .set('syntax', ['help <request*>'])
            .set('logic', function(args, env, system) {
                return app.messages["registration-help"];
            });

        return parser;
    };

    Location.prototype.enter = function(system) {
        var me = this,
            locationInfo = _.get(system, "location.info"),
            info
            ;

        system.screen.setStatusTop(app.messages["registration-status-top"]);

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
            util.format(app.messages["registration-user-enter"].message, system.name),
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
            info.firstTime = false;
        }

        system.screen.echo(app.messages["registration-description"]);
        system.screen.echo(app.messages["registration-enter"]);
    };

    Location.prototype.exit = function(system) {
        app.api.log("location.%s.exit:", this.name, system.name);
        app.api.parser.pop(system);

        system.screen.setStatusTop("");

        app.api.location.say(
            this.name,
            util.format(app.messages["registration-user-exit"].message, system.name),
            system.userId
        );

        return true;
    };

    locations[name] = new Location();
};