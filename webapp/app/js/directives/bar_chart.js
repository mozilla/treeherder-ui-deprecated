treeherder.directive('barChart', function () {
    return {
        restrict: 'EA',
        scope: {
            data: '=barChart'
        },
        link: function (scope, element, attrs) {
            var prepareData, points = [], data = [], plot;

            var chartOptions = {
                bars: {
                    show: true
                },

                xaxis: {
                },

                yaxis: {
                    autoscaleMargin:0.3
                },

                series: {
                    color: '#68D48C'
                }
            };

            (prepareData = function () {
                data = [];

                scope.data.forEach(function (datum, index) {
                    data.push([
                        index,
                        datum
                    ]);
                });
            })();

            scope.$watch('data', function () {
                if (scope.data.length === 0) return;

                prepareData();
                $.plot(element, [data], chartOptions);
            });
        }
    };
});
