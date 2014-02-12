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