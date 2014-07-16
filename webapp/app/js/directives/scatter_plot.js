treeherder.directive('scatterPlotContainer', ['ThPerformanceDataModel', '$rootScope',
        function (ThPerformanceDataModel, $rootScope) {

    var PerformanceData = new ThPerformanceDataModel();

    return {
        restrict: 'EA',
        templateUrl: 'partials/thScatterPlot.html',
        scope: {
            settings: '=scatterPlotContainer'
        },
        link: function (scope, element, attrs) {
            scope.timeIntervals = [
                { seconds:86400, days:1},
                { seconds:604800, days:7},
                { seconds:1209600, days:14},
                { seconds:2592000, days:30},
                { seconds:5184000, days:60},
                { seconds:7776000, days:90},
            ];

            scope.selectedInterval = 86400;
            scope._chartData = [];

            $rootScope.$watch('selectedJob', function () {
                scope.settings.selectedJob = $rootScope.selectedJob;
                loadData();
            });

            scope.selectInterval = function (seconds) {
                scope.selectedInterval = seconds;
                loadData();
            };

            scope.getTests = function () {
                return scope._chartData.map(function (datum) {
                    return datum.test;
                });
            };

            scope.jumpToTest = function ($index) {
                var parent = element.find('.th-scatter-plot-chart-list');
                var child = element.find('.th-chart-repeater').eq($index);

                var offset =
                    child.position().top +
                    parent.scrollTop();

                parent.scrollTop(offset);
            };

            function getParamsForWebService () {
                var job = scope.settings.selectedJob;

                if (!job) return null;

                return {
                    job_group_symbol: job.job_group_symbol,
                    job_type_symbol: job.job_type_symbol,
                    build_platform: job.build_platform
                };
            };

            var loadData = function () {
                var params = getParamsForWebService();
                if (!params) return;

                scope._loading = true;

                PerformanceData.get_signatures_from_property_list(params)
                .then(function (signatureData) {
                    signatureData = signatureData.data;
                    var signatures = [];

                    for (var i in signatureData) {
                        if (!signatureData.hasOwnProperty(i)) continue;
                        signatures.push(i);
                    }

                    PerformanceData.get_from_signatures(signatures, scope.selectedInterval).then(
                            function (performanceData) {
                        scope._chartData = [];

                        performanceData.data.forEach(function (datum) {
                            var chartData = signatureData[datum.series_signature];

                            scope._chartData.push({
                                data: datum.blob,
                                suite: chartData.suite,
                                test: chartData.test
                            });

                            scope._loading = false;
                        });
                    });
                });
            };

            scope.$watch('settings', function (oldData, newData) {
                if (!scope.settings.error) {
                    loadData();
                }
            });
        }
    };
}]);

treeherder.directive('scatterPlot', ['$window', '$timeout',
        function ($window, $timeout) {
    return {
        restrict: 'EA',
        scope: {
            obj: '=scatterPlot'
        },
        link: function (scope, element, attrs) {
            var data = [], prepareData;

            (prepareData = function () {
                scope.obj.data.forEach(function (datum, index) {
                    data.push([
                        index,
                        datum.median
                    ]);
                });
            })();

            var timeoutHandle = null;
            function timeoutResize () {
                $.plot(element, [data], this.performanceChartOptions);
            }

            angular.element($window).bind('resize', function () {
                $timeout.cancel(timeoutHandle);
                timeoutHandle = $timeout(timeoutResize, 200);
            });


            this.performanceChartOptions = {
                grid: {
                    clickable: true,
                    hoverable: true,
                    autoHighlight: true,
                    color: '#B6B6B6',
                    borderWidth: 0.5
                },

                // 'xaxis': {
                //     'tickFormatter': _.bind(this.formatLabel, this)
                // },

                yaxis: {
                    min:0,
                    autoscaleMargin:0.3
                },

                zoom: {
                    interactive: true,
                },
                pan: {
                    interactive: true,
                },

                series: {

                    points: {
                        radius: 2.5,
                        show: true,
                        fill: true,
                        fillColor: '#058DC7',
                        errorbars: 'y',
                        yerr: {
                             show: true,
                             upperCap:'-',
                             lowerCap:'-',
                             color: '#CCCCCC'
                            }
                    },
                    color: '#058DC7'
                },
                selection:{
                    mode:'x',
                    color:'#BDBDBD'
                }
            };

            $timeout(function () {
                $.plot(element, [data], this.performanceChartOptions);
            });
        }
    };
}]);
