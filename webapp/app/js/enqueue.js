window.enqueue = (function () {
  var tasks = [];
  var queued = false;

  function taskLoop() {
    var start = Date.now();

    for (var i = 0, len = tasks.length; i < len; i++) {
      var timeElapsed = Date.now() - start;
      if (timeElapsed > 5) {
        tasks = tasks.slice(i);
        requestAnimationFrame(taskLoop);
        return;
      }

      try {
        tasks[i]();
      } catch (ex) {
        console.error(ex);
      }
    }

    queued = false;
  }

  return function enqueue(task) {
    tasks.push(task);

    if (!queued) {
      queued = true;
      requestAnimationFrame(taskLoop);
    }
  };
}());
