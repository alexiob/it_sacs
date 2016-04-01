'use strict';

module.exports.create = function(app) {
    var _ = require("lodash"),
        util = require("util"),
        PromiseA = require("bluebird"),
        nodemailer = require('nodemailer'),
        format = require("string-template")
        ;
    var transporter = nodemailer.createTransport(app.config.get("email.config")),
        mailOptions = {
            from: '"🤖 Eccentrico Gallumbis 🤖" <eccentrico.gallumbits@gmail.com>',
            to: '',
            subject: '',
            text: '',
            html: ''
        }
        ;

    app.api.email = {};

    app.api.email.send = function(options) {
        options = _.merge(_.clone(mailOptions), options);

        return transporter.sendMail(options)
            .then(function(info) {
                return info;
            })
            .catch(function(error) {
                console.log('Message error: ', error);
                throw error;
            });
    };

    app.api.email.sendSpam = function(userId) {
        var user = app.api.user.get(userId),
            options = _.clone(mailOptions),
            spamMessagesCount = _.random(1, app.config.get("spamMessagesCount")),
            info = _.clone(user.info)
            ;

        info.place = info.place || "Thailand";
        info.color = info.color || "fuxia";
        info.beloved = info.beloved || "your beloved one";

        options.to = user.info.email;
        options.subject = format(app.messages['spam-subject-' + spamMessagesCount].message, info);
        options.text = format(app.messages['spam-' + spamMessagesCount].message, info);

        app.api.log("email.sendSpam:", options);
        return app.api.email.send(options);
    };

};