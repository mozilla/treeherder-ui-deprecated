'use strict';

/* Services */
treeherder.factory('thUrl',['$rootScope', 'thServiceDomain', '$log', function($rootScope, thServiceDomain, $log) {

   var thUrl =  {
        getRootUrl: function(uri) {
            return thServiceDomain + "/api" + uri;
        },
        getProjectUrl: function(uri) {
            return thServiceDomain + "/api/project/" + $rootScope.repoName + uri;
        },
        getLogViewerUrl: function(job_id) {
            return "logviewer.html#?job_id=" + job_id + "&repo=" + $rootScope.repoName;
        },
        getSocketEventUrl: function() {
            var port = thServiceDomain.indexOf("https:") !== -1 ? 443 :80;
            return thServiceDomain + ':' + port + '/events';
        }
   };
   return thUrl;

}]);

treeherder.factory('thSocket', function ($rootScope, $log, thUrl) {
    var socket = io.connect(thUrl.getSocketEventUrl());
    socket.on('connect', function(){
       $log.debug('socketio connected');
    });
  return {
    on: function (eventName, callback) {
      socket.on(eventName, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          callback.apply(socket, args);
        });
      });
    },
    emit: function (eventName, data, callback) {
      socket.emit(eventName, data, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          if (callback) {
            callback.apply(socket, args);
          }
        });
      });
    }
  };
});

treeherder.factory('ThPaginator', function(){
    //dead-simple implementation of an in-memory paginator

    var ThPaginator = function(data, limit){
        this.data = data;
        this.length = data.length;
        this.limit = limit;
    };

    ThPaginator.prototype.get_page = function(n){
        return this.data.slice(n * limit - limit, n * limit);
    }

    ThPaginator.prototype.get_all = function(){
        return data
    };

    return ThPaginator

});

treeherder.factory('BrowserId', function($http, $q, $log,  thServiceDomain){
    
    /* 
    * BrowserId is a wrapper for the persona authentication service
    * it handles the navigator.id.request and navigator.id.logout calls
    * and exposes the related promises via requestDeferred and logoutDeferred.
    * This is mostly inspired by the django_browserid jquery implementation.  
    */
    var browserid = {
        info: $http.get(thServiceDomain+'/browserid/info/'),
        requestDeferred: null,
        logoutDeferred: null,
        
        /*
        * Retrieve an assertion from the persona service and 
        * and send it to the treeherder verification endpoints.
        * 
        */
        login: function(requestArgs){
            return browserid.getAssertion(requestArgs)
            .then(function(response) {
                return browserid.verifyAssertion(response);
            });

        },
        /*
        * Logout from persona and notify treeherder of the change
        * The logoutDeferred promise is resolved by the onLogout callback
        * of navigator.id.watch
        */
        logout: function(){
            return browserid.info.then(function(response){
                browserid.logoutDeferred = $q.defer();
                navigator.id.logout();
                return browserid.logoutDeferred.promise.then(function(){
                    return $http.post(response.data.logoutUrl);
                })
            });
        },
        /*
        * Ask persona to provide an assetion and return a promise of the response
        * The requestDeferred promise is resolved by the onLogin callback
        * of navigator.id.watch. 
        */
        getAssertion: function(requestArgs){
            return browserid.info.then(function(response){
                requestArgs = _.extend({}, response.data.requestArgs, requestArgs);
                browserid.requestDeferred = $q.defer();
                navigator.id.request(requestArgs);
                return browserid.requestDeferred.promise;
           });
        },
        /*
        * Verify the assertion provided by persona against the treeherder verification endpoint.
        * The django_browserid endpoint accept a post request with form-urlencoded fields. 
        */
        verifyAssertion: function(assertion){
            return browserid.info.then(function(response){
                return $http.post(
                    response.data.loginUrl, {assertion: assertion},{
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
                        transformRequest: browserid.transform_data
                    });
            });
        },
        
        transform_data: function(data){
            return $.param(data);
        }
    }
    return browserid;
});
