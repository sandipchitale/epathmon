(function(){
  const electron = require('electron');
  const process = require('process');
  const spawn = require('child_process').spawn;
  const remote = electron.remote;
  const fileSystem = require('fs');
  const path = require('path');
  const dialog = remote.dialog;

  // Utility
  const isFile = function(path) {
    try {
      return fileSystem.statSync(path) && fileSystem.statSync(path).isFile()
    } catch (e) {
      return false;
    }
  }

  const isDirectory = function(path) {
    try {
      return fileSystem.statSync(path) && fileSystem.statSync(path).isDirectory()
    } catch (e) {
      return false;
    }
  }

  angular
  .module('EpathmonApp', [])
  .controller('EpathmonCtrl', ['$scope', '$window', '$log', function($scope, $window, $log){
    var vm = this, handleExe;

    handleExe = path.join(__dirname, '..', 'app.asar.unpacked', 'js', 'handle.exe');
    if (!isFile(handleExe)) {
      handleExe =  path.join(__dirname, 'js', 'handle.exe');
    }

    vm.wait = false;

    vm.path = '';
    vm.handles = [];

    vm.orderByPath = function(handle) {
      return parseInt(handle.pid);
    }

    vm.killProcess = function(PID) {
      if (angular.isString(PID)) {
        PID = parseInt(PID);
      }
      if (angular.isNumber(PID)) {
        if ($window.confirm('Kill process: ' + PID)) {
          $log.info('Killing process: ' + PID);
          const kp = (process.platform === 'win32') ?
            spawn('taskkill', ['/F', '/PID', '' + PID]) : spawn('kill', ['-9', '' + PID]);
          kp.stdout.on('data', function(output) {
            $log.debug(String.fromCharCode.apply(null, output));
          });

          kp.stderr.on('data', (err) => {
            $log.debug(err);
          });

          kp.on('close', (code) => {
            $log.debug('Exit code: ' + code);
            netstat();
          });
        }
      }
    }

    vm.browse = function() {
      dialog.showOpenDialog({
        title: 'Select path to monitor',
        properties: [
          'openDirectory'
        ]
      }, function (fileNames) {
        $scope.$apply(function() {
          if (angular.isArray(fileNames) && fileNames.length === 1) {
            vm.path = fileNames[0];
            handle();
          }
        });
      });
    }

    vm.deletePath = function(index) {
      vm.paths.splice(index, 1);
    }

    const parser = new RegExp('(.*)\\s+pid: (\\d+)\\s+type: File\\s+[^:]+: (.*)', 'g');
    function handle() {
      if (isFile(vm.path) || isDirectory(vm.path))
      {
        var pathLines = '';

        vm.wait = true;
        vm.handles = [];

        const h = (process.platform === 'win32') ?
                spawn(handleExe, ['-accepteula', vm.path]) : spawn('fuser', [vm.path]);
        h.stdout.on('data', function(pls) {
          pathLines += String.fromCharCode.apply(null, pls).substring(1);
        });

        h.stderr.on('data', (err) => {
          $log.error(err);
        });

        h.on('close', (code) => {
          vm.wait = false;
          pathLines = pathLines.split(/\r\n/);
          if (pathLines.length > 5) {
            pathLines.splice(0, 5);
          }
          if (pathLines.length > 1) {
            $scope.$apply(function() {
              var groups;
              var seenPIDs = [];

              angular.forEach(pathLines, function(pathLine){
                if (pathLine !== '') {
                  groups = parser.exec(pathLine);
                  if (angular.isArray(groups) && groups.length === 4) {
                    if (seenPIDs.indexOf(groups[2]) === -1) {
                      seenPIDs.push(groups[2]);
                      vm.handles.push({
                        'pid': groups[2],
                        'process': groups[1]
                      });
                    }
                  }
                }
              })
            });
          }
        });
      } else {
        if (vm.path === '') {
          vm.handles = [];
        }
      }
    }
    vm.handle = handle;

    vm.quit = function() {
      remote.getCurrentWindow().close();
    };
  }]);
})();
