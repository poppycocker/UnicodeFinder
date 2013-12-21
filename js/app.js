$(function() {

	var QueryProcessor = (function() {
		var p = function() {};
		p.prototype = {
			getCodePoints: function(str) {
				var tmp = str.toLowerCase().replace('u+', '').replace('0x', ''),
					hex, i, ERR_CODE = -1,
					ar = [];

				// is Number or Unicode Codepoint ?
				if (tmp.match(/^([0-9]|[a-f])+$/)) {
					hex = +('0x' + tmp);
					ar.push(hex);
					ar.push(+tmp);
					ar.push(String.octet2Codepoint(hex));
					ar.push(String.octet2Codepoint(tmp));
				}
				// evaluate as UTF-8 String
				for (i = 0; i < str.length; i++) {
					ar.push(str.charCodeAt(i));
				}

				return ar.filter(function(v) {
					return (!isNaN(v) && v !== ERR_CODE && v <= 0x1fffff);
				}).uniq();
			}
		};
		return p;
	})();

	var AppView = Backbone.View.extend({
		el: '#wrapper',
		initialize: function() {
			var collection = new ResultCollection();
			this.resultView = new ResultView({
				collection: collection
			});
			this.searchView = new SearchView({
				collection: collection
			});
		},
	});

	var SearchView = Backbone.View.extend({
		el: '.search_box',
		events: {
			'keyup .input_query': 'onSearch',
			'click .icon-clear': 'clearField'
		},
		initialize: function() {
			_.bindAll(this, 'onSearch', 'setCP', 'removeAll', 'clearField');
			this.queryProcessor = new QueryProcessor();
			this.$input = $('.input_query').val('U+3042').focus().select();
			this.onSearch();
		},
		onSearch: function(e) {
			var key = this.$input.val();
			if (key === this.prev) {
				return;
			}
			this.prev = key;
			this.removeAll();
			this.queryProcessor.getCodePoints(key).forEach(_.bind(function(n) {
				this.setCP(n);
			}, this));
		},
		setCP: function(cp) {
			var octet = String.codepoint2Octet(cp);
			this.collection.add(new ResultUnitModel({
				codePoint: cp.toString(16).toUpperCase().zeroPadding(4),
				cpDec: cp.toString(10),
				hex: octet.toString(16).toUpperCase().zeroPadding('even'),
				dec: octet.toString(10),
				character: String.fromCharCodeEx(cp),
				iso8859: String.getISO8859NFromUnicode(cp),
				name: String.getUnicodeName(cp)
			}));
		},
		removeAll: function() {
			this.collection.clearAll();
		},
		clearField: function() {
			this.$input.val('').focus();
			this.removeAll();
		}
	});

	var ResultView = Backbone.View.extend({
		el: '.results',
		initialize: function() {
			_.bindAll(this, 'render');
			this.collection.bind('add', this.render);
		},
		render: function(model) {
			var view = new ResultUnitView({
				model: model
			});
			this.$el.append(view.render().$el);
			return this;
		}
	});

	var ResultUnitView = Backbone.View.extend({
		tagName: 'li',
		initialize: function() {
			_.bindAll(this, 'render', 'remove');
			this.template = _.template($('#tmpl_result').html());
			this.model.bind('destroy', this.remove);
		},
		render: function() {
			this.$el.html(this.template(this.model.attributes)).addClass('clearfix');
			return this;
		}
	});
	var ResultUnitModel = Backbone.Model.extend({
		defaults: function() {
			return {
				codePoint: '',
				cpDec: '',
				hex: '',
				dec: '',
				character: ''
			};
		}
	});
	var ResultCollection = Backbone.Collection.extend({
		clearAll: function() {
			var model;
			while (model = this.first()) {
				model.destroy();
			}
		}
	});

	window.app = new AppView();
});