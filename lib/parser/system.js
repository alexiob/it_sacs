'use strict';

module.exports.create = function(app, parser) {
    var _ = require("lodash"),
        util = require("util")
        ;

    parser.addCommand('who')
        .set('syntax', ['who'])
        .set('logic', function(args, env, system) {
            var output = _.clone(app.api.messages.get("system-who")),
                text = ''
                ;

            _.forEach(env.users, function(user, userId) {
                text += util.format("{cyan-fg}[%s] %s%s{/}\n",
                    user.isLoggedIn === true ? "+" : "-",
                    system.userId === userId ? "* " : "  ",
                    user.name
                );
            });

            output.message = util.format(output.message, text);
            return output;
        });

    parser.addCommand('go')
        .set('syntax', ['xgo <string:location>'])
        .set('logic', function(args, env, system) {
            return app.api.location.enter(_.trim(args.location), system.userId)
                .then(function(entered) {
                    return true;
                });
        });

    parser.addCommand('quit')
        .set('syntax', ['quit', 'exit', 'leave', 'bye'])
        .set('logic', function(args, env, system) {
            var name = env.users[system.userId].name
                ;

            _.forEach(env.users, function(user, userId) {
                var msg
                    ;

                if (userId !== system.userId) {
                    msg = _.clone(app.messages["user-quits"]);
                    msg.message = util.format(msg.message, name);
                    user.screen.echo(msg);
                }
            });

            setTimeout(function() {
                system.client.destroy();
            }, 2000);

            return app.messages["quit"];
        });

    return parser;
};