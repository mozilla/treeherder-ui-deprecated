treeherder.directive('scatterPlotContainer',
    ['ThPerformanceDataModel', '$rootScope', 'PerformanceReplicates',
        function (ThPerformanceDataModel, $rootScope, PerformanceReplicates) {

    var PerformanceData = new ThPerformanceDataModel();

    return {
        restrict: 'EA',
        templateUrl: 'partials/thScatterPlot.html',
        scope: {
            settings: '=scatterPlotContainer'
        },
        link: function (scope, element, attrs) {
            scope.timeIntervals = [
                { seconds:604800, days:7},
                { seconds:1209600, days:14},
                { seconds:2592000, days:30},
                { seconds:5184000, days:60},
                { seconds:7776000, days:90},
            ];

            scope._chartData = [];

            scope.options = {
                selectedInterval: 604800,
                errorBars: true,
                plot: 'mean'
            };

            scope.selectInterval = function (seconds) {
                scope.options.selectedInterval = seconds;
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
                console.log(scope.settings.selectedJob);

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
                    params, scope.options.selectedInterval)
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

                    PerformanceReplicates.load_replicates(
                        scope._chartData[0].series_signature,
                        scope._chartData[0].job_id);
                });
            };

            function jobAlreadyLoaded () {
                return ($rootScope.selectedJob && $rootScope.selectedJob.job_id) &&
                       (scope.settings && scope.settings.selectedJob) &&
                       ($rootScope.selectedJob.job_id ===
                        scope.settings.selectedJob.job_id);
            }

            $rootScope.$watch('selectedJob', function () {
                if (jobAlreadyLoaded() ||
                    (scope.settings.selectedJob &&
                        ($rootScope.selectedJob.result_set_id !==
                         scope.settings.selectedJob.result_set_id))) return;

                scope.settings.selectedJob = $rootScope.selectedJob;
                console.log(1);
                loadData();
            });

            scope.$watch('settings', function (oldData, newData) {
                if (!scope.settings.error) {
                    if (jobAlreadyLoaded()) return;

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
        link: function (scope, element, attrs) {
            var points=[], data=[], plot, prepareData, performanceChartOptions,
                lockedOnPoint;

            var $chart = element.find('.th-chart');

            scope.zoom = function () {
                plot.zoom();
            };

            scope.zoomOut = function () {
                plot.zoomOut();
            };

            scope.pan = function (offset) {
                plot.pan(offset);
            };

            function formatLabel (index) {
                var datum = scope.obj.data[index];

                if (!datum) {
                    if (index % 1 === 0.5) {
                        var datum = {
                            push_timestamp:
                                (scope.obj.data[index - 0.5].push_timestamp +
                                 scope.obj.data[index + 0.5].push_timestamp) / 2
                        }
                    } else {
                        return '';
                    }
                }

                var date = new Date(datum.push_timestamp * 1000);

                var day = date.getDate();
                var month = date.getMonth();
                var year = date.getFullYear();

                return month + '/' + day + '/' + year;
            }

            performanceChartOptions = {
                grid: {
                    clickable: true,
                    hoverable: true,
                    autoHighlight: true,
                    color: '#B6B6B6',
                    borderWidth: 0.5
                },

                xaxis: {
                    tickFormatter: formatLabel
                },

                yaxis: {
                    min:0,
                    autoscaleMargin:0.3
                },

                zoom: {
                    interactive: false,
                    trigger: 'dblclick'
                },
                pan: {
                    interactive: true,
                },

                series: {

                    points: {
                        radius: 2.5,
                        show: true,
                        fill: true,
                        fillColor: '#68D48C',
                        yerr: {
                            show: true,
                            upperCap:'-',
                            lowerCap:'-',
                            color: '#CCCCCC'
                        }
                    },
                    color: '#68D48C'
                },
                selection:{
                    mode:'x',
                    color:'#96E1AF'
                }
            };

            scope.$watch('options.errorBars', function () {
                prepareData();draw();
            });
            scope.$watch('options.plot', function () {
                prepareData();draw();
            });

            (prepareData = function () {
                points = [];
                data = [];

                if (scope.options.errorBars) {
                    performanceChartOptions.series.points.errorbars = 'y';
                } else {
                    performanceChartOptions.series.points.errorbars = '';
                }

                scope.obj.data.forEach(function (datum, index) {
                    var dataPoint;

                    if (scope.options.plot === 'mean') {
                        dataPoint = datum.mean;
                    } else if (scope.options.plot === 'median') {
                        dataPoint = datum.median;
                    }

                    points.push([
                        index,
                        dataPoint,
                        datum.std,
                        datum.std
                    ]);

                    points[points.length - 1];
                });
            })();

            function draw () {
                plot = $.plot($chart, [points], performanceChartOptions);
            }

            var timeoutHandle = null;
            function timeoutResize () {
                draw();
            }

            angular.element($window).bind('resize', function () {
                $timeout.cancel(timeoutHandle);
                timeoutHandle = $timeout(timeoutResize, 200);
            });

            $rootScope.$on('replicates.highlight', function (e, result_set_id) {
                plot.unhighlight();

                for (var i = 0, l = scope.obj.data.length; i < l; i++) {
                    var obj = scope.obj.data[i];

                    if (obj.result_set_id === result_set_id) {
                        plot.highlight(0, i);

                        scope.lockedOnPoint = obj;
                        scope.selectedDatum = obj;
                    }
                }
            });

            $chart.bind('plothover', function (e, pos, item) {
                if (!item) return;

                var index = item.dataIndex;
                var obj = scope.obj.data[index];

                if (scope.selectedDatum &&
                   (scope.selectedDatum.job_id === obj.job_id)) return;

                scope.selectedDatum = obj;

                if (!scope.$$phase) scope.$apply();
            });

            $chart.bind('plotclick', function (e, pos, item) {
                var clearData = function () {
                    scope.lockedOnPoint = undefined;

                    // clear locked points
                    $rootScope.$emit('replicates.highlight', null);
                };

                if (!item) {
                    clearData();
                    return;
                }

                var index = item.dataIndex;
                var obj = scope.obj.data[index];

                if (scope.lockedOnPoint &&
                   (scope.lockedOnPoint.job_id === obj.job_id)) {

                    clearData();
                    return;
                }

                scope.selectedDatum = obj;
                scope.lockedOnPoint = obj;

                PerformanceReplicates.load_replicates(
                    scope.obj.series_signature,
                    obj.job_id
                );

                $rootScope.$emit('replicates.highlight', obj.result_set_id);
            });

            $timeout(function () {
                draw();
            });
        }
    };
}]);
