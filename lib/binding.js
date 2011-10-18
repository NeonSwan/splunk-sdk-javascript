
// Copyright 2011 Splunk, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

(function() {
    var Paths   = require('./paths').Paths;
    var Class   = require('./jquery.class').Class;
    var Promise   = require('./promise').Promise;
    var utils   = require('./utils');

    var root = exports || this;

    // Our basic class that stores the context of a specific session, such
    // as login information, host name, port, etc.
    root.Context = Class.extend({
        init: function(http, params) {
            this.http = http;
            this.scheme = params.scheme || "https";
            this.host = params.host || "localhost";
            this.port = params.port || 8089;
            this.username = params.username || null;  
            this.password = params.password || null;  
            this.owner = params.owner || "-";  
            this.namespace = params.namespace || "-";  
            this.sessionKey = params.sessionKey || "";
            
            // Store our full prefix, which is just combining together
            // the scheme with the host
            this.prefix = this.scheme + "://" + this.host + ":" + this.port + "/services/json/v1";

            // We perform the bindings so that every function works 
            // properly when it is passed as a callback.
            this._headers   = utils.bind(this, this._headers);
            this.fullpath   = utils.bind(this, this.fullpath);
            this.urlify     = utils.bind(this, this.urlify);
            this.get        = utils.bind(this, this.get);
            this.del        = utils.bind(this, this.del);
            this.post       = utils.bind(this, this.post);
            this.login      = utils.bind(this, this.login);
        },

        // Return any session-specific headers (such as authorization).
        _headers: function (headers) {
            headers = headers || {};
            headers["Authorization"] = "Splunk " + this.sessionKey;

            return headers;
        },

        // Convert any partial path into a full path containing the full
        // owner and namespace prefixes if necessary.
        fullpath: function(path) {
            if (utils.startsWith(path, "/")) {
                return path;
            }  

            if (!this.namespace) {
                return "/services/" + path;
            }

            var owner = (this.owner === "*" ? "-" : this.owner);
            var namespace = (this.namespace === "*" ? "-" : this.namespace);

            return "/servicesNS/" + owner + "/" + namespace + "/" + path; 
        },

        // Given any path, this function will turn it into a fully
        // qualified URL, using the current context.
        urlify: function(path) {
            return this.prefix + this.fullpath(path);
        },

        // Authorize to the server and store the given session key.
        login: function(callback) {
            var url = Paths.login;
            var params = { username: this.username, password: this.password };

            var successCallback = utils.bind(this, function(response) {

                this.sessionKey = response.odata.results.sessionKey;

                if (callback) {
                    return callback(true);
                }
                else {
                    return Promise.Success(true);
                }
            });
            var errorCallback = function(response) {
                console.log("Error getting login info.");

                if (callback) {
                    return callback(false);
                }
                else {
                    return Promise.Failure(false);
                }
            };

            // We have to handel the case of both promises or callbacks
            // being used, so we register all the callbacks and handle the promise
            // return values.
            var loginP = this.post(url, params);

            return loginP.when(successCallback, errorCallback);
        },

        get: function(path, params, callback) {
            return this.http.get(
                this.urlify(path),
                this._headers(),
                params,
                0,
                callback
            );  
        },

        del: function(path, params, callback) {
            return this.http.del(
                this.urlify(path),
                this._headers(),
                params,
                0,
                callback
            );  
        },

        post: function(path, params, callback) {
            return this.http.post(
                this.urlify(path),
                this._headers(),
                params,
                0,
                callback
            );  
        },

        request: function(path, method, headers, body, callback) {
            return this.http.request(
                this.urlify(path),    
                {
                    method: method,
                    headers: this._headers(headers),
                    body: body,
                    timeout: 0
                },
                callback
            );
        }
    });
})();