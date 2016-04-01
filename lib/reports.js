'use strict';

module.exports.create = function(app) {
    var _ = require("lodash"),
        PromiseA = require("bluebird"),
        fs = PromiseA.promisifyAll(require("fs")),
        util = require("util"),
        format = require("string-template"),
        uuid = require("node-uuid")
        ;
    var reports = {},
        templates = {
            report: fs.readFileSync(app.config.get("path.emailReportTemplate")).toString(),
        }
        ;

    app.api.reports = {};

    function newRecordId(userId) {
        var user = app.api.user.get(userId),
            id =_.random(100000,999999)
            ;

        if (_.isUndefined(reports[user.name])) {
            reports[user.name] = {};
        }

        while(reports[user.name][id]) {
            id =_.random(100000,999999);
        }

        return id;
    }

    app.api.reports.newRecord = function(userId, accountId, date, comment) {
        var record = {
            id: newRecordId(userId),
            accountId: accountId,
            date: date,
            comment: comment
        };
        return record;
    };

    app.api.reports.add = function(userId, accountId, date, comment) {
        var user = app.api.user.get(userId),
            record = app.api.reports.newRecord(userId, accountId, date, comment)
            ;

        reports[user.name][record.id] = record;

        return record;
    };

    app.api.reports.get = function(userId, recordId) {
        var user = app.api.user.get(userId)
            ;

        if (_.isObject(reports[user.name])) {
            return reports[user.name][recordId];
        }
    };

    app.api.reports.delete = function(userId, recordId) {
        var user = app.api.user.get(userId)
            ;

        if (_.isObject(reports[user.name])) {
            delete reports[user.name][recordId];
            return true;
        }
        return false;
    };

    app.api.reports.random = function(userId) {
        var user = app.api.user.get(userId)
            ;

        if (_.isObject(reports[user.name])) {
            return reports[user.name][_.sample(_.keys(reports[user.name]))];
        }
    };

    app.api.reports.getInMonthYear = function(userId, month, year) {
        var user = app.api.user.get(userId),
            records = []
            ;

        if (_.isObject(reports[user.name])) {
            _.forEach(reports[user.name], function(record) {
                if ((!year || record.date.year === year) &&
                    (!month || record.date.month === month)) {
                    records.push(record);
                }
            });
        }

        return records;
    };

    app.api.reports.list = function(userId, month, year) {
        var user = app.api.user.get(userId),
            records
            ;

        records = _.filter(reports[user.name], function(record) {
            if (month && record.date.month != month) {
                return false;
            }

            if (year && record.date.year != year) {
                return false;
            }

            return true;
        });

        return records;
    };

    app.api.reports.send = function(userId, email, records) {
        var user = app.api.user.get(userId),
            recordsList = [],
            userRecords = reports[user.name],
            reportData = {},
            report = '',
            subject
            ;

        if (_.isObject(userRecords)) {
            reportData.wrongRecords = 0;
            report += "+-------------------------------------------------------------+\n";
            _.forEach(records, function(recordId, idx) {
                var record = userRecords[recordId],
                    date
                    ;
                if (record) {
                    recordsList.push(record);

                    date = util.format("%s/%s/%s", record.date.year, record.date.month, record.date.day);
                    report += util.format("| %s | %s | %s | %s |\n",
                        _.padStart(idx, 3),
                        _.padEnd(record.id, 6),
                        _.padEnd(date, 10),
                        _.padEnd(record.comment, 30)
                    );
                } else {
                    reportData.wrongRecords += 1;
                }
            });
            report += "+-------------------------------------------------------------+\n";

            reportData.protocolNumber = uuid.v4();
            reportData.username = user.name;
            reportData.email = user.info.email;
            reportData.numInterviews = recordsList.length;
            reportData.total = recordsList.length * app.config.get("interviewRate");
            reportData.report = report;

            subject = util.format("I.T. S.Ac.S. - Technical Screening Report from %s <%s>", user.name, user.info.email);

            return app.api.email.send({
                to: email,
                subject: subject,
                text: format(templates.report, reportData)
            })
            .then(function() {
                return app.messages["accounting-send-result"];
            })
            .catch(function(error) {
                app.api.log("reports.send.error:", error);
                return app.messages["accounting-send-error"];
            });
        } else {
            return PromiseA.resolve(app.messages["accounting-send-error"]);
        }
    };

    app.api.reports.save = function() {
        return fs.writeFileAsync(app.config.get("path.reports"), JSON.stringify(reports))
            .then(function(){
                app.api.log("reports.save: %s", app.config.get("path.reports"));
            })
            .catch(function(error){
                app.api.log("reports.save.error: saving to file %s. %s", app.config.get("path.reports"), error);
            });
    };

    app.api.reports.load = function() {
        return fs.readFileAsync(app.config.get("path.reports"))
            .then(function(data){
                reports = JSON.parse(data);
                app.api.log("reports.load: %s", app.config.get("path.reports"));
            })
            .catch(function(error){
                app.api.log("reports.load.error: loading file %s. %s", app.config.get("path.reports"), error);
            });
    };

    app.api.reports.load();
};
