treeherder.directive('lineChart', ['Charts', '$window', '$timeout', function (Charts, $window, $timeout) {
    return {
        restrict: 'EA',
        link: function (scope, element, attrs) {
            Charts.load().then(function (d3) {

                var svgs = [];
                var margin = {top: 20, right: 20, bottom: 30, left: 40};

                var timeoutHandle = null;

                // add the tooltip area to the webpage
                var tooltip = d3.select('d3-tooltip') ||
                              d3.select('body').append('div')
                                .attr('class', 'd3-tooltip')
                                .style('opacity', 0);

                // setup fill color
                var cValue = function(d) { return d.result_set_id;},
                    color = d3.scale.category10();

                function timeout () {
                    window.clearTimeout(timeoutHandle);

                    timeoutHandle = window.setTimeout(function () {
                        scope.$apply();
                    }, 500);
                }

                window.onresize = function () {
                    // only resize when window is done being moved
                    timeout();
                };

                // scope.$watch(function() {
                //     return element[0].innerWidth;
                // }, function() {
                //     scope.render(scope.data);
                // });

                scope.$watch(attrs.showWhen, function (isTrue) {
                    if (isTrue) {
                        if (timeoutHandle) $timeout.cancel(timeoutHandle);
                        timeoutHandle = $timeout(function rendering() {scope.render();}, 1000);
                    }
                });

                function clearAndRebuildSvgs () {
                    element.find('.th-chart').remove();

                    svgs = [];

                    for (var i = 0; i < scope.data.length; i++) {
                        var svg = d3.select(element[0]).append('svg')
                            .style('width', '100%')
                            .attr('class', 'th-chart');

                        svgs.push(svg);
                    }
                }

                scope.render = function (data) {
                    if (!data && !scope.data) return;

                    clearAndRebuildSvgs();

                    var index = 0;
                    // setup variables
                    var width = d3.select(element[0]).node().offsetWidth - margin.left - margin.right,
                        // calculate the height
                        height = 230 - margin.top - margin.bottom;

                    var xValue = function(d) {return index++;}, // data -> value
                        xScale = d3.scale.linear().range([0, width]),
                        xMap = function(d) {return xScale(xValue(d));}, // data -> display
                        xAxis = d3.svg.axis().scale(xScale).orient('bottom');

                    // setup y
                    var yValue = function(d) { return d.median;}, // data -> value
                        yScale = d3.scale.linear().range([height, 0]),
                        yMap = function(d) { return yScale(yValue(d));}, // data -> display
                        yAxis = d3.svg.axis().scale(yScale).orient('left');

                    // set the height based on the calculations above
                    svgs.forEach(function (svg, i) {
                        index = 0;
                        data = scope.data[i].data;

                        // don't want dots overlapping axis, so add in buffer to data domain
                        xScale.domain([0, data.length]);
                        yScale.domain([0, d3.max(data, yValue)+1]);

                        svg.attr('height', height + margin.top + margin.bottom)
                           .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

                        // x-axis
                        svg.append('g')
                            .attr('class', 'x axis')
                            .attr('transform', 'translate(0,' + height + ')')
                            .call(xAxis)
                        .append('text')
                            .attr('class', 'label')
                            .attr('x', width)
                            .attr('y', -6)
                            .style('text-anchor', 'end')
                            .text('Time');

                        // y-axis
                        svg.append('g')
                            .attr('class', 'y axis')
                            .call(yAxis)
                        .append('text')
                            .attr('class', 'label')
                            .attr('transform', 'rotate(-90)')
                            .attr('y', 6)
                            .attr('dy', '.71em')
                            .style('text-anchor', 'end')
                            .text('Speed');

                        // draw dots
                        svg.selectAll('.dot')
                            .data(data)
                        .enter().append('circle')
                            .attr('class', 'dot')
                            .attr('r', 3.5)
                            .attr('cx', xMap)
                            .attr('cy', yMap)
                            .style('fill', function(d) { return color(cValue(d));})
                            .on('mouseover', function(d) {
                                tooltip.transition()
                                    .duration(200)
                                    .style('opacity', .9);
                                tooltip.html(d.total_replicates + '<br/> (' + xValue(d)
                                + ', ' + yValue(d) + ')')
                                    .style('left', (d3.event.pageX + 5) + 'px')
                                    .style('top', (d3.event.pageY - 28) + 'px');
                            })
                            .on('mouseout', function(d) {
                                tooltip.transition()
                                    .duration(500)
                                    .style('opacity', 0);
                            });

                        // draw legend
                        // var legend = svg.selectAll('.legend')
                        //     .data(color.domain())
                        // .enter().append('g')
                        //     .attr('class', 'legend')
                        //     .attr('transform', function(d, i) { return 'translate(0,' + i * 20 + ')'; });

                        // // draw legend colored rectangles
                        // legend.append('rect')
                        //     .attr('x', width - 18)
                        //     .attr('width', 18)
                        //     .attr('height', 18)
                        //     .style('fill', color);

                        // // draw legend text
                        // legend.append('text')
                        //     .attr('x', width - 24)
                        //     .attr('y', 9)
                        //     .attr('dy', '.35em')
                        //     .style('text-anchor', 'end')
                        //     .text(function(d) { return d;});
                    });
                };
            });
        }
    };
}]);
