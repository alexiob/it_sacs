'use strict';

module.exports.create = function(app) {
    var _ = require("lodash"),
        PromiseA = require("bluebird"),
        fs = PromiseA.promisifyAll(require("fs")),
        usersInfo = {}
        ;

    app.api.user = {};

    app.api.user.new = function(userId, name) {
        var system = {
            userId: userId,
            name: name,
            screen: undefined,
            parser: {
                stack: []
            },
            location: {
                current: null,
                info: {}
            },
            history: [],
            historyIndex: 0
        };

        return system;
    };

    app.api.user.connect = function(userId, data) {
        var userData = {},
            name
            ;

        if (app.api.parser.parser.env.users[userId]) {
            userData = app.api.parser.parser.env.users[userId];
        } else {
            name = "Guest" + app.api.parser.parser.env.userNumber
                ;

            userData = app.api.user.new(userId, name);

            app.api.parser.parser.env.userNumber++;
        }

        if (_.isObject(data)) {
            _.merge(userData, data);
        }

        app.api.parser.parser.env.users[userId] = userData;

        return userData;
    };

    app.api.user.disconnect = function(userId) {
        if (app.api.parser.parser.env.users[userId]) {
            delete app.api.parser.parser.env.users[userId];
        }
    };

    app.api.user.get = function(userId) {
        return app.api.parser.parser.env.users[userId];
    };

    app.api.user.update = function(userId, data) {
        if (app.api.parser.parser.env.users[userId] && _.isObject(data)) {
            _.merge(app.api.parser.parser.env.users[userId], data);
        }
    };

    app.api.user.save = function() {
        return fs.writeFileAsync(app.config.get("path.users"), JSON.stringify(usersInfo))
            .then(function(){
                app.api.log("user.save: %s", app.config.get("path.users"));
            })
            .catch(function(error){
                app.api.log("user.save.error: saving to file %s. %s", app.config.get("path.users"), error);
            });
    };

    app.api.user.load = function() {
        return fs.readFileAsync(app.config.get("path.users"))
            .then(function(data){
                usersInfo = JSON.parse(data);
                app.api.log("user.load: %s", app.config.get("path.users"));
            })
            .catch(function(error){
                app.api.log("user.load.error: loading file %s. %s", app.config.get("path.users"), error);
            });
    };

    app.api.user.isUsernameUsed = function(username) {
        return _.has(usersInfo, username);
    };

    app.api.user.register = function(userId, info, autoLogin) {
        var user = app.api.user.get(userId)
            ;
        if (_.isObject(user) && _.isUndefined(user.info) && _.isObject(info)) {
            usersInfo[info.username] = info;

            if (autoLogin === true) {
                return app.api.user.login(userId, info.username, info.password);
            }

            return true;
        }

        return false;
    };

    app.api.user.isLoggedIn = function(userId) {
        var user = app.api.user.get(userId)
            ;

        return _.isObject(user) && user.isLoggedIn === true;
    };

    app.api.user.login = function(userId, username, password) {
        var user,
            info
            ;

        user = app.api.user.get(userId);

        if (_.isObject(user)) {
            if (user.isLoggedIn === true) {
                return true;
            }

            info = usersInfo[username];

            if (!_.isObject(info) || info.disabled === true || info.password !== password) {
                return false;
            }

            user.info = info;
            user.isLoggedIn = true;
            user.name = user.info.nickname || user.info.username;

            return true;
        }

        return false;
    };

    app.api.user.logout = function(userId) {
        var user = app.api.user.get(userId)
            ;

        if (_.isObject(user)) {
            delete user.isLoggedIn;
            delete user.info;
        }
    };

    app.api.user.load();
};
