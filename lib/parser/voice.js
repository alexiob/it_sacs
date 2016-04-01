'use strict';

module.exports.create = function(app, parser) {
    var _ = require("lodash"),
        util = require("util")
        ;

    function sponsorize(message, system) {
        var sponsorMessage = _.clone(app.api.messages.get("sponsor-" + _.random(1, app.config.get("sponsorMessagesCount"))))
            ;
        sponsorMessage.message = util.format(sponsorMessage.message, message);
        return sponsorMessage;
    }

    parser.addCommand('yell')
        .set('syntax', [
            'yell <string:message*>',
            'scream <string:message*>',
            'shout <string:message*>',
        ])
        .set('logic', function(args, env, system) {
            var name = env.users[system.userId].name,
                message = args['message*']
                ;

            _.forEach(env.users, function(user, userId) {
                var msg
                    ;

                if (userId !== system.userId) {
                    msg = sponsorize(message.toUpperCase(), system);
                    msg.message = util.format("%s, quite unpolitely, yells:\n%s", name, msg.message);
                    user.screen.echo(msg);
                }
            });

            return app.messages["yell-response"];
        });

    parser.addCommand('say')
        .set('syntax', [
            'say <string:username> <string:message*>',
            'say to <string:username> <string:message*>',
            'tell <string:username> <string:message*>',
            'tell to <string:username> <string:message*>',
            'wisper <string:username> <string:message*>',
            'wisper to <string:username> <string:message*>',
        ])
        .set('logic', function(args, env, system) {
            var name = env.users[system.userId].name,
                username = args.username.toLowerCase(),
                message = args['message*']
                ;

            _.forEach(env.users, function(user) {
                var msg
                    ;

                if (username === user.name.toLowerCase()) {
                    msg = sponsorize(message, system);
                    msg.message = util.format("%s wispers to you:\n%s", name, msg.message);
                    user.screen.echo(msg);
                    return false;
                }
            });

            return app.messages["say-response"];
        });

    return parser;
};