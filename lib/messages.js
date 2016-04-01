'use strict';

module.exports.create = function(app) {
    var _ = require("lodash"),
        fs = require("fs"),
        textUtils = require("./textUtils")
        ;
    var messagesFilename = app.config.get("path.messages"),
        messagesData = fs.readFileSync(messagesFilename),
        messages = {},
        banners = {},
        messageId,
        message
        ;
    var messageCommands = {
        '~': {name: 'wait'},
        '---': {name: 'wait-for-key', applyToCurrent:true}
    };

    app.api.messages = {};

    function generateBanner(config) {
        return textUtils.banner(config.text, config.font)
            .then(function(banner) {
                banners[config.id] =  banner;
            });
    }

    function addMessage(messageId, message) {
        var data = [],
            msg = "",
            currentCommand,
            currentCommandOptions
            ;

        function parseCommands(line) {
            _.forEach(messageCommands, function(command, commandKey) {
                var commandOptions
                    ;

                if (_.startsWith(line, commandKey)) {
                    if (!_.isEmpty(msg)) {
                        line = _.trimStart(line, commandKey);
                        if (_.startsWith(line, "=")) {
                            line = _.trimStart(line, "=");
                            line = _.split(line, ";");
                            commandOptions = line.shift();
                            if (line.length) {
                                line = line.join(";");
                            } else {
                                line = "";
                            }
                            commandOptions = JSON.parse(commandOptions);
                        }
                        msg = _.trim(msg, "\n");

                        if (command.applyToCurrent === true) {
                            currentCommand = command.name;
                            currentCommandOptions = commandOptions;
                        }

                        data.push({command:currentCommand || "echo", options:currentCommandOptions, message:msg});

                        if (command.applyToCurrent !== true) {
                            currentCommand = command.name;
                            currentCommandOptions = commandOptions;
                        } else {
                            currentCommand = undefined;
                            currentCommandOptions = undefined;
                        }
                        msg = "";
                    }
                    return false;
                }

            });
            return line;
        }

        if (!_.isEmpty(messageId)) {
            _.forEach(_.split(message, "\n"), function(line) {
                line = parseCommands(line);
                msg += line + "\n";
            });

            msg = _.trimEnd(msg, "\n");

            if (!_.isUndefined(currentCommand) || !_.isEmpty(msg) ) {
                msg += "\n";

                data.push({command:currentCommand || "echo", options:currentCommandOptions, message:msg});
            }

            if (data.length === 1) {
                data = data[0];
            }

            messages[messageId] = data;
        }
    }

    _.forEach(_.split(messagesData, "\n"), function(messageLine) {
        if (_.startsWith(messageLine, "//")) {
            return;
        }

        if (_.startsWith(messageLine, "#")) {
            addMessage(messageId, message);

            messageId = _.trimStart(messageLine, "#").toLowerCase();
            message = "";

            return;
        }

        message += "\n" + messageLine;
    });
    addMessage(messageId, message);

    _.forEach(app.config.get("banners"), function(config) {
        generateBanner(config);
    });

    app.messages = messages;
    app.banners = banners;

    app.api.messages.get = function(messageId, defaultId) {
        return _.get(app.messages, messageId, _.get(app.messages, defaultId));
    };

    app.api.messages.unknown = function() {
        return app.api.messages.get("command-unknown-" + _.random(1, app.config.get("unknownMessagesCount")));
    };

    return app;
};