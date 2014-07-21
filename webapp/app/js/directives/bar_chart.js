treeherder.directive('barChart', function () {
    return {
        restrict: 'EA',
        scope: {
            data: '=barChart'
        },
        link: function (scope, element, attrs) {
            var prepareData, data = [], plot;

            this.chartOptions = {
                bars: {
                    show: true
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
