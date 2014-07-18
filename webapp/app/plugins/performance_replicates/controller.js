"use strict";

treeherder.controller('PerformanceReplicatesPluginCtrl',
        ['$rootScope', '$scope', 'PerformanceReplicates',
        function ($rootScope, $scope, PerformanceReplicates) {

    $scope.replicates = PerformanceReplicates;
}]);
