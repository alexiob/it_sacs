'use strict';

module.exports.create = function(app) {
    var _ = require("lodash"),
        PromiseA = require("bluebird"),
        mingy = require("../vendors/mingy/mingy"),
        Parser = mingy.Parser
        ;

    var parser = new Parser()
        ;

    parser.setEnv('users', {});
    parser.setEnv('userNumber', 1);


    function callback(output, system) {
        console.log("CALLBACK:", system.userId, output);
    }

    function parserEnv(system) {
        var parserStack = _.get(system, "parser.stack"),
            env
            ;

        if (_.isArray(parserStack) && !_.isEmpty(parserStack)) {
            if (_.isFunction(parserStack[0].env)) {
                env = parserStack[0].env(system);

                if (_.isObject(env)) {
                    return env;
                }
            }
        }

        return parser.env;
    }

    function parserPush(system, handler) {
        var parserStack = _.get(system, "parser.stack")
            ;

        parserStack.unshift(handler);
    }

    function parserPop(system) {
        var parserStack = _.get(system, "parser.stack")
            ;

        parserStack.shift();
    }

    function run(parser, command, system) {
        var lexemes = _.split(command, " "),
            output
            ;

        if (parser.validCommands(lexemes).length) {
            output = parser.parseLexemes(lexemes, callback, system);
        }
        return output;
    }


    function parse(command, userId) {
        var system = app.api.user.get(userId),
            output,
            parserStack = _.get(system, "parser.stack"),
            handler,
            p
            ;

        if (_.isArray(parserStack) && !_.isEmpty(parserStack)) {
            handler = parserStack[0];
            if (_.isFunction(handler.parse)) {
                output = handler.parse(command, system);

                if (output !== false) {
                    p = PromiseA.resolve(output);
                } else {
                    return "";
                }
            }
        }

        if (_.isUndefined(p)) {
            p = PromiseA.resolve();
        }

        p = p.then(function(output) {
            if (_.isUndefined(output)) {
                if (_.isUndefined(output)) {
                    output = run(parser, command, system);
                }
                if (_.isFunction(handler.handleUndefinedOutput)) {
                    output = handler.handleUndefinedOutput(system, output);
                }

            }
            return output;
        });

        return p.then(function(output) {
            if (_.isUndefined(output)) {
                output = app.api.messages.unknown();
            }

            return output;
        });
    }

    function format(message, command, options) {
        return {
            command: command || "echo",
            message: message,
            options: options
        };
    }

    app.api.parser = {
        parser: parser,
        env: parserEnv,
        parse: parse,
        pop: parserPop,
        push: parserPush,
        run: PromiseA.method(run),
        format: format
    };

    require("./system").create(app, parser);
    require("./voice").create(app, parser);

    return parser;
};