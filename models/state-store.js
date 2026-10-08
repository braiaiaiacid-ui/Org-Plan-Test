(function(root) {
  var app = root.OrgPlanner = root.OrgPlanner || {};
  app.Models = app.Models || {};

  app.Models.createStateStore = function(key) {
    return {
      readRaw: function() {
        try {
          return root.localStorage.getItem(key);
        } catch (error) {
          return null;
        }
      },
      read: function() {
        try {
          var value = root.localStorage.getItem(key);
          return value ? JSON.parse(value) : null;
        } catch (error) {
          return null;
        }
      },
      writeRaw: function(value) {
        try {
          root.localStorage.setItem(key, value);
        } catch (error) {}
      },
      write: function(state) {
        try {
          root.localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {}
      },
      remove: function() {
        try {
          root.localStorage.removeItem(key);
        } catch (error) {}
      }
    };
  };
})(window);
