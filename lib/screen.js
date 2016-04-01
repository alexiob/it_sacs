'use strict';

module.exports.create = function(app, client) {
    var _ = require("lodash"),
        PromiseA = require("bluebird"),
        blessed = require('blessed'),
        format = require("string-template")
        ;

    function Screen(app, client) {
        var me = this,
            options = app.config.get("screen.options"),
            screen
            ;

        options.input = client;
        options.output = client;

        screen = blessed.screen(options);

        me.screen = screen;
        me.client = client;
        me.widgets = {};
        me.system = undefined;
        me.inputEnabled = true;
        me.echoCommands = [];

        screen.title = app.config.get("screen.title");

        // screen.key(['escape', 'q', 'C-c'], function() {
        //     client.end();
        //     process.exit(0);
        // });

        screen.on('destroy', function() {
            if (client.writable) {
                client.destroy();
            }

            me.screen = undefined;
            me.client = undefined;
            me.widgets = undefined;
        });

        screen.render();

        return me;
    }

    Screen.prototype.render = function() {
        this.screen.render();
    };

    Screen.prototype.destroy = function() {
        if (this.screen && !this.screen.destroyed) {
            this.screen.destroy();
        }
    };

    Screen.prototype.setTerminal = function(terminal) {
        this.screen.terminal = terminal;

        this.system = app.api.user.get(this.client.userId);
    };

    Screen.prototype.setInputEnabled = function(enabled, callback) {
        this.inputEnabled = enabled;

        if (enabled === true && _.isFunction(this.inputEnabledCallback)) {
            this.inputEnabledCallback();
        }
        this.inputEnabledCallback = callback;
    };

    Screen.prototype.isInputEnabled = function() {
        return !(this.inputEnabled === false || _.isString(this.inputEnabled));
    };

    Screen.prototype.historyAdd = function(command) {
        this.system.history.push(command);

        if (this.system.history.length > app.config.get("historyLength")) {
            this.system.history.splice(0, 1);
        }

        this.system.historyIndex = this.system.history.length - 1;
    };

    Screen.prototype.historyMove = function(direction) {
        var command
            ;

        if (direction === "up") {
            if (this.system.historyIndex < 0) {
                this.system.historyIndex = -1;
            } else {
                command = this.system.history[this.system.historyIndex];
                this.system.historyIndex--;
            }
        } else if (direction === "down") {
            this.system.historyIndex++;
            if (this.system.historyIndex <= 0) {
                this.system.historyIndex = 1;
            }

            if (this.system.historyIndex >= this.system.history.length) {
                this.system.historyIndex = this.system.history.length - 1;
            } else {
                command = this.system.history[this.system.historyIndex];
            }
        }

        return command;
    };

    Screen.prototype.startPrompt = function() {
        this.widgets.input.readInput(function(){});
    };

    Screen.prototype.echoPush = function(msg) {
        if (_.isString(msg)) {
            msg = {command:"echo", message:msg};
        }

        if (!_.isArray(msg)) {
            msg = [msg];
        } else {
            msg = _.clone(msg);
        }

        this.echoCommands.push(msg);
    };


    Screen.prototype.echo = function(msg) {
        this.echoPush(msg);

        if (this.isInputEnabled()) {
            this.processEchoCommands();
        }
    };

    Screen.prototype.processEchoCommands = function() {
        var me = this,
            echoCommands,
            command,
            stop
            ;

        if (me.isInputEnabled()) {
            me.setInputEnabled(false);
        }

        while(me.echoCommands.length) {
            echoCommands = me.echoCommands.shift();
            command = echoCommands.shift();
            stop = me.echoCommand(command);

            if (!_.isEmpty(echoCommands)) {
                me.echoCommands.unshift(echoCommands);
            }

            if (stop === true) {
                return;
            }
        }

        me.setInputEnabled(true);
    };

    Screen.prototype.compileMessage = function(msg) {
        var me = this
            ;

        if (_.isObject(msg)) {
            msg = msg.message;
        }

        msg = blessed.parseTags(msg);

        if (_.isObject(me.system.location.current)) {
            msg = format(msg, me.system.location.current.env());
        }

        return msg;
    };

    Screen.prototype.addText = function(text) {
        var w = this.widgets.log
            ;

        w.insertBottom(text);
        w.setScroll(w.getScrollHeight());
    };

    Screen.prototype.echoCommand = function(command) {
        var me = this,
            defaultTimeout = 1,
            stop = false,
            key
            ;

        if (_.isObject(command)) {
            if (command.command === "echo") {
// console.log("echoCommand.echo", me.compileMessage(command))
                me.addText(me.compileMessage(command));
            } else if (command.command === "wait") {
// console.log("echoCommand.wait", command)
                me.setInputEnabled(false);
                me.addText(me.compileMessage(command));
                setTimeout(function() {
                        me.processEchoCommands();
                    },
                    _.get(command, "options.timeout", defaultTimeout) * 1000
                );
                stop = true;
            } else if (command.command === "wait-for-key") {
// console.log("echoCommand.wait-for-key", command)
                if (!_.isEmpty(command.message)) {
                    me.addText(me.compileMessage(command));
                }

                key = _.get(command, "options.key", "");

                me.setInputEnabled(
                    key,
                    function() {
                        me.setStatusBottom("");
                        me.processEchoCommands();
                    }
                );

                if (_.isEmpty(key)) {
                    key = "any key";
                }
                me.setStatusBottom("Press " + key + " to continue...");
                stop = true;
            }

            me.screen.render();
        } else {
            app.api.log("screen.echoCommand.invalid:", command);
        }

        return stop;
    };

    Screen.prototype.setScrollPerc = function (p) {
        var w = this.widgets.log
            ;

        if (p < 0) {
            p = 0;
        } else if (p > 100) {
            p = 100;
        }

        w.setScrollPerc(p);
    };

    Screen.prototype.scrollUp = function () {
        var w = this.widgets.log
            ;

        this.setScrollPerc(w.getScrollPerc() - 10);
    };

    Screen.prototype.scrollDown = function () {
        var w = this.widgets.log
            ;

        this.setScrollPerc(w.getScrollPerc() + 10);
    };

    Screen.prototype.setStatusTop = function(msg) {
        if (_.isObject(msg)) {
            msg = msg.message;
        }
        msg = _.trim(msg, "\n");
        this.widgets.statusTop.setContent(this.compileMessage(msg));
    };

    Screen.prototype.setStatusBottom = function(msg) {
        if (_.isObject(msg)) {
            msg = msg.message;
        }
        msg = _.trim(msg, "\n");
        this.widgets.statusBottom.setContent(this.compileMessage(msg));
    };

    Screen.prototype.setup = function() {
        var me = this,
            prompt = app.config.get("prompt")
            ;

        me.widgets.log = blessed.box({
            parent: me.screen,
            top: 1,
            left: 0,
            bottom: 2,
            right: 0,
            shrink: true,
            scrollable: true,
            scrollbar: {
                ch: ' '
            },
            style: {
                fg: 'green',
                bg: 'black',
                scrollbar: {
                    ch: ' ',
                    track: {
                        bg: 'cyan'
                    },
                    style: {
                        inverse: true
                    }
                },
            }
        });

        me.widgets.prompt = blessed.box({
            parent: me.screen,
            bottom: 1,
            left: 0,
            width: prompt.length,
            height: 1,
            style: {
                blink: true,
                fg: 'white',
                bg: 'gray'
            },
            content: prompt
        });

        me.widgets.input = blessed.textarea({
            parent: me.screen,
            bottom: 1,
            left: prompt.length,
            right: 0,
            height: 1,
            style: {
                fg: 'white',
                bg: 'gray'
            },
            "cursor": {
                "artificial": true,
                "shape": "block",
                "blink": true,
                "color": "white"
            }
        });

        me.widgets.statusTop = blessed.box({
            parent: me.screen,
            top: 0,
            left: 0,
            width: "100%",
            height: 1,
            style: {
                fg: 'white',
                bg: 'blue'
            },
            content: ''
        });

        me.widgets.statusBottom = blessed.box({
            parent: me.screen,
            bottom: 0,
            left: 0,
            width: "100%",
            height: 1,
            style: {
                fg: 'white',
                bg: 'blue'
            },
            content: ''
        });

        me.screen.append(me.widgets.log);
        me.screen.append(me.widgets.prompt);
        me.screen.append(me.widgets.input);
        me.screen.append(me.widgets.statusTop);
        me.screen.append(me.widgets.statusBottom);

        function unlockInput(key) {
            if (me.isInputEnabled() === false) {
                if (_.isString(me.inputEnabled) && (_.isEmpty(me.inputEnabled) || key === me.inputEnabled)) {
                    me.setInputEnabled(true);
                } else {
                    me.widgets.input.setValue("");
                }
                me.screen.render();
            }
            return me.inputEnabled;
        }

        me.widgets.input.on("keypress", function(key, info) {
            var command
                ;

            if (unlockInput(info.name) !== true) {
                return;
            }

            if (info.name === "up" || info.name === "down") {
                if (info.shift === true) {
                    if (info.name === "up") {
                        me.scrollUp();
                    } else {
                        me.scrollDown();
                    }
                    me.screen.render();
                } else {
                    command = me.historyMove(info.name);
                    if (!_.isEmpty(command)) {
                        me.widgets.input.setValue(command);
                        me.screen.render();
                    }
                }
            }
        });

        me.widgets.input.on("cancel", function() {
            me.startPrompt();
        });

        me.widgets.input.key("enter", function() {
            var command = me.widgets.input.value
                ;

            if (unlockInput("enter") !== true) {
                return;
            }

            command = _.trim(_.trimEnd(command, "\n"));

            me.widgets.input.setValue("");

            if (!_.isEmpty(command)) {
                me.setInputEnabled(true);
                me.historyAdd(command);
                me.echoPush("\n{white-fg}you:{/white-fg} {cyan-fg}" + command + "{/cyan-fg}");

                app.api.parser.parse(command, me.client.userId)
                    .then(function(output) {
                        // console.log("CMD OUTPUT", _.isEmpty(output), JSON.stringify(output), me.echoCommands);
                        if (!_.isEmpty(output)) {
                            me.echoPush(output);
                        } else {
                            me.echoPush("\n");
                        }

                        me.processEchoCommands();
                    })
                    .catch(function(error) {
                        console.log("CMD ERROR:", error);
                    });
            }

            me.widgets.input.submit();
        });

        me.screen.render();
    };

    return new Screen(app, client);
};

