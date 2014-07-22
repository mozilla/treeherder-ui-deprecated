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

            function loadData () {
                var params = getParamsForWebService();
                if (!params) return;

                scope._loading = true;

                PerformanceData.get_from_property_list(
                    params, scope.selectedInterval)
                .then(function (ret) {
                    var performanceData = ret.performanceData;
                    var signatureData = ret.signatureData;

                    scope._chartData = [];

                    performanceData.data.forEach(function (datum) {
                        var chartData = signatureData[datum.series_signature];

                        scope._chartData.push({
                            data: datum.blob,
                            suite: chartData.suite,
                            test: chartData.test,
                            series_signature: datum.series_signature
                        });

                        scope._loading = false;
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

treeherder.directive('scatterPlot',
    ['$rootScope', '$window', '$timeout', 'PerformanceReplicates',
        function ($rootScope, $window, $timeout, PerformanceReplicates) {
    return {
        restrict: 'EA',
        scope: {
            obj: '=scatterPlot'
        },
        link: function (scope, element, attrs) {
            var points=[], data=[], plot, prepareData, performanceChartOptions;

            scope.showDeviation = true;

            (prepareData = function () {
                points = [];
                data = [];

                scope.obj.data.forEach(function (datum, index) {
                    points.push([
                        index,
                        datum.median,
                        datum.std,
                        datum.std
                    ]);

                    points[points.length - 1];
                });
            })();

            function draw () {
                plot = $.plot(element, [points], performanceChartOptions);
            }

            var timeoutHandle = null;
            function timeoutResize () {
                draw();
            }

            angular.element($window).bind('resize', function () {
                $timeout.cancel(timeoutHandle);
                timeoutHandle = $timeout(timeoutResize, 200);
            });

            performanceChartOptions = {
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

            $rootScope.$on('replicates.highlight', function (e, result_set_id) {
                plot.unhighlight();

                var index = 0;
                console.log(result_set_id);
                for (var i = 0, l = scope.obj.data.length; i < l; i++) {
                    if (scope.obj.data[i].result_set_id === result_set_id) {
                        plot.highlight(0, i);
                    }
                }
            });

            $timeout(function () {
                draw();

                $(element).bind('plothover', function (e, pos, item) {
                    if (!item) return;

                    var index = item.dataIndex;
                    var obj = scope.obj.data[index];

                    PerformanceReplicates.load_replicates(
                        scope.obj.series_signature,
                        obj.job_id
                    );
                });

                $(element).bind('plotclick', function (e, pos, item) {
                    if (!item) return;

                    console.log($rootScope.selectedJob);

                    var index = item.dataIndex;
                    var obj = scope.obj.data[index];

                    $rootScope.$emit('replicates.highlight', obj.result_set_id);
                });
            });
        }
    };
}]);
