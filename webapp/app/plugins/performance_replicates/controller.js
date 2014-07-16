"use strict";

treeherder.controller('PerformanceReplicatesPluginCtrl',
    ['$rootScope', '$scope', 'ThPerformanceArtifactModel', function ($rootScope, $scope, ThPerformanceArtifactModel) {

    ThPerformanceArtifactModel.get_list({
        job_id: $rootScope.selectedJob.job_id,
    }).then(function (data) {
        console.log(data);
    });

    $scope.test = 'bing';
}]);
