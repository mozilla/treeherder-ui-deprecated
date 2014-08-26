'use strict';

var treeherder = angular.module('treeherder',
    ['ngResource','ui.bootstrap', 'ngSanitize', 'ngCookies', 'ngRoute',
     'LocalStorageModule']);


treeherder.config(function($routeProvider, $httpProvider, $logProvider) {

    // enable or disable debug messages using $log.
    // comment out the next line to enable them
    $logProvider.debugEnabled(false);

    // avoid CORS issue when getting the logs from the ftp site
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];

    $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
    $httpProvider.defaults.xsrfCookieName = 'csrftoken';

    $routeProvider.
        when('/jobs', {
            controller: 'JobsCtrl',
            templateUrl: 'partials/jobs.html',
            // see controllers/filters.js ``skipNextSearchChangeReload`` for
            // why we set this to false.
            reloadOnSearch: false
        }).
        when('/jobs/:tree', {
            controller: 'JobsCtrl',
            templateUrl: 'partials/jobs.html',
            reloadOnSearch: false
        }).
        when('/timeline', {
            controller: 'TimelineCtrl',
            templateUrl: 'partials/timeline.html'
        }).
        when('/machines', {
            controller: 'MachinesCtrl',
            templateUrl: 'partials/machines.html'
        }).
        otherwise({redirectTo: '/jobs'});
});

var logViewer = angular.module('logViewer',['treeherder']);

//var helpViewer = angular.module('helpViewer', []);//, ['HelpviewerController']);


var helpviewer = angular.module('helpviewer', ['treeherder']);

// helpviewer.controller('HelpviewerCtrl', [
//     '$scope', '$rootScope', 'ThBuildPlatformModel', 'ThJobTypeModel',
//     'thEvents', 'ThRepositoryModel', 'ThOptionModel', 'ThJobExclusionModel',
//     'ThExclusionProfileModel',
//     function HelpviewerController(
//         $scope, $rootScope, ThBuildPlatformModel, ThJobTypeModel, thEvents,
//         ThRepositoryModel, ThOptionModel, ThJobExclusionModel,
//         ThExclusionProfileModel) {

helpviewer.controller('HelpviewerCtrl', [
    '$scope', 'ThJobTypeModel', 'ThBuildPlatformModel', 'ThJobGroupModel',
    function HelpviewerController(
        $scope, ThJobTypeModel, ThBuildPlatformModel, ThJobGroupModel) {

        // initialize the list of job_types
        $scope.master_job_types = [];
        ThJobTypeModel.get_list()
        .then(function(data) {
            for (var i = 0; i < data.length; i++) {
                $scope.master_job_types.push(data[i]);
            }
        });

        // initialize the list of job_groups
        $scope.master_job_groups = [];
        ThJobGroupModel.get_list()
        .then(function(data) {
            for (var i = 0; i < data.length; i++) {
                $scope.master_job_groups.push(data[i]);
            }
        });

}]);
