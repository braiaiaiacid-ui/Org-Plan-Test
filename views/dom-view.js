(function(root) {
  var app = root.OrgPlanner = root.OrgPlanner || {};
  app.Views = app.Views || {};

  app.Views.createDomView = function(documentRef) {
    return {
      element: function(id) {
        return documentRef.getElementById(id);
      },
      html: function(id, value) {
        this.element(id).innerHTML = value;
      },
      text: function(id, value) {
        this.element(id).textContent = value;
      },
      value: function(id, value) {
        this.element(id).value = value;
      },
      hidden: function(id, value) {
        this.element(id).hidden = value;
      }
    };
  };
})(window);
